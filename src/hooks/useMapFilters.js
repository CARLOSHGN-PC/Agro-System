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
    fazenda: "",
    variedade: "",
    corte: "",
    talhao: ""
  });

  // O 'appliedFilters' é o estado que realmente ativa a mudança na view do mapa.
  const [appliedFilters, setAppliedFilters] = useState({
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
    if (!geoJsonData || !geoJsonData.features) return { fazendas: [], variedades: [], cortes: [], talhoes: [] };

    const fazendasSet = new Set();
    const variedadesSet = new Set();
    const cortesSet = new Set();
    const talhoesSet = new Set();

    geoJsonData.features.forEach(f => {
      const p = f.properties || {};
      const fazendaName = getFazendaName(p);
      const variedade = p.VARIEDADE ? String(p.VARIEDADE).trim() : "";
      const corte = p.ECORTE ? String(p.ECORTE).trim() : "";
      const talhao = p.TALHAO ? String(p.TALHAO).trim() : "";

      let matchesFazenda = true;
      let matchesVariedade = true;
      let matchesCorte = true;

      // Restringe as opções dependendo das seleções de nível superior já preenchidas no "draft" (filters)
      if (filters.fazenda && filters.fazenda !== "all" && fazendaName !== filters.fazenda) matchesFazenda = false;
      if (filters.variedade && filters.variedade !== "all" && variedade !== filters.variedade) matchesVariedade = false;
      if (filters.corte && filters.corte !== "all" && corte !== filters.corte) matchesCorte = false;

      if (fazendaName) fazendasSet.add(fazendaName);
      if (variedade && matchesFazenda) variedadesSet.add(variedade);
      if (corte && matchesFazenda && matchesVariedade) cortesSet.add(corte);
      if (talhao && matchesFazenda && matchesVariedade && matchesCorte) talhoesSet.add(talhao);
    });

    return {
      fazendas: Array.from(fazendasSet).sort(naturalSort),
      variedades: Array.from(variedadesSet).sort(naturalSort),
      cortes: Array.from(cortesSet).sort(naturalSort),
      talhoes: Array.from(talhoesSet).sort(naturalSort),
    };
  }, [geoJsonData, filters.fazenda, filters.variedade, filters.corte]);

  /**
   * Constrói uma nova versão do GeoJSON apenas com as features (polígonos)
   * que passam nos 'appliedFilters'. E também injeta flags lógicas `_is_estimated`.
   */
  const enhancedGeoJson = useMemo(() => {
    if (!geoJsonData) return null;

    const filteredFeatures = geoJsonData.features.filter(feature => {
      const p = feature.properties || {};
      const fazendaName = getFazendaName(p);

      if (appliedFilters.fazenda && fazendaName !== appliedFilters.fazenda) return false;
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
