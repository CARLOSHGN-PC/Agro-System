import React, { useState, useEffect } from 'react';
import { Search, Map as MapIcon, Plus, FileText, CheckCircle, Clock } from 'lucide-react';
import { useOrdensCorte } from '../../hooks/estimativas/useOrdensCorte';
import GerenciamentoList from './components/GerenciamentoList';
import { ORDEM_CORTE_STATUS } from '../../services/ordemCorte/ordemCorteConstants';

export default function GerenciamentoOrdemCortePage({ companyId, safra, setActiveModule }) {
  // Aproveita o Hook já existente de ordens de corte para ler do Dexie/Firebase
  const { ordensSafra } = useOrdensCorte(companyId, safra);

  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [filteredOrdens, setFilteredOrdens] = useState([]);

  // Aplica filtros locais
  useEffect(() => {
    let result = [...(ordensSafra || [])];

    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(o =>
        (o.id && o.id.toLowerCase().includes(lowerTerm)) ||
        (o.numeroEmpresa && o.numeroEmpresa.toLowerCase().includes(lowerTerm)) ||
        (o.frenteServico && o.frenteServico.toLowerCase().includes(lowerTerm)) ||
        (o.nomeColaborador && o.nomeColaborador.toLowerCase().includes(lowerTerm))
      );
    }

    if (dateFilter) {
      result = result.filter(o => o.createdAt && o.createdAt.startsWith(dateFilter));
    }

    // Ordenar do mais novo pro mais antigo
    result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    setFilteredOrdens(result);
  }, [ordensSafra, searchTerm, dateFilter]);

  // Resumo para os cards
  const summary = {
    hoje: ordensSafra.filter(o => o.createdAt && o.createdAt.startsWith(new Date().toISOString().split('T')[0])).length,
    aguardando: ordensSafra.filter(o => o.status === ORDEM_CORTE_STATUS.AGUARDANDO).length,
    abertas: ordensSafra.filter(o => o.status === ORDEM_CORTE_STATUS.ABERTA).length,
    pdfs: 0 // Placeholder: se houver rastreio disso no futuro
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-gray-50/50 p-6">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gerenciamento de Ordem de Corte</h1>
          <p className="text-sm text-gray-500 mt-1">Safra {safra}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveModule('estimativa')}
            className="px-4 py-2 bg-white text-gray-700 font-semibold text-sm rounded-xl border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <MapIcon className="w-4 h-4" />
            Abrir no Mapa
          </button>
        </div>
      </div>

      {/* CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Ordens do Dia", value: summary.hoje, icon: Clock, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Aguardando Número", value: summary.aguardando, icon: FileText, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Abertas", value: summary.abertas, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "PDFs Gerados", value: summary.pdfs, icon: FileText, color: "text-purple-600", bg: "bg-purple-50" },
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 border shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${card.bg} ${card.color}`}>
              <card.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">{card.label}</p>
              <h3 className="text-2xl font-bold text-gray-900">{card.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* FILTROS E TABELA */}
      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        {/* Barra de Filtros */}
        <div className="p-4 border-b bg-gray-50/50 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por frente, ID, número ou responsável..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-48">
             <input
                type="date"
                className="w-full px-4 py-2 text-sm bg-white border rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-gray-600"
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
             />
          </div>
        </div>

        {/* Tabela de Listagem */}
        <div className="flex-1 overflow-auto">
          <GerenciamentoList
             ordens={filteredOrdens}
             companyId={companyId}
             safra={safra}
          />
        </div>
      </div>
    </div>
  );
}
