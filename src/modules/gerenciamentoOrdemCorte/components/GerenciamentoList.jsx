import React, { useState } from 'react';
import { Eye, Edit3, FileDown, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { ORDEM_CORTE_STATUS } from '../../../services/ordemCorte/ordemCorteConstants';
import OrdemCorteInfoModal from './OrdemCorteInfoModal';
import OrdemCortePdfModal from './OrdemCortePdfModal';
import OrdemCorteViewModal from './OrdemCorteViewModal';

export default function GerenciamentoList({ ordens, companyId, safra }) {
  const [selectedOrdem, setSelectedOrdem] = useState(null);
  const [modalType, setModalType] = useState(null); // 'info', 'view', 'edit', 'pdf'

  const openModal = (ordem, type) => {
    setSelectedOrdem(ordem);
    setModalType(type);
  };

  const closeModal = () => {
    setSelectedOrdem(null);
    setModalType(null);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case ORDEM_CORTE_STATUS.AGUARDANDO:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800"><Clock className="w-3 h-3 mr-1" /> Aguardando</span>;
      case ORDEM_CORTE_STATUS.ABERTA:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800"><CheckCircle className="w-3 h-3 mr-1" /> Aberta</span>;
      case ORDEM_CORTE_STATUS.FINALIZADA:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"><AlertCircle className="w-3 h-3 mr-1" /> Finalizada</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  return (
    <div className="w-full">
      <table className="w-full text-left text-sm text-gray-600">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-6 py-3 font-semibold text-gray-900">Data</th>
            <th className="px-6 py-3 font-semibold text-gray-900">Frente</th>
            <th className="px-6 py-3 font-semibold text-gray-900">ID do sistema Ordem de Corte</th>
            <th className="px-6 py-3 font-semibold text-gray-900">Nº Ordem Empresa</th>
            <th className="px-6 py-3 font-semibold text-gray-900">Responsável</th>
            <th className="px-6 py-3 font-semibold text-gray-900">Status</th>
            <th className="px-6 py-3 font-semibold text-gray-900 text-center">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {ordens.length === 0 ? (
            <tr>
              <td colSpan="7" className="px-6 py-12 text-center text-gray-400">
                Nenhuma ordem encontrada para os filtros aplicados.
              </td>
            </tr>
          ) : (
            ordens.map(ordem => (
              <tr key={ordem.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  {new Date(ordem.createdAt).toLocaleDateString('pt-BR')}
                </td>
                <td className="px-6 py-4 font-medium text-gray-900">
                  {ordem.frenteServico || '-'}
                </td>
                <td className="px-6 py-4 text-gray-500 font-mono text-xs">
                  {ordem.id}
                </td>
                <td className="px-6 py-4">
                  {ordem.numeroEmpresa ? (
                    <span className="font-semibold text-gray-900">{ordem.numeroEmpresa}</span>
                  ) : (
                    <button
                      onClick={() => openModal(ordem, 'info')}
                      className="text-amber-600 hover:text-amber-700 font-medium hover:underline text-xs bg-amber-50 px-2 py-1 rounded"
                    >
                      Informar número
                    </button>
                  )}
                </td>
                <td className="px-6 py-4">
                  {ordem.nomeColaborador || '-'}
                </td>
                <td className="px-6 py-4">
                  {getStatusBadge(ordem.status)}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => openModal(ordem, 'view')}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1 border bg-white shadow-sm"
                      title="Ver Ordem"
                    >
                      <Eye className="w-4 h-4" /> <span className="text-xs font-semibold px-1">Ver</span>
                    </button>
                    <button
                      onClick={() => openModal(ordem, 'edit')}
                      className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors flex items-center gap-1 border bg-white shadow-sm"
                      title="Editar Ordem"
                    >
                      <Edit3 className="w-4 h-4" /> <span className="text-xs font-semibold px-1">Editar</span>
                    </button>
                    <button
                      onClick={() => openModal(ordem, 'pdf')}
                      className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors flex items-center gap-1 border bg-white shadow-sm"
                      title="Gerar PDF"
                    >
                      <FileDown className="w-4 h-4" /> <span className="text-xs font-semibold px-1">PDF</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Renderização Condicional dos Modais */}
      {modalType === 'info' && selectedOrdem && (
        <OrdemCorteInfoModal
          isOpen={true}
          onClose={closeModal}
          ordem={selectedOrdem}
        />
      )}

      {modalType === 'view' && selectedOrdem && (
        <OrdemCorteViewModal
          isOpen={true}
          onClose={closeModal}
          ordem={selectedOrdem}
          onOpenPdf={() => setModalType('pdf')}
        />
      )}

      {modalType === 'edit' && selectedOrdem && (
        <OrdemCorteInfoModal
          isOpen={true}
          onClose={closeModal}
          ordem={selectedOrdem}
          isEditMode={true}
        />
      )}

      {modalType === 'pdf' && selectedOrdem && (
        <OrdemCortePdfModal
          isOpen={true}
          onClose={closeModal}
          ordem={selectedOrdem}
          companyId={companyId}
        />
      )}
    </div>
  );
}
