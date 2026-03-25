import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { editarOrdemCorte } from '../../../services/ordemCorte/ordemCorteService';
import { ORDEM_CORTE_STATUS } from '../../../services/ordemCorte/ordemCorteConstants';

export default function OrdemCorteInfoModal({ isOpen, onClose, ordem, isEditMode = false }) {
  const [numeroEmpresa, setNumeroEmpresa] = useState('');
  const [frente, setFrente] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (ordem) {
      setNumeroEmpresa(ordem.numeroEmpresa || '');
      setFrente(ordem.frenteServico || '');
      setResponsavel(ordem.nomeColaborador || '');
    }
  }, [ordem]);

  if (!isOpen || !ordem) return null;

  const handleSave = async () => {
    setIsSaving(true);

    // Regra principal: Se colocou número -> ABERTA. Se tirou -> AGUARDANDO.
    // Se a ordem já for FINALIZADA, ela continua FINALIZADA.
    let novoStatus = ordem.status;
    if (ordem.status !== ORDEM_CORTE_STATUS.FINALIZADA) {
       novoStatus = numeroEmpresa.trim() ? ORDEM_CORTE_STATUS.ABERTA : ORDEM_CORTE_STATUS.AGUARDANDO;
    }

    const novosDados = {
      numeroEmpresa: numeroEmpresa.trim(),
      status: novoStatus
    };

    if (isEditMode) {
       novosDados.frenteServico = frente.trim();
       novosDados.nomeColaborador = responsavel.trim();
    }

    await editarOrdemCorte(ordem.id, novosDados);

    setIsSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b bg-gray-50/50">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {isEditMode ? 'Editar Ordem de Corte' : 'Informar Nº Ordem Empresa'}
            </h2>
            <p className="text-sm text-gray-500 font-mono mt-0.5">{ordem.id}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-5">
          {/* Read-only ID field */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">ID Sistema Ordem de Corte</label>
            <input
              type="text"
              readOnly
              value={ordem.id}
              className="w-full bg-gray-100 text-gray-600 border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono cursor-not-allowed outline-none border"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
              Nº Ordem Empresa
            </label>
            <input
              type="text"
              placeholder="Ex: 5012934"
              value={numeroEmpresa}
              onChange={e => setNumeroEmpresa(e.target.value)}
              className="w-full bg-white border-gray-300 text-gray-900 rounded-xl px-4 py-2.5 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all border shadow-sm"
              autoFocus={!isEditMode}
            />
            {!isEditMode && (
              <p className="text-xs text-gray-500 mt-2">
                Ao informar um número, o status mudará para <span className="font-semibold text-emerald-600">ABERTA</span>.
              </p>
            )}
          </div>

          {isEditMode && (
            <>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Frente</label>
                <input
                  type="text"
                  value={frente}
                  onChange={e => setFrente(e.target.value)}
                  className="w-full bg-white border-gray-300 text-gray-900 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all border shadow-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Responsável</label>
                <input
                  type="text"
                  value={responsavel}
                  onChange={e => setResponsavel(e.target.value)}
                  className="w-full bg-white border-gray-300 text-gray-900 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all border shadow-sm"
                />
              </div>
            </>
          )}

        </div>

        {/* Footer */}
        <div className="p-5 border-t bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-500/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>

      </div>
    </div>
  );
}
