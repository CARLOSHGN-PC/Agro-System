import React from 'react';
import { Sliders } from 'lucide-react';
import { palette } from '../../constants/theme';

/**
 * @file Premissas.jsx
 * @description Módulo reservado para futuras configurações de premissas do sistema.
 * @module Premissas
 */

/**
 * Componente placeholder para o módulo de Premissas.
 *
 * O que este bloco faz: Renderiza uma tela inicial vazia indicando que o módulo está em construção.
 * Por que ele existe: Para cumprir o requisito de ter um menu "Premissas" estruturado onde
 * futuramente serão configurados os outros módulos do sistema.
 *
 * @returns {JSX.Element} A interface do módulo Premissas.
 */
export default function Premissas() {
  return (
    <div className="h-full flex flex-col p-6 animate-fade-in text-white" style={{ background: palette.background }}>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Premissas</h1>
      </div>
      <div className="flex-1 rounded-[24px] border flex flex-col items-center justify-center text-center p-8" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="w-16 h-16 rounded-full mb-4 flex items-center justify-center" style={{ background: "rgba(212,175,55,0.14)", color: palette.gold }}>
          <Sliders className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Configuração de Premissas</h2>
        <p className="max-w-md text-[15px] leading-relaxed" style={{ color: palette.text2 }}>
          Este módulo está reservado para a configuração de premissas globais do sistema. Em breve você poderá configurar os outros módulos por aqui.
        </p>
      </div>
    </div>
  );
}
