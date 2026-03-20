import { firestore } from "./firebase";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";

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
    const rodadaKey = estimateData.rodada ? String(estimateData.rodada).replace(/ /g, '_') : 'Rodada_1';
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
        rodada: estimateData.rodada || "Rodada 1",
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
        rodada: estimateData.rodada || "Rodada 1",
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
 * Retorna todas as estimativas. Agora tenta puxar da Base Local (offline first), e
 * em paralelo, puxa do Firebase em background para manter atualizado (se tiver net).
 */
export const getAllEstimates = async (companyId, safra, rodada = null) => {
  try {
    // 1. CARREGAMENTO LOCAL INSTANTÂNEO (Sempre vai ter alguma coisa, caso offline)
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

    // 2. TENTATIVA DE SINCRONIZAÇÃO EM BACKGROUND
    // Se estivermos online, vamos baixar do Firebase para atualizar a base local.
    // Isso é feito SEM travar o retorno pros componentes de UI. O React reage nas re-renders.
    if (navigator.onLine) {
        // Função anônima auto-executável para rodar "em background"
        (async () => {
             try {
                let constraints = [
                    where("companyId", "==", companyId),
                    where("safra", "==", safra)
                ];
                if (rodada) constraints.push(where("rodada", "==", rodada));

                const q = query(collection(firestore, COLLECTION_ESTIMATIVAS), ...constraints);
                const querySnapshot = await getDocs(q);

                const updates = [];
                querySnapshot.forEach((d) => {
                    const fbData = d.data();
                    // Atualiza o Dexie. Mas se o Dexie tiver um 'pending', a gente não esmaga ele com o do banco!
                    updates.push(async () => {
                        const existing = await db.estimativas.get(d.id);
                        if (!existing || existing.syncStatus === 'synced') {
                            await db.estimativas.put({
                                id: d.id,
                                ...fbData,
                                syncStatus: 'synced', // Veio do Firebase, tá safo.
                                updatedAt: fbData.updatedAt?.toDate()?.toISOString() || new Date().toISOString()
                            });
                        }
                    });
                });
                await Promise.all(updates.map(u => u()));
             } catch (e) { console.warn("Erro ao puxar updates em background do Firebase", e) }
        })();
    }

    // Retorna imediatamente a cópia local, não importa se terminou o refresh de background
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
export const getEstimate = async (companyId, safra, talhaoId, rodada = "Rodada 1") => {
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