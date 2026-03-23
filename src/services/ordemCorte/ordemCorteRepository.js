import { firestore } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
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

export const fecharOrdemCorte = async (ordemCorteId, talhoesSelecionadosIds, usuario) => {
    // O que este bloco faz: Atualiza os registros do banco local (Dexie) de apenas um ou mais talhões selecionados da ordem,
    // fechando apenas os "Vínculos" deles. Se depois de fechar, nenhum outro talhão sobrar ABERTO na ordem, a Ordem Mestre
    // também é fechada.
    // Por que ele existe: Permite ao usuário colher e fechar parte da Ordem de Corte em dias diferentes sem encerrar toda a ordem e
    // garante que os talhões fechados já sumam/fiquem ocultos do mapa imediatamente, independentemente se o resto da ordem continua viva.

    const closedAt = new Date().toISOString();

    // 1. Busca TODOS os vínculos desta Ordem (Para filtrar na memória quem é que o usuário quer fechar).
    const todosVinculosDaOrdem = await db.ordensCorteTalhoes
        .where('ordemCorteId')
        .equals(ordemCorteId)
        .toArray();

    // 2. Filtramos apenas os vínculos que batem com os IDs de talhão que o usuário mandou fechar.
    const vinculosParaFechar = todosVinculosDaOrdem.filter(v => talhoesSelecionadosIds.includes(v.talhaoId));

    // 3. Fechamos individualmente cada Vínculo da lista de selecionados
    for (const v of vinculosParaFechar) {
        // O que este bloco faz: Modifica o "status" e a "data de fechamento" daquele talhão para FECHADA e reenvia ao Firebase.
        // Damos um "clone" manual do objeto v (o Vínculo) com as novas propriedades para garantir
        // que o "enqueueTask" não envie "undefined" ou falhe caso o Dexie demore para processar a linha do .update()
        const novoStatus = {
            status: ORDEM_CORTE_STATUS.FECHADA,
            closedAt,
            updatedAt: closedAt,
            syncStatus: 'pending'
        };

        await db.ordensCorteTalhoes.update(v.id, novoStatus);

        // Colocamos o vínculo isolado na fila de Sync para a nuvem injetando as vars diretamente.
        // Assim, é 100% de certeza que o Firebase vai receber { status: FECHADA } no payload.
        const payloadAtualizado = { ...v, ...novoStatus };
        await enqueueTask('createOrUpdate', ORDEM_CORTE_COLECOES.VINCULO, v.id, payloadAtualizado);
    }

    // 4. Buscamos de novo a lista completa de vínculos no DB local para verificar o "resto".
    const vinculosPosUpdate = await db.ordensCorteTalhoes
        .where('ordemCorteId')
        .equals(ordemCorteId)
        .toArray();

    // O que este bloco faz: Conta quantos talhões dessa ordem ainda estão ABERTOS.
    const restantesAbertos = vinculosPosUpdate.filter(v => v.status === ORDEM_CORTE_STATUS.ABERTA);

    // 5. Se não sobrou nenhum talhão ABERTO, fechamos também o Cabeçalho da Ordem ("Mestre").
    if (restantesAbertos.length === 0) {
        const novosDadosMestre = {
            status: ORDEM_CORTE_STATUS.FECHADA,
            closedAt,
            closedBy: usuario || 'Sistema',
            updatedAt: closedAt,
            syncStatus: 'pending'
        };

        await db.ordensCorte.update(ordemCorteId, novosDadosMestre);

        // Põe a Ordem Mestre (Cabeçalho) na fila de sync recuperando a base
        const ordemBase = await db.ordensCorte.get(ordemCorteId);
        if (ordemBase) {
            const payloadMestreAtualizado = { ...ordemBase, ...novosDadosMestre };
            await enqueueTask('createOrUpdate', ORDEM_CORTE_COLECOES.MESTRE, ordemCorteId, payloadMestreAtualizado);
        }
    }
};

export const getVinculosDaSafra = async (companyId, safra) => {
    return await db.ordensCorteTalhoes
        .where('[companyId+safra]')
        .equals([companyId, safra])
        .toArray();
};

/**
 * onSnapshot para Ordens (Cabeçalhos)
 * O que este bloco faz: Escuta ao vivo no Firebase e joga pro Dexie
 */
