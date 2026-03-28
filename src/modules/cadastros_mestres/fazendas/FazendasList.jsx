import React, { useState, useEffect } from 'react';
import { palette } from '../../../constants/theme.js';
import { Download, Upload, MapPin, Eye, FileSpreadsheet } from 'lucide-react';
import { getFazendas, saveFazendaAndTalhoes } from '../../../services/cadastros_mestres/fazendas/fazendasService.js';
import { useAuth } from '../../../hooks/useAuth.js';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import FazendaDetailModal from './FazendaDetailModal.jsx';

/**
 * @file FazendasList.jsx
 * @description Listagem Mestra do Cadastro Geral de Fazendas e Ferramenta de Importação via Excel.
 * @module FazendasList
 */

// Todas as 45 colunas exigidas pelo modelo do Cadastro Geral (Mestre de Fazendas)
const CABECALHO_MODELO = [
  "CLUSTER", "EMPRESA", "MOD_ADM", "UM_INDUSTRIAL", "CD_SAFRA", "TIPO_PROPRIEDADE",
  "CD_EMPRESA", "COD_FAZ", "DES_FAZENDA", "BLOCO", "TALHAO", "AREA_TALHAO",
  "ESTAGIO", "VARIEDADE", "AMBIENTE", "FORNECEDOR", "DE_MUNICIPIO", "OCUPACAO",
  "DE_ESPACAMENTO", "TIPO_SOLO", "DT_PLANTIO", "DT_ULTCORTE", "SISTEMA_PLANTIO",
  "DIST_TERRA", "DIST_ASFALTO", "DIST_TOTAL", "SIST_IRRIG", "MATURACAO",
  "INSTITUICAO", "MANEJO_HIPOTETICO", "INCIO_CTT", "FIM_CTT", "VENC_CONTRATO",
  "EXPANSAO", "REF_PLANEJADA", "REF_CONFIRMADA", "DEVOLUCAO", "BACIA_VINHACA",
  "PAV", "RESTRICAO_1", "RESTRICAO_2", "RESTRICAO_3", "CERTIFICACAO_1",
  "CERTIFICACAO_2", "CERTIFICACAO_3"
];

export default function FazendasList() {
  const { user } = useAuth();
  const companyId = JSON.parse(localStorage.getItem('@AgroSystem:auth'))?.companyId || "AgroSystem_Demo";

  const [fazendas, setFazendas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentFazendaId, setCurrentFazendaId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const dataFazendas = await getFazendas(companyId);
    setFazendas(dataFazendas);
    setLoading(false);
  };

  const exportarModelo = () => {
    const ws = XLSX.utils.aoa_to_sheet([CABECALHO_MODELO]);

    // Configurar a largura das colunas para melhor visualização
    const wscols = CABECALHO_MODELO.map(() => ({ wch: 20 }));
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cadastro Geral");
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const data = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(data, "Modelo_Cadastro_Geral_AgroSystem.xlsx");
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(firstSheet, { defval: "" }); // Evita colunas undefined

            if (json.length === 0) {
                alert("Planilha vazia ou com formato inválido.");
                setIsImporting(false);
                return;
            }

            // Agrupar todas as linhas da planilha por COD_FAZ para iterar de forma eficiente
            const fazendasGrouped = {};
            json.forEach(row => {
                const codFaz = row['COD_FAZ'];
                if (codFaz !== undefined && codFaz !== "") {
                    if (!fazendasGrouped[codFaz]) {
                        fazendasGrouped[codFaz] = {
                            COD_FAZ: codFaz,
                            DES_FAZENDA: row['DES_FAZENDA'],
                            talhoes: []
                        };
                    }
                    fazendasGrouped[codFaz].talhoes.push(row);
                }
            });

            // Persistir cada fazenda agrupada e seus talhões no IndexedDB e enfileirar para o Firebase
            for (const codFaz in fazendasGrouped) {
                const grupo = fazendasGrouped[codFaz];
                await saveFazendaAndTalhoes(grupo, grupo.talhoes, user?.uid || 'system', companyId);
            }

            alert(`Importação concluída com sucesso! ${Object.keys(fazendasGrouped).length} fazendas cadastradas/atualizadas.`);
            loadData();
        } catch (error) {
            console.error("Erro na importação:", error);
            alert("Ocorreu um erro ao ler a planilha. Verifique o formato do arquivo.");
        } finally {
            setIsImporting(false);
            e.target.value = null; // Reseta o input
        }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
                <MapPin className="w-6 h-6" style={{ color: palette.gold }} />
                Fazendas Cadastradas
            </h2>
            <p className="text-sm text-white/50 mt-1">Base mestre de propriedades e talhões (via planilha)</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
            <button
                onClick={exportarModelo}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white/80 bg-white/5 hover:bg-white/10 hover:text-white transition-all border border-white/10 whitespace-nowrap"
            >
                <Download className="w-4 h-4" /> Baixar Modelo (Excel)
            </button>
            <label className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-black transition-all shadow-lg cursor-pointer ${isImporting ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`} style={{ background: palette.gold }}>
                <Upload className="w-4 h-4" />
                {isImporting ? 'Importando...' : 'Importar Planilha'}
                <input
                    type="file"
                    accept=".xlsx, .xls"
                    className="hidden"
                    onChange={handleImport}
                    disabled={isImporting}
                />
            </label>
        </div>
      </div>

      <div className="flex-1 overflow-auto rounded-2xl border border-white/5 bg-[#0A0A0A]">
        <table className="w-full text-left text-sm">
            <thead className="bg-black/40 text-white/50 border-b border-white/5 sticky top-0 backdrop-blur-sm z-10">
                <tr>
                    <th className="px-6 py-4 font-semibold">Código da Fazenda</th>
                    <th className="px-6 py-4 font-semibold">Nome / Descrição</th>
                    <th className="px-6 py-4 font-semibold">Status de Sincronia</th>
                    <th className="px-6 py-4 font-semibold text-right">Ver Detalhes</th>
                </tr>
            </thead>
            <tbody>
                {fazendas.length === 0 && !loading && (
                    <tr>
                        <td colSpan="4" className="text-center py-16 text-white/40">
                            <div className="flex flex-col items-center justify-center">
                                <FileSpreadsheet className="w-12 h-12 mb-4 opacity-20" />
                                <p className="text-lg">Nenhuma fazenda cadastrada.</p>
                                <p className="text-xs mt-2">Baixe o modelo, preencha as 45 colunas e importe a planilha mestre.</p>
                            </div>
                        </td>
                    </tr>
                )}
                {fazendas.map(f => (
                    <tr key={f.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                        <td className="px-6 py-4 font-mono text-white/80">{f.codFaz}</td>
                        <td className="px-6 py-4 font-medium text-white">{f.desFazenda}</td>
                        <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${f.syncStatus === 'synced' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                {f.syncStatus === 'synced' ? 'Nuvem OK' : 'Sincronizando...'}
                            </span>
                        </td>
                        <td className="px-6 py-4 flex items-center justify-end">
                            <button
                                onClick={() => { setCurrentFazendaId(f.id); setIsModalOpen(true); }}
                                className="p-2 hover:bg-white/10 rounded-xl text-white/60 hover:text-white flex items-center gap-2 transition-all border border-transparent group-hover:border-white/10"
                            >
                                <span className="text-xs font-semibold uppercase tracking-wider">Consultar Talhões</span>
                                <Eye className="w-4 h-4" />
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>

      {isModalOpen && (
        <FazendaDetailModal
            fazendaId={currentFazendaId}
            onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}
