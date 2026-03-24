import { adminFirestore } from '../../../config/firebaseAdmin.js';

class RelatorioEstimativaRepository {
    /**
     * Busca os dados brutos de estimativas baseado nos filtros.
     * Como o Firestore tem limitações de queries complexas com muitos INs e ORs em campos diferentes,
     * a estratégia recomendada é fazer um fetch das estimativas ativas na safra/empresa e aplicar os filtros
     * refinados em memória (ou buscar subconjuntos que o Firestore suporte indexar).
     */
    async fetchEstimativas(filters) {
        let query = adminFirestore.collection('estimativas');

        // Aplicação de filtros que o Firestore permite perfeitamente (Equalities)
        if (filters.safra) {
            query = query.where('safra', '==', filters.safra);
        }

        if (filters.empresaId) {
            query = query.where('empresaId', '==', String(filters.empresaId));
        }

        const snapshot = await query.get();
        if (snapshot.empty) {
            return [];
        }

        let results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // ---- Filtros em memória (devido a restrições do NoSQL do Firestore) ---- //

        // Filtro por Unidade
        if (filters.unidadeId) {
            results = results.filter(item => item.unidadeId == filters.unidadeId);
        }

        // Filtro por Tipo de Propriedade
        if (filters.tipoPropriedade && filters.tipoPropriedade.length > 0 && !filters.tipoPropriedade.includes('TODAS')) {
            // Supondo que o frontend salve como string normalizada na collection
            results = results.filter(item => filters.tipoPropriedade.includes((item.tipoPropriedade || '').toUpperCase()));
        }

        // Filtro por Propriedades/Fazendas/Talhões/Cortes/Variedades
        if (filters.fazendaIds && filters.fazendaIds.length > 0) {
             results = results.filter(item => filters.fazendaIds.includes(item.fazendaId));
        }

        if (filters.talhaoIds && filters.talhaoIds.length > 0) {
             results = results.filter(item => filters.talhaoIds.includes(item.talhaoId));
        }

        if (filters.cortes && filters.cortes.length > 0) {
            results = results.filter(item => filters.cortes.includes(item.corte || item.ecorte));
        }

        // Filtros de Data
        // Nota: Assumindo que as datas no Firestore estão salvas como timestamps ou strings YYYY-MM-DD
        if (filters.dataEstimativaInicio) {
             results = results.filter(item => {
                 const d = new Date(item.dataEstimativa);
                 const f = new Date(filters.dataEstimativaInicio);
                 return d >= f;
             });
        }
        if (filters.dataEstimativaFim) {
             results = results.filter(item => {
                 const d = new Date(item.dataEstimativa);
                 const f = new Date(filters.dataEstimativaFim);
                 return d <= f;
             });
        }

        return results;
    }
}

export default new RelatorioEstimativaRepository();
