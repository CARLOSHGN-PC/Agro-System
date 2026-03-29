import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { firestore } from '../firebase.js';
import db from '../localDb.js';
import { enqueueTask } from '../syncService.js';
import { v4 as uuidv4 } from 'uuid';
import { logAuditoria } from '../logService.js';

/**
 * @file variedadesService.js
 * @description Lógica de negócios e persistência do Cadastro Mestre de Variedades.
 *
 * O que este bloco faz:
 * Gerencia a inserção, edição, listagem e inativação de variedades, tanto
 * para a interface de usuário quanto para a importação de planilhas.
 *
 * Por que ele existe:
 * Abstrair do componente visual a complexidade de gerenciar UUIDs,
 * syncStatus, IndexedDB local e enfileiramento de sincronização para a nuvem.
 */

export const getVariedades = async (companyId) => {
    return await db.variedades.where('companyId').equals(companyId).toArray();
};

export const saveVariedade = async (variedade, usuarioId, companyId) => {
    const isNew = !variedade.id;
    const id = isNew ? uuidv4() : variedade.id;

    const payload = {
        ...variedade,
        id,
        companyId,
        status: variedade.status || 'ATIVO',
        syncStatus: 'pending',
        updatedAt: new Date().toISOString(),
        updatedBy: usuarioId
    };

    if (isNew) {
        payload.createdAt = new Date().toISOString();
        payload.createdBy = usuarioId;
    }

    // 1. Salvar no banco local (Dexie)
    await db.variedades.put(payload);

    // 2. Sincronizar na nuvem (Firestore)
    await enqueueTask('createOrUpdate', 'variedades', id, payload);

    // 3. Auditoria
    await logAuditoria(
        'variedades',
        id,
        isNew ? 'CREATE' : 'UPDATE',
        { diff: payload },
        usuarioId,
        companyId
    );

    return payload;
};

export const inactivateVariedade = async (id, usuarioId, companyId) => {
    const variedade = await db.variedades.get(id);
    if (!variedade) throw new Error('Variedade não encontrada');

    const payload = {
        ...variedade,
        status: 'INATIVO',
        syncStatus: 'pending',
        updatedAt: new Date().toISOString(),
        updatedBy: usuarioId
    };

    await db.variedades.put(payload);
    await enqueueTask('createOrUpdate', 'variedades', id, payload);

    await logAuditoria(
        'variedades',
        id,
        'INACTIVATE',
        { reason: 'User requested inactivation' },
        usuarioId,
        companyId
    );
};

/**
 * Salva ou atualiza uma lista de variedades vinda da planilha em massa.
 */
export const saveVariedadesEmMassa = async (variedadesRows, usuarioId, companyId) => {
    // Buscar todas as variedades já cadastradas para a empresa para evitar duplicatas
    const variedadesExistentes = await db.variedades.where('companyId').equals(companyId).toArray();
    const mapaVariedades = {};
    variedadesExistentes.forEach(v => {
        // Agrupamos pelo nome da variedade para bater com o Excel
        const nomeUpper = (v.variedade || "").toString().trim().toUpperCase();
        mapaVariedades[nomeUpper] = v;
    });

    const opsDexie = [];
    const opsSync = [];

    const now = new Date().toISOString();

    for (const row of variedadesRows) {
        const nomeVariedade = (row['VARIEDADE'] || "").toString().trim();
        if (!nomeVariedade) continue; // Ignora linha sem nome de variedade

        const nomeUpper = nomeVariedade.toUpperCase();
        let variedadeId = mapaVariedades[nomeUpper]?.id;
        const isNew = !variedadeId;

        if (isNew) {
            variedadeId = uuidv4();
        }

        const payload = {
            id: variedadeId,
            companyId,
            codigo: (row['CODIGO'] || "").toString(),
            variedade: nomeVariedade,
            tipoMaturacao: (row['TIPO_MATURACAO'] || "").toString().trim(),
            inicioJanela: row['INICIO_JANELA'] ? Number(row['INICIO_JANELA']) : null,
            fimJanela: row['FIM_JANELA'] ? Number(row['FIM_JANELA']) : null,
            status: 'ATIVO',
            syncStatus: 'pending',
            updatedAt: now,
            updatedBy: usuarioId
        };

        if (isNew) {
            payload.createdAt = now;
            payload.createdBy = usuarioId;
        } else {
            // Mantém os createdAt originais
            payload.createdAt = mapaVariedades[nomeUpper].createdAt;
            payload.createdBy = mapaVariedades[nomeUpper].createdBy;
        }

        opsDexie.push(payload);

        // Preparamos a fila pro Firebase
        opsSync.push({
            type: 'createOrUpdate',
            targetCollection: 'variedades',
            documentId: variedadeId,
            payload: payload
        });
    }

    if (opsDexie.length > 0) {
        // Salva tudo no Dexie em lote
        await db.variedades.bulkPut(opsDexie);

        // Enfileira tudo em lote pro SyncService
        for (const op of opsSync) {
            await enqueueTask(op.type, op.targetCollection, op.documentId, op.payload);
        }

        await logAuditoria(
            'variedades',
            'IMPORT_MASS',
            'IMPORT',
            { count: opsDexie.length },
            usuarioId,
            companyId
        );
    }
};

/**
 * Escuta mudanças em tempo real na coleção de Variedades.
 */
export const subscribeToVariedadesRealtime = (companyId) => {
    if (!navigator.onLine) return () => {};

    const q = query(
        collection(firestore, 'variedades'),
        where("companyId", "==", companyId)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
        let hasChanges = false;
        const toAddOrUpdate = [];
        const toDeleteIds = [];

        snapshot.docChanges().forEach((change) => {
            const data = change.doc.data();
            const id = change.doc.id;

            if (change.type === "added" || change.type === "modified") {
                toAddOrUpdate.push({
                    ...data,
                    id: id,
                    syncStatus: 'synced'
                });
                hasChanges = true;
            } else if (change.type === "removed") {
                toDeleteIds.push(id);
                hasChanges = true;
            }
        });

        if (hasChanges) {
            try {
                if (toAddOrUpdate.length > 0) {
                    await db.variedades.bulkPut(toAddOrUpdate);
                }
                if (toDeleteIds.length > 0) {
                    await db.variedades.bulkDelete(toDeleteIds);
                }
            } catch (err) {
                console.error("[Variedades Realtime] Erro ao sincronizar para o Dexie:", err);
            }
        }
    });

    return unsubscribe;
};
