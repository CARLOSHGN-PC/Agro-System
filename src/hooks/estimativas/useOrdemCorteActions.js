import { useState } from 'react';
import Swal from 'sweetalert2';
import { abrirOrdemCorte, fecharOrdemCorte } from '../../services/ordemCorte/ordemCorteService';
import { showSuccess, showError } from '../../utils/alert';
import { palette } from '../../constants/theme';

/**
 * useOrdemCorteActions.js
 *
 * O que este bloco faz:
 * É um React Hook utilitário que lida com o "clique do usuário".
 * Exibe popups de confirmação, chama o Service que manipula o Banco, e emite erros amigáveis.
 *
 * Por que ele existe:
 * Evitar sujeira no arquivo de UI (OrdemCorteActions.jsx) com "Swal.fire" ou try/catch
 * complexos. Este Hook fornece funções limpas como "handleAbrir()" ou "handleFechar()".
 */

export const useOrdemCorteActions = () => {
    const [isProcessing, setIsProcessing] = useState(false);

    const handleAbrirOrdem = async ({ companyId, safra, talhaoIds, rodadaOrigem, usuario }) => {
        if (!talhaoIds || talhaoIds.length === 0) {
            showError("Atenção", "Selecione ao menos um talhão no mapa para abrir uma Ordem de Corte.");
            return false;
        }

        const confirm = await Swal.fire({
            title: 'Abrir Ordem de Corte?',
            text: `Isso irá vincular os ${talhaoIds.length} talhão(ões) selecionado(s) a uma nova Ordem, que ficarão azuis no mapa.`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: palette.gold,
            cancelButtonColor: '#ef4444',
            confirmButtonText: 'Sim, Abrir',
            cancelButtonText: 'Cancelar',
            background: 'rgba(14,16,20,0.96)',
            color: palette.white
        });

        if (!confirm.isConfirmed) return false;

        setIsProcessing(true);
        try {
            const result = await abrirOrdemCorte(companyId, safra, talhaoIds, rodadaOrigem, usuario);

            if (result.success) {
                showSuccess("Sucesso!", `Ordem de Corte ${result.codigo} aberta e salva offline.`);
                return true;
            } else {
                showError("Não foi possível abrir", result.message);
                return false;
            }
        } catch (err) {
            console.error(err);
            showError("Erro do Sistema", "Ocorreu um problema ao registrar a Ordem.");
            return false;
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFecharOrdem = async (ordemCorteId, codigoVisual, usuario) => {
        const confirm = await Swal.fire({
            title: 'Fechar Ordem de Corte?',
            text: `Tem certeza que deseja fechar a Ordem ${codigoVisual}? Os talhões vinculados a ela ficarão ocultos do mapa nesta safra.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: palette.gold,
            cancelButtonColor: '#ef4444',
            confirmButtonText: 'Sim, Fechar',
            cancelButtonText: 'Cancelar',
            background: 'rgba(14,16,20,0.96)',
            color: palette.white
        });

        if (!confirm.isConfirmed) return false;

        setIsProcessing(true);
        try {
             // Apenas chama o método do repo orquestrador passando a data atual no servidor (simulada em UTC ou locale string no repo)
             const result = await fecharOrdemCorte(ordemCorteId, usuario);

             if (result.success) {
                 showSuccess("Ordem Fechada!", `A ordem ${codigoVisual} foi encerrada com sucesso.`);
                 return true;
             } else {
                 showError("Falha ao fechar", result.message);
                 return false;
             }
        } catch (err) {
             console.error(err);
             showError("Erro do Sistema", "Ocorreu um problema ao fechar a Ordem.");
             return false;
        } finally {
             setIsProcessing(false);
        }
    };

    return {
        isProcessing,
        handleAbrirOrdem,
        handleFecharOrdem
    };
};
