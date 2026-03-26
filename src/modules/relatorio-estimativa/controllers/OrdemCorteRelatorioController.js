import { adminFirestore } from '../../../config/firebaseAdmin.js';
import { gerarPdfOrdemCorte } from '../services/pdf/gerarPdfOrdemCorte.js';

class OrdemCorteRelatorioController {
    /**
     * Endpoint para gerar PDF Operacional da Ordem de Corte
     */
    static async gerarPdfOperacional(req, res) {
        try {
            const { companyId } = req.params;
            const { ordemId } = req.query;

            if (!companyId || !ordemId) {
                return res.status(400).json({ success: false, message: 'companyId e ordemId são obrigatórios.' });
            }

            // 1. Busca os dados Mestre da Ordem de Corte
            const ordemRef = adminFirestore.collection('ordens_corte').doc(ordemId);
            const ordemDoc = await ordemRef.get();

            if (!ordemDoc.exists) {
                return res.status(404).json({ success: false, message: 'Ordem de corte não encontrada.' });
            }

            const ordemDados = ordemDoc.data();
            ordemDados.id = ordemDoc.id;

            // 2. Busca todos os talhões (Vínculos) dessa Ordem para poder imprimir a tabela
            const vinculosSnapshot = await adminFirestore.collection('ordens_corte_talhoes')
                .where('ordemCorteId', '==', ordemId)
                .get();

            const talhoesVinculados = [];
            vinculosSnapshot.forEach(doc => {
                talhoesVinculados.push({ id: doc.id, ...doc.data() });
            });

            // 3. Montar o DTO (Data Transfer Object) com os valores exigidos pelo layout
            // Calculamos Totais
            let totalArea = 0;
            let totalTon = 0;
            let fazendaPrincipal = 'Não informada';

            // Como as fazendas ficam no talhão em nossas coletas da Estimativa
            // Ou nós pegamos dos metadados da estimativa_safra

            // Para encontrar detalhes como "Area" e "TCH", precisamos também ver os dados salvos da estimativa
            // do talhão no momento em que a ordem foi criada (se não tiver lá, procuramos na collection base).
            // Nossas propriedades salvam _estimate_tch etc, mas no banco a "ordem_corte_talhao" pode nao ter Area e TCH se ela só salva os "ids" dos talhões.
            // Para manter o PDF preenchido, vou buscar a "estimativas_safra" original do talhao.
            const estimativasDocs = [];
            if (talhoesVinculados.length > 0) {
                 const talhaoIdsPromises = talhoesVinculados.map(async (v) => {
                     // Busca a estimativa pra puxar TCH e Area exatas
                     // Note: Assumindo que o ID do talhão é v.talhaoId e estamos buscando ele na coleção 'estimativas_safra' com a rodada apropriada.
                     // Mas o jeito mais seguro (caso a arquitetura separe) é buscar apenas estimativas_safra onde talhaoId == v.talhaoId e safra == v.safra.

                     // Para acelerar e ser resiliente:
                     const estQuery = await adminFirestore.collection('estimativas_safra')
                        .where('talhaoId', '==', v.talhaoId)
                        .where('safra', '==', v.safra)
                        .limit(1)
                        .get();

                     let estData = {};
                     if (!estQuery.empty) {
                          estData = estQuery.docs[0].data();
                          if (!fazendaPrincipal || fazendaPrincipal === 'Não informada') {
                              fazendaPrincipal = estData.fazenda || estData.FUNDO_AGR || 'Não informada';
                          }
                     }

                     return {
                          talhaoId: v.talhaoId,
                          area: estData.area || 0,
                          tch: estData.tch || 0,
                          toneladas: estData.toneladas || 0,
                          queimaCorte: ordemDados.tipoCana || ordemDados.tipoColheita || 'TOTAL' // fallback para a coluna solicitada
                     };
                 });

                 const dadosResolvidos = await Promise.all(talhaoIdsPromises);

                 dadosResolvidos.forEach(d => {
                     totalArea += parseFloat(d.area) || 0;
                     totalTon += parseFloat(d.toneladas) || 0;
                     estimativasDocs.push(d);
                 });
            }

            const reportData = {
                idSistema: ordemDados.id,
                numeroEmpresa: ordemDados.numeroEmpresa || '',
                status: ordemDados.status || 'AGUARDANDO',
                fazenda: fazendaPrincipal,
                frente: ordemDados.frenteServico || '',
                data: ordemDados.openedAt ? new Date(ordemDados.openedAt).toLocaleDateString('pt-BR') : '',
                hora: ordemDados.openedAt ? new Date(ordemDados.openedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
                responsavel: ordemDados.nomeColaborador || '',
                tipoCana: ordemDados.tipoCana || '',
                observacao: ordemDados.observacao || '',
                talhoes: estimativasDocs,
                totalArea: totalArea,
                totalTon: totalTon
            };

            // 4. Configurar headers do HTTP e acionar PDFKit
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=OrdemCorte_${ordemDados.numeroEmpresa || ordemDados.codigo}.pdf`);

            // 5. Injeta Res para PDFKit escrever direto no Stream
            gerarPdfOrdemCorte(reportData, res);

        } catch (error) {
            console.error('Erro ao gerar relatório PDF da Ordem de Corte:', error);
            if (!res.headersSent) {
                res.status(500).json({ success: false, message: 'Erro ao gerar relatório', error: error.message });
            }
        }
    }
}

export default OrdemCorteRelatorioController;
