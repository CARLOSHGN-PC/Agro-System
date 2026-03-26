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
    AGUARDANDO: 'AGUARDANDO',
    ABERTA: 'ABERTA',
    FINALIZADA: 'FINALIZADA'
};

export const ORDEM_CORTE_COLECOES = {
    MESTRE: 'ordens_corte',
    VINCULO: 'ordens_corte_talhoes'
};

export const ORDEM_CORTE_CORES = {
    // O que este bloco faz: Define cores de destaque para diferenciar o status da Ordem de Corte no mapa.
    // Por que ele existe: A pedido do usuário, precisamos identificar visualmente se a ordem
    // apenas foi iniciada (Vermelho/Aguardando número) ou se já foi liberada com número da ordem (Amarelo).
    VERMELHO_AGUARDANDO: '#ef4444', // Vermelho para "Aguardando número da Ordem de Serviço"
    AMARELO_ABERTA: '#eab308',      // Amarelo para "Autorizado/Liberado"
};
