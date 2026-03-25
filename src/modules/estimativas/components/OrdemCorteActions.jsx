import React from 'react';
import { Layers } from 'lucide-react';
import { useState } from 'react';
import { palette } from '../../../constants/theme';
import { useOrdemCorteActions } from '../../../hooks/estimativas/useOrdemCorteActions';
import { ORDEM_CORTE_STATUS } from '../../../services/ordemCorte/ordemCorteConstants';
import { OrdemCorteInfo } from './OrdemCorteInfo';
import { OrdemCorteFormModal } from './OrdemCorteFormModal';

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
    hasUnestimatedTalhao, // Boolean indicando se pelo menos 1 talhão não está estimado na camada/rodada atual
    hasClosedOrdem, // Boolean indicando se os talhões selecionados já tiveram a ordem FECHADA (impedido de reabrir na mesma safra)
    companyId,
    safra,
    rodadaOrigem,
    usuario
}) => {
    const { handleAbrirOrdem, handleFecharOrdem, isProcessing } = useOrdemCorteActions();
    const [isModalOpen, setIsModalOpen] = useState(false);

    const onAbrirClick = () => {
         // O que este bloco faz: Se por um hack o botão for clicado, bloqueia na camada de UI também.
         // Por que ele existe: Regra de negócio exigindo que você não pode cortar o que ainda não estimou naquela camada.
         if (hasUnestimatedTalhao || hasClosedOrdem) return;

         setIsModalOpen(true);
    };

    const handleConfirmarAbertura = async (dadosAdicionais) => {
        setIsModalOpen(false);
        await handleAbrirOrdem({
            companyId,
            safra,
            talhaoIds: talhoesIds,
            rodadaOrigem,
            usuario,
            formDadosAdicionais: dadosAdicionais
        });
    };

    const onFecharClick = async () => {
         if (!vinculoAtivo) return;
         // O que este bloco faz: Passa todos os talhões IDs atualmente selecionados no mapa
         // para a função de fechamento, para o sistema não fechar toda a ordem 01, mas sim
         // apenas as partes da ordem 01 que o usuário clicou.
         await handleFecharOrdem(vinculoAtivo.ordemCorteId, vinculoAtivo.ordemCodigo, talhoesIds, usuario);
    };

    return (
        <div className="mt-4 flex flex-col gap-3">
            {/* Se o Talhão tem vínculo, nós mostramos.  */}
            {vinculoAtivo && <OrdemCorteInfo vinculo={vinculoAtivo} />}

            {/* Botões de Ação Dinâmicos */}
            {!vinculoAtivo || vinculoAtivo.status === ORDEM_CORTE_STATUS.FECHADA ? (
                 <button
                    onClick={onAbrirClick}
                    disabled={isProcessing || talhoesIds.length === 0 || hasUnestimatedTalhao || hasClosedOrdem}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg ${
                        (hasUnestimatedTalhao || hasClosedOrdem)
                            ? 'bg-gray-600 hover:bg-gray-600'
                            : 'bg-blue-500 hover:bg-blue-600'
                    }`}
                 >
                    <Layers className="w-5 h-5" />
                    <span>
                        {hasClosedOrdem
                            ? 'Ordem Fechada'
                            : hasUnestimatedTalhao
                            ? 'Estime para abrir Ordem'
                            : 'Abrir Ordem de Corte'}
                    </span>
                 </button>
            ) : vinculoAtivo.status === ORDEM_CORTE_STATUS.ABERTA ? (
                 <button
                    onClick={onFecharClick}
                    disabled={isProcessing || talhoesIds.length === 0}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-600 bg-red-500 text-white shadow-lg"
                 >
                    <Layers className="w-5 h-5" />
                    <span>Fechar {talhoesIds.length > 1 ? `${talhoesIds.length} talhões da Ordem` : 'talhão da Ordem'}</span>
                 </button>
            ) : null}

            {isModalOpen && (
                <OrdemCorteFormModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onConfirm={handleConfirmarAbertura}
                    talhoesCount={talhoesIds.length}
                    companyId={companyId}
                />
            )}
        </div>
    );
};
