import React, { useState, useEffect } from 'react';
import { palette } from '../../../../constants/theme.js';
import { Beaker, Plus, Edit2, Trash2, ArrowRight } from 'lucide-react';
import { getProtocolos, getOperacoes } from '../../../../services/premissas/tratos_culturais/tratosCulturaisService.js';
import { useAuth } from '../../../../hooks/useAuth.js';
import ProtocoloFormModal from './ProtocoloFormModal.jsx';

/**
 * @file ProtocolosList.jsx
 * @description Listagem de Protocolos de Tratos Culturais e controle do Modal de Formulario.
 * @module ProtocolosList
 */

export default function ProtocolosList() {
  const { user } = useAuth();
  const companyId = JSON.parse(localStorage.getItem('@AgroSystem:auth'))?.companyId || "AgroSystem_Demo";

  const [protocolos, setProtocolos] = useState([]);
  const [operacoes, setOperacoes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProtocoloId, setCurrentProtocoloId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const dataProtocolos = await getProtocolos(companyId);
    const dataOperacoes = await getOperacoes(companyId);
    setProtocolos(dataProtocolos);
    setOperacoes(dataOperacoes);
    setLoading(false);
  };

  const getNomeOperacao = (operacaoId) => {
    const op = operacoes.find(o => o.id === operacaoId);
    return op ? op.nome : 'Desconhecida';
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
            <Beaker className="w-5 h-5" style={{ color: palette.gold }} />
            Receituário e Protocolos Agrícolas
        </h2>
        <button
          onClick={() => { setCurrentProtocoloId(null); setIsModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-white/10 hover:bg-white/20 transition-all border border-white/10"
        >
          <Plus className="w-4 h-4" /> Novo Protocolo
        </button>
      </div>

      <div className="flex-1 overflow-auto rounded-xl border border-white/5 bg-white/5">
        <table className="w-full text-left text-sm">
            <thead className="bg-black/40 text-white/50 border-b border-white/5 sticky top-0">
                <tr>
                    <th className="px-6 py-4 font-semibold">Nome do Protocolo</th>
                    <th className="px-6 py-4 font-semibold">Operação Mãe</th>
                    <th className="px-6 py-4 font-semibold">Observação</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold text-right">Ações</th>
                </tr>
            </thead>
            <tbody>
                {protocolos.length === 0 && !loading && (
                    <tr><td colSpan="5" className="text-center py-8 text-white/40">Nenhum protocolo cadastrado.</td></tr>
                )}
                {protocolos.map(p => (
                    <tr key={p.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                        <td className="px-6 py-4 font-medium text-white">{p.nome}</td>
                        <td className="px-6 py-4 text-white/80">{getNomeOperacao(p.operacaoId)}</td>
                        <td className="px-6 py-4 text-white/60 truncate max-w-[200px]">{p.observacoesTecnicas || '-'}</td>
                        <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${p.status === 'ATIVO' ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/40'}`}>
                                {p.status}
                            </span>
                        </td>
                        <td className="px-6 py-4 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setCurrentProtocoloId(p.id); setIsModalOpen(true); }} className="p-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-white flex items-center gap-1" title="Ver Detalhes/Editar">
                                <span className="text-xs">Gerenciar Receita</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>

      {isModalOpen && (
        <ProtocoloFormModal
            protocoloId={currentProtocoloId}
            onClose={() => setIsModalOpen(false)}
            onSaveSuccess={() => { setIsModalOpen(false); loadData(); }}
            operacoesDisponiveis={operacoes.filter(o => o.status === 'ATIVO')}
        />
      )}
    </div>
  );
}
