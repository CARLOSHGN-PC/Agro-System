import { useLiveQuery } from 'dexie-react-hooks';
import db from '../../services/localDb';

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

    return {
        vinculosSafra: vinculosSafra || [],
        ordensSafra: ordensSafra || [],
        // Só é loading real se as queries não tiverem retornado nada na primeira execução
        isLoading: vinculosSafra === undefined || ordensSafra === undefined
    };
};
