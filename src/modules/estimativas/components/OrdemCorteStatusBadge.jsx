import React from 'react';
import { ORDEM_CORTE_STATUS } from '../../../services/ordemCorte/ordemCorteConstants';

/**
 * OrdemCorteStatusBadge.jsx
 *
 * O que este bloco faz:
 * É apenas um selo visual (Badge) que renderiza "ABERTA", "FECHADA" ou nada
 * com base no status da ordem de corte injetada.
 *
 * Por que ele existe:
 * Evita repetição de de CSS em `EstimativaPanels` e poluição com lógicas ternárias
 * para decidir se a bolinha é verde, azul ou vermelha.
 */

export const OrdemCorteStatusBadge = ({ status }) => {
    if (!status) return null;

    const isAberta = status === ORDEM_CORTE_STATUS.ABERTA;

    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            isAberta ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                     : 'bg-red-500/20 text-red-400 border border-red-500/30'
        }`}>
            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isAberta ? 'bg-blue-400' : 'bg-red-400'}`}></span>
            {status}
        </span>
    );
};
