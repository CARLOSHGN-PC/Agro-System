import db from '../../localDb.js';
import { enqueueTask } from '../../syncService.js';
import { v4 as uuidv4 } from 'uuid';
import { logAuditoria } from '../../logService.js';

/**
 * @file tratosCulturaisService.js
 * @description Lógica de persistência para as Operações e Protocolos do módulo de Tratos Culturais.
 */

const MODULO_ID = 'tratos-culturais';

export const getProtocolos = async (companyId) => {
    return await db.protocolos.where('companyId').equals(companyId).toArray();
};

export const getProtocoloItens = async (protocoloId) => {
    const itens = await db.protocoloItens.where('protocoloId').equals(protocoloId).toArray();
    return itens.sort((a, b) => a.ordem - b.ordem);
};

export const getProtocoloOperacoes = async (protocoloId) => {
    const operacoes = await db.protocoloOperacoes.where('protocoloId').equals(protocoloId).toArray();
    return operacoes.sort((a, b) => a.ordem - b.ordem);
};

export const saveProtocolo = async (protocolo, operacoes, itens, usuarioId, companyId) => {
    const isNew = !protocolo.id;
    const protocoloId = isNew ? uuidv4() : protocolo.id;

    // 1. Salvar o Protocolo (Capa da Receita)
    const payloadProtocolo = {
        ...protocolo,
        id: protocoloId,
        moduloId: MODULO_ID,
        companyId,
        status: protocolo.status || 'ATIVO',
        syncStatus: 'pending',
        updatedAt: new Date().toISOString(),
        updatedBy: usuarioId
    };

    if (isNew) {
        payloadProtocolo.createdAt = new Date().toISOString();
        payloadProtocolo.createdBy = usuarioId;
    }

    await db.protocolos.put(payloadProtocolo);
    await enqueueTask('createOrUpdate', 'protocolos', protocoloId, payloadProtocolo);

    await logAuditoria(
        'protocolos',
        protocoloId,
        isNew ? 'CREATE' : 'UPDATE',
        { diff: payloadProtocolo },
        usuarioId,
        companyId
    );

    // 2. Salvar Operações da Receita (Múltiplas operações por protocolo)
    // Deletar ou inativar operações antigas (por simplicidade: inativar ou substituir soft)
    const oldOperacoes = await db.protocoloOperacoes.where('protocoloId').equals(protocoloId).toArray();
    for (const old of oldOperacoes) {
        await db.protocoloOperacoes.delete(old.id);
    }

    for (const op of operacoes) {
        const opId = op.id || uuidv4();
        const payloadOp = {
            ...op,
            id: opId,
            protocoloId: protocoloId,
            syncStatus: 'pending',
            status: op.status || 'ATIVO'
        };
        await db.protocoloOperacoes.put(payloadOp);
        await enqueueTask('createOrUpdate', `protocolos/${protocoloId}/operacoes`, opId, payloadOp);
    }


    // 3. Salvar os Itens (Produtos do Protocolo)
    const oldItens = await db.protocoloItens.where('protocoloId').equals(protocoloId).toArray();
    for (const old of oldItens) {
        await db.protocoloItens.delete(old.id);
    }

    for (const item of itens) {
        const itemId = item.id || uuidv4();
        const payloadItem = {
            ...item,
            id: itemId,
            protocoloId: protocoloId,
            syncStatus: 'pending',
            status: item.status || 'ATIVO'
        };
        await db.protocoloItens.put(payloadItem);
        await enqueueTask('createOrUpdate', `protocolos/${protocoloId}/itens`, itemId, payloadItem);
    }

    return payloadProtocolo;
};
