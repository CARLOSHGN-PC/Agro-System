import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, FileSpreadsheet } from 'lucide-react';
import { palette } from '../../../constants/theme';
import { exportarRelatorioEstimativa } from '../services/relatorioEstimativaService';
import { showSuccess, showError } from '../../../utils/alert'; // Wrapper customizado do SweetAlert2

/**
 * RelatorioEstimativaPage.jsx
 *
 * O que este bloco faz:
 * Renderiza a interface principal do Módulo de Relatórios de Estimativa.
 * Permite ao usuário configurar os filtros (Safra, Unidade, Propriedade, Cortes)
 * e selecionar o modelo de saída desejado (Por Corte ou Por Fazenda/Talhão).
 *
 * Por que ele existe:
 * Para coletar os inputs do usuário e enviá-los de forma estruturada para o backend
 * processar a geração dos arquivos PDF ou Excel de forma remota.
 */
export default function RelatorioEstimativaPage() {
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [isLoadingExcel, setIsLoadingExcel] = useState(false);

  // Estado dos Filtros (Inputs da Tela)
  const [filtros, setFiltros] = useState({
    safra: '2025/2026',
    tipoPropriedade: 'TODAS', // 'PROPRIA', 'PARCERIA', 'ARRENDADA', 'TODAS'
    agruparPor: 'CORTE',
    tipoRelatorio: 'POR_CORTE', // 'POR_CORTE', 'POR_FAZENDA_TALHAO'
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFiltros(prev => ({ ...prev, [name]: value }));
  };

  const handleExportar = async (formato) => {
    // Evita cliques duplos
    if (isLoadingPdf || isLoadingExcel) return;

    if (formato === 'PDF') setIsLoadingPdf(true);
    if (formato === 'EXCEL') setIsLoadingExcel(true);

    try {
      // O payload deve respeitar o schema do Zod no backend
      const payload = {
        safra: filtros.safra,
        tipoRelatorio: filtros.tipoRelatorio,
        formatoSaida: formato,
        // O campo 'tipoPropriedade' no backend espera array.
        tipoPropriedade: filtros.tipoPropriedade === 'TODAS'
                         ? ['PROPRIA', 'PARCERIA', 'ARRENDADA']
                         : [filtros.tipoPropriedade],
        agruparPor: filtros.agruparPor
      };

      await exportarRelatorioEstimativa(payload);

      showSuccess('Download Concluído', `Seu relatório em ${formato} foi gerado com sucesso.`);

    } catch (error) {
      console.error('Erro ao exportar:', error);
      showError('Erro de Geração', error.message || 'Ocorreu um erro ao gerar o relatório no servidor.');
    } finally {
      setIsLoadingPdf(false);
      setIsLoadingExcel(false);
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto p-4 sm:p-8" style={{ color: palette.white }}>
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header do Módulo */}
        <div className="flex items-center gap-4 border-b pb-4" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.14)', color: palette.gold }}>
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Relatório de Estimativa x Reestimativa</h1>
            <p className="text-sm opacity-60">Filtre e exporte os dados consolidados da safra atual em PDF ou Excel.</p>
          </div>
        </div>

        {/* Card de Configuração */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl p-6 sm:p-8 border shadow-2xl relative overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, rgba(20,30,48,0.7), rgba(36,59,85,0.7))',
            borderColor: 'rgba(212,175,55,0.2)',
            backdropFilter: 'blur(20px)'
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">

            {/* Filtros Básicos */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold" style={{ color: palette.gold }}>Filtros</h3>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium uppercase opacity-60 ml-1">Safra</label>
                <select
                  name="safra"
                  value={filtros.safra}
                  onChange={handleChange}
                  className="w-full h-12 rounded-2xl px-4 text-sm font-medium border focus:ring-2 outline-none transition-all appearance-none"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    borderColor: 'rgba(255,255,255,0.1)',
                    color: palette.white
                  }}
                >
                  <option value="2024/2025" style={{ background: palette.bgDark }}>2024/2025</option>
                  <option value="2025/2026" style={{ background: palette.bgDark }}>2025/2026</option>
                  <option value="2026/2027" style={{ background: palette.bgDark }}>2026/2027</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium uppercase opacity-60 ml-1">Tipo de Propriedade</label>
                <select
                  name="tipoPropriedade"
                  value={filtros.tipoPropriedade}
                  onChange={handleChange}
                  className="w-full h-12 rounded-2xl px-4 text-sm font-medium border focus:ring-2 outline-none transition-all appearance-none"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    borderColor: 'rgba(255,255,255,0.1)',
                    color: palette.white
                  }}
                >
                  <option value="TODAS" style={{ background: palette.bgDark }}>Todas as Propriedades</option>
                  <option value="PROPRIA" style={{ background: palette.bgDark }}>Própria</option>
                  <option value="PARCERIA" style={{ background: palette.bgDark }}>Parceria</option>
                  <option value="ARRENDADA" style={{ background: palette.bgDark }}>Arrendada</option>
                </select>
              </div>
            </div>

            {/* Configurações do Relatório */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold" style={{ color: palette.gold }}>Modelo de Relatório</h3>

              <div className="flex flex-col gap-3">
                <label
                  className="flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all hover:bg-white/5"
                  style={{
                    borderColor: filtros.tipoRelatorio === 'POR_CORTE' ? palette.gold : 'rgba(255,255,255,0.1)',
                    background: filtros.tipoRelatorio === 'POR_CORTE' ? 'rgba(212,175,55,0.08)' : 'transparent'
                  }}
                >
                  <input
                    type="radio"
                    name="tipoRelatorio"
                    value="POR_CORTE"
                    checked={filtros.tipoRelatorio === 'POR_CORTE'}
                    onChange={handleChange}
                    className="w-4 h-4 accent-yellow-600"
                  />
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm">Modelo A - Agrupado por Corte</span>
                    <span className="text-xs opacity-60">Consolidado por Tipo de Propriedade e Corte.</span>
                  </div>
                </label>

                <label
                  className="flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all hover:bg-white/5"
                  style={{
                    borderColor: filtros.tipoRelatorio === 'POR_FAZENDA_TALHAO' ? palette.gold : 'rgba(255,255,255,0.1)',
                    background: filtros.tipoRelatorio === 'POR_FAZENDA_TALHAO' ? 'rgba(212,175,55,0.08)' : 'transparent'
                  }}
                >
                  <input
                    type="radio"
                    name="tipoRelatorio"
                    value="POR_FAZENDA_TALHAO"
                    checked={filtros.tipoRelatorio === 'POR_FAZENDA_TALHAO'}
                    onChange={handleChange}
                    className="w-4 h-4 accent-yellow-600"
                  />
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm">Modelo B - Fazenda e Talhão</span>
                    <span className="text-xs opacity-60">Analítico, exibindo a variação talhão a talhão.</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="mt-8 pt-6 border-t flex flex-col sm:flex-row items-center justify-end gap-4 relative z-10" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            <button
              onClick={() => handleExportar('PDF')}
              disabled={isLoadingPdf || isLoadingExcel}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
              style={{ background: '#e53e3e', color: '#fff' }}
            >
              {isLoadingPdf ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Exportar PDF
            </button>

            <button
              onClick={() => handleExportar('EXCEL')}
              disabled={isLoadingPdf || isLoadingExcel}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
              style={{ background: '#38a169', color: '#fff' }}
            >
              {isLoadingExcel ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              Exportar Excel
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}