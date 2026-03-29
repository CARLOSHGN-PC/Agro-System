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

// Remoção do saveApontamentosEmMassa local. O salvamento em massa agora é processado exclusivamente via API pelo backend
// para suportar grandes volumes de dados que travam o navegador (Ex: 300k linhas).

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
