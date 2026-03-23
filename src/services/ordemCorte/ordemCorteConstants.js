/**
 * ordemCorteConstants.js
 *
 * O que este bloco faz:
 * Armazena todos os valores fixos e strings estáticas (Magic Strings) relacionadas
 * ao fluxo de Ordens de Corte.
 *
 * Por que ele existe:
 * Centralizar nomes de status, cores e coleções evita erros de digitação e
 * facilita caso um dia queiramos mudar a cor ou a coleção no Firebase.
 */

export const ORDEM_CORTE_STATUS = {
    ABERTA: 'ABERTA',
    FECHADA: 'FECHADA'
};

export const ORDEM_CORTE_COLECOES = {
    MESTRE: 'ordens_corte',
    VINCULO: 'ordens_corte_talhoes'
};

export const ORDEM_CORTE_CORES = {
    // O que este bloco faz: Define uma cor ciano/neon muito forte e opaca para talhões em ordem aberta.
    // Por que ele existe: O usuário relatou que o mapa de satélite já possui tons azuis normais.
    // Uma cor extremamente brilhante (#00e1ff) destaca os polígonos da Ordem de Corte imediatamente.
    AZUL_ABERTA: '#00e1ff', // Ciano vibrante
};
