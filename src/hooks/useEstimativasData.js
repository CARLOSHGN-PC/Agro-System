import { useState, useEffect } from "react";
import { fetchLatestGeoJson } from "../services/storage";
import { saveEstimate, getEstimate, getEstimateHistory, getAllEstimates } from "../services/estimativa";
import { showError, showSuccess } from "../utils/alert";
import { parseBrazilianFloat } from "../utils/formatters";
import { getFazendaName, getUniqueTalhaoId } from "../utils/geoHelpers";

/**
 * useEstimativasData.js
 *
 * O que este bloco faz:
 * Hook global que gerencia todo o ciclo de vida dos dados pesados do módulo
 * "Estimativa Safra". Carrega o shapefile, carrega do Firestore os relatórios de talhões,
 * submete novas requisições de salvar/reestimar e trata a gestão de estado do formulário de estimativa.
 *
 * Por que ele existe:
 * Funções longas com chamadas assíncronas ao Firebase poluíam severamente a renderização da UI no componente raiz.
 * Ter essa camada puramente de "Data Fetching e Manipulation" cria uma arquitetura baseada em MVC
 * (Sendo este o Controller/Model).
 *
 * O que entra e o que sai:
 * @param {string} currentCompanyId - O ID da empresa do tenant logado.
 * @param {string} currentSafra - A string da safra atual em contexto (ex: "2026/2027").
 * @param {Function} setActiveModule - Roteador global para ir pra tela de config se o mapa não existir.
 */
