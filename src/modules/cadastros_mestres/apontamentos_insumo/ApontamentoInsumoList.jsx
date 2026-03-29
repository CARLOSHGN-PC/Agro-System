import React, { useState, useEffect } from 'react';
import { palette } from '../../../constants/theme.js';
import { ClipboardList, Trash2, Download, Upload, Search, FileSpreadsheet } from 'lucide-react';
import { getApontamentosInsumo, inactivateApontamentoInsumo, saveApontamentosEmMassa } from '../../../services/cadastros_mestres/apontamentoInsumoService.js';
import { useAuth } from '../../../hooks/useAuth.js';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import Swal from 'sweetalert2';

/**
 * @file ApontamentoInsumoList.jsx
 * @description Listagem e importação do Cadastro Mestre de Apontamento de Insumos.
 * @module ApontamentoInsumoList
 */

export default function ApontamentoInsumoList() {
  const { user } = useAuth();
  const companyId = JSON.parse(localStorage.getItem('@AgroSystem:auth'))?.companyId || "AgroSystem_Demo";

  const [apontamentos, setApontamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Paginação simples
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
        const data = await getApontamentosInsumo(companyId);
        setApontamentos(data.filter(ap => ap.status === 'ATIVO')); // Oculta inativados da lista principal
    } catch (error) {
        console.error("Erro ao carregar apontamentos:", error);
    }
    setLoading(false);
  };

  const handleInactivate = async (id) => {
    const result = await Swal.fire({
      title: 'Desativar apontamento?',
      text: "Isso inativará este registro de apontamento de insumo.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: palette.danger,
      cancelButtonColor: '#333',
      confirmButtonText: 'Sim, inativar',
      cancelButtonText: 'Cancelar',
      background: '#1a1a1a',
      color: '#fff'
    });

    if (result.isConfirmed) {
      try {
        await inactivateApontamentoInsumo(id, user?.uid || 'user_demo', companyId);
        Swal.fire({
          title: 'Inativado!',
          text: 'O apontamento foi inativado.',
          icon: 'success',
          background: '#1a1a1a',
          color: '#fff',
          confirmButtonColor: palette.gold
        });
        loadData();
      } catch (error) {
        Swal.fire({
          title: 'Erro!',
          text: 'Não foi possível inativar o apontamento.',
          icon: 'error',
          background: '#1a1a1a',
          color: '#fff',
          confirmButtonColor: palette.danger
        });
      }
    }
  };

  const processarPlanilha = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Reseta o input para permitir selecionar o mesmo arquivo novamente, se necessário
    e.target.value = null;

    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const wsname = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { defval: "" });

        if (data.length === 0) {
            Swal.fire({
                title: 'Planilha Vazia',
                text: 'A planilha selecionada não contém dados.',
                icon: 'warning',
                background: '#121212',
                color: '#fff',
                confirmButtonColor: palette.gold
            });
            return;
        }

        // Abre SweetAlert bloqueante com barra de progresso
        Swal.fire({
            title: 'Importando Apontamentos',
            html: `
              <div style="color: #ccc; margin-bottom: 15px;">Aguarde, os dados estão sendo salvos no banco de dados. Este processo pode levar alguns minutos.</div>
              <div style="font-size: 14px; font-weight: bold; margin-bottom: 10px;" id="progress-text">Processando 0 de ${data.length} linhas...</div>
              <div style="width: 100%; background-color: #333; border-radius: 4px; height: 10px; overflow: hidden;">
                  <div id="progress-bar" style="width: 0%; height: 100%; background-color: ${palette.primary}; transition: width 0.1s linear;"></div>
              </div>
            `,
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            background: '#121212',
            color: '#fff',
            didOpen: async () => {
                const updateProgress = (processed, total) => {
                    const pct = Math.round((processed / total) * 100);
                    const progressBar = document.getElementById('progress-bar');
                    const progressText = document.getElementById('progress-text');
                    if (progressBar && progressText) {
                        progressBar.style.width = `${pct}%`;
                        progressText.innerText = `Processando ${processed} de ${total} linhas...`;
                    }
                };

                try {
                    await saveApontamentosEmMassa(data, user?.uid || 'user_demo', companyId, updateProgress);

                    Swal.fire({
                        title: 'Sucesso!',
                        text: `${data.length} apontamentos importados.`,
                        icon: 'success',
                        background: '#121212',
                        color: '#fff',
                        confirmButtonColor: palette.primary
                    });
                    loadData();
                } catch (err) {
                    console.error("Erro na importação:", err);
                    Swal.fire({
                        title: 'Erro na Importação',
                        text: 'Ocorreu um erro ao processar os dados. Verifique a planilha.',
                        icon: 'error',
                        background: '#121212',
                        color: '#fff',
                        confirmButtonColor: palette.danger
                    });
                }
            }
        });

      } catch (err) {
        console.error(err);
        Swal.fire({
            title: 'Erro ao ler arquivo',
            text: 'Não foi possível ler a planilha selecionada.',
            icon: 'error',
            background: '#121212',
            color: '#fff',
            confirmButtonColor: palette.danger
        });
      }
    };

    reader.readAsBinaryString(file);
  };

  const baixarTemplate = () => {
      // Cria a estrutura que reflete exatamente as colunas
      const ws = XLSX.utils.json_to_sheet([{
          CLUSTER: '', EMPRESA: '', MOD_ADM: '', INSTANCIA: '', DT_HISTORICO: '', CD_CCUSTO: '', DE_CCUSTO: '', CD_OP: '', DE_OPERACAO: '', UND_OPER: '', COD_FAZ: '', DES_FAZENDA: '', BLOCO: '', DES_BLOCO: '', TALHAO: '', ETAPA: '', COD_INSUMO: '', DESC_INSUMO: '', HA_APLIC: '', QTDE_APLIC: '', DOSE_APLIC: '', DOSE_REC: '', VLR_UNIT: '', TOTAL_RS: ''
      }]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Apontamentos");
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      saveAs(new Blob([wbout], { type: "application/octet-stream" }), "template_apontamento_insumo.xlsx");
  };

  const baixarDadosAtuais = () => {
      if (apontamentos.length === 0) {
          Swal.fire({
            title: 'Sem dados',
            text: 'Não há apontamentos para exportar.',
            icon: 'info',
            background: '#121212',
            color: '#fff',
            confirmButtonColor: palette.primary
        });
        return;
      }

      const ws = XLSX.utils.json_to_sheet(apontamentos.map(ap => ({
          CLUSTER: ap.cluster, EMPRESA: ap.empresa, MOD_ADM: ap.modAdm, INSTANCIA: ap.instancia, DT_HISTORICO: ap.dtHistorico, CD_CCUSTO: ap.cdCcusto, DE_CCUSTO: ap.deCcusto, CD_OP: ap.cdOp, DE_OPERACAO: ap.deOperacao, UND_OPER: ap.undOper, COD_FAZ: ap.codFaz, DES_FAZENDA: ap.desFazenda, BLOCO: ap.bloco, DES_BLOCO: ap.desBloco, TALHAO: ap.talhao, ETAPA: ap.etapa, COD_INSUMO: ap.codInsumo, DESC_INSUMO: ap.descInsumo, HA_APLIC: ap.haAplic, QTDE_APLIC: ap.qtdeAplic, DOSE_APLIC: ap.doseAplic, DOSE_REC: ap.doseRec, VLR_UNIT: ap.vlrUnit, TOTAL_RS: ap.totalRs
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Apontamentos");
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      saveAs(new Blob([wbout], { type: "application/octet-stream" }), "apontamentos_insumo_exportacao.xlsx");
  };


  const filteredData = apontamentos.filter(ap =>
    ap.codInsumo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ap.descInsumo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ap.desFazenda?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ap.deOperacao?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const currentData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0A0A0A] border border-white/5 rounded-[24px]">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: palette.primary, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0A0A0A] border border-white/5 rounded-[24px] overflow-hidden">

      {/* HEADER DA TAB */}
      <div className="sticky top-0 z-20 shrink-0 border-b border-white/10 bg-[#0A0A0A] p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <ClipboardList className="w-5 h-5 text-white/70" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Apontamentos de Insumo</h2>
              <p className="text-sm text-white/50">{apontamentos.length} registros cadastrados</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                placeholder="Buscar (Cod, Insumo, Fazenda, Op)..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-white/20 transition-colors"
              />
            </div>

            <input
               type="file"
               id="import-excel-apontamentos"
               accept=".xlsx, .xls"
               className="hidden"
               onChange={processarPlanilha}
            />

            <button
                onClick={() => document.getElementById('import-excel-apontamentos').click()}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white rounded-xl text-sm font-medium hover:bg-white/10 transition-colors"
                title="Importar Excel"
            >
                <Upload className="w-4 h-4" /> <span className="hidden sm:inline">Importar</span>
            </button>

            <button
                onClick={baixarDadosAtuais}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white rounded-xl text-sm font-medium hover:bg-white/10 transition-colors"
                title="Exportar Dados Atuais"
            >
                <Download className="w-4 h-4" /> <span className="hidden sm:inline">Exportar</span>
            </button>
            <button
                 onClick={baixarTemplate}
                 className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white rounded-xl text-sm font-medium hover:bg-white/10 transition-colors"
                 title="Baixar Template (Molde)"
            >
                 <FileSpreadsheet className="w-4 h-4" /> <span className="hidden sm:inline">Template</span>
            </button>
          </div>
      </div>

      {/* LISTA (TABELA) */}
      <div className="flex-1 overflow-auto custom-scrollbar">
          {filteredData.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-white/40">
                <ClipboardList className="w-12 h-12 mb-4 opacity-20" />
                <p>Nenhum apontamento encontrado.</p>
                {searchTerm && <button onClick={() => setSearchTerm('')} className="mt-2 text-sm text-white/60 hover:text-white">Limpar busca</button>}
            </div>
          ) : (
            <div className="min-w-[1200px] p-6">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-white/10 text-xs uppercase text-white/40">
                            <th className="pb-3 px-4 font-semibold">Data</th>
                            <th className="pb-3 px-4 font-semibold">Fazenda/Talhão</th>
                            <th className="pb-3 px-4 font-semibold">Operação</th>
                            <th className="pb-3 px-4 font-semibold">Insumo</th>
                            <th className="pb-3 px-4 font-semibold text-right">Qtd. Aplic.</th>
                            <th className="pb-3 px-4 font-semibold text-right">Dose Aplic.</th>
                            <th className="pb-3 px-4 font-semibold text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentData.map((ap) => (
                            <tr key={ap.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                                <td className="py-4 px-4 text-sm text-white whitespace-nowrap">{ap.dtHistorico || '-'}</td>
                                <td className="py-4 px-4 text-sm text-white">
                                    <div className="font-medium text-white/90">{ap.codFaz} - {ap.desFazenda}</div>
                                    <div className="text-xs text-white/50">Bloco {ap.bloco || '-'} / Talhão {ap.talhao || '-'}</div>
                                </td>
                                <td className="py-4 px-4 text-sm text-white">
                                    <div className="font-medium text-white/90">{ap.cdOp}</div>
                                    <div className="text-xs text-white/50">{ap.deOperacao}</div>
                                </td>
                                <td className="py-4 px-4 text-sm text-white">
                                    <div className="font-medium text-white/90">{ap.codInsumo}</div>
                                    <div className="text-xs text-white/50 max-w-xs truncate" title={ap.descInsumo}>{ap.descInsumo}</div>
                                </td>
                                <td className="py-4 px-4 text-sm text-white/80 text-right">{ap.qtdeAplic || '-'}</td>
                                <td className="py-4 px-4 text-sm text-white/80 text-right">{ap.doseAplic || '-'}</td>
                                <td className="py-4 px-4 text-center">
                                    <button
                                        onClick={() => handleInactivate(ap.id)}
                                        className="p-2 text-white/30 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                        title="Inativar/Remover"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          )}
      </div>

      {/* PAGINAÇÃO */}
      {totalPages > 1 && (
        <div className="shrink-0 border-t border-white/10 bg-[#0A0A0A] p-4 flex items-center justify-between text-sm text-white/60">
            <div>
                Mostrando {(currentPage - 1) * itemsPerPage + 1} a {Math.min(currentPage * itemsPerPage, filteredData.length)} de {filteredData.length}
            </div>
            <div className="flex gap-2">
                <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="px-3 py-1 bg-white/5 border border-white/10 rounded disabled:opacity-50 hover:bg-white/10 transition-colors"
                >
                    Anterior
                </button>
                <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="px-3 py-1 bg-white/5 border border-white/10 rounded disabled:opacity-50 hover:bg-white/10 transition-colors"
                >
                    Próxima
                </button>
            </div>
        </div>
      )}
    </div>
  );
}
