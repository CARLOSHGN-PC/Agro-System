import * as repo from './ordemCorteRepository';
import { buildNovaOrdemCorte, buildVinculoOrdemTalhao } from './ordemCorteMapper';
import { validatePodeAbrirOrdem } from './ordemCorteRules';
import { formatarCodigoOrdem } from '../../modules/estimativas/utils/ordemCorteHelpers';

/**
 * ordemCorteService.js
 *
 * O que este bloco faz:
 * Orquestra as ações de abrir e fechar ordem de corte.
 * Chama os validadores (`Rules`), o repositório (`Repository`) e o formatador (`Mapper`).
 * Retorna sucesso ou erro estruturado para a interface (UI).
 *
 * Por que ele existe:
 * Concentrar a "Receita de Bolo" num único Service que delega para as peças (Mapper, Rules, Repo).
 * Nenhuma regra UI (React) entra aqui, garantindo pureza da camada.
 */

export const abrirOrdemCorte = async (companyId, safra, talhaoIds, rodadaOrigem, usuario) => {
    try {
        // Passo 1: Puxa todos os vínculos existentes dessa safra para passar na validação de regras.
        // Precisamos saber se qualquer ID do array 'talhaoIds' já tem algo ABERTO.
        const todosVinculosSafra = await repo.getVinculosDaSafra(companyId, safra);

        // Passo 2: Validar!
        const isValid = validatePodeAbrirOrdem(talhaoIds, todosVinculosSafra);

        // Se a regra barrar (O conflictId seria o id que falhou na avaliação), jogamos o erro amigável.
        if (!isValid.canOpen) {
             return { success: false, message: `Um ou mais talhões selecionados já possuem uma Ordem de Corte ABERTA na Safra atual. Feche-as antes de criar novas.` };
        }

        // Passo 3: Criar sequencial. Se não houver, o DB diz que é 1.
        const sequencialNumber = await repo.getNextSequencialPorSafra(companyId, safra);
        const codigoFormatado = formatarCodigoOrdem(sequencialNumber);

        // Passo 4: Usa o Mapper para criar objetos perfeitos para salvar
        const payloadOrdem = buildNovaOrdemCorte({
            companyId,
            safra,
            sequencial: sequencialNumber,
            codigoVisual: codigoFormatado,
            talhaoIds,
            rodadaOrigem,
            usuario
        });

        // E constrói as filhas (Vínculos), que referenciam o pai.
        const payloadVinculos = talhaoIds.map(tId => buildVinculoOrdemTalhao({
            ordemBase: payloadOrdem,
            talhaoId: tId
        }));

        // Passo 5: Efetivar no Banco (que fará a fila Offline-First acontecer).
        await repo.saveOrdemCorteAndVinculos(payloadOrdem, payloadVinculos);

        return { success: true, codigo: codigoFormatado };

    } catch (err) {
        console.error("Falha orquestrando abertura de Ordem:", err);
        return { success: false, message: "Erro fatal no serviço de Abertura de Ordem de Corte." };
    }
};

export const fecharOrdemCorte = async (ordemCorteId, usuario) => {
    try {
        // O repositório lida com buscar os detalhes e dar o update + sync.
        await repo.fecharOrdemCorte(ordemCorteId, usuario);
        return { success: true };
    } catch (err) {
        console.error("Falha orquestrando fechamento de Ordem:", err);
        return { success: false, message: "Erro fatal no serviço de Fechar Ordem de Corte." };
    }
};
