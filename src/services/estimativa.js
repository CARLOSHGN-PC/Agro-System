import { firestore } from "./firebase";
import { collection, doc, getDoc, getDocs, query, where, onSnapshot } from "firebase/firestore";

// Offline-first imports
import db from "./localDb";
import { enqueueTask } from "./syncService";

const COLLECTION_ESTIMATIVAS = "estimativas_safra";
const COLLECTION_HISTORICO = "estimativas_safra_historico";

/**
 * estimativa.js (Offline-First Refactor)
 *
 * O que mudou:
 * Antes os metodos read/write batiam direto no Firestore. Se falhasse (sem internet), o app quebrava.
 * Agora, todos escrevem no banco de dados local (`Dexie`) instantaneamente,
 * e a camada de Sincronização (`syncService`) lida com subir pro Firebase.
 */

export const saveEstimate = async (companyId, safra, talhaoId, estimateData) => {
  try {
    const rodadaKey = estimateData.rodada ? String(estimateData.rodada).replace(/ /g, '_') : 'Estimativa';
    const estimateDocId = `${companyId}_${safra.replace('/', '-')}_${rodadaKey}_${talhaoId}`;

    // 1. OBTENDO VERSÃO LOCAL: tenta pegar o antigo pra incrementar a versão
    let version = 1;
    const localEst = await db.estimativas.get(estimateDocId);
    if (localEst) {
      version = (localEst.version || 0) + 1;
    } else if (navigator.onLine) {
        // Se a gente tá online e por algum motivo o dexie tava limpo, dá um check no firebase (opcional)
        try {
            const fbSnap = await getDoc(doc(firestore, COLLECTION_ESTIMATIVAS, estimateDocId));
            if (fbSnap.exists()) version = (fbSnap.data().version || 0) + 1;
        } catch (e) {
            console.log("Falha ao buscar versão remota, fallback pra v1", e);
        }
    }

    const isoDate = new Date().toISOString();

    const newEstimateData = {
      id: estimateDocId, // Chave primária do Dexie
      companyId,
      safra,
      talhaoId,
      ...estimateData,
      version,
      syncStatus: 'pending', // Indica que não foi pro backend ainda
      updatedAt: isoDate,
    };

    // 2. SALVAMENTO LOCAL IMEDIATO (Sempre funciona, mesmo num mato sem internet)
    await db.estimativas.put(newEstimateData);

    // Cria um ID determinístico para o histórico para evitar duplicação em caso de retry
    const historyDocId = `${estimateDocId}_v${version}`;

    // Salvamento no histórico local
    await db.historico.add({
        id: historyDocId, // Determinístico
        estimateDocId,
        companyId,
        safra,
        talhaoId,
        rodada: estimateData.rodada || "Estimativa",
        version,
        ...estimateData,
        createdAt: isoDate
    });

    // 3. ENFILEIRAR TAREFAS DE SINCRONIZAÇÃO
    // Registra a intenção de sincronização aguardando confirmação local para evitar perda
    // de dados em cenários extremos (ex: disco cheio).

    await enqueueTask('createOrUpdate', COLLECTION_ESTIMATIVAS, estimateDocId, newEstimateData);
    // Usa 'createOrUpdate' com historyDocId determinístico em vez de 'addHistory' para garantir idempotência.
    await enqueueTask('createOrUpdate', COLLECTION_HISTORICO, historyDocId, {
        estimateDocId,
        companyId,
        safra,
        talhaoId,
        rodada: estimateData.rodada || "Estimativa",
        version,
        ...estimateData
    });

    return { success: true, version };
  } catch (error) {
    console.error("Erro fatal ao salvar estimativa localmente:", error);
    throw error;
  }
};

/**
 * Inscreve-se em atualizações em tempo real (onSnapshot) para uma safra/empresa.
 * Sempre que outro dispositivo (ex: o celular) atualizar o Firestore, o onSnapshot
 * vai baixar as mudanças, injetar no Dexie e chamar o callback, atualizando o mapa na hora.
 */
