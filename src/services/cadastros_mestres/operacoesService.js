import { v4 as uuidv4 } from 'uuid';
import db from '../localDb.js';
import { enqueueTask } from '../syncService.js';
import { logAuditoria } from '../logService.js';

const COLLECTION_NAME = 'operacoes_geral';

/**
 * Retorna as Operações Gerais da empresa do banco local, desconsiderando as inativas.
 *
 * @param {string} companyId - ID da empresa.
 * @returns {Promise<Array>} - Lista de Operações filtrada e ordenada.
 */
export const getOperacoes = async (companyId) => {
  const all = await db[COLLECTION_NAME].where('companyId').equals(companyId).toArray();
  // Filter inactive and sort natively (numeric or string via localeCompare)
  return all
    .filter((o) => o.status !== 'inativo')
    .sort((a, b) => {
      // Prioritize sort by CD_OPERACAO ascending if both have it
      const codA = a.cdOperacao || '';
      const codB = b.cdOperacao || '';
      return String(codA).localeCompare(String(codB), undefined, { numeric: true });
    });
};

/**
 * Cria ou atualiza uma Operação de forma individual, gerando UUID e enfileirando para o Firebase.
 *
 * @param {Object} operacao - Dados da operação (formulário manual).
 * @param {string} companyId - ID da empresa do usuário atual.
 * @param {string} userId - ID do usuário para fins de auditoria.
 */
export const saveOperacao = async (operacao, companyId, userId) => {
  const isNew = !operacao.id;
  const id = isNew ? uuidv4() : operacao.id;

  const payload = {
    ...operacao,
    id,
    companyId,
    status: operacao.status || 'ativo',
    updatedAt: new Date().toISOString(),
    syncStatus: 'pending',
  };

  // Garante salvar no Dexie localmente (offline-first)
  await db[COLLECTION_NAME].put(payload);

  // Envia a task para o background uploader
  await enqueueTask('createOrUpdate', COLLECTION_NAME, id, payload);

  // Auditoria
  await logAuditoria(
    COLLECTION_NAME,
    id,
    isNew ? 'Criou nova Operação manual' : 'Editou Operação manual',
    {},
    userId,
    companyId
  );

  return payload;
};

/**
 * Inativa (soft-delete) uma Operação do banco local e enfileira a inativação no Firebase.
 *
 * @param {string} operacaoId - ID do registro no localDb.
 * @param {string} companyId - ID da empresa.
 * @param {string} userId - ID do usuário.
 */
export const inactivateOperacao = async (operacaoId, companyId, userId) => {
  const operacao = await db[COLLECTION_NAME].get(operacaoId);
  if (!operacao) throw new Error('Operação não encontrada no banco local.');

  const payload = {
    ...operacao,
    status: 'inativo',
    updatedAt: new Date().toISOString(),
    syncStatus: 'pending',
  };

  await db[COLLECTION_NAME].put(payload);
  await enqueueTask('createOrUpdate', COLLECTION_NAME, operacaoId, payload);

  await logAuditoria(
    COLLECTION_NAME,
    operacaoId,
    'Inativou (soft-delete) Operação',
    {},
    userId,
    companyId
  );
};

/**
 * Recebe as linhas parseadas do Excel, processa as Operações e enfileira cada uma como "pending" para upload no Firebase.
 * Também bloqueia a atualização UI (usando batch via bulkPut).
 *
 * @param {Array} rows - Linhas do Excel mapeadas.
 * @param {string} companyId - ID da empresa no Firebase.
 * @param {string} userId - ID de quem está enviando o batch.
 */
export const saveOperacoesEmMassa = async (rows, companyId, userId) => {
  const now = new Date().toISOString();

  // Mapeia todas as linhas vindas do import XLSX para o formato payload
  const payloads = rows.map((row) => ({
    id: uuidv4(),
    companyId,
    codCcustoRateio: String(row.COD_CCUSTO_RATEIO || ''),
    cdCcusto: String(row.CD_CCUSTO || ''),
    deCcusto: String(row.DE_CCUSTO || ''),
    cdOperacao: String(row.CD_OPERACAO || ''),
    deOperacao: String(row.DE_OPERACAO || ''),
    unidade: String(row.UNIDADE || ''),
    tipoOperacao: String(row.TIPO_OPERACAO || ''),
    classe: String(row.CLASSE || ''),
    status: 'ativo',
    updatedAt: now,
    syncStatus: 'pending',
  }));

  // Uso de Bulk operations (Ponto Chave das premissas: para evitar overhead local e freeze na UI)
  await db[COLLECTION_NAME].bulkPut(payloads);

  // Para o SyncQueue, enfileira tudo em batch com os dados atualizados localmente.
  // Criamos as tarefas 'createOrUpdate' para disparar pro Firebase.
  const syncTasks = payloads.map((p) => ({
    id: uuidv4(),
    type: 'createOrUpdate',
    targetCollection: COLLECTION_NAME,
    documentId: p.id,
    payload: p,
    status: 'pending',
    retryCount: 0,
    createdAt: Date.now(),
  }));

  // Adiciona as tarefas direto na fila de sincronização background
  await db.syncQueue.bulkAdd(syncTasks);

  // Apenas um log mestre indicando a operação de massa.
  await logAuditoria(
    COLLECTION_NAME,
    'LOTE_MASSIVO',
    `Importou lote de ${payloads.length} Operações`,
    {},
    userId,
    companyId
  );

  return payloads.length;
};
