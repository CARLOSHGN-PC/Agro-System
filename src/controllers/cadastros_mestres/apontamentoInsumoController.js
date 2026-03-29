import { adminFirestore as adminDb } from '../../config/firebaseAdmin.js';
import { v4 as uuidv4 } from 'uuid';

export const apontamentoInsumoController = {
    importChunk: async (req, res) => {
        try {
            // O body.chunk é um array com uma "fatia" dos dados (ex: 500 linhas)
            const { companyId, userId, chunk, currentBatch, totalBatches } = req.body;

            if (!companyId || !chunk || !Array.isArray(chunk)) {
                return res.status(400).json({ success: false, message: 'companyId e chunk (array) são obrigatórios.' });
            }

            if (chunk.length === 0) {
                return res.status(200).json({ success: true, message: 'Chunk vazio recebido e ignorado.' });
            }

            // Usamos o tamanho nativo do Firestore batch limit (500 ops)
            let batch = adminDb.batch();
            const now = new Date().toISOString();
            const collectionRef = adminDb.collection('apontamentosInsumo');

            let insertedInThisBatch = 0;

            for (let i = 0; i < chunk.length; i++) {
                const row = chunk[i];
                const apontamentoId = uuidv4();
                const docRef = collectionRef.doc(apontamentoId);

                const payload = {
                    id: apontamentoId,
                    companyId: companyId,
                    cluster: (row['CLUSTER'] || "").toString().trim(),
                    empresa: (row['EMPRESA'] || "").toString().trim(),
                    modAdm: (row['MOD_ADM'] || "").toString().trim(),
                    instancia: (row['INSTANCIA'] || "").toString().trim(),
                    dtHistorico: (row['DT_HISTORICO'] || "").toString().trim(),
                    dtHistoricoIso: ((row['DT_HISTORICO'] || "").toString().trim() && (row['DT_HISTORICO'] || "").toString().trim().includes('/'))
                                    ? (row['DT_HISTORICO'] || "").toString().trim().split('/').reverse().join('-')
                                    : "",
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
                    syncStatus: 'synced', // Já está no Firestore
                    createdAt: now,
                    createdBy: userId || 'system',
                    updatedAt: now,
                    updatedBy: userId || 'system'
                };

                batch.set(docRef, payload);
                insertedInThisBatch++;

                // O array chunk recebido pelo frontend já vem quebrado de forma segura (ex: até 500 linhas)
                // Se exceder 500 iterativamente, teríamos que quebrar aqui, mas garantiremos que o chunk do cliente seja de no máximo 500.
                if (insertedInThisBatch === 500) {
                    await batch.commit();
                    batch = adminDb.batch();
                    insertedInThisBatch = 0;
                }
            }

            if (insertedInThisBatch > 0) {
                await batch.commit();
            }

            return res.status(200).json({
                success: true,
                message: `Lote ${currentBatch} de ${totalBatches} processado.`
            });

        } catch (error) {
            console.error("Erro ao processar lote (chunk) no servidor:", error);
            return res.status(500).json({ success: false, message: 'Erro interno ao processar lote no servidor.', error: error.message });
        }
    },

    migrarDatasParaIso: async (req, res) => {
        try {
            const { companyId } = req.body;
            if (!companyId) return res.status(400).json({ success: false, message: 'companyId obrigatório.' });

            // 1. Migrar Apontamentos (em lotes de 500 para evitar limite do Firestore)
            let apontamentosRef = adminDb.collection('apontamentosInsumo');
            let snapApt = await apontamentosRef.where('companyId', '==', companyId).get();
            let batch = adminDb.batch();
            let countApt = 0;
            let totalAptOps = 0;

            for (let i = 0; i < snapApt.docs.length; i++) {
                const doc = snapApt.docs[i];
                const data = doc.data();
                if (data.dtHistorico && !data.dtHistoricoIso) {
                    const iso = data.dtHistorico.includes('/') ? data.dtHistorico.split('/').reverse().join('-') : "";
                    if (iso) {
                        batch.update(doc.ref, { dtHistoricoIso: iso });
                        countApt++;
                        totalAptOps++;
                        if (countApt === 500) {
                            await batch.commit();
                            batch = adminDb.batch();
                            countApt = 0;
                        }
                    }
                }
            }
            if (countApt > 0) await batch.commit();

            // 2. Migrar Produção Agrícola (em lotes de 500)
            let prodRef = adminDb.collection('producaoAgricola');
            let snapProd = await prodRef.where('companyId', '==', companyId).get();
            let batchProd = adminDb.batch();
            let countProd = 0;
            let totalProdOps = 0;

            for (let i = 0; i < snapProd.docs.length; i++) {
                const doc = snapProd.docs[i];
                const data = doc.data();
                if (data.dtUltCorte && !data.dtUltCorteIso) {
                    const iso = data.dtUltCorte.includes('/') ? data.dtUltCorte.split('/').reverse().join('-') : "";
                    if (iso) {
                        batchProd.update(doc.ref, { dtUltCorteIso: iso });
                        countProd++;
                        totalProdOps++;
                        if (countProd === 500) {
                            await batchProd.commit();
                            batchProd = adminDb.batch();
                            countProd = 0;
                        }
                    }
                }
            }
            if (countProd > 0) await batchProd.commit();

            return res.status(200).json({
                success: true,
                message: `Migração concluída. ${totalAptOps} apontamentos e ${totalProdOps} produções atualizadas.`
            });

        } catch (error) {
            console.error("Erro na migração de datas:", error);
            return res.status(500).json({ success: false, message: 'Erro interno ao migrar datas.', error: error.message });
        }
    }
};
