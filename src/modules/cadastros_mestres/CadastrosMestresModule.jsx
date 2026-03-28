import React from 'react';
import { palette } from '../../constants/theme.js';
import { Package, Shapes, Scale } from 'lucide-react';
import ProdutosList from './produtos/ProdutosList.jsx';

import { MapPin } from 'lucide-react';
import FazendasList from './fazendas/FazendasList.jsx';

/**
 * @file CadastrosMestresModule.jsx
 * @description Módulo de Cadastro Geral (Fazendas, Produtos, Unidades, Categorias).
 * @module CadastrosMestres
 */

export default function CadastrosMestresModule() {
  const [activeTab, setActiveTab] = React.useState('fazendas');

  return (
    <div className="h-full flex flex-col p-6 animate-fade-in text-white overflow-y-auto custom-scrollbar" style={{ background: palette.background }}>
      <div className="mb-6 shrink-0">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Cadastro Geral</h1>
        <p className="text-[15px] text-white/60">
          Gerencie propriedades agrícolas, produtos, categorias e unidades de medida.
        </p>
      </div>

      {/* Navegação por Abas */}
      <div className="flex items-center border-b border-white/10 mb-6 gap-6 shrink-0">
        <button
          onClick={() => setActiveTab('fazendas')}
          className={`pb-3 font-semibold transition-all relative flex items-center gap-2 ${
            activeTab === 'fazendas' ? 'text-white' : 'text-white/40 hover:text-white/80'
          }`}
        >
          <MapPin className="w-4 h-4" /> Fazendas e Talhões
          {activeTab === 'fazendas' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: palette.gold }}></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab('produtos')}
          className={`pb-3 font-semibold transition-all relative flex items-center gap-2 ${
            activeTab === 'produtos' ? 'text-white' : 'text-white/40 hover:text-white/80'
          }`}
        >
          <Package className="w-4 h-4" /> Produtos
          {activeTab === 'produtos' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: palette.gold }}></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab('categorias')}
          className={`pb-3 font-semibold transition-all relative flex items-center gap-2 ${
            activeTab === 'categorias' ? 'text-white' : 'text-white/40 hover:text-white/80'
          }`}
        >
          <Shapes className="w-4 h-4" /> Categorias
          {activeTab === 'categorias' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: palette.gold }}></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab('unidades')}
          className={`pb-3 font-semibold transition-all relative flex items-center gap-2 ${
            activeTab === 'unidades' ? 'text-white' : 'text-white/40 hover:text-white/80'
          }`}
        >
          <Scale className="w-4 h-4" /> Unidades de Medida
          {activeTab === 'unidades' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: palette.gold }}></div>
          )}
        </button>
      </div>

      {/* Renderização Condicional da Aba */}
      <div className="flex-1 flex flex-col min-h-0 relative">
          {activeTab === 'fazendas' && <FazendasList />}
          {activeTab === 'produtos' && <ProdutosList />}
      {activeTab === 'categorias' && (
         <div className="flex-1 rounded-[24px] border overflow-hidden bg-[#0A0A0A] border-white/5 p-6 flex items-center justify-center text-white/40">
           Em construção: CRUD de Categorias
         </div>
      )}
          {activeTab === 'unidades' && (
             <div className="flex-1 rounded-[24px] border overflow-hidden bg-[#0A0A0A] border-white/5 p-6 flex items-center justify-center text-white/40">
               Em construção: CRUD de Unidades de Medida
             </div>
          )}
      </div>
    </div>
  );
}