export function useEstimativasData(currentCompanyId, currentSafra, setActiveModule) {
  // Dados brutos
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [allEstimates, setAllEstimates] = useState([]);

  // Modais de histórico e Form de Salvamento
  const [currentEstimate, setCurrentEstimate] = useState(null);
  const [estimateHistory, setEstimateHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [estimateOpen, setEstimateOpen] = useState(false);

  const [formEstimativa, setFormEstimativa] = useState({ area: "", tch: "", toneladas: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingEstimate, setIsLoadingEstimate] = useState(false);

  // Escopo de estimativa: pode ser 1 talhão, todos selecionados, ou a fazenda inteira
  const [scope, setScope] = useState("talhao");

  /**
   * Dispara o pull de tudo que precisamos ao montar a aplicação:
   * 1. O ultimo GeoJson convertido do Storage.
   * 2. Todas as estimativas do Firestore atreladas àquela safra.
   */
  const loadInitialData = async () => {
    const [resMap, resEst] = await Promise.all([
      fetchLatestGeoJson(currentCompanyId),
      getAllEstimates(currentCompanyId, currentSafra)
    ]);

    if (resMap.error) {
      showError("Erro ao carregar mapa", resMap.error);
    } else if (resMap.data) {
      const featuresWithIds = resMap.data.features.map((f, i) => ({
        ...f,
        id: i,
        properties: { ...f.properties, featureId: i }
      }));
      setGeoJsonData({ ...resMap.data, features: featuresWithIds });
    } else {
      setActiveModule("configuracao");
    }

    if (resEst.success) {
      setAllEstimates(resEst.data);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [currentCompanyId, currentSafra]);

  /**
   * Recarrega manualemente a lista de estimativas global após algo ser salvo.
   */
  const refetchEstimates = async () => {
    const res = await getAllEstimates(currentCompanyId, currentSafra);
    if (res.success) setAllEstimates(res.data);
  };

  /**
   * Carrega os dados persistidos de um Talhão para preencher a UI do Form.
   */
  const loadEstimateData = async (feature) => {
    if (!feature || !feature.properties) return;
    setIsLoadingEstimate(true);
    setCurrentEstimate(null);
    setEstimateHistory([]);

    const uniqueTalhaoId = getUniqueTalhaoId(feature);

    setFormEstimativa({
      area: feature.properties.AREA ? String(feature.properties.AREA) : "",
      tch: "",
      toneladas: ""
    });

    try {
      const res = await getEstimate(currentCompanyId, currentSafra, uniqueTalhaoId);
      if (res.success && res.data) {
        setCurrentEstimate(res.data);
        setFormEstimativa({
          area: res.data.area || feature.properties.AREA || "",
          tch: res.data.tch || "",
          toneladas: res.data.toneladas || ""
        });
      }
    } catch (err) {
      console.error("Failed to load estimate", err);
    } finally {
      setIsLoadingEstimate(false);
    }
  };

  /**
   * Carrega o painel histórico do talhão atualmente selecionado.
   */
  const openHistory = async (selectedTalhao) => {
    if (!selectedTalhao) return;
    setHistoryOpen(true);
    const uniqueTalhaoId = getUniqueTalhaoId(selectedTalhao);
    const res = await getEstimateHistory(currentCompanyId, currentSafra, uniqueTalhaoId);
    if (res.success) {
      setEstimateHistory(res.data);
    }
  };

  /**
   * Função pesada de submissão do formulário. Faz o upload das estimativas para o Firestore.
   * Lida com o processamento de múltiplos talhões simultaneamente via Promise.all
   */
  const submitEstimate = async (selectedTalhoes, selectedTalhao, enhancedGeoJson) => {
    if (!formEstimativa.tch || parseBrazilianFloat(formEstimativa.tch) <= 0) {
      showError("Atenção", "O TCH (Toneladas de Cana por Hectare) é obrigatório e deve ser maior que zero.");
      return { success: false };
    }

    setIsSaving(true);
    let successCount = 0;

    try {
      const talhoesToSave = [];
      if (scope === "talhao" && selectedTalhao) {
        talhoesToSave.push(selectedTalhao);
      } else if (scope === "selecionados" && selectedTalhoes.length > 0) {
        selectedTalhoes.forEach(id => {
          const feat = enhancedGeoJson.features.find(f => f.id === id);
          if (feat) talhoesToSave.push(feat);
        });
      } else if (scope === "filtro" && enhancedGeoJson) {
        talhoesToSave.push(...enhancedGeoJson.features);
      } else if (scope === "fazenda" && geoJsonData) {
        let referenceFazenda = "";
        let referenceFundo = "";
        if (selectedTalhao && selectedTalhao.properties) {
          referenceFazenda = selectedTalhao.properties.FAZENDA || "";
          referenceFundo = selectedTalhao.properties.FUNDO_AGR || "";
        } else if (selectedTalhoes.length > 0) {
          const firstSelected = geoJsonData.features.find(f => f.id === selectedTalhoes[0]);
          if (firstSelected && firstSelected.properties) {
            referenceFazenda = firstSelected.properties.FAZENDA || "";
            referenceFundo = firstSelected.properties.FUNDO_AGR || "";
          }
        }

        if (referenceFazenda) {
          const farmFeatures = geoJsonData.features.filter(feat => {
             const featFaz = feat.properties.FAZENDA || "";
             const featFundo = feat.properties.FUNDO_AGR || "";
             return featFaz === referenceFazenda && featFundo === referenceFundo;
          });
          talhoesToSave.push(...farmFeatures);
        } else {
          talhoesToSave.push(...geoJsonData.features);
        }
      }

      await Promise.all(talhoesToSave.map(async (feat) => {
        const uniqueTalhaoId = getUniqueTalhaoId(feat);
        let areaToSave;
        let toneladasToSave;

        if (talhoesToSave.length === 1) {
          // Edição limpa do form (1 pra 1)
          areaToSave = formEstimativa.area;
          toneladasToSave = formEstimativa.toneladas;
        } else {
          // Múltiplos calculam usando a área unitária
          const indvArea = parseBrazilianFloat(feat.properties.AREA);
          const tchToUse = parseBrazilianFloat(formEstimativa.tch);
          const indvToneladas = indvArea * tchToUse;

          areaToSave = indvArea.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          toneladasToSave = indvToneladas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }

        const res = await saveEstimate(currentCompanyId, currentSafra, uniqueTalhaoId, {
          fundo_agricola: feat.properties.FUNDO_AGR || "N/A",
          fazenda: feat.properties.FAZENDA || "N/A",
          variedade: feat.properties.VARIEDADE || "N/A",
          area: areaToSave,
          tch: formEstimativa.tch,
          toneladas: toneladasToSave,
          responsavel: "Carlos" // Mock user name
        });
        if (res.success) successCount++;
      }));

      showSuccess("Sucesso!", `Estimativa salva com sucesso para ${successCount} talhões!`);
      setEstimateOpen(false);

      return { success: true, scope: scope };
    } catch (err) {
      if (err.message && (err.message.includes("permission") || err.message.includes("Missing or insufficient permissions"))) {
        showError("Acesso Negado", "Erro de permissão no Firebase. As regras de Firestore bloqueiam o acesso.");
      } else {
        showError("Erro", "Erro ao salvar estimativa: " + err.message);
      }
      return { success: false };
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Efeito dependente que calcula as Toneladas em tempo real sempre que TCH ou a Área mudar no form.
   */
  useEffect(() => {
    const area = parseBrazilianFloat(formEstimativa.area);
    const tch = parseBrazilianFloat(formEstimativa.tch);

    if (area > 0 && tch > 0) {
      const toneladasVal = area * tch;
      const toneladasFormatted = toneladasVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (formEstimativa.toneladas !== toneladasFormatted) {
        setFormEstimativa(prev => ({ ...prev, toneladas: toneladasFormatted }));
      }
    } else if (formEstimativa.toneladas !== "") {
      setFormEstimativa(prev => ({ ...prev, toneladas: "" }));
    }
  }, [formEstimativa.area, formEstimativa.tch]);

  /**
   * Efeito dependente para recalcular a Área total caso o usuário troque o Escopo (Scope) de edição.
   */
  const updateFormAreaFromScope = (selectedTalhao, selectedTalhoes, enhancedGeoJson) => {
    if (!estimateOpen) return;
    let totalArea = 0;

    if (scope === "talhao" && selectedTalhao) {
      totalArea = parseBrazilianFloat(selectedTalhao.properties?.AREA);
    } else if (scope === "selecionados") {
      selectedTalhoes.forEach(id => {
        const feat = enhancedGeoJson?.features?.find(f => f.id === id);
        if (feat) totalArea += parseBrazilianFloat(feat.properties?.AREA);
      });
    } else if (scope === "filtro" && enhancedGeoJson) {
      enhancedGeoJson.features.forEach(feat => {
        totalArea += parseBrazilianFloat(feat.properties?.AREA);
      });
    } else if (scope === "fazenda" && geoJsonData) {
      let referenceFazenda = "";
      let referenceFundo = "";
      if (selectedTalhao && selectedTalhao.properties) {
        referenceFazenda = selectedTalhao.properties.FAZENDA || "";
        referenceFundo = selectedTalhao.properties.FUNDO_AGR || "";
      } else if (selectedTalhoes.length > 0) {
        const firstSelected = geoJsonData.features.find(f => f.id === selectedTalhoes[0]);
        if (firstSelected && firstSelected.properties) {
          referenceFazenda = firstSelected.properties.FAZENDA || "";
          referenceFundo = firstSelected.properties.FUNDO_AGR || "";
        }
      }
      geoJsonData.features.forEach(feat => {
        const featFaz = feat.properties.FAZENDA || "";
        const featFundo = feat.properties.FUNDO_AGR || "";
        if (referenceFazenda) {
           if (featFaz === referenceFazenda && featFundo === referenceFundo) {
              totalArea += parseBrazilianFloat(feat.properties?.AREA);
           }
        } else {
           totalArea += parseBrazilianFloat(feat.properties?.AREA);
        }
      });
    }

    setFormEstimativa(prev => ({ ...prev, area: totalArea ? totalArea.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "" }));
  };

  return {
    geoJsonData,
    setGeoJsonData,
    allEstimates,
    refetchEstimates,
    currentEstimate,
    estimateHistory,
    historyOpen,
    setHistoryOpen,
    estimateOpen,
    setEstimateOpen,
    formEstimativa,
    setFormEstimativa,
    isSaving,
    isLoadingEstimate,
    scope,
    setScope,
    loadEstimateData,
    openHistory,
    submitEstimate,
    updateFormAreaFromScope
  };
}