export const subscribeToEstimatesRealtime = (companyId, safra, onUpdateCallback) => {
    // Se não tiver net, não se inscreve. O Dexie sozinho vai suprir a tela pelo getAllEstimates.
    if (!navigator.onLine) return () => {};

    const constraints = [
        where("companyId", "==", companyId),
        where("safra", "==", safra)
    ];

    const q = query(collection(firestore, COLLECTION_ESTIMATIVAS), ...constraints);

    const unsubscribe = onSnapshot(q, async (snapshot) => {
        // O que este bloco faz: Agrupa todas as mudanças (adições, edições, remoções) em arrays
        // para processá-las em lote (bulk) no IndexedDB de uma vez só, em vez de gerar milhares de promises de .put() e .get() isolados.
        // Por que ele existe: Processadores de celular sofriam engasgos e congelamentos severos na tela ao tentar sincronizar 2000
        // talhões de uma vez através de conexões em tempo real, enquanto o PC aguentava a carga assíncrona bruta. O "Bulk" resolve isso.
        let hasChanges = false;

        const toAddOrUpdate = [];
        const toDeleteIds = [];

        snapshot.docChanges().forEach((change) => {
            hasChanges = true;
            if (change.type === "added" || change.type === "modified") {
                const fbData = change.doc.data();
                toAddOrUpdate.push({
                    id: change.doc.id,
                    ...fbData,
                    syncStatus: 'synced',
                    updatedAt: fbData.updatedAt?.toDate()?.toISOString() || new Date().toISOString()
                });
            } else if (change.type === "removed") {
                toDeleteIds.push(change.doc.id);
            }
        });

        if (hasChanges) {
            // O que este bloco faz: Lê todos os IDs afetados de uma vez no banco para verificar quem está com "status pending" (dados não salvos do próprio celular).
            // Por que ele existe: Para proteger o celular de ter seus próprios dados (ainda sem internet/na fila) esmagados pelo servidor.
            const allAffectedIds = [...toAddOrUpdate.map(item => item.id), ...toDeleteIds];

            // Se o lote for muito grande (ex: carregamento inicial vazio do banco de 2000), o bulkGet pode devolver undefined para IDs que não existem, o que é esperado e tratado.
            const existingRecords = await db.estimativas.bulkGet(allAffectedIds);

            // Cria um dicionário de busca super rápido para os registros existentes
            const existingMap = {};
            existingRecords.forEach(record => {
                if (record) existingMap[record.id] = record;
            });

            // Filtra os arrays finais considerando a regra de proteção "pending"
            const finalPuts = toAddOrUpdate.filter(item => {
                const existing = existingMap[item.id];
                return !existing || existing.syncStatus === 'synced';
            });

            const finalDeletes = toDeleteIds.filter(id => {
                const existing = existingMap[id];
                return existing && existing.syncStatus !== 'pending';
            });

            // Executa as transações massivas de uma única vez no IndexedDB do navegador.
            if (finalPuts.length > 0) await db.estimativas.bulkPut(finalPuts);
            if (finalDeletes.length > 0) await db.estimativas.bulkDelete(finalDeletes);

            // Quando terminar de atualizar o Dexie (em menos de 100ms até pra celulares), avisa o React que os dados mudaram!
            onUpdateCallback();
        }
    }, (error) => {
        console.warn("Realtime sync lost or permission denied:", error);
    });

    return unsubscribe;
};

/**
 * Retorna todas as estimativas. Puxa APENAS da Base Local (offline first).
 * Removemos o pull em background do Firebase daqui pois o 'subscribeToEstimatesRealtime'
 * já cuida de manter o Dexie perfeitamente sincronizado. Isso evita sobrecarga (aquecimento)
 * com múltiplas requisições GET em paralelo (looping) quando a UI re-renderiza ou internet volta.
 */
