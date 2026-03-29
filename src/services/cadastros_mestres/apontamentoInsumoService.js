import db from '../localDb.js';
import { enqueueTask } from '../syncService.js';
import { v4 as uuidv4 } from 'uuid';
import { logAuditoria } from '../logService.js';

/**
 * @file apontamentoInsumoService.js
 * @description Lógica de negócios e persistência do Apontamento de Insumos.
 */

export const getApontamentosInsumo = async (companyId) => {
    return await db.apontamentosInsumo.where('companyId').equals(companyId).toArray();
};

export const saveApontamentosEmMassa = async (apontamentosRows, usuarioId, companyId, onProgress = null) => {
    const opsDexie = [];
    const opsSync = [];
    const now = new Date().toISOString();
    let processedLines = 0;
    const totalLines = apontamentosRows.length;

    for (const row of apontamentosRows) {
        // Incrementa e atualiza progresso
        processedLines++;
        if (onProgress && processedLines % 10 === 0) {
           onProgress(processedLines, totalLines);
        }

        const apontamentoId = uuidv4();

        const payload = {
            id: apontamentoId,
            companyId,
            cluster: (row['CLUSTER'] || "").toString().trim(),
            empresa: (row['EMPRESA'] || "").toString().trim(),
            modAdm: (row['MOD_ADM'] || "").toString().trim(),
            instancia: (row['INSTANCIA'] || "").toString().trim(),
            dtHistorico: (row['DT_HISTORICO'] || "").toString().trim(),
            cdCcusto: (row['CD_CCUSTO'] || "").toString().trim(),
            deCcusto: (row['DE_CCUSTO'] || "").toString().trim(),
            cdOp: (row['CD_OP'] || "").toString().trim(),
            deOperacao: (row['DE_OPERACAO'] || "").toString().trim(),
            undOper: (row['UND_OPER'] || "").toString().trim(),
            codFaz: (row['COD_FAZ'] || "").toString().trim(),
            desFazenda: (row['DES_FAZENDA'] || "").toString().trim(),
            bloco: (row['BLOCO'] || "").toString().trim(),
            desBloco: (row['DES_BLOCO'] || "").toString().trim(),
            talhao: (row['TALHAO'] || "").toString().trim(),
            etapa: (row['ETAPA'] || "").toString().trim(),
            codInsumo: (row['COD_INSUMO'] || "").toString().trim(),
            descInsumo: (row['DESC_INSUMO'] || "").toString().trim(),
            haAplic: (row['HA_APLIC'] || "").toString().trim(),
            qtdeAplic: (row['QTDE_APLIC'] || "").toString().trim(),
            doseAplic: (row['DOSE_APLIC'] || "").toString().trim(),
            doseRec: (row['DOSE_REC'] || "").toString().trim(),
            vlrUnit: (row['VLR_UNIT'] || "").toString().trim(),
            totalRs: (row['TOTAL_RS'] || "").toString().trim(),
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
            targetCollection: 'apontamentosInsumo',
            documentId: apontamentoId,
            payload: payload
        });
    }

    if (onProgress) {
         onProgress(totalLines, totalLines); // Garante 100% no final
    }

    if (opsDexie.length > 0) {
        // Salva tudo no Dexie em lote
        await db.apontamentosInsumo.bulkPut(opsDexie);

        // Enfileira tudo em lote pro SyncService
        for (const op of opsSync) {
            await enqueueTask(op.type, op.targetCollection, op.documentId, op.payload);
        }

        await logAuditoria(
            'apontamentosInsumo',
            'IMPORT_MASS',
            'IMPORT',
            { count: opsDexie.length },
            usuarioId,
            companyId
        );
    }
};

export const inactivateApontamentoInsumo = async (id, usuarioId, companyId) => {
    const apontamento = await db.apontamentosInsumo.get(id);
    if (!apontamento) throw new Error('Apontamento não encontrado');

    const payload = {
        ...apontamento,
        status: 'INATIVO',
        syncStatus: 'pending',
        updatedAt: new Date().toISOString(),
        updatedBy: usuarioId
    };

    await db.apontamentosInsumo.put(payload);
    await enqueueTask('createOrUpdate', 'apontamentosInsumo', id, payload);

    await logAuditoria(
        'apontamentosInsumo',
        id,
        'INACTIVATE',
        { reason: 'User requested inactivation' },
        usuarioId,
        companyId
    );
};
