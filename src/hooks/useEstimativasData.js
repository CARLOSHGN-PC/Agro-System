import { useState, useEffect } from "react";
import { fetchLatestGeoJson } from "../services/storage";
import { saveEstimate, getEstimate, getEstimateHistory, getAllEstimates, subscribeToEstimatesRealtime } from "../services/estimativa";
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
  // Configuração e Dados
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [allEstimates, setAllEstimates] = useState([]);
  const [currentRodada, setCurrentRodada] = useState("Rodada 1");
  const [availableRodadas, setAvailableRodadas] = useState(["Rodada 1"]);

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
    // Busca dados localmente primeiro para ser offline-first e instantâneo
    const [resMap, resEstAll] = await Promise.all([
      fetchLatestGeoJson(currentCompanyId),
      getAllEstimates(currentCompanyId, currentSafra, null)
    ]);

    if (resMap.error && resMap.source !== 'local_fallback') {
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

    if (resEstAll.success) {
       const allData = resEstAll.data;

       const distinctRodadas = new Set(["Rodada 1"]);
       allData.forEach(e => {
         if (e.rodada) distinctRodadas.add(e.rodada);
       });

       const arrRodadas = Array.from(distinctRodadas).sort((a,b) => {
         return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
       });

       setAvailableRodadas(arrRodadas);

       const highestRodada = arrRodadas[arrRodadas.length - 1];
       setCurrentRodada(highestRodada);

       const filtered = allData.filter(e => (e.rodada || "Rodada 1") === highestRodada);
       setAllEstimates(filtered);
    }
  };

  useEffect(() => {
    if (!currentCompanyId || !currentSafra) return;
    loadInitialData();

    // Inscreve no Firebase para ouvir atualizações em tempo real (cross-device sync).
    // Se o usuário salvar no celular, o Firestore será atualizado, o snapshot avisará,
    // o Dexie será atualizado em background e o `refetchEstimates` será chamado, repintando o mapa!
    const unsubscribeRealtime = subscribeToEstimatesRealtime(currentCompanyId, currentSafra, () => {
        // Usa uma flag temporária para evitar que a promisse polua algo se desmontar rápido
        refetchEstimates();
    });

    return () => {
        if (unsubscribeRealtime) unsubscribeRealtime();
    };
  }, [currentCompanyId, currentSafra]);

  // Listener para o evento global de sincronização completa
  useEffect(() => {
    const handleSyncCompleted = (e) => {
      // Quando a sincronização via background finaliza com sucesso:
      // O refetch global do mapa (allEstimates) não precisa mais ser
      // chamado aqui porque a camada do `onSnapshot` do Firebase já atualizará o Dexie
      // e chamará o refetch sozinho de forma reativa, impedindo o loop.
      // E para o histórico, evitamos disparar funções indefinidas.
      if (e.detail && e.detail.count > 0) {
        // Como o app já assina atualizações, não precisamos forçar fetch de histórico
        // ao reconectar internet para evitar refetch loops.
      }
    };
    window.addEventListener('sync-completed', handleSyncCompleted);
    return () => window.removeEventListener('sync-completed', handleSyncCompleted);
  }, []);

  // Efeito isolado para quando a `currentRodada` mudar. Ele esvazia a tela e busca as estimativas novas.
  useEffect(() => {
    if (!geoJsonData) return; // Se mapa não existe, não faz fetch da troca de rodada

    const fetchNovaRodada = async () => {
      const res = await getAllEstimates(currentCompanyId, currentSafra, currentRodada);
      if (res.success) {
        setAllEstimates(res.data);
      }
    };
    fetchNovaRodada();
  }, [currentRodada]);

  /**
   * Recarrega manualmente a lista de estimativas global da rodada atual após algo ser salvo.
   */
  const refetchEstimates = async () => {
    const res = await getAllEstimates(currentCompanyId, currentSafra, currentRodada);
    if (res.success) setAllEstimates(res.data);
  };

  /**
   * Cria uma nova rodada baseada no estado de rodadas disponíveis, e já seta ela como ativa,
   * limpando automaticamente o visual do mapa.
   */
  const createNewRodada = () => {
    const nextNumber = availableRodadas.length + 1;
    const newName = `Rodada ${nextNumber}`;
    setAvailableRodadas(prev => [...prev, newName]);
    setCurrentRodada(newName);
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
      // Quando preenche o modal, verifica se já existe estimate pra _esta_ rodada.
      // Se não, o form aparece vazio. Mas se quiser a ultima versão como preenchimento,
      // ele apenas puxará da atual que está sendo visualizada.
      const res = await getEstimate(currentCompanyId, currentSafra, uniqueTalhaoId, currentRodada);
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
    // O histórico a gente puxa de TODAS AS RODADAS da safra para a pessoa ter o controle geral no modal
    const res = await getEstimateHistory(currentCompanyId, currentSafra, uniqueTalhaoId, null);
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

      // Batch saving
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

        const payload = {
          fundo_agricola: feat.properties.FUNDO_AGR || "N/A",
          fazenda: feat.properties.FAZENDA || "N/A",
          variedade: feat.properties.VARIEDADE || "N/A",
          area: areaToSave,
          tch: formEstimativa.tch,
          toneladas: toneladasToSave,
          responsavel: "Carlos", // Mock user name
          rodada: currentRodada
        };

        // Agora isso retorna sucesso imediatamente, gravando localmente no Dexie!
        const res = await saveEstimate(currentCompanyId, currentSafra, uniqueTalhaoId, payload);
        if (res.success) successCount++;
      }));

      // Adicionamos uma verificação visual do modo offline
      if (!navigator.onLine) {
         showSuccess("Offline: Salvo localmente!", `A estimativa de ${successCount} talhões foi guardada e será sincronizada assim que você tiver internet.`);
      } else {
         showSuccess("Sucesso!", `Estimativa salva com sucesso para ${successCount} talhões!`);
      }

      setEstimateOpen(false);
      // AWAIT the refetch so that the state updates before we finish, ensuring React re-renders.
      await refetchEstimates();

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
    currentRodada,
    setCurrentRodada,
    availableRodadas,
    createNewRodada,
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
