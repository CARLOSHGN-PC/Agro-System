import React, { useState, useEffect } from 'react';
import { palette } from '../../../constants/theme.js';
import { MapPin, X, Target, Info, Search } from 'lucide-react';
import { getTalhoesPorFazenda } from '../../../services/cadastros_mestres/fazendas/fazendasService.js';
import db from '../../../services/localDb.js';

/**
 * @file FazendaDetailModal.jsx
 * @description Modal de detalhamento exibindo todos os Talhões de uma Fazenda importada (com as 45 colunas).
 * @module FazendaDetailModal
 */

export default function FazendaDetailModal({ fazendaId, onClose }) {
  const companyId = JSON.parse(localStorage.getItem('@AgroSystem:auth'))?.companyId || "AgroSystem_Demo";

  const [fazenda, setFazenda] = useState(null);
  const [talhoes, setTalhoes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Para visualização de uma linha completa
  const [selectedTalhao, setSelectedTalhao] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, [fazendaId]);

  const loadData = async () => {
    if (!fazendaId) return;
    setLoading(true);
    const f = await db.fazendas.get(fazendaId);
    setFazenda(f);

    const tData = await getTalhoesPorFazenda(companyId, fazendaId);
    // Ordenar logicamente pelo número do talhão se possível
    setTalhoes(tData.sort((a,b) => String(a.TALHAO).localeCompare(String(b.TALHAO), undefined, {numeric: true})));
    setLoading(false);
  };

  const filteredTalhoes = talhoes.filter(t =>
      String(t.TALHAO).toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(t.VARIEDADE).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-2 sm:p-4 animate-fade-in">
      {/* Ajustado max-h para 85vh para garantir que não cubra a navbar ou corte em telas de laptop */}
      <div className="bg-[#121212] border border-white/10 rounded-2xl w-[95vw] md:w-[90vw] max-w-7xl h-[85vh] shadow-2xl flex flex-col overflow-hidden animate-scale-in">

        {/* Cabeçalho */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/10 bg-black/40 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-transparent pointer-events-none"></div>
            <div className="z-10">
                <h3 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
                    <MapPin className="w-6 h-6" style={{ color: palette.gold }} />
                    {fazenda ? `${fazenda.codFaz} - ${fazenda.desFazenda}` : 'Carregando...'}
                </h3>
                <p className="text-sm text-white/50">{talhoes.length} talhões cadastrados nesta unidade</p>
            </div>
            <button onClick={onClose} className="p-2 z-10 bg-white/5 hover:bg-white/10 rounded-xl text-white/60 hover:text-white transition-colors">
                <X className="w-5 h-5" />
            </button>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">

            {/* A lista de talhões agora não usa overflow interno para evitar duplos scrolls de forma agressiva, delegando pro app ou container principal se possível,
                ou mantendo um scroll minimalista se estritamente necessário pro design. O usuário quer evitar duplo scroll da página vs modal.
                Aqui limitamos as larguras para caberem lado a lado corretamente. */}
            <div className={`w-full md:w-1/3 md:min-w-[280px] md:max-w-[350px] flex flex-col border-r border-white/10 bg-[#0A0A0A] ${selectedTalhao ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b border-white/5">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar Talhão ou Variedade..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-gold transition-all"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                    {loading ? (
                        <p className="p-4 text-center text-white/30 text-sm">Carregando dados...</p>
                    ) : filteredTalhoes.length === 0 ? (
                        <p className="p-4 text-center text-white/30 text-sm">Nenhum talhão encontrado.</p>
                    ) : (
                        filteredTalhoes.map(t => (
                            <button
                                key={t.id}
                                onClick={() => setSelectedTalhao(t)}
                                className={`w-full text-left p-4 rounded-xl transition-all border ${selectedTalhao?.id === t.id ? 'bg-white/10 border-white/20' : 'bg-transparent border-transparent hover:bg-white/5'}`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-bold text-lg text-white">T {t.TALHAO}</span>
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                                        {t.AREA_TALHAO} ha
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs text-white/50">
                                    <span>{t.VARIEDADE || 'Var. Mista'}</span>
                                    <span>Corte: {t.ESTAGIO}</span>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            <div className={`flex-1 bg-[#121212] overflow-y-auto relative p-4 sm:p-6 custom-scrollbar ${!selectedTalhao ? 'hidden md:flex flex-col' : 'block'}`}>
                {!selectedTalhao ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white/20">
                        <Target className="w-16 h-16 mb-4 opacity-50" />
                        <p className="text-lg">Selecione um talhão na lista</p>
                        <p className="text-sm">Para visualizar todas as informações de plantio e georreferenciamento</p>
                    </div>
                ) : (
                    <div className="animate-fade-in space-y-6 pb-8">

                        <div className="flex items-center gap-4 pb-4 border-b border-white/10">
                            <button onClick={() => setSelectedTalhao(null)} className="md:hidden p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
                                <X className="w-5 h-5 text-white/70" />
                            </button>
                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-xl font-bold text-white border border-white/10 shrink-0">
                                {selectedTalhao.TALHAO}
                            </div>
                            <div>
                                <h4 className="text-xl font-bold text-white">Talhão {selectedTalhao.TALHAO}</h4>
                                <p className="text-sm text-white/60">Detalhes cadastrais importados</p>
                            </div>
                        </div>

                        {/* Grid de Informações Densas (As 45 colunas divididas por contexto) */}
                        <div className="space-y-4">

                            {/* Bloco 1: Identificação Básica */}
                            <div className="bg-black/30 border border-white/5 rounded-2xl p-4">
                                <h5 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3 flex items-center gap-2">
                                    <Info className="w-4 h-4"/> Identificação & Localização
                                </h5>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                    <DataPoint label="Empresa" value={selectedTalhao.EMPRESA} />
                                    <DataPoint label="Cluster / U.I" value={`${selectedTalhao.CLUSTER} / ${selectedTalhao.UM_INDUSTRIAL}`} />
                                    <DataPoint label="Município" value={selectedTalhao.DE_MUNICIPIO} />
                                    <DataPoint label="Fornecedor" value={selectedTalhao.FORNECEDOR} />

                                    <DataPoint label="Tipo Propriedade" value={selectedTalhao.TIPO_PROPRIEDADE} />
                                    <DataPoint label="Bloco" value={selectedTalhao.BLOCO} />
                                    <DataPoint label="Ocupação" value={selectedTalhao.OCUPACAO} />
                                    <DataPoint label="Safra (CD_SAFRA)" value={selectedTalhao.CD_SAFRA} />
                                </div>
                            </div>

                            {/* Bloco 2: Agronômico */}
                            <div className="bg-black/30 border border-white/5 rounded-2xl p-4">
                                <h5 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3 flex items-center gap-2">
                                    <Info className="w-4 h-4"/> Agronômico & Plantio
                                </h5>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                    <DataPoint label="Variedade" value={selectedTalhao.VARIEDADE} highlight />
                                    <DataPoint label="Área (ha)" value={selectedTalhao.AREA_TALHAO} highlight />
                                    <DataPoint label="Estágio / Corte" value={selectedTalhao.ESTAGIO} />
                                    <DataPoint label="Tipo Solo" value={selectedTalhao.TIPO_SOLO} />

                                    <DataPoint label="Data Plantio" value={selectedTalhao.DT_PLANTIO} />
                                    <DataPoint label="Últ. Corte" value={selectedTalhao.DT_ULTCORTE} />
                                    <DataPoint label="Espaçamento" value={selectedTalhao.DE_ESPACAMENTO} />
                                    <DataPoint label="Manejo" value={selectedTalhao.MANEJO_HIPOTETICO} />

                                    <DataPoint label="Sistema Plantio" value={selectedTalhao.SISTEMA_PLANTIO} />
                                    <DataPoint label="Ambiente" value={selectedTalhao.AMBIENTE} />
                                    <DataPoint label="Maturação" value={selectedTalhao.MATURACAO} />
                                    <DataPoint label="Irrigação" value={selectedTalhao.SIST_IRRIG} />
                                </div>
                            </div>

                            {/* Bloco 3: Logística e Contratos */}
                            <div className="bg-black/30 border border-white/5 rounded-2xl p-4">
                                <h5 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3 flex items-center gap-2">
                                    <Info className="w-4 h-4"/> Logística & Contratos
                                </h5>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                    <DataPoint label="Dist. Asfalto" value={selectedTalhao.DIST_ASFALTO} />
                                    <DataPoint label="Dist. Terra" value={selectedTalhao.DIST_TERRA} />
                                    <DataPoint label="Dist. Total" value={selectedTalhao.DIST_TOTAL} />
                                    <DataPoint label="Bacia Vinhaça" value={selectedTalhao.BACIA_VINHACA} />

                                    <DataPoint label="Início Contrato" value={selectedTalhao.INCIO_CTT} />
                                    <DataPoint label="Fim Contrato" value={selectedTalhao.FIM_CTT} />
                                    <DataPoint label="Vencimento" value={selectedTalhao.VENC_CONTRATO} />
                                    <DataPoint label="Devolução" value={selectedTalhao.DEVOLUCAO} />
                                </div>
                            </div>

                            {/* Bloco 4: Restrições & Certificações */}
                            <div className="bg-black/30 border border-white/5 rounded-2xl p-4">
                                <h5 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3 flex items-center gap-2">
                                    <Info className="w-4 h-4"/> Restrições & Certificações
                                </h5>
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                    <DataPoint label="Restrição 1" value={selectedTalhao.RESTRICAO_1} />
                                    <DataPoint label="Restrição 2" value={selectedTalhao.RESTRICAO_2} />
                                    <DataPoint label="Restrição 3" value={selectedTalhao.RESTRICAO_3} />

                                    <DataPoint label="Certificação 1" value={selectedTalhao.CERTIFICACAO_1} />
                                    <DataPoint label="Certificação 2" value={selectedTalhao.CERTIFICACAO_2} />
                                    <DataPoint label="Certificação 3" value={selectedTalhao.CERTIFICACAO_3} />
                                    <DataPoint label="Instituição" value={selectedTalhao.INSTITUICAO} />
                                </div>
                            </div>

                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}

// Mini Componente para exibição dos dados das 45 colunas uniformemente
// O que este bloco faz: Exibe o rótulo e o valor de cada propriedade do talhão de forma padronizada. Foi ajustado (padding reduzido p-2 e text-xs) para caberem melhor em telas menores.
const DataPoint = ({ label, value, highlight = false }) => (
    <div className={`p-2 rounded-xl border ${highlight ? 'bg-white/5 border-white/10' : 'border-transparent'}`}>
        <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-white/40 mb-0.5">{label}</div>
        <div className={`text-xs sm:text-sm font-medium ${!value || value === '0' || value === 'N' ? 'text-white/30 italic' : 'text-white'} truncate`} title={value || '-'}>
            {value || '-'}
        </div>
    </div>
);
