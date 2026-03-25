import React, { useState } from "react";
import { ChevronDown, X, Pencil, History, Palette, PieChart, Layers } from "lucide-react";
import { palette } from "../../constants/theme";
import { parseBrazilianFloat } from "../../utils/formatters";

// Hook e Componente de Ordem de Corte injetados
import { selecionarVinculoDoTalhao } from "./utils/ordemCorteSelectors";
import { OrdemCorteActions } from "./components/OrdemCorteActions";

/**
 * EstimativaPanels.jsx
 *
 * O que este bloco faz:
 * Reúne todos os painéis flutuantes (Cards) que sobrepõem o mapa de estimativas.
 * Isso inclui: Título/Botão de Filtro (Superior Esquerdo), Info de Talhões Selecionados (Superior Direito),
 * Legenda de Cores (Inferior Esquerdo) e Resumo Numérico (Inferior Esquerdo).
 *
 * Por que ele existe:
 * O código HTML das estruturas flutuantes domina o JSX raiz, tornando sua leitura quase
 * impossível. Movendo-os pra cá e recebendo estados de summary/legend via props, limpamos a visualização.
 *
 * O que entra e o que sai:
 * @param {Object} props - Todas as lógicas e callbacks de estado do UI e GeoJSON para construir os painéis.
 * @returns {JSX.Element} Conjunto de divs absolutas de UI.
 */