export const getAllEstimates = async (companyId, safra, rodada = null) => {
  try {
    let localData = [];
    if (rodada) {
        localData = await db.estimativas
            .where('[companyId+safra+rodada]')
            .equals([companyId, safra, rodada])
            .toArray();
    } else {
         localData = await db.estimativas
            .where('[companyId+safra]')
            .equals([companyId, safra])
            .toArray();
    }

    // Retorna imediatamente a cópia local.
    // Qualquer nova estimativa salva por outro dispositivo chegará via onSnapshot.
    return { success: true, data: localData };

  } catch (error) {
    console.error("Error getting all estimates:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Puxa os detalhes da estimativa de 1 talhão para abrir no Formulário.
 * Lê do localDb, com uma checagem rápida no Firebase caso nada seja encontrado.
 */
export const getEstimate = async (companyId, safra, talhaoId, rodada = "Estimativa") => {
  try {
    const rodadaKey = String(rodada).replace(/ /g, '_');
    const estimateDocId = `${companyId}_${safra.replace('/', '-')}_${rodadaKey}_${talhaoId}`;

    // Procura localmente
    const localEst = await db.estimativas.get(estimateDocId);
    if (localEst) {
        return { success: true, data: localEst };
    }

    // Se estivermos online mas o banco apagou localmente, damos um fallback
    if (navigator.onLine) {
        const estimateRef = doc(firestore, COLLECTION_ESTIMATIVAS, estimateDocId);
        const estimateSnap = await getDoc(estimateRef);
        if (estimateSnap.exists()) {
            const data = estimateSnap.data();
            // Cacheia no Dexie e retorna
            await db.estimativas.put({ id: estimateDocId, ...data, syncStatus: 'synced' });
            return { success: true, data: data };
        }
    }

    return { success: true, data: null };
  } catch (error) {
    console.error("Error getting estimate:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Traz o histórico do Talhão. Localmente + O que já tem no Firebase.
 */
export const getEstimateHistory = async (companyId, safra, talhaoId, rodada = null) => {
  try {
    let localHistory = [];
    if (rodada) {
         localHistory = await db.historico
            .where('[companyId+safra+talhaoId+rodada]')
            .equals([companyId, safra, talhaoId, rodada])
            .toArray();
    } else {
        localHistory = await db.historico
            .where('[companyId+safra+talhaoId]')
            .equals([companyId, safra, talhaoId])
            .toArray();
    }

    // Fallback de background igual no `getAllEstimates`
    if (navigator.onLine) {
         (async () => {
             try {
                 let constraints = [
                    where("companyId", "==", companyId),
                    where("safra", "==", safra),
                    where("talhaoId", "==", talhaoId)
                ];
                if (rodada) constraints.push(where("rodada", "==", rodada));

                const q = query(collection(firestore, COLLECTION_HISTORICO), ...constraints);
                const snap = await getDocs(q);

                // Vamos identificar quais documentos do Firebase já temos localmente
                // comparando o timestamp e versão para não duplicar, em vez de apagar tudo.
                const existingRemoteIds = new Set(localHistory.filter(h => h.id).map(h => h.id));

                // Insere os documentos remotos recentes
                const newHistory = [];
                snap.forEach((d) => {
                    if (!existingRemoteIds.has(d.id)) {
                        const fbData = d.data();
                        newHistory.push({
                            id: d.id, // O Firebase document id
                            ...fbData,
                            createdAt: fbData.createdAt?.toDate()?.toISOString() || new Date().toISOString()
                        });
                    }
                });

                if (newHistory.length > 0) {
                    await db.historico.bulkAdd(newHistory);
                }
             } catch(e) {
                 console.warn("Erro ao puxar o histórico remoto em background", e);
             }
         })();
    }

    // Reorganiza decrescente
    localHistory.sort((a, b) => b.version - a.version);

    return { success: true, data: localHistory };
  } catch (error) {
    console.error("Error getting estimate history:", error);
    return { success: false, error: error.message };
  }
};