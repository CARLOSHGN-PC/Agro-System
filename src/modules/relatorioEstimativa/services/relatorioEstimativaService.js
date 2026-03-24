import { getAuth } from 'firebase/auth';

/**
 * Faz a requisição para o backend Node.js (via /api/relatorios/estimativa/exportar/...)
 * e trata a resposta binária (Blob) para realizar o download automático no navegador.
 *
 * @param {Object} payload Objeto de filtros (safra, tipoRelatorio, formatoSaida, etc)
 * @throws {Error} Se a API retornar erro ou falhar a rede
 */
export const exportarRelatorioEstimativa = async (payload) => {
    try {
        const auth = getAuth();
        const user = auth.currentUser;

        let token = '';
        if (user) {
            token = await user.getIdToken();
        }

        // O backend está hospedado no Render, enquanto o frontend pode estar no Github Pages.
        // Se a variável VITE_API_URL estiver definida (ex: "https://meu-backend-render.com"),
        // a utilizamos. Senão, se estiver rodando localmente, usamos o caminho relativo.
        const baseUrl = import.meta.env.VITE_API_URL || '';

        // Define a URL baseada no formato solicitado
        const endpoint = payload.formatoSaida === 'PDF'
            ? `${baseUrl}/api/relatorios/estimativa/exportar/pdf`
            : `${baseUrl}/api/relatorios/estimativa/exportar/excel`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            let errorMsg = 'Erro ao processar relatório no servidor.';
            try {
                // Tenta ler o JSON de erro do backend (Zod validator error message etc)
                const errorData = await response.json();
                errorMsg = errorData.error || JSON.stringify(errorData.details) || errorMsg;
            } catch (e) {
                // Se não for JSON (ex: 500 HTML), falha silensiosamente e usa o fallback
            }
            throw new Error(errorMsg);
        }

        // Lê o arquivo binário enviado por Streaming (PDFKit ou ExcelJS)
        const blob = await response.blob();

        // Pega o nome do arquivo enviado no cabeçalho ou cria um genérico
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `relatorio_estimativa_${new Date().getTime()}`;

        if (contentDisposition && contentDisposition.includes('filename=')) {
            filename = contentDisposition.split('filename=')[1].replace(/"/g, '');
        } else {
            filename += payload.formatoSaida === 'PDF' ? '.pdf' : '.xlsx';
        }

        // Cria o link virtual e dispara o download no navegador
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;

        document.body.appendChild(a);
        a.click();

        // Limpeza
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        return true;
    } catch (error) {
        console.error('Falha no RelatorioEstimativaService:', error);
        throw error;
    }
};