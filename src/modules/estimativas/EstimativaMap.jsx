import React, { useEffect, useRef } from "react";
import Map, { Source, Layer } from "react-map-gl";
import * as turf from "@turf/turf";
import { palette } from "../../constants/theme";
import "mapbox-gl/dist/mapbox-gl.css";
import { useMemo } from "react";
import { ORDEM_CORTE_CORES } from "../../services/ordemCorte/ordemCorteConstants";

const MAPBOX_TOKEN = "pk.eyJ1IjoiY2FybG9zaGduIiwiYSI6ImNtZDk0bXVxeTA0MTcyam9sb2h1dDhxaG8ifQ.uf0av4a0WQ9sxM1RcFYT2w";

/**
 * EstimativaMap.jsx
 *
 * O que este bloco faz:
 * O container principal de renderização do WebGL Map via Mapbox. Configura o source,
 * as camadas (`layers`) de preenchimento, contorno e as labels, aplicando lógicas
 * de hover, seleção e colorização do GeoJSON de acordo com o `feature-state`.
 *
 * Por que ele existe:
 * Separar as configurações densas do mapbox (`mapStyle`, controle de estado dos polígonos,
 * cores calculadas em tempo real e handlers do click). Isso permite que ele seja inserido
 * limpo no container do módulo.
 *
 * O que entra e o que sai:
 * @param {Object} mapRef - Referência do componente pra chamar `fitBounds`.
 * @param {Object} enhancedGeoJson - Os polígonos filtrados a serem desenhados.
 * @param {Function} onMapClick - Listener que gerencia a seleção/deseleção de talhões.
 * @param {Function} setHoveredTalhao - Atualiza qual ID de feature o mouse está pairando.
 * @param {boolean} showLabels - Flag se deve desenhar as strings de nomes dos talhões.
 * @param {number|null} hoveredTalhao - ID da feature atual em hover.
 * @param {boolean} isMultiSelectMode - Define se o usuário clica em múltiplos (no estado atual, sempre true).
 * @param {Array} selectedTalhoes - Os ids que o react-map-gl precisa renderizar como ativos.
 * @param {Object} selectedTalhao - A info do ultimo talhão unico.
 * @returns {JSX.Element} Instância do mapbox `<Map>`.
 */
