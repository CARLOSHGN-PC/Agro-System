import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import db from '../../services/localDb';
import { subscribeToOrdensRealtime, subscribeToVinculosRealtime } from '../../services/ordemCorte/ordemCorteRepository';

/**
 * useOrdensCorte.js
 *
 * O que este bloco faz:
 * É um Custom React Hook (useLiveQuery) que busca passivamente no IndexedDB
 * todos os Vínculos e Ordens de Corte pertinentes à Safra e à Empresa selecionada.
 * Atualiza o DOM e React States em Tempo Real assim que um save ocorre (mesmo offline).
 *
 * Por que ele existe:
 * Separar a busca e gestão do estado dos componentes Visuais (Panels, Maps),
 * tornando o fluxo do Map e SidePanel puramente dependentes da "Memória de Longo Prazo".
 */

export const useOrdensCorte = (companyId, safra) => {
    // Escuta ao vivo a tabela pivot (Vínculos: OrdemCorte -> Talhão) para mapear
    // quais Talhões pertencem a qual status e código.
    // Usamos stringify/parse para forçar atualização profunda no React se precisar
    const vinculosSafra = useLiveQuery(
        async () => {
            if (!companyId || !safra) return [];
            const dados = await db.ordensCorteTalhoes
                .where('[companyId+safra]')
                .equals([companyId, safra])
                .toArray();
            return dados;
        },
        [companyId, safra]
    );

    // Escuta ao vivo a tabela Cabeçalho (OrdemCorte) caso precisemos de atributos globais (openedAt, etc).
    const ordensSafra = useLiveQuery(
        async () => {
            if (!companyId || !safra) return [];
            const dados = await db.ordensCorte
                .where('[companyId+safra]')
                .equals([companyId, safra])
                .toArray();
            return dados;
        },
        [companyId, safra]
    );

    // O que este bloco faz: Inicializa os listeners do Firebase onSnapshot para manter o Dexie perfeitamente atualizado.
    // Por que ele existe: Permite que mudanças feitas por outros aparelhos (como abrir ou fechar uma ordem)
    // sejam puxadas do servidor e mostradas em tempo real no nosso mapa via o hook useLiveQuery acima.
    useEffect(() => {
        if (!companyId || !safra) return;

        // Assina as atualizações da Ordem Mestre e dos Vínculos (Talhões).
        // Quando uma novidade chegar, a função de callback vazia () => {} é chamada
        // O Dexie é atualizado por baixo dos panos no Repository, e o `useLiveQuery` percebe a mudança de
        // tabela automaticamente forçando o React a repintar a tela. Nenhuma ação extra é necessária aqui!
        const unsubscribeOrdens = subscribeToOrdensRealtime(companyId, safra, () => {});
        const unsubscribeVinculos = subscribeToVinculosRealtime(companyId, safra, () => {});

        return () => {
            if (unsubscribeOrdens) unsubscribeOrdens();
            if (unsubscribeVinculos) unsubscribeVinculos();
        };
    }, [companyId, safra]);

    return {
        vinculosSafra: vinculosSafra || [],
        ordensSafra: ordensSafra || [],
        // Só é loading real se as queries não tiverem retornado nada na primeira execução
        isLoading: vinculosSafra === undefined || ordensSafra === undefined
    };
};
