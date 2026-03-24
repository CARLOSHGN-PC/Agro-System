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

        // Filtros de Data (Estimativa)
        if (filters.dataEstimativaInicio) {
            results = results.filter(item => {
                if (!item.dataEstimativa) return false;
                const d = new Date(item.dataEstimativa);
                const f = new Date(filters.dataEstimativaInicio);
                return d >= f;
            });
        }
        if (filters.dataEstimativaFim) {
            results = results.filter(item => {
                if (!item.dataEstimativa) return false;
                const d = new Date(item.dataEstimativa);
                const f = new Date(filters.dataEstimativaFim);
                // Ajusta para o final do dia
                f.setUTCHours(23, 59, 59, 999);
                return d <= f;
            });
        }

        // Filtros de Data (Reestimativa)
        if (filters.dataReestimativaInicio) {
            results = results.filter(item => {
                if (!item.dataReestimativa) return false;
                const d = new Date(item.dataReestimativa);
                const f = new Date(filters.dataReestimativaInicio);
                return d >= f;
            });
        }
        if (filters.dataReestimativaFim) {
            results = results.filter(item => {
                if (!item.dataReestimativa) return false;
                const d = new Date(item.dataReestimativa);
                const f = new Date(filters.dataReestimativaFim);
                // Ajusta para o final do dia
                f.setUTCHours(23, 59, 59, 999);
                return d <= f;
            });
        }

        // Filtro de Situação (Estimativa vs Reestimativa)
        if (filters.situacao) {
            if (filters.situacao === 'SOMENTE_ESTIMATIVA') {
                // Considerando que 'Reestimativa' possui um contador de versão ou status
                results = results.filter(item => !item.dataReestimativa || item.rodadaKey === 'Estimativa');
            } else if (filters.situacao === 'SOMENTE_REESTIMATIVA') {
                results = results.filter(item => item.dataReestimativa || (item.rodadaKey && item.rodadaKey.startsWith('Reestimativa')));
            }
            // AMBOS traz tudo, então não há filtro adicional
        }

        return results;
    }
}

export default new RelatorioEstimativaRepository();
