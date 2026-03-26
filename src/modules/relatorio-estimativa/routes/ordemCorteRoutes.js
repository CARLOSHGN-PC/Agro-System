import { Router } from 'express';
import Controller from '../controllers/OrdemCorteRelatorioController.js';
// import { verifyAuth } from '../../../middlewares/verifyAuth.js';

const router = Router();

// Descomente caso as rotas devam ser autenticadas:
// router.use(verifyAuth);

/**
 * Endpoint de Geração do PDF Operacional de Ordem de Corte
 * Rota que atende: /api/estimativas/:companyId/relatorios/ordem-corte/pdf
 */
router.get('/:companyId/relatorios/ordem-corte/pdf', Controller.gerarPdfOperacional);

export default router;