const EstimativaMap = React.memo(function EstimativaMap({
  mapRef,
  enhancedGeoJson,
  onMapClick,
  setHoveredTalhao,
  showLabels,
  hoveredTalhao,
  isMultiSelectMode,
  selectedTalhoes,
  selectedTalhao,
  idsAbertosSet = new Set(),
  idsOcultosSet = new Set(),
  activeMapModule = "estimativa"
}) {
  const previousGeoJsonBbox = useRef("");

  // Memoizamos os polígonos para excluir visualmente aqueles que estão com Ordem de Corte FECHADA
  // Essa é a maneira de "ocultar sem deletar do banco nem do source original".
  const visibleGeoJson = useMemo(() => {
    if (!enhancedGeoJson) return null;
    return {
      ...enhancedGeoJson,
      features: enhancedGeoJson.features.map(f => {
        // Clone features to avoid mutating the original data in useMemo
        return {
          ...f,
          properties: {
            ...f.properties,
            _is_closed_ordem: idsOcultosSet.has(f.id)
          }
        };
      }).filter(f => {
        const isEstimated = f.properties?._is_estimated;

        if (activeMapModule === "estimativa") {
            // Estimativa de Safra: Mostra tudo
            return true;
        } else if (activeMapModule === "ordemCorte") {
            // Ordem de Corte: Mostra os estimados e OS FECHADOS, mas o que for fechado ficará vermelho (pintado via mapbox paint)
            // Se eu não renderizar os fechados, não tem como eles ficarem vermelhos na view do 'Ordem de Corte'
            // O usuário pediu: "deixar de vermelho quando fechar nao precisa sumir" no módulo ordem de corte
            // Mas também disse: "se aparece fechado tem que ir no outro modulo"
            // Entendemos que eles ficam visíveis mas coloridos diferentemente em ordemCorte
            return isEstimated;
        } else if (activeMapModule === "tratosCulturais") {
            // Tratos Culturais: Mostra APENAS os talhões que já tiveram a ordem de corte fechada
            return f.properties._is_closed_ordem;
        }
        return true;
      })
    };
  }, [enhancedGeoJson, idsOcultosSet, activeMapModule]);

  // Realiza o zoom adaptativo APENAS quando os polígonos filtrados mudam,
  // e não quando eles mudam de cor (propriedades).
  useEffect(() => {
    if (enhancedGeoJson && enhancedGeoJson.features.length > 0 && mapRef.current) {
      try {
        const [minLng, minLat, maxLng, maxLat] = turf.bbox(enhancedGeoJson);
        const bboxString = `${minLng},${minLat},${maxLng},${maxLat}`;
        if (bboxString !== previousGeoJsonBbox.current) {
          previousGeoJsonBbox.current = bboxString;
          mapRef.current.fitBounds(
            [[minLng, minLat], [maxLng, maxLat]],
            { padding: 40, duration: 1000 }
          );
        }
      } catch (err) {
        console.error("Error calculating bounds from enhancedGeoJson:", err);
      }
    }
  }, [enhancedGeoJson, mapRef]);

  // Atualiza manualmente os 'featureStates' no Mapbox nativo para lidar com hover e select visual
  useEffect(() => {
    if (!mapRef.current || !enhancedGeoJson) return;
    const map = mapRef.current.getMap();

    // Aguarda o Mapbox carregar a `source` antes de despachar eventos
    if (!map.getSource('talhoes')) return;

    // Reseta todos os estados pra falso antes de redesenhar os correntes
    enhancedGeoJson.features.forEach(f => {
      map.setFeatureState({ source: 'talhoes', id: f.id }, { hover: false, selected: false });
    });

    if (hoveredTalhao !== null) {
      map.setFeatureState({ source: 'talhoes', id: hoveredTalhao }, { hover: true });
    }

    if (isMultiSelectMode) {
      selectedTalhoes.forEach(id => {
        map.setFeatureState({ source: 'talhoes', id }, { selected: true });
      });
    } else if (selectedTalhao && selectedTalhao.id !== undefined) {
      map.setFeatureState({ source: 'talhoes', id: selectedTalhao.id }, { selected: true });
    }
  }, [hoveredTalhao, selectedTalhao, selectedTalhoes, isMultiSelectMode, enhancedGeoJson, mapRef]);

  return (
    <div className="absolute inset-0 w-full h-full" style={{ filter: "saturate(0.95) contrast(1.02) brightness(0.88)" }}>
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          longitude: -49.35,
          latitude: -18.25,
          zoom: 8.4
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/satellite-v9"
        attributionControl={false}
        onClick={onMapClick}
        interactiveLayerIds={['talhoes-fill']}
        onMouseMove={(e) => {
          if (e.features && e.features.length > 0) {
            setHoveredTalhao(e.features[0].id);
          } else {
            setHoveredTalhao(null);
          }
        }}
        onMouseLeave={() => setHoveredTalhao(null)}
      >
        {visibleGeoJson && (
          <Source id="talhoes" type="geojson" data={visibleGeoJson}>
            <Layer
              id="talhoes-fill"
              type="fill"
              paint={{
                "fill-color": [
                  "case",
                  ["boolean", ["feature-state", "selected"], false],
                  "#ffbf00", // Bright yellow marking color for selected talhoes
                  ["boolean", ["feature-state", "hover"], false],
                  palette.goldLight,
                  // Injeção da Ordem de Corte (Se a chave _has_open_ordem for true -> Pinta de Azul)
                  // Se for ordem fechada e estiver no módulo de Ordem de Corte, fica Vermelho
                  // Se for ordem fechada e estiver em Tratos Culturais, fica Cinza Neutro (o usuário pediu "cor neutra")
                  // Se for ordem fechada e estiver em Estimativa Safra, mantém a cor de estimativa normal
                  ["all", ["==", activeMapModule, "ordemCorte"], ["boolean", ["get", "_is_closed_ordem"], false]],
                  "#ff0000", // Vermelho para fechado no Ordem de Corte

                  ["all", ["==", activeMapModule, "tratosCulturais"], ["boolean", ["get", "_is_closed_ordem"], false]],
                  "#808080", // Cor neutra (cinza) para fechado em Tratos Culturais

                  ["boolean", ["get", "_has_open_ordem"], false],
                  ORDEM_CORTE_CORES.AZUL_ABERTA,

                  // Se for ordem de corte, mas a ordem não está aberta nem fechada, fica cinza (sem cor de corte, como pedido)
                  ["all", ["==", activeMapModule, "ordemCorte"], ["boolean", ["get", "_is_estimated"], false]],
                  "#808080", // Cor neutra para talhões que podem abrir ordem mas não abriram

                  ["boolean", ["get", "_is_estimated"], false],
                  [
                    "match",
                    ["get", "_normalized_ecorte"],
                    "1º corte", "#ff0000",
                    "2º corte", "#00ff00",
                    "3º corte", "#ffe600",
                    "4º corte", "#01206e",
                    "5º corte", "#ff6a00",
                    "6º corte", "#9500ff",
                    "7º corte", "#00d0ff",
                    "8º corte", "#ea00ff",
                    "9º corte", "#b3ff00",
                    "10º corte", "#ff005d",
                    "11º corte", "#00ffff",
                    "#6e6e6e" // Default fallback color
                  ],
                  "transparent" // Polígonos sem estimativa continuam invisíveis
                ],
                "fill-opacity": [
                  "case",
                  ["boolean", ["feature-state", "selected"], false],
                  1.0,
                  ["boolean", ["feature-state", "hover"], false],
                  0.95,
                  ["boolean", ["get", "_is_estimated"], false],
                  0.85,
                  0
                ]
              }}
            />
            <Layer
              id="talhoes-outline"
              type="line"
              paint={{
                "line-color": [
                  "case",
                  ["boolean", ["feature-state", "selected"], false],
                  "#000000",
                  palette.white
                ],
                "line-opacity": [
                  "case",
                  ["boolean", ["feature-state", "selected"], false],
                  1.0,
                  0.5
                ],
                "line-width": [
                  "case",
                  ["boolean", ["feature-state", "selected"], false],
                  6, // Highlight thickness
                  1.5
                ]
              }}
            />
            {showLabels && (
              <Layer
                id="talhoes-labels"
                type="symbol"
                minzoom={13} // OTIMIZAÇÃO: Mostra apenas quando tiver zoom adequado para não fritar CPU e não poluir
                layout={{
                  "text-field": ["get", "TALHAO"],
                  "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
                  "text-size": 12,
                  "text-anchor": "center",
                  "text-allow-overlap": false
                }}
                paint={{
                  "text-color": "#ffffff",
                  "text-halo-color": "#000000",
                  "text-halo-width": 1.5
                }}
              />
            )}
          </Source>
        )}
      </Map>
    </div>
  );
});

export default EstimativaMap;
