/**
 * ordemCorteRules.test.js
 *
 * O que este bloco faz:
 * Testes unitários para as regras de negócio de Ordens de Corte.
 *
 * Por que ele existe:
 * Garante que a lógica de validação de abertura de ordens (não permitir duplicidade de talhões abertos)
 * funcione conforme o esperado e não sofra regressões.
 */

import test from 'node:test';
import assert from 'node:assert';
import { validatePodeAbrirOrdem } from './ordemCorteRules.js';
import { ORDEM_CORTE_STATUS } from './ordemCorteConstants.js';

test('validatePodeAbrirOrdem', async (t) => {
    // Caso de Sucesso: Nenhum talhão desejado está em ordens abertas
    await t.test('deve retornar canOpen true quando não houver vínculos abertos para os talhões desejados', () => {
        const talhoesDesejados = ['TALHAO_01', 'TALHAO_02'];
        const todosVinculosSafra = [
            { talhaoId: 'TALHAO_03', status: ORDEM_CORTE_STATUS.ABERTA },
            { talhaoId: 'TALHAO_01', status: ORDEM_CORTE_STATUS.FECHADA }
        ];

        const result = validatePodeAbrirOrdem(talhoesDesejados, todosVinculosSafra);
        assert.deepStrictEqual(result, { canOpen: true, conflictId: null });
    });

    // Caso de Falha: Pelo menos um talhão já possui uma ordem aberta
    await t.test('deve retornar canOpen false e o conflictId quando um talhão já estiver em uma ordem ABERTA', () => {
        const talhoesDesejados = ['TALHAO_01', 'TALHAO_02'];
        const todosVinculosSafra = [
            { talhaoId: 'TALHAO_01', status: ORDEM_CORTE_STATUS.ABERTA },
            { talhaoId: 'TALHAO_03', status: ORDEM_CORTE_STATUS.ABERTA }
        ];

        const result = validatePodeAbrirOrdem(talhoesDesejados, todosVinculosSafra);
        assert.deepStrictEqual(result, { canOpen: false, conflictId: 'TALHAO_01' });
    });

    // Caso: Talhões em ordens fechadas não devem bloquear nova abertura
    await t.test('deve retornar canOpen true quando os talhões desejados estiverem apenas em ordens FECHADAS', () => {
        const talhoesDesejados = ['TALHAO_01'];
        const todosVinculosSafra = [
            { talhaoId: 'TALHAO_01', status: ORDEM_CORTE_STATUS.FECHADA }
        ];

        const result = validatePodeAbrirOrdem(talhoesDesejados, todosVinculosSafra);
        assert.deepStrictEqual(result, { canOpen: true, conflictId: null });
    });

    // Caso: Lista de vínculos vazia
    await t.test('deve retornar canOpen true quando não houver nenhum vínculo na safra', () => {
        const talhoesDesejados = ['TALHAO_01', 'TALHAO_02'];
        const todosVinculosSafra = [];

        const result = validatePodeAbrirOrdem(talhoesDesejados, todosVinculosSafra);
        assert.deepStrictEqual(result, { canOpen: true, conflictId: null });
    });

    // Caso: Lista de desejados vazia
    await t.test('deve retornar canOpen true quando a lista de talhões desejados estiver vazia', () => {
        const talhoesDesejados = [];
        const todosVinculosSafra = [
            { talhaoId: 'TALHAO_01', status: ORDEM_CORTE_STATUS.ABERTA }
        ];

        const result = validatePodeAbrirOrdem(talhoesDesejados, todosVinculosSafra);
        assert.deepStrictEqual(result, { canOpen: true, conflictId: null });
    });
});
