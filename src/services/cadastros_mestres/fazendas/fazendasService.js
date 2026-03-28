import db from '../../../services/localDb.js';
import { enqueueTask } from '../../../services/syncService.js';
import { v4 as uuidv4 } from 'uuid';
import { logAuditoria } from '../../../services/logService.js';

/**
 * @file fazendasService.js
 * @description Lógica de persistência e gerenciamento do Cadastro Geral de Fazendas e Talhões.
 */

export const getFazendas = async (companyId) => {
    return await db.fazendas.where('companyId').equals(companyId).toArray();
};

export const getTalhoesPorFazenda = async (companyId, fazendaId) => {
    return await db.talhoes.where('[companyId+fazendaId]').equals([companyId, fazendaId]).toArray();
};

/**
 * Salva uma fazenda e seus respectivos talhões no banco de dados local.
 * Usado primariamente pelo processo de importação via Excel.
 */
export const saveFazendaAndTalhoes = async (fazendaData, talhoesDataArray, usuarioId, companyId) => {
    // 1. Verificar se a fazenda já existe pelo COD_FAZ para atualização ou criação
    let fazenda = await db.fazendas.where('[companyId+codFaz]').equals([companyId, fazendaData.COD_FAZ]).first();
    const isNewFazenda = !fazenda;

    const fazendaId = isNewFazenda ? uuidv4() : fazenda.id;

    const payloadFazenda = {
        id: fazendaId,
        companyId,
        codFaz: fazendaData.COD_FAZ,
        desFazenda: fazendaData.DES_FAZENDA,
        syncStatus: 'pending',
        updatedAt: new Date().toISOString(),
        updatedBy: usuarioId
    };

    if (isNewFazenda) {
        payloadFazenda.createdAt = new Date().toISOString();
        payloadFazenda.createdBy = usuarioId;
    }

    await db.fazendas.put(payloadFazenda);
    await enqueueTask('createOrUpdate', 'fazendas', fazendaId, payloadFazenda);

    await logAuditoria(
        'fazendas',
        fazendaId,
        isNewFazenda ? 'CREATE' : 'UPDATE',
        { diff: payloadFazenda, context: 'Importação Cadastro Geral' },
        usuarioId,
        companyId
    );

    // 2. Processar os Talhões dessa fazenda
    for (const t of talhoesDataArray) {
        // Tenta achar o talhão pelo TALHAO dentro daquela fazenda
        let talhao = await db.talhoes.where('[companyId+fazendaId+talhao]').equals([companyId, fazendaId, t.TALHAO]).first();
        const isNewTalhao = !talhao;
        const talhaoId = isNewTalhao ? uuidv4() : talhao.id;

        const payloadTalhao = {
            ...t, // Injeta as 45 colunas puras do Excel
            id: talhaoId,
            fazendaId: fazendaId,
            companyId,
            talhao: t.TALHAO, // Normaliza o acesso pro index
            syncStatus: 'pending',
            updatedAt: new Date().toISOString(),
            updatedBy: usuarioId
        };

        if (isNewTalhao) {
            payloadTalhao.createdAt = new Date().toISOString();
            payloadTalhao.createdBy = usuarioId;
        }

        await db.talhoes.put(payloadTalhao);
        await enqueueTask('createOrUpdate', `fazendas/${fazendaId}/talhoes`, talhaoId, payloadTalhao);
    }

    return payloadFazenda;
};
