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
      case ORDEM_CORTE_STATUS.AGUARDANDO: return 'text-red-400 bg-red-400/10 border-red-400/20';
      case ORDEM_CORTE_STATUS.ABERTA: return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      case ORDEM_CORTE_STATUS.FINALIZADA: return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      default: return 'text-gray-400 bg-white/5 border-white/10';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200 border" style={{ background: '#111a2d', borderColor: 'rgba(255,255,255,0.12)' }}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.02)' }}>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" /> Detalhes da Ordem
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:bg-white/10"
            style={{ color: '#aebccb' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-y-6 gap-x-8">
            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#aebccb' }}>ID do Sistema</p>
              <p className="text-sm font-mono text-white rounded-lg border px-3 py-2" style={{ background: 'rgba(0,0,0,0.2)', borderColor: 'rgba(255,255,255,0.08)' }}>{ordem.id}</p>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#aebccb' }}>Nº Ordem Empresa</p>
              <p className="text-sm font-bold text-white rounded-lg border px-3 py-2" style={{ background: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.2)' }}>{ordem.numeroEmpresa || 'Não informado'}</p>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#aebccb' }}>Status</p>
              <span className={`inline-flex px-3 py-1 text-xs font-bold uppercase rounded-lg border ${getStatusColor(ordem.status)}`}>
                {ordem.status}
              </span>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#aebccb' }}>Frente de Serviço</p>
              <p className="text-sm font-semibold text-white">{ordem.frenteServico || 'Não informado'}</p>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#aebccb' }}>Responsável</p>
              <p className="text-sm font-medium text-white">{ordem.nomeColaborador || 'Não informado'}</p>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#aebccb' }}>Data de Criação</p>
              <p className="text-sm font-medium text-white">{new Date(ordem.createdAt).toLocaleString('pt-BR')}</p>
            </div>

            <div className="col-span-2">
               <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#aebccb' }}>Quantidade de Talhões Vinculados</p>
               <p className="text-sm font-medium text-white rounded-lg border inline-block px-3 py-2" style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.12)' }}>{(ordem.talhaoIds || []).length} talhões</p>
            </div>

            <div className="col-span-2">
               <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#aebccb' }}>Talhões Vinculados</p>
               <div className="flex flex-wrap gap-2 mt-2">
                 {ordem.talhaoIds?.map((id, index) => (
                   <div key={id} className="px-3 py-1.5 text-blue-300 font-mono text-xs rounded-lg border" style={{ background: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.2)' }}>
                     {ordem.talhoesNomes ? ordem.talhoesNomes[index] : id}
                   </div>
                 ))}
               </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t flex justify-between gap-3" style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.02)' }}>
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold rounded-xl transition-colors hover:bg-white/10"
            style={{ color: '#aebccb' }}
          >
            Fechar
          </button>
          <button
            onClick={handleDownload}
            className="px-5 py-2.5 text-sm font-semibold text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 rounded-xl transition-all flex items-center gap-2 border shadow-sm"
            style={{ borderColor: 'rgba(168, 85, 247, 0.3)' }}
          >
            <Download className="w-4 h-4" />
            Gerar PDF
          </button>
        </div>

      </div>
    </div>
  );
}
