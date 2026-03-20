import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { palette } from "../../constants/theme";
import { showConfirm } from "../../utils/alert";

/**
 * EstimativaModals.jsx
 *
 * O que este bloco faz:
 * Contém a renderização dos 3 modais principais do sistema: Nova Estimativa (Formulário),
 * Histórico de Estimativa, e Filtros de Mapa.
 *
 * Por que ele existe:
 * Remover mais de 300 linhas de JSX flutuante de dentro da raiz. Os modais
 * só são renderizados via "AnimatePresence" quando as flags booleanas correspondentes estão ativas.
 *
 * O que entra e o que sai:
 * @param {Object} props - Todas os states e setters necessários para gerenciar o formulário e filtros.
 * @returns {JSX.Element} Conjunto de AnimatePresence condicional para os 3 modais.
 */
export default function EstimativaModals({
  // Modal states
  estimateOpen, setEstimateOpen,
  historyOpen, setHistoryOpen,
  filtersOpen, setFiltersOpen,

  // Data props
  currentSafra, scope, setScope,
  selectedTalhao, selectedTalhoes,
  enhancedGeoJson, geoJsonData,
  formEstimativa, setFormEstimativa,
  isSaving, submitEstimate,
  estimateHistory,
  filters, setFilters,
  setAppliedFilters, filterOptions,
  updateFormAreaFromScope // Função de recalculo de área atrelada ao Escopo
}) {

  // Shell para padronizar o fundo preto semi-transparente
  const modalShell = (children) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/55 backdrop-blur-sm">
      {children}
    </div>
  );

  // Efeito isolado para recalcular a area sempre que o escopo mudar.
  useEffect(() => {
    if (estimateOpen && updateFormAreaFromScope) {
      updateFormAreaFromScope(selectedTalhao, selectedTalhoes, enhancedGeoJson);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, selectedTalhao, selectedTalhoes, estimateOpen]);

  const handleSaveWrapper = async () => {
    await submitEstimate(selectedTalhoes, selectedTalhao, enhancedGeoJson);
  };

  return (
    <>
      {/* 1. Modal: Formulário de Nova Estimativa */}
      <AnimatePresence>
        {estimateOpen && modalShell(
          <motion.div initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} className="w-full max-w-[920px] max-h-[90vh] flex flex-col rounded-[26px] overflow-hidden border shadow-[0_10px_30px_rgba(0,0,0,0.28)]" style={{ background: "#111a2d", borderColor: "rgba(255,255,255,0.12)" }}>
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b shrink-0" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
              <div>
                <h2 className="text-[22px] font-semibold">Nova estimativa</h2>
                <p className="text-sm mt-1" style={{ color: palette.text2 }}>Revise o escopo da estimativa e confirme os dados antes de salvar.</p>
              </div>
              <button className="rounded-xl border px-3 py-2 transition-colors hover:bg-white/10" style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)" }} onClick={() => setEstimateOpen(false)}>✕</button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  ["Fundo agrícola / Fazenda", scope === "talhao" ? ((selectedTalhao?.properties?.FUNDO_AGR && selectedTalhao?.properties?.FAZENDA) ? `${selectedTalhao.properties.FUNDO_AGR} - ${selectedTalhao.properties.FAZENDA}` : selectedTalhao?.properties?.FAZENDA || selectedTalhao?.properties?.FUNDO_AGR || "N/A") : (scope === "selecionados" && selectedTalhoes.length > 0 ? ((enhancedGeoJson.features.find(f => f.id === selectedTalhoes[0])?.properties?.FUNDO_AGR && enhancedGeoJson.features.find(f => f.id === selectedTalhoes[0])?.properties?.FAZENDA) ? `${enhancedGeoJson.features.find(f => f.id === selectedTalhoes[0]).properties.FUNDO_AGR} - ${enhancedGeoJson.features.find(f => f.id === selectedTalhoes[0]).properties.FAZENDA}` : "Múltiplos/Variados") : "Várias")],
                  ["Talhão", scope === "talhao" ? (selectedTalhao?.properties?.TALHAO || "N/A") : (scope === "selecionados" ? `${selectedTalhoes.length} selecionados` : "Múltiplos")],
                  ["Variedade", scope === "talhao" ? (selectedTalhao?.properties?.VARIEDADE || "N/A") : "Várias"],
                  ["Corte / Estágio", scope === "talhao" ? (selectedTalhao?.properties?.ECORTE || "N/A") : "Vários"]
                ].map(([k, v]) => (
                  <div key={k} className="rounded-2xl border p-3" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)" }}>
                    <div className="text-xs" style={{ color: palette.text2 }}>{k}</div>
                    <div className="mt-1 font-semibold truncate" title={v}>{v}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div className="flex flex-col gap-2">
                  <label className="text-xs" style={{ color: palette.text2 }}>Safra</label>
                  <input readOnly value={currentSafra} className="rounded-2xl border px-4 py-3 outline-none opacity-60" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)", color: palette.white }} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs" style={{ color: palette.text2 }}>Data da estimativa</label>
                  <input readOnly value={new Date().toISOString().split('T')[0]} className="rounded-2xl border px-4 py-3 outline-none opacity-60" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)", color: palette.white }} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs" style={{ color: palette.text2 }}>Área (ha)</label>
                  <input value={formEstimativa.area} onChange={(e) => setFormEstimativa({...formEstimativa, area: e.target.value})} className="rounded-2xl border px-4 py-3 outline-none focus:border-yellow-500 transition-colors" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)", color: palette.white }} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs" style={{ color: palette.text2 }}>TCH estimado</label>
                  <input value={formEstimativa.tch} onChange={(e) => setFormEstimativa({...formEstimativa, tch: e.target.value})} className="rounded-2xl border px-4 py-3 outline-none focus:border-yellow-500 transition-colors" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)", color: palette.white }} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs" style={{ color: palette.text2 }}>Toneladas estimadas</label>
                  <input readOnly value={formEstimativa.toneladas} className="rounded-2xl border px-4 py-3 outline-none opacity-80" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)", color: palette.white }} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs" style={{ color: palette.text2 }}>Responsável</label>
                  <input readOnly value="Carlos" className="rounded-2xl border px-4 py-3 outline-none opacity-60" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)", color: palette.white }} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  ["talhao", "Talhão atual", "Grava apenas no talhão selecionado."],
                  ["selecionados", "Selecionados", "Usa a seleção múltipla do mapa."],
                  ["filtro", "Filtro atual", "Aplica a todos os talhões no filtro atual."],
                  ["fazenda", "Fazenda inteira", (() => {
                     let fazName = "Aplica a todos os talhões desta fazenda.";
                     if (selectedTalhao && selectedTalhao.properties?.FAZENDA) {
                        fazName = `Aplica aos talhões da fazenda ${selectedTalhao.properties.FAZENDA}.`;
                     } else if (selectedTalhoes.length > 0) {
                        const first = enhancedGeoJson?.features?.find(f => f.id === selectedTalhoes[0]);
                        if (first && first.properties?.FAZENDA) {
                           fazName = `Aplica aos talhões da fazenda ${first.properties.FAZENDA}.`;
                        }
                     }
                     return fazName;
                  })()]
                ].map(([key, title, sub]) => (
                  <button
                    key={key}
                    onClick={async () => {
                      if (key === "fazenda" || key === "filtro") {
                        const confirmResult = await showConfirm(
                          "Aplicar em massa",
                          `Tem certeza que deseja aplicar a estimativa para a ${title}? Essa ação impactará vários talhões.`
                        );
                        if (!confirmResult.isConfirmed) return;
                      }
                      setScope(key);
                    }}
                    className="text-left rounded-[18px] border p-3 transition-colors hover:bg-white/5"
                    style={{ background: "rgba(255,255,255,0.05)", borderColor: scope === key ? "rgba(245,158,11,0.7)" : "rgba(255,255,255,0.12)", boxShadow: scope === key ? "inset 0 0 0 1px rgba(245,158,11,0.25)" : "none" }}
                  >
                    <div className="font-semibold text-sm">{title}</div>
                    <div className="text-xs mt-1" style={{ color: palette.text2 }}>{sub}</div>
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs" style={{ color: palette.text2 }}>Observação</label>
                <textarea placeholder="Ao salvar, cada reestimativa gera uma nova versão por safra sem apagar o histórico anterior." className="rounded-2xl border px-4 py-3 min-h-[110px] outline-none focus:border-yellow-500 transition-colors" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)", color: palette.white }} />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t shrink-0" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
              <button className="rounded-xl border px-4 py-3 hover:bg-white/10 transition-colors" style={{ borderColor: "rgba(255,255,255,0.12)", background: "transparent" }} onClick={() => setEstimateOpen(false)}>Cancelar</button>
              <button disabled={isSaving} className="rounded-xl px-4 py-3 transition-transform hover:scale-[1.02] disabled:opacity-50" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)", color: "white" }} onClick={handleSaveWrapper}>
                {isSaving ? "Salvando..." : "Salvar estimativa"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Modal: Histórico */}
      <AnimatePresence>
        {historyOpen && modalShell(
          <motion.div initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} className="w-full max-w-[620px] max-h-[90vh] flex flex-col rounded-[26px] overflow-hidden border shadow-[0_10px_30px_rgba(0,0,0,0.28)]" style={{ background: "#111a2d", borderColor: "rgba(255,255,255,0.12)" }}>
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b shrink-0" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
              <div>
                <h2 className="text-[22px] font-semibold">Histórico de Estimativas</h2>
                <p className="text-sm mt-1" style={{ color: palette.text2 }}>Safra {currentSafra}</p>
              </div>
              <button className="rounded-xl border px-3 py-2 transition-colors hover:bg-white/10" style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)" }} onClick={() => setHistoryOpen(false)}>✕</button>
            </div>
            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              {estimateHistory.length === 0 ? (
                <div className="text-center py-8 text-sm" style={{ color: palette.text2 }}>Nenhum histórico encontrado para esta safra.</div>
              ) : (
                estimateHistory.map((item, idx) => (
                  <div key={idx} className="rounded-2xl border p-4 hover:bg-white/5 transition-colors" style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.08)" }}>
                    <div className="flex justify-between items-center mb-2">
                      <div className="font-semibold text-[15px]">Versão {item.version}</div>
                      <div className="text-xs" style={{ color: palette.text2 }}>{new Date(item.updatedAt?.seconds * 1000).toLocaleString()}</div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                      <div><span style={{ color: palette.text2 }}>Área:</span> {item.area} ha</div>
                      <div><span style={{ color: palette.text2 }}>TCH:</span> {item.tch}</div>
                      <div><span style={{ color: palette.text2 }}>Toneladas:</span> {item.toneladas}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Modal: Filtros */}
      <AnimatePresence>
        {filtersOpen && modalShell(
          <motion.div initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} className="w-full max-w-[620px] max-h-[90vh] flex flex-col rounded-[26px] overflow-hidden border shadow-[0_10px_30px_rgba(0,0,0,0.28)]" style={{ background: "#111a2d", borderColor: "rgba(255,255,255,0.12)" }}>
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b shrink-0" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
              <div>
                <h2 className="text-[22px] font-semibold">Filtros do mapa</h2>
                <p className="text-sm mt-1" style={{ color: palette.text2 }}>Selecione o fundo agrícola/fazenda, variedade, corte e talhão que deseja visualizar.</p>
              </div>
              <button className="rounded-xl border px-3 py-2 transition-colors hover:bg-white/10" style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)" }} onClick={() => setFiltersOpen(false)}>✕</button>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto flex-1">
              <div className="flex flex-col gap-2">
                <label className="text-xs" style={{ color: palette.text2 }}>Fundo agrícola / Fazenda</label>
                <div className="relative">
                  <select
                    value={filters.fazenda}
                    onChange={(e) => setFilters({...filters, fazenda: e.target.value, variedade: "", corte: "", talhao: ""})}
                    className="w-full rounded-2xl border px-4 py-3 outline-none appearance-none focus:border-yellow-500 transition-colors"
                    style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)", color: palette.white }}
                  >
                    <option value="" style={{ color: "black" }}>Todas as Fazendas</option>
                    {filterOptions.fazendas.map(f => <option key={f} value={f} style={{ color: "black" }}>{f}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: palette.text2 }} />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs" style={{ color: palette.text2 }}>Variedade</label>
                <div className="relative">
                  <select
                    value={filters.variedade}
                    onChange={(e) => setFilters({...filters, variedade: e.target.value, corte: "", talhao: ""})}
                    className="w-full rounded-2xl border px-4 py-3 outline-none appearance-none focus:border-yellow-500 transition-colors"
                    style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)", color: palette.white }}
                  >
                    <option value="" style={{ color: "black" }}>Todas as Variedades</option>
                    {filterOptions.variedades.map(v => <option key={v} value={v} style={{ color: "black" }}>{v}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: palette.text2 }} />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs" style={{ color: palette.text2 }}>Corte / Estágio</label>
                <div className="relative">
                  <select
                    value={filters.corte}
                    onChange={(e) => setFilters({...filters, corte: e.target.value, talhao: ""})}
                    className="w-full rounded-2xl border px-4 py-3 outline-none appearance-none focus:border-yellow-500 transition-colors"
                    style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)", color: palette.white }}
                  >
                    <option value="" style={{ color: "black" }}>Todos os Cortes</option>
                    {filterOptions.cortes.map(c => <option key={c} value={c} style={{ color: "black" }}>{c}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: palette.text2 }} />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs" style={{ color: palette.text2 }}>Talhão</label>
                <div className="relative">
                  <select
                    value={filters.talhao}
                    onChange={(e) => setFilters({...filters, talhao: e.target.value})}
                    className="w-full rounded-2xl border px-4 py-3 outline-none appearance-none focus:border-yellow-500 transition-colors"
                    style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)", color: palette.white }}
                  >
                    <option value="" style={{ color: "black" }}>Todos os Talhões</option>
                    {filterOptions.talhoes.map(t => <option key={t} value={t} style={{ color: "black" }}>{t}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: palette.text2 }} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t shrink-0" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
              <button className="rounded-xl border px-4 py-3 hover:bg-white/10 transition-colors" style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)" }} onClick={() => {
                setFilters({fazenda: "", variedade: "", corte: "", talhao: ""});
                setAppliedFilters({fazenda: "", variedade: "", corte: "", talhao: ""});
                setFiltersOpen(false);
              }}>Limpar</button>
              <button className="rounded-xl px-4 py-3 transition-transform hover:scale-[1.02]" style={{ background: `linear-gradient(135deg, ${palette.gold} 0%, ${palette.goldLight} 100%)`, color: palette.bg }} onClick={() => {
                setAppliedFilters(filters);
                setFiltersOpen(false);
              }}>Aplicar filtros</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
