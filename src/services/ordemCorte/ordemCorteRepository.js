import db from '../localDb';
import { enqueueTask } from '../syncService';
import { ORDEM_CORTE_STATUS, ORDEM_CORTE_COLECOES } from './ordemCorteConstants';

/**
 * ordemCorteRepository.js
 *
 * O que este bloco faz:
 * É a camada de persistência especializada em Ordens de Corte.
 * Realiza as transações puras no banco de dados local (Dexie) e agenda o
 * sincronizador para enviar as transações via Firebase (`enqueueTask`).
 *
 * Por que ele existe:
 * Evitar misturar lógica de UI (react hook/service orquestrador) com "como se
 * salva e lê dados", blindando o negócio caso as chaves ou tabelas mudem.
 */

export const getNextSequencialPorSafra = async (companyId, safra) => {
    // Puxa as ordens da safra. Como precisamos do maior sequencial, faremos uma leitura total.
    const ordens = await db.ordensCorte
        .where('[companyId+safra]')
        .equals([companyId, safra])
        .toArray();

    if (!ordens || ordens.length === 0) return 1;

    // Encontra o max das ordens lidas.
    const maxSeq = Math.max(...ordens.map(o => o.sequencial || 0));
    return maxSeq + 1;
};

export const saveOrdemCorteAndVinculos = async (ordemPayload, vinculosPayload) => {
    // 1. Grava no Dexie
    await db.ordensCorte.put(ordemPayload);
    await db.ordensCorteTalhoes.bulkPut(vinculosPayload);

    // 2. Enfileira o cabeçalho no Firebase
    await enqueueTask('createOrUpdate', ORDEM_CORTE_COLECOES.MESTRE, ordemPayload.id, ordemPayload);

    // 3. Enfileira cada vínculo no Firebase
    for (const v of vinculosPayload) {
        await enqueueTask('createOrUpdate', ORDEM_CORTE_COLECOES.VINCULO, v.id, v);
    }
};

export const fecharOrdemCorte = async (ordemCorteId, usuario) => {
    const closedAt = new Date().toISOString();

    // Atualiza a tabela Mestre (Ordem) localmente no Dexie
    await db.ordensCorte.update(ordemCorteId, {
        status: ORDEM_CORTE_STATUS.FECHADA,
        closedAt,
        closedBy: usuario || 'Sistema',
        updatedAt: closedAt,
        syncStatus: 'pending'
    });

    // Obtém o payload atualizado da tabela mestre e enfileira pro sync service Firebase
    const updatedOrdem = await db.ordensCorte.get(ordemCorteId);
    if(updatedOrdem) await enqueueTask('createOrUpdate', ORDEM_CORTE_COLECOES.MESTRE, updatedOrdem.id, updatedOrdem);

    // Identifica e atualiza todos os Vínculos associados localmente no Dexie
    const vinculos = await db.ordensCorteTalhoes
        .where('ordemCorteId')
        .equals(ordemCorteId)
        .toArray();

    for (const v of vinculos) {
        // Altera status local e grava offline
        await db.ordensCorteTalhoes.update(v.id, {
            status: ORDEM_CORTE_STATUS.FECHADA,
            closedAt,
            updatedAt: closedAt,
            syncStatus: 'pending'
        });

        // Pega versão atualizada pós-update local e agenda no Firebase
        const updatedV = await db.ordensCorteTalhoes.get(v.id);
        if(updatedV) await enqueueTask('createOrUpdate', ORDEM_CORTE_COLECOES.VINCULO, updatedV.id, updatedV);
    }
};

export const getVinculosDaSafra = async (companyId, safra) => {
    return await db.ordensCorteTalhoes
        .where('[companyId+safra]')
        .equals([companyId, safra])
        .toArray();
};
