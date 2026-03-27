import React from 'react';
import { palette } from '../../../constants/theme.js';
import { ArrowLeft } from 'lucide-react';
import OperacoesList from './operacoes/OperacoesList.jsx';
import ProtocolosList from './protocolos/ProtocolosList.jsx';
import AuditoriaList from './historico/AuditoriaList.jsx';

/**
 * @file TratosCulturaisModule.jsx
 * @description Módulo de Tratos Culturais contendo Operações e Protocolos.
 * @module TratosCulturaisModule
 */

/**
 * Tela interna do módulo de Tratos Culturais.
 *
 * O que este bloco faz: Renderiza a interface principal dos Tratos Culturais com navegação e abas.
 * Por que ele existe: Para cumprir a prioridade máxima solicitada, focada em Operações e Protocolos.
 * O que entra e sai: Recebe `onBack` da navegação principal para voltar aos cards mestres.
 *
 * @param {{onBack: Function}} props
 * @returns {JSX.Element} Estrutura de abas do Módulo Tratos Culturais.
 */
export default function TratosCulturaisModule({ onBack }) {
  const [activeTab, setActiveTab] = React.useState('operacoes');

  return (
    <div className="h-full flex flex-col p-6 animate-fade-in text-white overflow-y-auto" style={{ background: palette.background }}>
      {/* Header e Navegação */}
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-xl border border-white/10 hover:bg-white/5 transition-colors flex items-center justify-center"
            title="Voltar para Premissas"
          >
            <ArrowLeft className="w-5 h-5 text-white/70 hover:text-white" />
          </button>
          <div>
            <div className="text-sm font-medium opacity-60 mb-1">Premissas / Tratos Culturais</div>
            <h1 className="text-2xl font-bold tracking-tight">Tratos Culturais</h1>
          </div>
        </div>
      </div>

      {/* Navegação por Abas (Tabs) */}
      <div className="flex items-center border-b border-white/10 mb-6 gap-6">
        <button
          onClick={() => setActiveTab('operacoes')}
          className={`pb-3 font-semibold transition-all relative ${
            activeTab === 'operacoes' ? 'text-white' : 'text-white/40 hover:text-white/80'
          }`}
        >
          Operações
          {activeTab === 'operacoes' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: palette.gold }}></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab('protocolos')}
          className={`pb-3 font-semibold transition-all relative ${
            activeTab === 'protocolos' ? 'text-white' : 'text-white/40 hover:text-white/80'
          }`}
        >
          Protocolos e Receitas
          {activeTab === 'protocolos' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: palette.gold }}></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab('historico')}
          className={`pb-3 font-semibold transition-all relative ${
            activeTab === 'historico' ? 'text-white' : 'text-white/40 hover:text-white/80'
          }`}
        >
          Histórico e Logs
          {activeTab === 'historico' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: palette.gold }}></div>
          )}
        </button>
      </div>

      {/* Conteúdo da Aba */}
      <div className="flex-1 rounded-[24px] border overflow-hidden bg-[#0A0A0A] border-white/5 p-6 relative">
        {activeTab === 'operacoes' && <OperacoesList />}
        {activeTab === 'protocolos' && <ProtocolosList />}
        {activeTab === 'historico' && <AuditoriaList />}
      </div>
    </div>
  );
}
