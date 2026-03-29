import express from 'express';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import relatorioEstimativaRoutes from './src/modules/relatorio-estimativa/routes/relatorioEstimativaRoutes.js';
import ordemCorteRoutes from './src/modules/relatorio-estimativa/routes/ordemCorteRoutes.js';
import apontamentoInsumoRoutes from './src/routes/cadastros_mestres/apontamentoInsumoRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
// Aumentando o limite global do body-parser para suportar o recebimento de chunks em JSON maiores que 100kb
app.use(express.json({ limit: '50mb' }));

// Future API routes can be added here
app.get('/api/status', (req, res) => {
    res.json({ status: 'AgroSystem API is running' });
});

// Registrar rotas de módulos REST do Backend
app.use('/api/relatorios/estimativa', relatorioEstimativaRoutes);
app.use('/api/estimativas', ordemCorteRoutes);
app.use('/api/cadastros/apontamentos-insumo', apontamentoInsumoRoutes);

// Serve static files from the React Vite build (dist folder)
app.use(express.static(path.join(__dirname, 'dist')));

// Catch-all handler for React SPA (Single Page Application) routing
// If a request doesn't match an API route or a static file, serve index.html
app.get(/^(?!\/api).+/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
