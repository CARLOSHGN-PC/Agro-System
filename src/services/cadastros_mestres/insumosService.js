import db from '../localDb.js';
import { enqueueTask } from '../syncService.js';
import { v4 as uuidv4 } from 'uuid';
import { logAuditoria } from '../logService.js';

/**
 * @file insumosService.js
 * @description Lógica de negócios e persistência do Cadastro Mestre de Insumos.
 *
 * O que este bloco faz:
 * Gerencia a inserção, edição, listagem e inativação de insumos, tanto
 * para a interface de usuário quanto para a importação de planilhas.
 */

export const getInsumos = async (companyId) => {
    return await db.insumos.where('companyId').equals(companyId).toArray();
};

export const saveInsumo = async (insumo, usuarioId, companyId) => {
    const isNew = !insumo.id;
    const id = isNew ? uuidv4() : insumo.id;

    const payload = {
        ...insumo,
        id,
        companyId,
        status: insumo.status || 'ATIVO',
        syncStatus: 'pending',
        updatedAt: new Date().toISOString(),
        updatedBy: usuarioId
    };

    if (isNew) {
        payload.createdAt = new Date().toISOString();
        payload.createdBy = usuarioId;
    }

    // 1. Salvar no banco local (Dexie)
    await db.insumos.put(payload);

    // 2. Sincronizar na nuvem (Firestore)
    await enqueueTask('createOrUpdate', 'insumos', id, payload);

    // 3. Auditoria
    await logAuditoria(
        'insumos',
        id,
        isNew ? 'CREATE' : 'UPDATE',
        { diff: payload },
        usuarioId,
        companyId
    );

    return payload;
};

export const inactivateInsumo = async (id, usuarioId, companyId) => {
    const insumo = await db.insumos.get(id);
    if (!insumo) throw new Error('Insumo não encontrado');

    const payload = {
        ...insumo,
        status: 'INATIVO',
        syncStatus: 'pending',
        updatedAt: new Date().toISOString(),
        updatedBy: usuarioId
    };

    await db.insumos.put(payload);
    await enqueueTask('createOrUpdate', 'insumos', id, payload);

    await logAuditoria(
        'insumos',
        id,
        'INACTIVATE',
        { reason: 'User requested inactivation' },
        usuarioId,
        companyId
    );
};

/**
 * Salva ou atualiza uma lista de insumos vinda da planilha em massa.
 */
export const saveInsumosEmMassa = async (insumosRows, usuarioId, companyId, onProgress = null) => {
    // Buscar todos os insumos já cadastrados para a empresa para evitar duplicatas
    const insumosExistentes = await db.insumos.where('companyId').equals(companyId).toArray();
    const mapaInsumos = {};
    insumosExistentes.forEach(ins => {
        // Agrupamos pelo COD_INSUMO para bater com o Excel
        const codInsumo = (ins.codInsumo || "").toString().trim().toUpperCase();
        mapaInsumos[codInsumo] = ins;
    });

    const opsDexie = [];
    const opsSync = [];

    const now = new Date().toISOString();
    let processedLines = 0;
    const totalLines = insumosRows.length;

    for (const row of insumosRows) {
        const codInsumoExcel = (row['COD_INSUMO'] || "").toString().trim();
        if (!codInsumoExcel) continue; // Ignora linha sem código de insumo

        const codUpper = codInsumoExcel.toUpperCase();
        let insumoId = mapaInsumos[codUpper]?.id;
        const isNew = !insumoId;

        // Atualizar barra de progresso se callback existir
        processedLines++;
        if (onProgress && processedLines % 10 === 0) {
           onProgress(processedLines, totalLines);
        }

        // Se já existe, pula de acordo com a regra de só acrescentar
        if (!isNew) {
            continue;
        }

        insumoId = uuidv4();

        const payload = {
            id: insumoId,
            companyId,
            codInsumoRateio: (row['COD_INSUMO_RATEIO'] || "").toString().trim(),
            codInsumo: codInsumoExcel,
            descInsumo: (row['DESC_INSUMO'] || "").toString().trim(),
            descGrupo: (row['DESC_GRUPO'] || "").toString().trim(),
            descSubgrupo: (row['DESC_SUBGRUPO'] || "").toString().trim(),
            und: (row['UND'] || "").toString().trim(),
            vlrUnit: (row['VLR_UNIT'] || "").toString().trim(),
            dtVlrUnit: (row['DT_VLR_UNIT'] || "").toString().trim(),
            nomeComercial: (row['NOME_COMERCIAL'] || "").toString().trim(),
            doseMedia: (row['DOSE_MEDIA'] || "").toString().trim(),
            doseMinima: (row['DOSE_MINIMA'] || "").toString().trim(),
            doseMaxima: (row['DOSE_MAXIMA'] || "").toString().trim(),
            status: 'ATIVO',
            syncStatus: 'pending',
            createdAt: now,
            createdBy: usuarioId,
            updatedAt: now,
            updatedBy: usuarioId
        };

        opsDexie.push(payload);

        // Preparamos a fila pro Firebase
        opsSync.push({
            type: 'createOrUpdate',
            targetCollection: 'insumos',
            documentId: insumoId,
            payload: payload
        });
    }

    if (onProgress) {
         onProgress(totalLines, totalLines); // Garante 100% no final
    }

    if (opsDexie.length > 0) {
        // Salva tudo no Dexie em lote
        await db.insumos.bulkPut(opsDexie);

        // Enfileira tudo em lote pro SyncService
        for (const op of opsSync) {
            await enqueueTask(op.type, op.targetCollection, op.documentId, op.payload);
        }

        await logAuditoria(
            'insumos',
            'IMPORT_MASS',
            'IMPORT',
            { count: opsDexie.length },
            usuarioId,
            companyId
        );
    }
};