export const subscribeToOrdensRealtime = (companyId, safra, onUpdateCallback) => {
    if (!navigator.onLine) return () => {};

    const q = query(
        collection(firestore, ORDEM_CORTE_COLECOES.MESTRE),
        where("companyId", "==", companyId),
        where("safra", "==", safra)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
        // O que este bloco faz: Processa lotes ("bulk") de registros sincronizados do Firestore em uma única transação no IndexedDB local.
        // Por que ele existe: Evita travamento na tela de celulares fracos, que ocorriam ao tentar iterar centenas de Promises de .put() individualmente na re-renderização.
        let hasChanges = false;
        const toAddOrUpdate = [];
        const toDeleteIds = [];

        snapshot.docChanges().forEach((change) => {
            hasChanges = true;
            if (change.type === "added" || change.type === "modified") {
                const fbData = change.doc.data();
                toAddOrUpdate.push({
                    id: change.doc.id,
                    ...fbData,
                    syncStatus: 'synced'
                });
            } else if (change.type === "removed") {
                toDeleteIds.push(change.doc.id);
            }
        });

        if (hasChanges) {
            const allAffectedIds = [...toAddOrUpdate.map(i => i.id), ...toDeleteIds];
            const existingRecords = await db.ordensCorte.bulkGet(allAffectedIds);

            const existingMap = {};
            existingRecords.forEach(record => {
                if (record) existingMap[record.id] = record;
            });

            const finalPuts = toAddOrUpdate.filter(item => {
                const existing = existingMap[item.id];
                return !existing || existing.syncStatus === 'synced';
            });

            const finalDeletes = toDeleteIds.filter(id => {
                const existing = existingMap[id];
                return existing && existing.syncStatus !== 'pending';
            });

            if (finalPuts.length > 0) await db.ordensCorte.bulkPut(finalPuts);
            if (finalDeletes.length > 0) await db.ordensCorte.bulkDelete(finalDeletes);

            if (onUpdateCallback) onUpdateCallback();
        }
    }, (error) => {
        console.warn("Ordens Realtime sync lost:", error);
    });

    return unsubscribe;
};

/**
 * onSnapshot para Vinculos (Talhoes)
 * O que este bloco faz: Escuta ao vivo os fechamentos parciais no FB e atualiza o mapa dos outros devices na hora.
 */
export const subscribeToVinculosRealtime = (companyId, safra, onUpdateCallback) => {
    if (!navigator.onLine) return () => {};

    const q = query(
        collection(firestore, ORDEM_CORTE_COLECOES.VINCULO),
        where("companyId", "==", companyId),
        where("safra", "==", safra)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
        // O que este bloco faz: Processa lotes ("bulk") de Vínculos sincronizados do Firestore em uma única transação no IndexedDB local.
        // Por que ele existe: Evita travamento na tela de celulares fracos, que ocorriam ao tentar iterar centenas de Promises de .put() individualmente.
        let hasChanges = false;
        const toAddOrUpdate = [];
        const toDeleteIds = [];

        snapshot.docChanges().forEach((change) => {
            hasChanges = true;
            if (change.type === "added" || change.type === "modified") {
                const fbData = change.doc.data();
                toAddOrUpdate.push({
                    id: change.doc.id,
                    ...fbData,
                    syncStatus: 'synced'
                });
            } else if (change.type === "removed") {
                toDeleteIds.push(change.doc.id);
            }
        });

        if (hasChanges) {
            const allAffectedIds = [...toAddOrUpdate.map(i => i.id), ...toDeleteIds];
            const existingRecords = await db.ordensCorteTalhoes.bulkGet(allAffectedIds);

            const existingMap = {};
            existingRecords.forEach(record => {
                if (record) existingMap[record.id] = record;
            });

            const finalPuts = toAddOrUpdate.filter(item => {
                const existing = existingMap[item.id];
                return !existing || existing.syncStatus === 'synced';
            });

            const finalDeletes = toDeleteIds.filter(id => {
                const existing = existingMap[id];
                return existing && existing.syncStatus !== 'pending';
            });

            if (finalPuts.length > 0) await db.ordensCorteTalhoes.bulkPut(finalPuts);
            if (finalDeletes.length > 0) await db.ordensCorteTalhoes.bulkDelete(finalDeletes);

            if (onUpdateCallback) onUpdateCallback();
        }
    }, (error) => {
        console.warn("Vinculos Realtime sync lost:", error);
    });

    return unsubscribe;
};
