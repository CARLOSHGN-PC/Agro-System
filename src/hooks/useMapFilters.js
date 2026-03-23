import { useState, useMemo, useEffect } from "react";
import { getFazendaName, getUniqueTalhaoId } from "../utils/geoHelpers";
import { normalizeCorte, naturalSort } from "../utils/formatters";

/**
 * useMapFilters.js
 *
 * O que este bloco faz:
 * Gerencia os filtros atuais, deriva as opções de dropdown com base no mapa (GeoJSON),
 * aplica esses filtros retornando um `enhancedGeoJson` que contém metadados
 * e apenas os features compatíveis, e lida com o estado UI do modal de filtro.
 *
 * Por que ele existe:
 * O cálculo de quais features estão ativas e as dependências em cascata dos
 * dropdowns (ex: mudar a fazenda muda as variedades disponíveis) é uma das partes
 * mais complexas do sistema e precisa rodar rápido (via `useMemo`) sem
 * poluir os eventos visuais.
 *
 * @param {Object} geoJsonData - O objeto GeoJSON cru vindo do Firebase Storage.
 * @param {Array} allEstimates - O array de estimativas atuais vindas do Firestore.
 * @returns {Object} Estado, opções calculadas, setters e métodos de manipulação de filtro.
 */
export function useMapFilters(geoJsonData, allEstimates) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  // O estado 'filters' armazena o estado "draft" dentro do modal.
  const [filters, setFilters] = useState({
    frente: "",
    fazenda: "",
    variedade: "",
    corte: "",
    talhao: ""
  });

  // O 'appliedFilters' é o estado que realmente ativa a mudança na view do mapa.
  const [appliedFilters, setAppliedFilters] = useState({
    frente: "",
    fazenda: "",
    variedade: "",
    corte: "",
    talhao: ""
  });

  /**
   * Deriva opções ativas para os "selects" de forma encadeada.
   * Se a 'Fazenda' for escolhida, só as 'Variedades' daquela fazenda entram na lista, etc.
   */
  const filterOptions = useMemo(() => {
    if (!geoJsonData || !geoJsonData.features) return { frentes: [], fazendas: [], variedades: [], cortes: [], talhoes: [] };

    const frentesSet = new Set();
    const fazendasSet = new Set();
    const variedadesSet = new Set();
    const cortesSet = new Set();
    const talhoesSet = new Set();

    geoJsonData.features.forEach(f => {
      const p = f.properties || {};
      const frente = p.FRENTE ? String(p.FRENTE).trim() : "";
      const fazendaName = getFazendaName(p);
      const variedade = p.VARIEDADE ? String(p.VARIEDADE).trim() : "";
      const corte = p.ECORTE ? String(p.ECORTE).trim() : "";
      const talhao = p.TALHAO ? String(p.TALHAO).trim() : "";

      // 1. A Fazenda é o nível mais alto. Ela sempre aparece (mas talvez filtrada por outras coisas no futuro, se quisermos).
      // Por enquanto, mostra todas as fazendas disponíveis no mapa.
      if (fazendaName) fazendasSet.add(fazendaName);

      // 2. A Frente de Serviço é o segundo nível. Só mostra frentes que PERTENCEM à fazenda selecionada.
      const matchesFazenda = !filters.fazenda || filters.fazenda === "all" || fazendaName === filters.fazenda;
      if (frente && matchesFazenda) {
         frentesSet.add(frente);
      }

      // 3. A Variedade é o terceiro nível. Só mostra variedades que pertencem à frente e fazenda selecionadas.
      const matchesFrente = !filters.frente || filters.frente === "all" || frente === filters.frente;
      if (variedade && matchesFazenda && matchesFrente) {
         variedadesSet.add(variedade);
      }

      // 4. O Corte (Estágio) é o quarto nível.
      const matchesVariedade = !filters.variedade || filters.variedade === "all" || variedade === filters.variedade;
      if (corte && matchesFazenda && matchesFrente && matchesVariedade) {
         cortesSet.add(corte);
      }

      // 5. O Talhão é o quinto nível.
      const matchesCorte = !filters.corte || filters.corte === "all" || corte === filters.corte;
      if (talhao && matchesFazenda && matchesFrente && matchesVariedade && matchesCorte) {
         talhoesSet.add(talhao);
      }
    });

    return {
      frentes: Array.from(frentesSet).sort(naturalSort),
      fazendas: Array.from(fazendasSet).sort(naturalSort),
      variedades: Array.from(variedadesSet).sort(naturalSort),
      cortes: Array.from(cortesSet).sort(naturalSort),
      talhoes: Array.from(talhoesSet).sort(naturalSort),
    };
  }, [geoJsonData, filters.frente, filters.fazenda, filters.variedade, filters.corte]);

  /**
   * Constrói uma nova versão do GeoJSON apenas com as features (polígonos)
   * que passam nos 'appliedFilters'. E também injeta flags lógicas `_is_estimated`.
   */
  // Ocultamos os IDs via visibleGeoJson lá na ponta (no Map), então aqui construimos o base com todos os properties necessários.
  // Para colorir com azul aberto, precisaremos do idsAbertosSet, que não mora aqui, mas como nós passamos o feature.id lá pro Map
  // também podemos injetar a property `_has_open_ordem` lá via Match do mapbox ou injetar aqui. No caso do Mapbox Match (no Map) é mais limpo.
  const enhancedGeoJson = useMemo(() => {
    if (!geoJsonData) return null;

    const filteredFeatures = geoJsonData.features.filter(feature => {
      const p = feature.properties || {};
      const fazendaName = getFazendaName(p);

      if (appliedFilters.fazenda && fazendaName !== appliedFilters.fazenda) return false;
      if (appliedFilters.frente && (!p.FRENTE || String(p.FRENTE).trim() !== appliedFilters.frente)) return false;
      if (appliedFilters.variedade && (!p.VARIEDADE || String(p.VARIEDADE).trim() !== appliedFilters.variedade)) return false;
      if (appliedFilters.corte && (!p.ECORTE || String(p.ECORTE).trim() !== appliedFilters.corte)) return false;
      if (appliedFilters.talhao && (!p.TALHAO || String(p.TALHAO).trim() !== appliedFilters.talhao)) return false;

      return true;
    });

    return {
      ...geoJsonData,
      features: filteredFeatures.map((feature) => {
        const normalizedCorte = normalizeCorte(feature.properties?.ECORTE);
        const uniqueTalhaoId = getUniqueTalhaoId(feature);
        const isEstimated = allEstimates.some(est => est.talhaoId === uniqueTalhaoId);

        return {
          ...feature,
          properties: {
            ...feature.properties,
            _normalized_ecorte: normalizedCorte,
            _is_estimated: isEstimated
          }
        };
      })
    };
  }, [geoJsonData, appliedFilters, allEstimates]);

  return {
    filtersOpen, setFiltersOpen,
    filters, setFilters,
    appliedFilters, setAppliedFilters,
    filterOptions,
    enhancedGeoJson
  };
}
