import React, { useState } from 'react';
import { X, FileDown, CheckCircle, Loader2 } from 'lucide-react';

// O backend não tem uma api exportada, então usaremos fetch
const BASE_URL = import.meta.env.VITE_API_URL || '';

export default function OrdemCortePdfModal({ isOpen, onClose, ordem, companyId }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !ordem) return null;

  const handleDownload = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      // Faz a chamada ao backend para gerar o PDF da Ordem de Corte via API REST
      const response = await fetch(`${BASE_URL}/api/estimativas/${companyId}/relatorios/ordem-corte/pdf?ordemId=${encodeURIComponent(ordem.id)}`);

      if (!response.ok) {
        throw new Error('Falha na resposta do servidor');
      }

      const blob = await response.blob();
      // Cria URL do blob e engatilha o download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `OrdemCorte_${ordem.numeroEmpresa || ordem.codigo}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);

      onClose();
    } catch (err) {
      console.error('Erro ao gerar PDF da Ordem de Corte:', err);
      setError('Ocorreu um erro ao gerar o PDF. Verifique sua conexão e tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b bg-purple-50">
          <h2 className="text-lg font-bold text-purple-900 flex items-center gap-2">
            <FileDown className="w-5 h-5 text-purple-600" />
            Gerar PDF
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-purple-200 transition-colors text-purple-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 text-center flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mb-2">
            <FileDown className="w-8 h-8 text-purple-600" />
          </div>

          <div>
            <h3 className="text-base font-bold text-gray-900">Ordem {ordem.numeroEmpresa || ordem.codigo}</h3>
            <p className="text-sm text-gray-500 mt-1">Deseja gerar o documento em PDF desta ordem de corte?</p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 w-full text-left text-sm mt-2 border">
            <p className="flex justify-between mb-1"><span className="text-gray-500">ID:</span> <span className="font-mono font-medium">{ordem.id}</span></p>
            <p className="flex justify-between mb-1"><span className="text-gray-500">Frente:</span> <span className="font-medium">{ordem.frenteServico || '-'}</span></p>
            <p className="flex justify-between mb-1"><span className="text-gray-500">Resp:</span> <span className="font-medium">{ordem.nomeColaborador || '-'}</span></p>
            <p className="flex justify-between"><span className="text-gray-500">Talhões:</span> <span className="font-medium">{(ordem.talhaoIds || []).length}</span></p>
          </div>

        </div>

        {error && (
          <div className="px-6 pb-2">
             <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl border border-red-100 w-full text-left">
               {error}
             </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-5 border-t bg-gray-50 flex flex-col gap-3">
          <button
            onClick={handleDownload}
            disabled={isGenerating}
            className="w-full px-5 py-3 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-all shadow-md shadow-purple-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Gerando Documento...</>
            ) : (
              <><FileDown className="w-4 h-4" /> Baixar PDF</>
            )}
          </button>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="w-full px-5 py-3 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>

      </div>
    </div>
  );
}
