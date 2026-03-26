import React from 'react';
import { X, FileText, Download } from 'lucide-react';
import { ORDEM_CORTE_STATUS } from '../../../services/ordemCorte/ordemCorteConstants';

export default function OrdemCorteViewModal({ isOpen, onClose, ordem, onOpenPdf }) {
  if (!isOpen || !ordem) return null;

  const handleDownload = () => {
    onClose();
    if (onOpenPdf) onOpenPdf();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case ORDEM_CORTE_STATUS.AGUARDANDO: return 'text-red-600 bg-red-50 border-red-200';
      case ORDEM_CORTE_STATUS.ABERTA: return 'text-amber-600 bg-amber-50 border-amber-200';
        case ORDEM_CORTE_STATUS.FINALIZADA: return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b bg-gray-50/50">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" /> Detalhes da Ordem
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-y-6 gap-x-8">
            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">ID do Sistema</p>
              <p className="text-sm font-mono text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border">{ordem.id}</p>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Nº Ordem Empresa</p>
              <p className="text-sm font-bold text-gray-900 bg-blue-50/50 px-3 py-2 rounded-lg border border-blue-100">{ordem.numeroEmpresa || 'Não informado'}</p>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Status</p>
              <span className={`inline-flex px-3 py-1 text-xs font-bold uppercase rounded-lg border ${getStatusColor(ordem.status)}`}>
                {ordem.status}
              </span>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Frente de Serviço</p>
              <p className="text-sm font-semibold text-gray-800">{ordem.frenteServico || 'Não informado'}</p>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Responsável</p>
              <p className="text-sm font-medium text-gray-800">{ordem.nomeColaborador || 'Não informado'}</p>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Data de Criação</p>
              <p className="text-sm font-medium text-gray-800">{new Date(ordem.createdAt).toLocaleString('pt-BR')}</p>
            </div>

            <div className="col-span-2">
               <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Quantidade de Talhões Vinculados</p>
               <p className="text-sm font-medium text-gray-800 bg-gray-50 px-3 py-2 rounded-lg border inline-block">{(ordem.talhaoIds || []).length} talhões</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t bg-gray-50 flex justify-between gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-xl transition-colors"
          >
            Fechar
          </button>
          <button
            onClick={handleDownload}
            className="px-5 py-2.5 text-sm font-semibold text-purple-700 bg-purple-100 hover:bg-purple-200 rounded-xl transition-all flex items-center gap-2 border border-purple-200 shadow-sm"
          >
            <Download className="w-4 h-4" />
            Gerar PDF
          </button>
        </div>

      </div>
    </div>
  );
}
