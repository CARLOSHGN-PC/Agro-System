import React from 'react';
import { Layers } from 'lucide-react';
import { palette } from '../../../constants/theme';
import { useOrdemCorteActions } from '../../../hooks/estimativas/useOrdemCorteActions';
import { ORDEM_CORTE_STATUS } from '../../../services/ordemCorte/ordemCorteConstants';
import { OrdemCorteInfo } from './OrdemCorteInfo';

/**
 * OrdemCorteActions.jsx
 *
 * O que este bloco faz:
 * Reúne o Componente "Info" com os botões "Abrir" ou "Fechar".
 * Determina qual botão exibir com base no status que o talhão (ou múltiplos) atual carrega.
 *
 * Por que ele existe:
 * Evitar poluição com vários `if/else` e `dispatch` dentro do painel lateral (`EstimativaPanels`).
 * Assim ele fica em "modo plugin" injetável lá.
 */

export const OrdemCorteActions = ({
    vinculoAtivo, // Pode ser null se não tiver ordem, ou o objeto do vinculo
    talhoesIds, // Array de string (IDs que estão selecionados no mapa)
    companyId,
    safra,
    rodadaOrigem,
    usuario
}) => {
    const { handleAbrirOrdem, handleFecharOrdem, isProcessing } = useOrdemCorteActions();

    const onAbrirClick = async () => {
         await handleAbrirOrdem({
             companyId,
             safra,
             talhaoIds: talhoesIds,
             rodadaOrigem,
             usuario
         });
    };

    const onFecharClick = async () => {
         if (!vinculoAtivo) return;
         await handleFecharOrdem(vinculoAtivo.ordemCorteId, vinculoAtivo.ordemCodigo, usuario);
    };

    return (
        <div className="mt-4 flex flex-col gap-3">
            {/* Se o Talhão tem vínculo, nós mostramos.  */}
            {vinculoAtivo && <OrdemCorteInfo vinculo={vinculoAtivo} />}

            {/* Botões de Ação Dinâmicos */}
            {!vinculoAtivo || vinculoAtivo.status === ORDEM_CORTE_STATUS.FECHADA ? (
                 <button
                    onClick={onAbrirClick}
                    disabled={isProcessing || talhoesIds.length === 0}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 bg-blue-500 text-white shadow-lg"
                 >
                    <Layers className="w-5 h-5" />
                    <span>Abrir Ordem de Corte</span>
                 </button>
            ) : vinculoAtivo.status === ORDEM_CORTE_STATUS.ABERTA ? (
                 <button
                    onClick={onFecharClick}
                    disabled={isProcessing}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-600 bg-red-500 text-white shadow-lg"
                 >
                    <Layers className="w-5 h-5" />
                    <span>Fechar Ordem de Corte</span>
                 </button>
            ) : null}
        </div>
    );
};
