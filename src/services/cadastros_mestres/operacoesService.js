import db from '../localDb.js';
import { enqueueTask } from '../syncService.js';
import { v4 as uuidv4 } from 'uuid';
import { logAuditoria } from '../logService.js';

/**
 * @file operacoesService.js
 * @description Lógica de negócios e persistência do Cadastro Mestre de Operações.
 *
 * O que este bloco faz:
 * Gerencia a inserção, edição, listagem e inativação de operações, tanto
 * para a interface de usuário quanto para a importação de planilhas.
 *
 * Por que ele existe:
 * Abstrair do componente visual a complexidade de gerenciar UUIDs,
 * syncStatus, IndexedDB local e enfileiramento de sincronização para a nuvem.
 */

export const getOperacoes = async (companyId) => {
    return await db.operacoes.where('companyId').equals(companyId).toArray();
};

export const saveOperacao = async (operacao, usuarioId, companyId) => {
    const isNew = !operacao.id;
    const id = isNew ? uuidv4() : operacao.id;

    const payload = {
        ...operacao,
        id,
        companyId,
        status: operacao.status || 'ATIVO',
        syncStatus: 'pending',
        updatedAt: new Date().toISOString(),
        updatedBy: usuarioId
    };

    if (isNew) {
        payload.createdAt = new Date().toISOString();
        payload.createdBy = usuarioId;
    }

    // 1. Salvar no banco local (Dexie)
    await db.operacoes.put(payload);

    // 2. Sincronizar na nuvem (Firestore)
    await enqueueTask('createOrUpdate', 'operacoes', id, payload);

    // 3. Auditoria
    await logAuditoria(
        'operacoes',
        id,
        isNew ? 'CREATE' : 'UPDATE',
        { diff: payload },
        usuarioId,
        companyId
    );

    return payload;
};

export const inactivateOperacao = async (id, usuarioId, companyId) => {
    const operacao = await db.operacoes.get(id);
    if (!operacao) throw new Error('Operação não encontrada');

    const payload = {
        ...operacao,
        status: 'INATIVO',
        syncStatus: 'pending',
        updatedAt: new Date().toISOString(),
        updatedBy: usuarioId
    };

    await db.operacoes.put(payload);
    await enqueueTask('createOrUpdate', 'operacoes', id, payload);

    await logAuditoria(
        'operacoes',
        id,
        'INACTIVATE',
        { reason: 'User requested inactivation' },
        usuarioId,
        companyId
    );
};

/**
 * Salva ou atualiza uma lista de operações vinda da planilha em massa.
 */
export const saveOperacoesEmMassa = async (operacoesRows, usuarioId, companyId) => {
    // Buscar todas as operações já cadastradas para a empresa para evitar duplicatas
    const operacoesExistentes = await db.operacoes.where('companyId').equals(companyId).toArray();
    const mapaOperacoes = {};
    operacoesExistentes.forEach(op => {
        // Agrupamos pelo CD_OPERACAO (Código da Operação) para bater com o Excel
        const cdOperacao = (op.cdOperacao || "").toString().trim().toUpperCase();
        mapaOperacoes[cdOperacao] = op;
    });

    const opsDexie = [];
    const opsSync = [];

    const now = new Date().toISOString();

    for (const row of operacoesRows) {
        const cdOperacaoExcel = (row['CD_OPERACAO'] || "").toString().trim();
        if (!cdOperacaoExcel) continue; // Ignora linha sem código de operação

        const cdUpper = cdOperacaoExcel.toUpperCase();
        let operacaoId = mapaOperacoes[cdUpper]?.id;
        const isNew = !operacaoId;

        // "nao deve atualizar somente acrescentar"
        if (!isNew) {
            continue; // Pula se já existir, não atualiza
        }

        operacaoId = uuidv4();

        const payload = {
            id: operacaoId,
            companyId,
            codCcustoRateio: (row['COD_CCUSTO_RATEIO'] || "").toString().trim(),
            cdCcusto: (row['CD_CCUSTO'] || "").toString().trim(),
            deCcusto: (row['DE_CCUSTO'] || "").toString().trim(),
            cdOperacao: cdOperacaoExcel,
            deOperacao: (row['DE_OPERACAO'] || "").toString().trim(),
            unidade: (row['UNIDADE'] || "").toString().trim(),
            tipoOperacao: (row['TIPO_OPERACAO'] || "").toString().trim(),
            classe: (row['CLASSE'] || "").toString().trim(),
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
            targetCollection: 'operacoes',
            documentId: operacaoId,
            payload: payload
        });
    }

    if (opsDexie.length > 0) {
        // Salva tudo no Dexie em lote
        await db.operacoes.bulkPut(opsDexie);

        // Enfileira tudo em lote pro SyncService
        for (const op of opsSync) {
            await enqueueTask(op.type, op.targetCollection, op.documentId, op.payload);
        }

        await logAuditoria(
            'operacoes',
            'IMPORT_MASS',
            'IMPORT',
            { count: opsDexie.length },
            usuarioId,
            companyId
        );
    }
};