export default function EstimativaPanels({
  activeMapModule,
  setActiveMapModule,
  currentRodada,
  setCurrentRodada,
  availableRodadas,
  createNewRodada,
  nextRodadaName,
  setFiltersOpen,
  selectedTalhoes,
  selectedTalhao,
  setSelectedTalhoes,
  setSelectedTalhao,
  enhancedGeoJson,
  isLoadingEstimate,
  currentEstimate,
  setScope,
  setEstimateOpen,
  openHistory,
  legendCollapsed,
  setLegendCollapsed,
  showLabels,
  setShowLabels,
  legendItems,
  summaryCollapsed,
  setSummaryCollapsed,
  summaryData,

  // Props de Ordem de Corte
  vinculosSafra = [],
  companyId = '',
  safra = ''
}) {
  const [infoCollapsed, setInfoCollapsed] = useState(false);

  // O que este bloco faz: Monitora a seleção de talhões. Em dispositivos mobile, se a seleção
  // aumenta (usuário clicou no mapa), o painel começa recolhido para não obstruir a tela,
  // permitindo que a pessoa veja a seleção que acabou de fazer e decida se quer abrir o painel.
  React.useEffect(() => {
    if (selectedTalhoes.length > 0 && window.innerWidth < 640) {
      setInfoCollapsed(true);
    } else if (selectedTalhoes.length === 0) {
      // Quando limpa a seleção, reseta o estado de colapso para a próxima vez que selecionar
      setInfoCollapsed(false);
    }
  }, [selectedTalhoes.length]);

  // O que este bloco faz: Calcula o vínculo ativo que vai ditar o botão de ABRIR ou FECHAR.
  // Se o usuário selecionou 1 ou múltiplos talhões, pegamos o vínculo do "último" clicado (ou do primeiro da lista)
  // para ditar qual Ordem estamos operando. Assim o botão "Fechar X talhões da Ordem" aparece corretamente
  // mesmo quando temos uma seleção múltipla no mapa.
  // Por que ele existe: Para não trancar a UI e permitir que o usuário feche 5 talhões de uma mesma Ordem de uma vez só.
  const vinculoAtivo = selectedTalhoes.length > 0 ? selecionarVinculoDoTalhao(selectedTalhoes[selectedTalhoes.length - 1], vinculosSafra) : null;

  // O que este bloco faz: Verifica se dentre os talhões selecionados no mapa, pelo menos UM não está estimado.
  // Por que ele existe: Porque as regras de negócio dizem que não se pode abrir uma Ordem de Corte para um talhão que não foi estimado naquela rodada.
  const hasUnestimatedTalhao = selectedTalhoes.some(id => {
      const feat = enhancedGeoJson?.features?.find(f => f.id === id);
      return feat && !feat.properties?._is_estimated;
  });

  return (
    <>
      {/* Título e Botão de Filtro - Top Left */}
      <div className="absolute top-4 left-4 right-4 sm:right-auto w-auto sm:w-[400px] rounded-[22px] border overflow-hidden z-10 shadow-[0_10px_30px_rgba(0,0,0,0.24)]" style={{ background: "rgba(17,24,39,0.88)", borderColor: "rgba(255,255,255,0.10)", backdropFilter: "blur(16px)" }}>
        <div className="p-4 flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="relative w-fit">
              <select
                  value={activeMapModule}
                  onChange={(e) => {
                     setActiveMapModule(e.target.value);
                     setSelectedTalhoes([]);
                     setSelectedTalhao(null);
                  }}
                  className="appearance-none outline-none cursor-pointer bg-transparent text-[18px] font-bold leading-tight pr-8 text-white w-full"
              >
                  <option value="estimativa" style={{ color: "black" }}>Estimativa Safra</option>
                  <option value="tratosCulturais" style={{ color: "black" }}>Tratos Culturais</option>
              </select>
              <ChevronDown className="w-5 h-5 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-white/70" />
            </div>

            {activeMapModule === "estimativa" && (
              <div className="mt-3 inline-flex items-center gap-2">
                <div className="relative">
                  <select
                    value={currentRodada}
                    onChange={(e) => {
                       if (e.target.value === "new") {
                          createNewRodada();
                       } else {
                          setCurrentRodada(e.target.value);
                       }
                    }}
                    className="rounded-full px-3 py-1 text-xs font-bold appearance-none outline-none pr-8 cursor-pointer"
                    style={{ background: "rgba(255,255,255,0.10)", color: "#dbe4ec" }}
                  >
                    {availableRodadas.map(r => (
                      <option key={r} value={r} style={{ color: "black" }}>{r}</option>
                    ))}
                    <option value="new" style={{ color: "black" }}>+ Nova {nextRodadaName}</option>
                  </select>
                  <ChevronDown className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#dbe4ec" }} />
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button className="w-11 h-11 rounded-xl flex items-center justify-center transition-colors hover:bg-white/10" style={{ background: "rgba(255,255,255,0.08)" }} onClick={() => setFiltersOpen(true)}>
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Painel de Info e Seleção - Top Right */}
      {selectedTalhoes.length > 0 && (
        <div className="absolute top-28 sm:top-4 left-4 sm:left-auto right-4 w-auto sm:w-[340px] rounded-3xl border overflow-hidden z-20 shadow-2xl flex flex-col" style={{ background: "rgba(23, 29, 43, 0.95)", borderColor: "rgba(255,255,255,0.08)", backdropFilter: "blur(16px)" }}>
          <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <div className="overflow-hidden flex-1 mr-3">
              <div className="text-[11px] uppercase font-bold tracking-[0.08em]" style={{ color: palette.text2 }}>
                {selectedTalhoes.length > 1 ? "TALHÕES" : "TALHÃO"}
              </div>
              <div className="text-[20px] font-bold mt-1 text-white truncate">
                {selectedTalhoes.length > 1 ? (
                   (() => {
                      const uniqueTalhoesNames = new Set();
                      selectedTalhoes.forEach(id => {
                        const feat = enhancedGeoJson?.features?.find(f => f.id === id);
                        if (feat && feat.properties?.TALHAO) uniqueTalhoesNames.add(feat.properties.TALHAO);
                      });
                      const namesArray = Array.from(uniqueTalhoesNames);
                      if (namesArray.length <= 3) return namesArray.join(", ");
                      return `${selectedTalhoes.length} Selecionados`;
                   })()
                ) : (selectedTalhao?.properties?.TALHAO || "N/A")}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors hover:bg-white/10" style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.12)", color: palette.text2 }} onClick={() => setInfoCollapsed(!infoCollapsed)}>
                {infoCollapsed ? "Expandir" : "Recolher"}
              </button>
              <button onClick={() => { setSelectedTalhoes([]); setInfoCollapsed(false); }} className="p-1.5 rounded-full hover:bg-white/10 transition-colors">
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>
          </div>

          {!infoCollapsed && (
            <div className="p-4 grid grid-cols-2 gap-3 overflow-y-auto max-h-[45vh] sm:max-h-[calc(100vh-200px)]">
              {[
                { label: "Fazenda", value: (() => {
                    if (selectedTalhoes.length <= 1) return selectedTalhao?.properties?.FAZENDA || "N/A";
                    const uniqueVals = new Set();
                    selectedTalhoes.forEach(id => {
                      const feat = enhancedGeoJson?.features?.find(f => f.id === id);
                      if (feat && feat.properties?.FAZENDA) uniqueVals.add(feat.properties.FAZENDA);
                    });
                    const vals = Array.from(uniqueVals);
                    if (vals.length === 1) return vals[0];
                    return vals.length > 2 ? `${vals[0]}, ${vals[1]}...` : vals.join(", ");
                })() },
                { label: "Variedade", value: (() => {
                    if (selectedTalhoes.length <= 1) return selectedTalhao?.properties?.VARIEDADE || "N/A";
                    const uniqueVals = new Set();
                    selectedTalhoes.forEach(id => {
                      const feat = enhancedGeoJson?.features?.find(f => f.id === id);
                      if (feat && feat.properties?.VARIEDADE) uniqueVals.add(feat.properties.VARIEDADE);
                    });
                    const vals = Array.from(uniqueVals);
                    if (vals.length === 1) return vals[0];
                    return vals.length > 2 ? `${vals[0]}, ${vals[1]}...` : vals.join(", ");
                })() },
                { label: "Estágio", value: (() => {
                    if (selectedTalhoes.length <= 1) return selectedTalhao?.properties?.ECORTE || "N/A";
                    const uniqueVals = new Set();
                    selectedTalhoes.forEach(id => {
                      const feat = enhancedGeoJson?.features?.find(f => f.id === id);
                      if (feat && feat.properties?.ECORTE) uniqueVals.add(feat.properties.ECORTE);
                    });
                    const vals = Array.from(uniqueVals);
                    if (vals.length === 1) return vals[0];
                    return vals.length > 2 ? `${vals[0]}, ${vals[1]}...` : vals.join(", ");
                })() },
                { label: "Área Total", value: (() => {
                    let totalArea = 0;
                    selectedTalhoes.forEach(id => {
                      const feat = enhancedGeoJson?.features?.find(f => f.id === id);
                      if (feat) totalArea += parseBrazilianFloat(feat.properties?.AREA);
                    });
                    return `${totalArea.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha`;
                })() },
                { label: "Status", value: selectedTalhoes.length > 1 ? "-" : (isLoadingEstimate ? "Carregando..." : (currentEstimate ? "Estimado" : "Pendente")) },
                { label: "Última estimativa", value: selectedTalhoes.length > 1 ? "-" : (isLoadingEstimate ? "..." : (currentEstimate ? `${currentEstimate.toneladas} ton` : "Não estimado")) },
              ].map((item, idx) => (
                <div key={idx} className="rounded-2xl p-3 flex flex-col justify-center" style={{ background: "rgba(31, 38, 53, 0.7)" }}>
                  <span className="text-xs mb-1" style={{ color: palette.text2 }}>{item.label}</span>
                  <span className="text-sm font-bold text-white line-clamp-2" title={item.value}>{item.value}</span>
                </div>
              ))}

              {activeMapModule === "estimativa" ? (
                <>
                  <div className="col-span-2 grid grid-cols-2 gap-3 mt-2">
                    <button
                      className="rounded-2xl py-3 flex items-center justify-center gap-2 font-semibold text-[15px] transition-transform hover:scale-[1.02]"
                      style={{ background: "#22c55e", color: "#ffffff" }}
                      onClick={() => {
                        if (selectedTalhoes.length > 1) {
                          setScope("selecionados");
                        } else {
                          setScope("talhao");
                        }
                        setEstimateOpen(true);
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                      {(() => {
                         let hasEstimated = false;
                         selectedTalhoes.forEach(id => {
                            const feat = enhancedGeoJson?.features?.find(f => f.id === id);
                            if (feat && feat.properties?._is_estimated) hasEstimated = true;
                         });
                         return hasEstimated ? "Reestimar" : "Estimar";
                      })()}
                    </button>
                    <button
                      onClick={() => openHistory(selectedTalhao)}
                      disabled={selectedTalhoes.length > 1}
                      className="rounded-2xl py-3 flex items-center justify-center gap-2 font-semibold text-[15px] transition-transform hover:scale-[1.02] border disabled:opacity-50"
                      style={{ background: "rgba(31, 38, 53, 0.7)", borderColor: "rgba(255,255,255,0.08)", color: "#ffffff" }}
                    >
                      <History className="w-4 h-4" />
                      Histórico
                    </button>
                  </div>

                  {/* Bloco Dinâmico Injetado - Ordem de Corte */}
                  <div className="col-span-2 mt-2">
                     <OrdemCorteActions
                          vinculoAtivo={vinculoAtivo}
                          talhoesIds={selectedTalhoes}
                          hasUnestimatedTalhao={hasUnestimatedTalhao}
                          companyId={companyId}
                          safra={safra}
                          rodadaOrigem={currentRodada}
                          usuario="Sistema" // Em um cenário real, pegaria do AuthContext
                     />
                  </div>
                </>
              ) : (
                <div className="col-span-2 mt-2">
                  <button
                    className="w-full rounded-2xl py-3 flex items-center justify-center gap-2 font-semibold text-[15px] transition-transform hover:scale-[1.02] shadow-lg"
                    style={{ background: "#3b82f6", color: "#ffffff" }}
                    onClick={() => {
                       // Placeholder for future Tratos Culturais Action
                       console.log("Nova Ordem de Serviço Tratos Culturais clicked");
                    }}
                  >
                    <Layers className="w-4 h-4" />
                    Nova Ordem de Serviço
                  </button>
                </div>
              )}

              <div className="col-span-2 mt-2">
                <button
                  className="w-full rounded-2xl py-3 flex items-center justify-center gap-2 font-semibold text-[15px] border transition-colors hover:bg-white/5"
                  style={{ background: "transparent", borderColor: "rgba(255,255,255,0.12)", color: "#ffffff" }}
                  onClick={() => { setSelectedTalhao(null); setSelectedTalhoes([]); setInfoCollapsed(false); }}
                >
                  <X className="w-4 h-4" />
                  Limpar seleção
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Menus Inferiores (Legenda e Resumo) */}
      <div className="absolute left-4 bottom-4 right-4 sm:right-auto z-20 flex flex-col gap-3 items-start">
        {!legendCollapsed ? (
          <div className="w-auto sm:w-[250px] max-w-[calc(100vw-2rem)] rounded-[22px] border overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.24)]" style={{ background: "rgba(17,24,39,0.88)", borderColor: "rgba(255,255,255,0.10)", backdropFilter: "blur(16px)" }}>
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <div className="font-bold text-[15px]">Estágios de corte</div>
              <div className="flex gap-2">
                <button className="rounded-xl px-2 py-1 text-xs font-medium transition-colors hover:bg-white/10" style={{ background: "rgba(255,255,255,0.08)" }} onClick={() => setShowLabels(!showLabels)}>{showLabels ? "Ocultar nomes" : "Exibir nomes"}</button>
                <button className="rounded-xl px-2 py-1 text-xs font-medium transition-colors hover:bg-white/10" style={{ background: "rgba(255,255,255,0.08)" }} onClick={() => setLegendCollapsed(true)}>Recolher</button>
              </div>
            </div>
            <div className="px-4 pb-4 text-sm space-y-2 max-h-[40vh] overflow-y-auto">
              {legendItems.length > 0 ? (
                legendItems.map(([color, label]) => (
                  <div key={label} className="grid grid-cols-[16px_1fr] gap-3 items-center">
                    <span className="w-4 h-4 rounded-md" style={{ background: color }} />
                    <span>{label}</span>
                  </div>
                ))
              ) : (
                <div className="text-xs" style={{ color: palette.text2 }}>
                  Nenhum talhão estimado na visualização atual.
                </div>
              )}
            </div>
          </div>
        ) : (
          <button className="w-[52px] h-[52px] rounded-full flex items-center justify-center transition-transform hover:scale-105" style={{ background: "#0c1527", border: "1px solid rgba(255,255,255,0.12)", color: palette.white, boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }} onClick={() => setLegendCollapsed(false)}>
            <Palette className="w-6 h-6 opacity-90" />
          </button>
        )}

        {!summaryCollapsed ? (
          <div className="w-auto sm:w-[420px] max-w-[calc(100vw-2rem)] rounded-[22px] border overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.24)]" style={{ background: "rgba(17,24,39,0.88)", borderColor: "rgba(255,255,255,0.10)", backdropFilter: "blur(16px)" }}>
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase font-bold tracking-[0.08em]" style={{ color: "#c6d1dc" }}>Resumo</div>
                <div className="text-[17px] font-bold mt-1">{summaryData.talhoes} talhões • {summaryData.area.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha</div>
              </div>
              <button className="rounded-xl px-3 py-2 text-sm font-medium transition-colors hover:bg-white/10" style={{ background: "rgba(255,255,255,0.08)" }} onClick={() => setSummaryCollapsed(true)}>Recolher</button>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4 pt-2">
              {[
                ["Talhões", String(summaryData.talhoes)],
                ["Área filtrada", `${summaryData.area.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha`],
                ["Estimados", String(summaryData.estimados)],
                ["Pendentes", String(summaryData.pendentes)],
                ["Toneladas", String(summaryData.toneladas)]
              ].map(([k, v]) => (
                <div key={k} className="rounded-[16px] border p-4" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.08)" }}>
                  <div className="text-[11px] uppercase font-semibold" style={{ color: "#aebccb" }}>{k}</div>
                  <div className="mt-2 text-[17px] font-bold">{v}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <button className="w-[52px] h-[52px] rounded-full flex items-center justify-center transition-transform hover:scale-105" style={{ background: "#0c1527", border: "1px solid rgba(255,255,255,0.12)", color: palette.white, boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }} onClick={() => setSummaryCollapsed(false)}>
            <PieChart className="w-6 h-6 opacity-90" />
          </button>
        )}
      </div>
    </>
  );
}
