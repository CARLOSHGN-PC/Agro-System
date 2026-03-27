import React, { useState, useEffect } from 'react';
import { palette } from '../../../../constants/theme.js';
import { Beaker, Plus, Trash2, Save, X, Settings2 } from 'lucide-react';
import { getProtocoloItens, getProtocoloOperacoes, saveProtocolo } from '../../../../services/premissas/tratos_culturais/tratosCulturaisService.js';
import { getProdutos } from '../../../../services/cadastros_mestres/produtosService.js';
import db from '../../../../services/localDb.js';
import { useAuth } from '../../../../hooks/useAuth.js';

/**
 * @file ProtocoloFormModal.jsx
 * @description Formulário para criação/edição de Protocolo (Guarda-chuva) com suas Operações e Produtos.
 * @module ProtocoloFormModal
 */

export default function ProtocoloFormModal({ protocoloId, onClose, onSaveSuccess }) {
  const { user } = useAuth();
  const companyId = JSON.parse(localStorage.getItem('@AgroSystem:auth'))?.companyId || "AgroSystem_Demo";

  // Estado do Protocolo (Capa / Guarda-chuva)
  const [protocolo, setProtocolo] = useState({ nome: '', observacoesTecnicas: '', status: 'ATIVO' });

  // Listas internas do Protocolo
  const [operacoes, setOperacoes] = useState([]);
  const [itens, setItens] = useState([]); // Produtos

  // Catálogos Mestres
  const [produtosDisponiveis, setProdutosDisponiveis] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const prods = await getProdutos(companyId);
    setProdutosDisponiveis(prods.filter(p => p.status === 'ATIVO'));

    if (protocoloId) {
        const pCapa = await db.protocolos.get(protocoloId);
        if (pCapa) setProtocolo(pCapa);

        const pOps = await getProtocoloOperacoes(protocoloId);
        setOperacoes(pOps.sort((a,b) => a.ordem - b.ordem));

        const pItens = await getProtocoloItens(protocoloId);
        setItens(pItens.sort((a,b) => a.ordem - b.ordem));
    }
  };

  // --- Handlers para Operações ---
  const addOperacao = () => {
      setOperacoes([...operacoes, { id: `temp-op-${Date.now()}`, nome: '', status: 'ATIVO', ordem: operacoes.length + 1 }]);
  };

  const updateOperacao = (index, field, value) => {
      const newOps = [...operacoes];
      newOps[index][field] = value;
      setOperacoes(newOps);
  };

  const removeOperacao = (index) => {
      const newOps = operacoes.filter((_, i) => i !== index);
      newOps.forEach((op, i) => op.ordem = i + 1);
      setOperacoes(newOps);
  };

  // --- Handlers para Produtos (Itens) ---
  const addItem = () => {
      setItens([...itens, { id: `temp-item-${Date.now()}`, produtoId: '', dosagem: '', unidadeMedidaId: '', status: 'ATIVO', ordem: itens.length + 1 }]);
  };

  const updateItem = (index, field, value) => {
      const newItens = [...itens];
      newItens[index][field] = value;
      setItens(newItens);
  };

  const removeItem = (index) => {
      const newItens = itens.filter((_, i) => i !== index);
      newItens.forEach((item, i) => item.ordem = i + 1);
      setItens(newItens);
  };

  // --- Salvar ---
  const handleSave = async () => {
      if (!protocolo.nome) {
          alert('Preencha o Nome do Protocolo/Receita.');
          return;
      }

      for (const op of operacoes) {
          if (!op.nome) {
              alert('Todas as Operações devem ter um nome preenchido.');
              return;
          }
      }

      for (const item of itens) {
          if (!item.produtoId || !item.dosagem) {
              alert('Todos os produtos da receita devem ter Produto e Dosagem definidos.');
              return;
          }
      }

      await saveProtocolo(protocolo, operacoes, itens, user?.uid || 'system', companyId);
      onSaveSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6">
      <div className="bg-[#121212] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-scale-in">

        {/* Cabeçalho */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
            <div>
                <h3 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
                    <Beaker className="w-6 h-6" style={{ color: palette.gold }} />
                    {protocoloId ? 'Editar Protocolo e Receita' : 'Novo Protocolo'}
                </h3>
                <p className="text-sm text-white/50">Configure o cabeçalho e os produtos da mistura</p>
            </div>
            <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-white/60 hover:text-white transition-colors">
                <X className="w-5 h-5" />
            </button>
        </div>

        {/* Corpo (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-6">

            {/* Seção 1: Capa do Protocolo */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <h4 className="font-semibold text-white/80 border-b border-white/10 pb-2 mb-4">Dados da Receita (Protocolo)</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-white/50 mb-1">Nome do Protocolo *</label>
                        <input
                            value={protocolo.nome}
                            onChange={(e) => setProtocolo({...protocolo, nome: e.target.value})}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold transition-all"
                            placeholder="Ex: 1º Vegetativo - Aplicação Aérea"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-white/50 mb-1">Status</label>
                        <select
                            value={protocolo.status}
                            onChange={(e) => setProtocolo({...protocolo, status: e.target.value})}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold transition-all appearance-none"
                        >
                            <option value="ATIVO">Ativo</option>
                            <option value="INATIVO">Inativo</option>
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-white/50 mb-1">Observações Técnicas</label>
                        <textarea
                            value={protocolo.observacoesTecnicas}
                            onChange={(e) => setProtocolo({...protocolo, observacoesTecnicas: e.target.value})}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold transition-all resize-none h-20"
                            placeholder="Instruções gerais, restrições climáticas..."
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Seção 2: Operações Vinculadas */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col min-h-[300px]">
                    <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-4">
                        <div>
                            <h4 className="font-semibold text-white flex items-center gap-2">
                                <Settings2 className="w-5 h-5 opacity-70"/> Operações
                            </h4>
                            <p className="text-xs text-white/50 mt-1">Quais operações compõem esta receita?</p>
                        </div>
                        <button onClick={addOperacao} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-white/10 hover:bg-white/20 text-white transition-all border border-white/10">
                            <Plus className="w-4 h-4" /> Add Operação
                        </button>
                    </div>

                    <div className="flex-1 overflow-auto space-y-3 pr-2">
                        {operacoes.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center text-white/30 p-4 border border-dashed border-white/5 rounded-xl">
                                <p className="text-sm">Nenhuma operação adicionada.</p>
                            </div>
                        ) : (
                            operacoes.map((op, index) => (
                                <div key={op.id} className={`flex flex-col sm:flex-row gap-3 bg-black/40 border p-3 rounded-xl items-center ${op.status === 'INATIVO' ? 'border-red-500/20 opacity-60' : 'border-white/10'}`}>
                                    <div className="flex-1 w-full">
                                        <input
                                            value={op.nome}
                                            onChange={(e) => updateOperacao(index, 'nome', e.target.value)}
                                            className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold"
                                            placeholder="Nome da Operação (ex: Pulverização)"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0 justify-end">
                                        <select
                                            value={op.status}
                                            onChange={(e) => updateOperacao(index, 'status', e.target.value)}
                                            className="bg-black/50 border border-white/10 rounded-lg px-2 py-2 text-xs text-white focus:outline-none"
                                        >
                                            <option value="ATIVO">Ativo</option>
                                            <option value="INATIVO">Desativado</option>
                                        </select>
                                        <button onClick={() => removeOperacao(index)} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg" title="Remover Operação">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Seção 3: Receituário / Produtos */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col min-h-[300px]">
                    <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-4">
                        <div>
                            <h4 className="font-semibold text-white flex items-center gap-2">
                                <Beaker className="w-5 h-5 opacity-70"/> Produtos
                            </h4>
                            <p className="text-xs text-white/50 mt-1">Produtos utilizados na calda da receita</p>
                        </div>
                        <button onClick={addItem} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-white/10 hover:bg-white/20 text-white transition-all border border-white/10">
                            <Plus className="w-4 h-4" /> Add Produto
                        </button>
                    </div>

                    <div className="flex-1 overflow-auto space-y-3 pr-2">
                        {itens.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center text-white/30 p-4 border border-dashed border-white/5 rounded-xl">
                                <p className="text-sm">Nenhum produto adicionado.</p>
                            </div>
                        ) : (
                            itens.map((item, index) => (
                                <div key={item.id} className={`flex flex-col gap-3 bg-black/40 border p-3 rounded-xl ${item.status === 'INATIVO' ? 'border-red-500/20 opacity-60' : 'border-white/10'}`}>
                                    <div className="flex flex-col sm:flex-row gap-3 w-full items-center">
                                        <div className="flex-1 w-full">
                                            <select
                                                value={item.produtoId}
                                                onChange={(e) => updateItem(index, 'produtoId', e.target.value)}
                                                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-gold appearance-none"
                                            >
                                                <option value="">Selecione o Produto (Mestre)...</option>
                                                {produtosDisponiveis.map(p => (
                                                    <option key={p.id} value={p.id}>{p.codigo ? `${p.codigo} - ` : ''}{p.nome}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="w-full sm:w-24">
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={item.dosagem}
                                                onChange={(e) => updateItem(index, 'dosagem', e.target.value)}
                                                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-gold"
                                                placeholder="Dose"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2 justify-end w-full sm:w-auto">
                                            <select
                                                value={item.status}
                                                onChange={(e) => updateItem(index, 'status', e.target.value)}
                                                className="bg-black/50 border border-white/10 rounded-lg px-2 py-2.5 text-xs text-white focus:outline-none"
                                            >
                                                <option value="ATIVO">Ativ.</option>
                                                <option value="INATIVO">Desat.</option>
                                            </select>
                                            <button onClick={() => removeItem(index)} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </div>
        </div>

        {/* Rodapé (Ações) */}
        <div className="p-6 border-t border-white/10 bg-black flex justify-end gap-3 mt-auto">
            <button
                onClick={onClose}
                className="px-6 py-3 rounded-xl font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            >
                Cancelar
            </button>
            <button
                onClick={handleSave}
                className="px-6 py-3 rounded-xl font-semibold text-black transition-transform hover:scale-[1.02] flex items-center gap-2 shadow-lg"
                style={{ background: palette.gold, boxShadow: "0 0 20px rgba(212,175,55,0.2)" }}
            >
                <Save className="w-5 h-5" /> Salvar Protocolo
            </button>
        </div>

      </div>
    </div>
  );
}
