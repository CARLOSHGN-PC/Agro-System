import Dexie from 'dexie';

/**
 * localDb.js
 *
 * O que este bloco faz:
 * É o banco de dados principal da aplicação (IndexedDB) gerenciado pelo Dexie.
 * Define as tabelas/stores e seus índices primários que serão consultados sem internet.
 *
 * Por que ele existe:
 * Para funcionar offline-first, não podemos ler as informações do Firestore.
 * O app precisará gravar aqui (muito rápido) e ler daqui também.
 * As mudanças daqui alimentarão o `syncService` que joga no Firebase em background.
 */

export const db = new Dexie('AgroSystemLocalDB');

// Definição do schema e versão atual. Se você alterar isso, mude a versão.
// Cada store recebe como string suas chaves, `&` significa chave única.
db.version(5).stores({
  // Tabela para guardar os arquivos pesados de Mapas (GeoJSON) que não podem baixar toda hora.
  // 'id' será no formato "empresaId_safra" pra puxar rápido.
  mapData: '&id, companyId, updatedAt',

  // Tabela do Módulo Cadastro Profissional
  // uuid é o ID real no Firestore. matricula e cpf também são importantes para busca
  profissionais: '&id, uuid, companyId, nomeCompleto, cpf, matricula, status, funcao, equipe, unidade, syncStatus, createdAt, updatedAt, [companyId+status], [companyId+funcao]',

  // Tabela com as estimativas salvas (id é a junção empresaId_safra_rodada_talhaoId igual no Firebase).
  // Adicionamos índices compostos para permitir as queries rápidas offline.
  estimativas: '&id, companyId, safra, talhaoId, rodada, syncStatus, updatedAt, [companyId+safra], [companyId+safra+rodada]',

  // Histórico de versões do Talhão. Serve pro painel de "Histórico"
  historico: '++localId, estimateDocId, companyId, safra, talhaoId, rodada, version, [companyId+safra+talhaoId], [companyId+safra+talhaoId+rodada]',

  // Fila de sincronização. Tudo que falhar em ir pro Firebase fica aqui aguardando.
  // Pode conter ações de criação ('create'), update ou delete.
  syncQueue: '++id, type, targetCollection, documentId, payload, status, retryCount, createdAt, [type+documentId]',

  // Tabela de Notificações. Guarda o histórico de alertas do sistema (sucesso, erro, avisos).
  // Serve para a central de notificações persistente do TopNavbar.
  notifications: '++id, title, type, isRead, createdAt',

  // Tabela mestre para as Ordens de Corte (O cabeçalho da ordem).
  // Permite consultar rápido todas as ordens de uma safra.
  ordensCorte: '&id, companyId, safra, status, syncStatus, [companyId+safra], [companyId+safra+status]',

  // Tabela pivô/vínculo entre Ordem de Corte e Talhão.
  // Permite consultar rápido em qual ordem um talhão está vinculado.
  ordensCorteTalhoes: '&id, companyId, safra, talhaoId, ordemCorteId, status, syncStatus, [companyId+safra], [companyId+safra+talhaoId], [companyId+safra+talhaoId+status]'
});

// Aumentamos a versão do Dexie para acomodar o Módulo Premissas e Cadastros Mestres.
// É crítico não quebrar os dados antigos, então fazemos apenas um upgrade incremental.
db.version(7).stores({
  // === Cadastro Geral: Propriedades Agrícolas (Fazendas e Talhões baseados em planilha) ===
  fazendas: '&id, companyId, codFaz, desFazenda, syncStatus, [companyId+codFaz]',

  // Guardamos todos os 45 campos aqui no Talhão
  talhoes: '&id, fazendaId, companyId, talhao, syncStatus, [companyId+fazendaId], [companyId+fazendaId+talhao]',

  // === Módulo Premissas / Tratos Culturais ===
  // Estrutura Base
  modulos: '&id, nome, status',

  // Protocolos (Receitas Mestres) de um Módulo
  protocolos: '&id, moduloId, nome, status, companyId, syncStatus, [companyId+moduloId]',

  // Operações que compõem o Protocolo (agora nascem dentro da Receita)
  protocoloOperacoes: '&id, protocoloId, nome, status, ordem, syncStatus, [protocoloId+ordem]',

  // Itens (Produtos) que compõem o Protocolo. Representa a Subcoleção no Firestore.
  protocoloItens: '&id, protocoloId, produtoId, status, ordem, syncStatus, [protocoloId+ordem]',

  // === Cadastros Mestres ===
  produtos: '&id, codigo, nome, categoriaId, unidadePadraoId, status, companyId, syncStatus, [companyId+categoriaId]',
  categoriasProduto: '&id, nome, sigla, status, companyId, syncStatus',
  unidadesMedida: '&id, nome, sigla, status, companyId, syncStatus',

  // === Log Centralizado / Auditoria ===
  auditoriaLogs: '&id, entidade, entidadeId, acao, usuarioId, timestamp, companyId, syncStatus, [companyId+entidade]'
});

// Aumentamos a versão do Dexie para acomodar o Cadastro de Variedades.
db.version(8).stores({
  // === Cadastros Mestres: Variedades ===
  // Armazena as variedades da cana de açúcar importadas via planilha.
  variedades: '&id, codigo, variedade, tipoMaturacao, inicioJanela, fimJanela, status, companyId, syncStatus, [companyId+variedade]'
});

// Aumentamos a versão do Dexie para acomodar o Cadastro de Operações.
db.version(9).stores({
  // === Cadastros Mestres: Operações ===
  // Armazena as operações importadas via planilha.
  operacoes: '&id, codCcustoRateio, cdCcusto, deCcusto, cdOperacao, deOperacao, unidade, tipoOperacao, classe, status, companyId, syncStatus, [companyId+cdOperacao]'
});

// Aumentamos a versão do Dexie para acomodar o Cadastro de Insumos.
db.version(10).stores({
  // === Cadastros Mestres: Insumos ===
  // Armazena os insumos importados via planilha.
  insumos: '&id, codInsumoRateio, codInsumo, descInsumo, descGrupo, descSubgrupo, und, vlrUnit, dtVlrUnit, nomeComercial, doseMedia, doseMinima, doseMaxima, status, companyId, syncStatus, [companyId+codInsumo]'
});

// Aumentamos a versão do Dexie para acomodar a Produção Agrícola.
db.version(11).stores({
  // === Cadastros Mestres: Produção Agrícola ===
  // Armazena os dados de produção importados via planilha.
  producaoAgricola: '&id, codFaz, desFazenda, talhao, areaHa, corte, dtUltCorte, tchEst, tonEst, tchFechado, tonFechada, atrReal, status, companyId, syncStatus, [companyId+codFaz], [companyId+codFaz+talhao]'
});

export default db;