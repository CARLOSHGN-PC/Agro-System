/**
 * ordemCorteSelectors.js
 *
 * O que este bloco faz:
 * Funciona como um filtro inteligente que lê os Arrays "Brutos" do Dexie e
 * entrega apenas o essencial para quem chamou. Ex: Puxar o Status que um talhão está
 * com base na lista geral da Safra.
 *
 * Por que ele existe:
 * Centralizar as perguntas ("Esse id X está fechado?", "Esse Y está ABERTO?")
 * Evita lambança em map() ou filter() direto nos components React e nos hooks de render do mapa.
 */

import { ORDEM_CORTE_STATUS } from '../../../services/ordemCorte/ordemCorteConstants';

/**
 * Procura um Vínculo Ativo (ABERTO) ou Recente para um talhão específico na coleção de Safra.
 * Se achar mais de um, por padrão retorna a ABERTA (O que não deveria ocorrer, graças às rules),
 * ou a FECHADA mais recente se ele não tem aberta.
 *
 * @param {string} talhaoId
 * @param {Array<Object>} todosVinculosSafra
 */
export const selecionarVinculoDoTalhao = (talhaoId, todosVinculosSafra) => {
    if (!todosVinculosSafra || !todosVinculosSafra.length) return null;

    // Todos os vínculos da safra onde a "propriedade talhaoId" bate com o nosso "id atual".
    const vinculosFiltrados = todosVinculosSafra.filter(v => v.talhaoId === talhaoId);

    // Se só houver um, ótimo. Se houver FECHADOS (ex: rodadas antigas e ele tentar re-estimar),
    // ou ABERTOS atuais, precisamos retornar a ABERTA, ou a última FECHADA se não houver ABERTAS.
    const aberto = vinculosFiltrados.find(v => v.status === ORDEM_CORTE_STATUS.ABERTA);
    if (aberto) return aberto;

    // Se não há ABERTO, ordenamos os FECHADOS pelos mais recentes para mostrar a última.
    if (vinculosFiltrados.length > 0) {
         vinculosFiltrados.sort((a, b) => new Date(b.closedAt) - new Date(a.closedAt));
         return vinculosFiltrados[0];
    }

    return null;
};

/**
 * Constrói um array com todos os IDs únicos de Talhões que pertencem a uma Ordem FECHADA,
 * e que devem, portanto, sumir do mapa daquela Safra, garantindo que não se sobrescrevam
 * se tiverem sido abertos depois (novas áreas).
 */
export const selecionarIdsOcultosDaSafra = (todosVinculosSafra) => {
    if (!todosVinculosSafra || !todosVinculosSafra.length) return [];

    // Pegamos todos os talhões que estão com status FECHADA
    const idsFechados = todosVinculosSafra
        .filter(v => v.status === ORDEM_CORTE_STATUS.FECHADA)
        .map(v => v.talhaoId);

    // Retiramos da lista "suja" de fechados, os caras que têm um status ABERTO concorrente
    // (Por exemplo: o usuário abriu uma nova, as regras permitiram, então não deve ocultar).
    // Nota: Nossas regras bloqueiam Reabrir no fluxo normal, mas como precaução, garantimos
    // que "Oculto" é o que não tem ABERTA no sistema!
    const idsAbertos = new Set(todosVinculosSafra
        .filter(v => v.status === ORDEM_CORTE_STATUS.ABERTA)
        .map(v => v.talhaoId));

    // Apenas quem é FECHADO e não ABERTO entra para ocultação.
    const exclusivosFechados = idsFechados.filter(id => !idsAbertos.has(id));

    // Retorna a lista unificada sem repetição, ideal para o hook do Mapbox.
    return [...new Set(exclusivosFechados)];
};

/**
 * Constrói a lista de Talhões que devem ser pitados de azul forte,
 * ignorando legendas e cores normais, pois estão designados a "Cortar".
 */
export const selecionarIdsAbertosDaSafra = (todosVinculosSafra) => {
     if (!todosVinculosSafra || !todosVinculosSafra.length) return [];

     const idsAbertos = todosVinculosSafra
         .filter(v => v.status === ORDEM_CORTE_STATUS.ABERTA)
         .map(v => v.talhaoId);

     return [...new Set(idsAbertos)];
};
