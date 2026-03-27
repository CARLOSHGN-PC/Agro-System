import React, { useState, useEffect } from 'react';
import { palette } from '../../../../constants/theme.js';
import { Beaker, Plus, Trash2, GripVertical, Save, X } from 'lucide-react';
import { getProtocoloItens, saveProtocolo } from '../../../../services/premissas/tratos_culturais/tratosCulturaisService.js';
import { getProdutos } from '../../../../services/cadastros_mestres/produtosService.js';
import db from '../../../../services/localDb.js';
import { useAuth } from '../../../../hooks/useAuth.js';

/**
 * @file ProtocoloFormModal.jsx
 * @description Formulário avançado para criação/edição de Protocolo e seus Produtos (Receituário).
 * @module ProtocoloFormModal
 */

export default function ProtocoloFormModal({ protocoloId, onClose, onSaveSuccess, operacoesDisponiveis }) {
  const { user } = useAuth();
  const companyId = JSON.parse(localStorage.getItem('@AgroSystem:auth'))?.companyId || "AgroSystem_Demo";

  // Estado do Protocolo (Capa)
  const [protocolo, setProtocolo] = useState({ nome: '', operacaoId: '', observacoesTecnicas: '', status: 'ATIVO' });

  // Estado dos Itens (Receita)
  const [itens, setItens] = useState([]);

  // Catálogos
  const [produtosDisponiveis, setProdutosDisponiveis] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Carregar Cadastro Mestre de Produtos
    const prods = await getProdutos(companyId);
    setProdutosDisponiveis(prods.filter(p => p.status === 'ATIVO'));

    if (protocoloId) {
        // Modo Edição
        const pCapa = await db.protocolos.get(protocoloId);
        if (pCapa) setProtocolo(pCapa);

        const pItens = await getProtocoloItens(protocoloId);
        // Garante que a ordem esteja correta visualmente
        setItens(pItens.sort((a,b) => a.ordem - b.ordem));
    }
  };

  const addItem = () => {
      setItens([...itens, { id: `temp-${Date.now()}`, produtoId: '', dosagem: '', unidadeMedidaId: '', ordem: itens.length + 1 }]);
  };

  const updateItem = (index, field, value) => {
      const newItens = [...itens];
      newItens[index][field] = value;
      setItens(newItens);
  };

  const removeItem = (index) => {
      const newItens = itens.filter((_, i) => i !== index);
      // Reordena
      newItens.forEach((item, i) => item.ordem = i + 1);
      setItens(newItens);
  };

  // Simples Drag & Drop Handler (Para fins didáticos, pode ser aprimorado com lib react-beautiful-dnd depois)
  const moveItem = (index, direction) => {
      if (direction === 'up' && index > 0) {
          const newItens = [...itens];
          const temp = newItens[index];
          newItens[index] = newItens[index - 1];
          newItens[index - 1] = temp;
          newItens.forEach((item, i) => item.ordem = i + 1);
          setItens(newItens);
      } else if (direction === 'down' && index < itens.length - 1) {
          const newItens = [...itens];
          const temp = newItens[index];
          newItens[index] = newItens[index + 1];
          newItens[index + 1] = temp;
          newItens.forEach((item, i) => item.ordem = i + 1);
          setItens(newItens);
      }
  };

  const handleSave = async () => {
      if (!protocolo.nome || !protocolo.operacaoId) {
          alert('Preencha o Nome e selecione a Operação.');
          return;
      }

      // Validação de itens
      for (const item of itens) {
          if (!item.produtoId || !item.dosagem) {
              alert('Todos os itens da receita devem ter Produto e Dosagem definidos.');
              return;
          }
      }

      await saveProtocolo(protocolo, itens, user?.uid || 'system', companyId);
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
        <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-6">

            {/* Coluna Esquerda: Capa do Protocolo */}
            <div className="md:w-1/3 flex flex-col gap-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                    <h4 className="font-semibold text-white/80 border-b border-white/10 pb-2 mb-4">Dados da Operação</h4>

                    <div>
                        <label className="block text-xs font-medium text-white/50 mb-1">Nome do Protocolo *</label>
                        <input
                            value={protocolo.nome}
                            onChange={(e) => setProtocolo({...protocolo, nome: e.target.value})}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all"
                            placeholder="Ex: Secagem Soja Fase 1"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-white/50 mb-1">Vincular a Operação *</label>
                        <select
                            value={protocolo.operacaoId}
                            onChange={(e) => setProtocolo({...protocolo, operacaoId: e.target.value})}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold transition-all appearance-none"
                        >
                            <option value="">Selecione...</option>
                            {operacoesDisponiveis.map(op => (
                                <option key={op.id} value={op.id}>{op.codigo ? `${op.codigo} - ` : ''}{op.nome}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-white/50 mb-1">Observações Técnicas</label>
                        <textarea
                            value={protocolo.observacoesTecnicas}
                            onChange={(e) => setProtocolo({...protocolo, observacoesTecnicas: e.target.value})}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold transition-all resize-none h-24"
                            placeholder="Ex: Aplicar em temperatura abaixo de 30°C e ventos de no máx 10km/h."
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
                </div>
            </div>

            {/* Coluna Direita: Construtor de Receita (Itens) */}
            <div className="md:w-2/3 flex flex-col gap-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 h-full flex flex-col">
                    <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-4">
                        <div>
                            <h4 className="font-semibold text-white">Receituário (Produtos)</h4>
                            <p className="text-xs text-white/50">Defina a dosagem e a ordem da mistura de tanque</p>
                        </div>
                        <button
                            onClick={addItem}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-white/10 hover:bg-white/20 text-white transition-all border border-white/10"
                        >
                            <Plus className="w-4 h-4" /> Add Produto
                        </button>
                    </div>

                    <div className="flex-1 overflow-auto space-y-3 pr-2">
                        {itens.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center text-white/30 p-8 border-2 border-dashed border-white/5 rounded-xl">
                                <Beaker className="w-10 h-10 mb-2 opacity-50" />
                                <p>Nenhum produto adicionado à receita.</p>
                                <p className="text-xs">Clique em "Add Produto" para começar a construir a calda.</p>
                            </div>
                        ) : (
                            itens.map((item, index) => (
                                <div key={item.id} className="flex flex-col sm:flex-row gap-3 bg-black/40 border border-white/10 p-3 rounded-xl items-center group">
                                    <div className="flex flex-col items-center justify-center w-8">
                                        <button onClick={() => moveItem(index, 'up')} className={`p-1 text-white/30 hover:text-white ${index === 0 ? 'invisible' : ''}`}>▲</button>
                                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white/60 select-none">
                                            {item.ordem}
                                        </div>
                                        <button onClick={() => moveItem(index, 'down')} className={`p-1 text-white/30 hover:text-white ${index === itens.length - 1 ? 'invisible' : ''}`}>▼</button>
                                    </div>

                                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-3 w-full">
                                        <div className="sm:col-span-6">
                                            <select
                                                value={item.produtoId}
                                                onChange={(e) => updateItem(index, 'produtoId', e.target.value)}
                                                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-gold transition-all appearance-none"
                                            >
                                                <option value="">Selecione o Produto...</option>
                                                {produtosDisponiveis.map(p => (
                                                    <option key={p.id} value={p.id}>{p.codigo ? `${p.codigo} - ` : ''}{p.nome}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="sm:col-span-3">
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={item.dosagem}
                                                onChange={(e) => updateItem(index, 'dosagem', e.target.value)}
                                                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-gold transition-all"
                                                placeholder="Dose"
                                            />
                                        </div>
                                        <div className="sm:col-span-3">
                                            <input
                                                value={item.unidadeMedidaId}
                                                onChange={(e) => updateItem(index, 'unidadeMedidaId', e.target.value)}
                                                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-gold transition-all"
                                                placeholder="Unid. (L/ha)"
                                            />
                                        </div>
                                    </div>

                                    <button onClick={() => removeItem(index)} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors ml-auto sm:ml-0" title="Remover da Receita">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
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
