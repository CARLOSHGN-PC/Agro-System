import express from 'express';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import relatorioEstimativaRoutes from './src/modules/relatorio-estimativa/routes/relatorioEstimativaRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Future API routes can be added here
app.get('/api/status', (req, res) => {
    res.json({ status: 'AgroSystem API is running' });
});

// Registrar rotas de módulos REST do Backend
app.use('/api/relatorios/estimativa', relatorioEstimativaRoutes);

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
