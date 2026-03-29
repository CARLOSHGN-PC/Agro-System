import { collection, query, where, onSnapshot, getDocs, orderBy, limit, startAfter } from 'firebase/firestore';
import { firestore } from '../firebase.js';
import db from '../localDb.js';
import { enqueueTask } from '../syncService.js';
import { v4 as uuidv4 } from 'uuid';
import { logAuditoria } from '../logService.js';

/**
 * @file apontamentoInsumoService.js
 * @description Lógica de negócios e persistência do Apontamento de Insumos.
 */

export const getApontamentosPaginados = async (companyId, pageSize = 50, lastVisible = null, searchTerm = '', dtInicialIso = '', dtFinalIso = '') => {
    let q = collection(firestore, 'apontamentosInsumo');
    let queryConstraints = [where("companyId", "==", companyId), where("status", "==", "ATIVO")];

    // Se dtHistoricoIso será nossa ordenação principal:
    if (dtInicialIso) queryConstraints.push(where("dtHistoricoIso", ">=", dtInicialIso));
    if (dtFinalIso) queryConstraints.push(where("dtHistoricoIso", "<=", dtFinalIso));

    queryConstraints.push(orderBy("dtHistoricoIso", "desc"));

    if (lastVisible) {
        queryConstraints.push(startAfter(lastVisible));
    }

    queryConstraints.push(limit(pageSize));

    const finalQuery = query(q, ...queryConstraints);
    const snapshot = await getDocs(finalQuery);

    const data = [];
    snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() });
    });

    const newLastVisible = snapshot.docs[snapshot.docs.length - 1];

    let filteredData = data;
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredData = data.filter(ap =>
            ap.codInsumo?.toLowerCase().includes(term) ||
            ap.descInsumo?.toLowerCase().includes(term) ||
            ap.desFazenda?.toLowerCase().includes(term) ||
            ap.deOperacao?.toLowerCase().includes(term)
        );
    }

    return { data: filteredData, lastVisible: newLastVisible, hasMore: snapshot.docs.length === pageSize };
};

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

// Sincronização em tempo real desativada para aliviar o Dexie.
export const subscribeToApontamentosInsumoRealtime = (companyId) => {
    return () => {};
};
