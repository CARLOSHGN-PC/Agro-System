import PDFDocument from 'pdfkit';

/**
 * Gera o PDF no formato "Relatório Operacional Raiz"
 * Sem frescuras, fonte Arial/Helvetica, tabelas de traço simples.
 *
 * @param {Object} reportData - Objeto montado pelo controller com as labels e talhões.
 * @param {Stream} res - Express Response (Writable Stream).
 */
export function gerarPdfOrdemCorte(reportData, res) {
    // Cria um novo documento PDF em formato Retrato (A4 padrão) com margens limpas
    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    // Pipe (vazar) o PDF sendo desenhado direto pra resposta HTTP do Express
    doc.pipe(res);

    // Helpers de Posição
    let currentY = 50;

    // === CABEÇALHO ===
    doc.font('Helvetica-Bold').fontSize(16).text('Ordem de Corte', { align: 'center' });
    currentY += 25;

    // Nome da Empresa Genérico (conforme instrução "CACU COMERCIO E INDUSTRIA DE ACUCAR E ALCOOL LTDA" da imagem)
    doc.font('Helvetica').fontSize(10).text('CACU COMERCIO E INDUSTRIA DE ACUCAR E ALCOOL LTDA', 40, currentY, { align: 'center' });
    currentY += 40;

    // BLOCO DE DADOS (3 COLUNAS VISUAIS DE TEXTO ALINHADO)
    doc.font('Helvetica-Bold').fontSize(10);

    // Linha 1
    doc.text('ID: ', 40, currentY, { continued: true }).font('Helvetica').text(reportData.idSistema, { continued: false });
    doc.font('Helvetica-Bold').text('Status: ', 250, currentY, { continued: true }).font('Helvetica').text(reportData.status, { continued: false });
    doc.font('Helvetica-Bold').text('Nº Empresa: ', 400, currentY, { align: 'right', continued: true }).font('Helvetica').text(reportData.numeroEmpresa || '          ');
    currentY += 15;

    // Linha 2
    doc.font('Helvetica-Bold').text('Fazenda: ', 40, currentY, { continued: true }).font('Helvetica').text(reportData.fazenda || '', { continued: false });
    doc.font('Helvetica-Bold').text('Frente: ', 400, currentY, { align: 'right', continued: true }).font('Helvetica').text(reportData.frente || '          ');
    currentY += 15;

    // Linha 3
    doc.font('Helvetica-Bold').text('Data: ', 40, currentY, { continued: true }).font('Helvetica').text(reportData.data || '', { continued: false });
    doc.font('Helvetica-Bold').text('Hora: ', 400, currentY, { align: 'right', continued: true }).font('Helvetica').text(reportData.hora || '          ');
    currentY += 15;

    // Linha 4
    doc.font('Helvetica-Bold').text('Responsável: ', 40, currentY, { continued: true }).font('Helvetica').text(reportData.responsavel || '', { continued: false });
    doc.font('Helvetica-Bold').text('Tipo de Cana: ', 400, currentY, { align: 'right', continued: true }).font('Helvetica').text(reportData.tipoCana || '          ');
    currentY += 30;

    // === TABELA DE TALHÕES ===

    // Desenha a linha superior do cabeçalho da tabela
    doc.moveTo(40, currentY).lineTo(550, currentY).lineWidth(1).stroke();
    currentY += 8;

    // Títulos da Tabela (Fonte Negrito)
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('Talhão', 40, currentY);
    doc.text('Área', 180, currentY);
    doc.text('Queima/Corte', 280, currentY);
    doc.text('TCH', 430, currentY, { align: 'right' });
    doc.text('Ton', 520, currentY, { align: 'right' });

    currentY += 15;

    // Desenha a linha inferior do cabeçalho da tabela
    doc.moveTo(40, currentY).lineTo(550, currentY).lineWidth(1).stroke();
    currentY += 10;

    // Itens da Tabela (Fonte Normal)
    doc.font('Helvetica').fontSize(9);

    reportData.talhoes.forEach((t) => {
        // Se a quebra de página bater, joga pra próxima página e refaz o header
        if (currentY > 750) {
            doc.addPage();
            currentY = 50;
            // Refazer o header da tabela (opcional, mas bom pra relatórios longos)
            doc.font('Helvetica-Bold');
            doc.moveTo(40, currentY).lineTo(550, currentY).stroke();
            currentY += 8;
            doc.text('Talhão', 40, currentY);
            doc.text('Área', 180, currentY);
            doc.text('Queima/Corte', 280, currentY);
            doc.text('TCH', 430, currentY, { align: 'right' });
            doc.text('Ton', 520, currentY, { align: 'right' });
            currentY += 15;
            doc.moveTo(40, currentY).lineTo(550, currentY).stroke();
            currentY += 10;
            doc.font('Helvetica');
        }

        // Tenta formatar os floats. Se for vazio/nulo, printa 0.00
        const areaStr = t.area ? Number(t.area).toFixed(2) : '0.00';
        const tchStr = t.tch ? Number(t.tch).toFixed(0) : '0';
        const tonStr = t.toneladas ? Number(t.toneladas).toFixed(2) : '0.00';
        // Regra do negócio sobre "Queima/Corte". Ou é CRUA, QUEIMADA ou fallback para TOTAL se estiver vazio/não reconhecido.
        let tipoColheitaFormatado = (t.queimaCorte || '').toUpperCase();
        if (tipoColheitaFormatado !== 'CRUA' && tipoColheitaFormatado !== 'QUEIMADA' && tipoColheitaFormatado !== 'PICADA CRUA' && tipoColheitaFormatado !== 'PICADA QUEIMADA') {
            tipoColheitaFormatado = 'TOTAL';
        }

        doc.text(t.talhaoId || '-', 40, currentY);
        doc.text(areaStr, 180, currentY);
        doc.text(tipoColheitaFormatado, 280, currentY);
        doc.text(tchStr, 430, currentY, { align: 'right' });
        doc.text(tonStr, 520, currentY, { align: 'right' });
        currentY += 15;
    });

    // Pular um pouquinho o Y após os últimos talhões
    currentY += 5;

    // === TOTALIZADORES ===
    doc.font('Helvetica-Bold').fontSize(10);
    const textTotalArea = `Total Área: ${Number(reportData.totalArea || 0).toFixed(2)}`;
    const textTotalTon = `Total Ton: ${Number(reportData.totalTon || 0).toFixed(2)}`;

    // Imprimir totais na mesma linha, separados por " | "
    doc.text(`${textTotalArea} | ${textTotalTon}`, 40, currentY);
    currentY += 25;

    // === OBSERVAÇÃO ===
    doc.text('Observação:', 40, currentY);
    currentY += 15;

    doc.font('Helvetica').text(reportData.observacao || '', 40, currentY);

    // Finalizar o documento (Encerra o stream)
    doc.end();
}
