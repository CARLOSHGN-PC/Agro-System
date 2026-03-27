import db from '../../localDb.js';
import { enqueueTask } from '../../syncService.js';
import { v4 as uuidv4 } from 'uuid';
import { logAuditoria } from '../../logService.js';

/**
 * @file tratosCulturaisService.js
 * @description Lógica de persistência para as Operações e Protocolos do módulo de Tratos Culturais.
 */

const MODULO_ID = 'tratos-culturais';

export const getOperacoes = async (companyId) => {
    return await db.operacoes.where('companyId').equals(companyId).toArray();
};

export const saveOperacao = async (operacao, usuarioId, companyId) => {
    const isNew = !operacao.id;
    const id = isNew ? uuidv4() : operacao.id;

    const payload = {
        ...operacao,
        id,
        moduloId: MODULO_ID,
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

    await db.operacoes.put(payload);
    await enqueueTask('createOrUpdate', 'operacoes', id, payload);

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

export const getProtocolos = async (companyId) => {
    return await db.protocolos.where('companyId').equals(companyId).toArray();
};

export const getProtocoloItens = async (protocoloId) => {
    const itens = await db.protocoloItens.where('protocoloId').equals(protocoloId).toArray();
    return itens.sort((a, b) => a.ordem - b.ordem);
};

export const saveProtocolo = async (protocolo, itens, usuarioId, companyId) => {
    const isNew = !protocolo.id;
    const protocoloId = isNew ? uuidv4() : protocolo.id;

    // 1. Salvar o Protocolo (Capa)
    const payloadProtocolo = {
        ...protocolo,
        id: protocoloId,
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

    // 2. Salvar os Itens (Produtos do Protocolo)
    // Para simplificar a sincronização offline, apagamos os itens antigos localmente
    // e recriamos. O `syncService` enfileirará as ações como createOrUpdate,
    // que farão um setDoc com merge no Firestore.

    const oldItens = await db.protocoloItens.where('protocoloId').equals(protocoloId).toArray();
    for (const old of oldItens) {
        await db.protocoloItens.delete(old.id);
        // Observação: Para remoção definitiva de subcoleções no Firestore via offline,
        // a engine de syncService precisaria ter um 'delete'.
        // Como o foco é soft-delete ou reescrita, usaremos a ordem para sobrescrever ou inativar.
    }

    for (const item of itens) {
        const itemId = uuidv4();
        const payloadItem = {
            ...item,
            id: itemId,
            protocoloId: protocoloId,
            syncStatus: 'pending'
        };
        await db.protocoloItens.put(payloadItem);
        // O caminho no Firebase seria protocolos/{protocoloId}/itens/{itemId}
        // Isso precisará de ajuste no syncService caso não usemos Collections raízes.
        // Para fins deste módulo, assumiremos a gravação com o ID do protocolo como pai.
        await enqueueTask('createOrUpdate', `protocolos/${protocoloId}/itens`, itemId, payloadItem);
    }

    return payloadProtocolo;
};
