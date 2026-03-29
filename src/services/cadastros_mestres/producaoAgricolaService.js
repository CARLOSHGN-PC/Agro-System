import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { firestore } from '../firebase.js';
import db from '../localDb.js';
import { enqueueTask } from '../syncService.js';
import { v4 as uuidv4 } from 'uuid';
import { logAuditoria } from '../logService.js';

/**
 * @file producaoAgricolaService.js
 * @description Lógica de negócios e persistência do Cadastro Mestre de Produção Agrícola.
 */

export const getProducoes = async (companyId) => {
    return await db.producaoAgricola.where('companyId').equals(companyId).toArray();
};

export const saveProducao = async (producao, usuarioId, companyId) => {
    const isNew = !producao.id;
    const id = isNew ? uuidv4() : producao.id;

    // Normalização de números para manter padrão
    const formatNumber = (val) => val ? String(val).replace(',', '.') : '';

    const payload = {
        ...producao,
        areaHa: formatNumber(producao.areaHa),
        tchEst: formatNumber(producao.tchEst),
        tonEst: formatNumber(producao.tonEst),
        tchFechado: formatNumber(producao.tchFechado),
        tonFechada: formatNumber(producao.tonFechada),
        atrReal: formatNumber(producao.atrReal),
        id,
        companyId,
        status: producao.status || 'ATIVO',
        syncStatus: 'pending',
        updatedAt: new Date().toISOString(),
        updatedBy: usuarioId
    };

    if (isNew) {
        payload.createdAt = new Date().toISOString();
        payload.createdBy = usuarioId;
    }

    // 1. Salvar no banco local (Dexie)
    await db.producaoAgricola.put(payload);

    // 2. Sincronizar na nuvem (Firestore)
    await enqueueTask('createOrUpdate', 'producaoAgricola', id, payload);

    // 3. Auditoria
    await logAuditoria(
        'producaoAgricola',
        id,
        isNew ? 'CREATE' : 'UPDATE',
        { diff: payload },
        usuarioId,
        companyId
    );

    return payload;
};

export const inactivateProducao = async (id, usuarioId, companyId) => {
    const producao = await db.producaoAgricola.get(id);
    if (!producao) throw new Error('Produção não encontrada');

    const payload = {
        ...producao,
        status: 'INATIVO',
        syncStatus: 'pending',
        updatedAt: new Date().toISOString(),
        updatedBy: usuarioId
    };

    await db.producaoAgricola.put(payload);
    await enqueueTask('createOrUpdate', 'producaoAgricola', id, payload);

    await logAuditoria(
        'producaoAgricola',
        id,
        'INACTIVATE',
        { reason: 'User requested inactivation' },
        usuarioId,
        companyId
    );
};

/**
 * Salva ou atualiza uma lista de produção agrícola vinda da planilha em massa.
 */
export const saveProducaoEmMassa = async (rows, usuarioId, companyId, onProgress = null) => {
    const producoesExistentes = await db.producaoAgricola.where('companyId').equals(companyId).toArray();

    // Agrupamos pela chave codFaz + talhao
    const mapaProducao = {};
    producoesExistentes.forEach(prod => {
        const codFaz = (prod.codFaz || "").toString().trim().toUpperCase();
        const talhao = (prod.talhao || "").toString().trim().toUpperCase();
        if (codFaz && talhao) {
            mapaProducao[`${codFaz}_${talhao}`] = prod;
        }
    });

    const opsDexie = [];
    const opsSync = [];

    const now = new Date().toISOString();
    let processedLines = 0;
    const totalLines = rows.length;

    const formatNumber = (val) => val ? String(val).replace(',', '.') : '';

    for (const row of rows) {
        const codFazExcel = (row['COD_FAZ'] || "").toString().trim();
        const talhaoExcel = (row['TALHAO'] || "").toString().trim();

        if (!codFazExcel || !talhaoExcel) continue; // Ignora se faltar fazenda ou talhão

        const chaveUnica = `${codFazExcel.toUpperCase()}_${talhaoExcel.toUpperCase()}`;
        let producaoId = mapaProducao[chaveUnica]?.id;
        const isNew = !producaoId;

        // Atualizar barra de progresso se callback existir
        processedLines++;
        if (onProgress && processedLines % 10 === 0) {
           onProgress(processedLines, totalLines);
        }

        // Se já existe, pula de acordo com a regra de não sobreescrever (se for o caso, senão, apenas pula)
        if (!isNew) continue;

        producaoId = uuidv4();

        const payload = {
            id: producaoId,
            companyId,
            codFaz: codFazExcel,
            desFazenda: (row['DES_FAZENDA'] || "").toString().trim(),
            talhao: talhaoExcel,
            areaHa: formatNumber(row['AREA_HA']),
            corte: (row['CORTE'] || "").toString().trim(),
            dtUltCorte: (row['DT_ULTCORTE'] || "").toString().trim(),
            tchEst: formatNumber(row['TCH_EST']),
            tonEst: formatNumber(row['TON_EST']),
            tchFechado: formatNumber(row['TCH_FECHADO']),
            tonFechada: formatNumber(row['TON_FECHADA']),
            atrReal: formatNumber(row['ATR_REAL']),
            status: 'ATIVO',
            syncStatus: 'pending',
            createdAt: now,
            createdBy: usuarioId,
            updatedAt: now,
            updatedBy: usuarioId
        };

        opsDexie.push(payload);

        opsSync.push({
            type: 'createOrUpdate',
            targetCollection: 'producaoAgricola',
            documentId: producaoId,
            payload: payload
        });
    }

    if (onProgress) {
         onProgress(totalLines, totalLines); // Garante 100% no final
    }

    if (opsDexie.length > 0) {
        await db.producaoAgricola.bulkPut(opsDexie);

        for (const op of opsSync) {
            await enqueueTask(op.type, op.targetCollection, op.documentId, op.payload);
        }

        await logAuditoria(
            'producaoAgricola',
            'IMPORT_MASS',
            'IMPORT',
            { count: opsDexie.length },
            usuarioId,
            companyId
        );
    }
};

/**
 * Escuta mudanças em tempo real na coleção de Produção Agrícola.
 */
export const subscribeToProducaoAgricolaRealtime = (companyId) => {
    if (!navigator.onLine) return () => {};

    const q = query(
        collection(firestore, 'producaoAgricola'),
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
                    await db.producaoAgricola.bulkPut(toAddOrUpdate);
                }
                if (toDeleteIds.length > 0) {
                    await db.producaoAgricola.bulkDelete(toDeleteIds);
                }
            } catch (err) {
                console.error("[ProducaoAgricola Realtime] Erro ao sincronizar para o Dexie:", err);
            }
        }
    });

    return unsubscribe;
};
