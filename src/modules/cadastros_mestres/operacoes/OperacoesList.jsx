import React, { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import Swal from 'sweetalert2';
import { Search, Plus, Upload, Download, Edit3, Trash2, FileSpreadsheet, Activity } from 'lucide-react';

import { getOperacoes, saveOperacao, inactivateOperacao, saveOperacoesEmMassa } from '../../../services/cadastros_mestres/operacoesService';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { addNotification } from '../../../services/notificationService';

export default function OperacoesList() {
  const companyId = JSON.parse(localStorage.getItem('@AgroSystem:auth'))?.companyId || "AgroSystem_Demo";
  const authUser = JSON.parse(localStorage.getItem('@AgroSystem:auth'))?.uid || "system";

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOp, setEditingOp] = useState(null);

  const fileInputRef = useRef(null);

  // Consulta Live ao Dexie
  const operacoes = useLiveQuery(() => getOperacoes(companyId), [companyId]) || [];

  const filteredData = operacoes.filter((op) => {
    const term = searchTerm.toLowerCase();
    return (
      (op.cdOperacao || '').toLowerCase().includes(term) ||
      (op.deOperacao || '').toLowerCase().includes(term) ||
      (op.cdCcusto || '').toLowerCase().includes(term) ||
      (op.deCcusto || '').toLowerCase().includes(term)
    );
  });

  // Modal handlers
  const openModal = (op = null) => {
    setEditingOp(op || {
      codCcustoRateio: '',
      cdCcusto: '',
      deCcusto: '',
      cdOperacao: '',
      deOperacao: '',
      unidade: '',
      tipoOperacao: '',
      classe: ''
    });
    setIsModalOpen(true);
  };
  const closeModal = () => {
    setIsModalOpen(false);
    setEditingOp(null);
  };

  const handleSaveManual = async () => {
    if (!editingOp.cdOperacao || !editingOp.deOperacao) {
      Swal.fire('Atenção', 'Código e Descrição da Operação são obrigatórios', 'warning');
      return;
    }
    try {
      await saveOperacao(editingOp, companyId, authUser);
      addNotification(`Operação salva`, `A operação ${editingOp.cdOperacao} foi salva com sucesso.`, 'success');
      closeModal();
    } catch (err) {
      console.error(err);
      Swal.fire('Erro', 'Não foi possível salvar a operação.', 'error');
    }
  };

  const handleDelete = async (id, cod) => {
    const result = await Swal.fire({
      title: 'Tem certeza?',
      text: `Deseja excluir a operação ${cod}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sim, excluir',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        await inactivateOperacao(id, companyId, authUser);
        addNotification(`Operação inativada`, `A operação ${cod} foi excluída.`, 'info');
      } catch (err) {
        console.error(err);
        Swal.fire('Erro', 'Não foi possível excluir a operação.', 'error');
      }
    }
  };

  // Importação e Exportação Excel
  const handleExportExcel = () => {
    if (!operacoes || operacoes.length === 0) {
      Swal.fire('Aviso', 'Não há dados para exportar.', 'info');
      return;
    }

    const exportData = operacoes.map((op) => ({
      COD_CCUSTO_RATEIO: op.codCcustoRateio,
      CD_CCUSTO: op.cdCcusto,
      DE_CCUSTO: op.deCcusto,
      CD_OPERACAO: op.cdOperacao,
      DE_OPERACAO: op.deOperacao,
      UNIDADE: op.unidade,
      TIPO_OPERACAO: op.tipoOperacao,
      CLASSE: op.classe
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Operacoes");

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, `Operacoes_AgroSystem_${new Date().getTime()}.xlsx`);
  };

  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (rows.length === 0) {
          Swal.fire('Aviso', 'Planilha vazia ou em formato inválido.', 'warning');
          return;
        }

        // Bloqueia a interface com o SweetAlert2 (progress mock visual para feedback)
        Swal.fire({
          title: 'Importando Operações...',
          html: `Processando <b>${rows.length}</b> registros.<br/>Por favor, aguarde.`,
          allowOutsideClick: false,
          allowEscapeKey: false,
          showConfirmButton: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });

        // O método no serviço já usa bulkPut para ser rápido
        const count = await saveOperacoesEmMassa(rows, companyId, authUser);

        // Fecha o SweetAlert e notifica sucesso
        Swal.close();

        Swal.fire('Sucesso!', `${count} operações foram importadas e salvas na fila de sincronização.`, 'success');
        addNotification(`Importação concluída`, `Lote de ${count} operações importado com sucesso.`, 'success');

      } catch (err) {
        console.error('Erro na importação:', err);
        Swal.close();
        Swal.fire('Erro', 'Falha ao processar o arquivo Excel. Verifique se as colunas estão corretas.', 'error');
      }
    };

    reader.readAsBinaryString(file);
    // Limpa o input para poder importar o mesmo arquivo de novo se precisar
    if (fileInputRef.current) {
      fileInputRef.current.value = null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      <div className="sticky top-0 z-20 bg-white border-b px-6 py-4 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Activity className="w-6 h-6 text-green-600" />
            Operações
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Cadastro mestre de operações e centros de custo.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Buscar por código, desc..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-64 rounded-xl"
            />
          </div>

          <Button variant="outline" className="gap-2" onClick={handleExportExcel}>
            <Download className="w-4 h-4" /> Exportar
          </Button>

          <input
            type="file"
            accept=".xlsx, .xls"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImportExcel}
          />
          <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 text-blue-600" /> Importar Excel
          </Button>

          <Button className="gap-2 bg-green-600 hover:bg-green-700" onClick={() => openModal()}>
            <Plus className="w-4 h-4" /> Nova
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 custom-scrollbar">
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-slate-600 text-sm border-b">
              <tr>
                <th className="py-3 px-4 font-medium">Cód. Op.</th>
                <th className="py-3 px-4 font-medium">Desc. Operação</th>
                <th className="py-3 px-4 font-medium">Cód. C. Custo</th>
                <th className="py-3 px-4 font-medium">Desc. C. Custo</th>
                <th className="py-3 px-4 font-medium text-center">Unidade</th>
                <th className="py-3 px-4 font-medium text-center">Tipo</th>
                <th className="py-3 px-4 font-medium">Sync</th>
                <th className="py-3 px-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <FileSpreadsheet className="w-12 h-12 text-slate-300 mb-3" />
                      <p>Nenhuma operação encontrada.</p>
                      <p className="text-xs mt-1">Clique em Importar Excel ou Nova para começar.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((op) => (
                  <tr key={op.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-800">{op.cdOperacao || '-'}</td>
                    <td className="py-3 px-4 text-slate-600">{op.deOperacao || '-'}</td>
                    <td className="py-3 px-4 text-slate-600">{op.cdCcusto || '-'}</td>
                    <td className="py-3 px-4 text-slate-500 text-xs">{op.deCcusto || '-'}</td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant="outline">{op.unidade || '-'}</Badge>
                    </td>
                    <td className="py-3 px-4 text-center text-slate-600">{op.tipoOperacao || '-'}</td>
                    <td className="py-3 px-4">
                      {op.syncStatus === 'synced' ? (
                        <span className="w-2 h-2 rounded-full bg-green-500 inline-block" title="Sincronizado" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block animate-pulse" title="Pendente" />
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => openModal(op)}>
                        <Edit3 className="w-4 h-4 text-slate-500 hover:text-blue-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(op.id, op.cdOperacao)}>
                        <Trash2 className="w-4 h-4 text-slate-500 hover:text-red-600" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && editingOp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-semibold text-slate-800">
                {editingOp.id ? 'Editar Operação' : 'Nova Operação'}
              </h2>
            </div>

            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Código Operação *</label>
                  <Input
                    value={editingOp.cdOperacao}
                    onChange={e => setEditingOp({...editingOp, cdOperacao: e.target.value})}
                    placeholder="Ex: 11102"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Descrição Operação *</label>
                  <Input
                    value={editingOp.deOperacao}
                    onChange={e => setEditingOp({...editingOp, deOperacao: e.target.value})}
                    placeholder="Ex: CATACAO PREPARO"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Código C. Custo</label>
                  <Input
                    value={editingOp.cdCcusto}
                    onChange={e => setEditingOp({...editingOp, cdCcusto: e.target.value})}
                    placeholder="Ex: 3007"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Descrição C. Custo</label>
                  <Input
                    value={editingOp.deCcusto}
                    onChange={e => setEditingOp({...editingOp, deCcusto: e.target.value})}
                    placeholder="Ex: PREPARO DE SOLO"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Cód. Rateio</label>
                  <Input
                    value={editingOp.codCcustoRateio}
                    onChange={e => setEditingOp({...editingOp, codCcustoRateio: e.target.value})}
                    placeholder="Opcional"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Unidade</label>
                  <Input
                    value={editingOp.unidade}
                    onChange={e => setEditingOp({...editingOp, unidade: e.target.value})}
                    placeholder="Ex: HR, D"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Tipo Operação</label>
                  <Input
                    value={editingOp.tipoOperacao}
                    onChange={e => setEditingOp({...editingOp, tipoOperacao: e.target.value})}
                    placeholder="Ex: HORIMETRO, DIARIA"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Classe</label>
                  <Input
                    value={editingOp.classe}
                    onChange={e => setEditingOp({...editingOp, classe: e.target.value})}
                    placeholder="Opcional"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-slate-50 flex justify-end gap-3">
              <Button variant="outline" onClick={closeModal}>Cancelar</Button>
              <Button className="bg-green-600 hover:bg-green-700" onClick={handleSaveManual}>
                Salvar Operação
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
