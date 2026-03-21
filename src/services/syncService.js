import db from './localDb';
import { firestore } from "./firebase";
import { doc, setDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";

/**
 * syncService.js
 *
 * O que este bloco faz:
 * Escuta mudanças de conectividade (online/offline) e roda um laço
 * verificando `db.syncQueue`. Ele tenta empurrar todas as requisições
 * pendentes para o Firebase. Em caso de sucesso, marca "synced" no registro.
 * Em caso de falha de internet/permissão, ele aumenta "retryCount".
 *
 * Por que ele existe:
 * Para o aplicativo não falhar durante salvamento de formulários caso o usuário caia do 4G.
 * Essa é a camada mágica que resolve tudo por trás.
 */

// Aumenta o tempo do retry
const MAX_RETRIES = 5;

// Variável de controle para evitar múltiplas instâncias de sync rodando ao mesmo tempo.
let isSyncing = false;

// Executa e desocupa a fila inteira.
export const processQueue = async () => {
    // Se não houver internet base ou já estiver rodando, abortamos para não duplicar requisições.
    if (!navigator.onLine || isSyncing) {
        if (!navigator.onLine) console.log("Offline, pulando fila...");
        return;
    }

    isSyncing = true;
    try {
        // Pega somente tarefas que estão 'pending' e ordene pelas mais velhas primeiro.
        const pendingTasks = await db.syncQueue
            .where('status')
            .equals('pending')
            .sortBy('createdAt');

        if (pendingTasks.length === 0) return;

        console.log(`Iniciando sincronização de ${pendingTasks.length} tarefas.`);

        // Se a fila for muito grande, o Promise.all executa todos os pushes do Firebase
        // em paralelo, o que é absurdamente mais rápido do que fazer um loop "for...await" sequencial,
        // destravando o sync instantaneamente.
        await Promise.all(pendingTasks.map(async (task) => {
            // Se já falhou muitas vezes, marca o status da queue como 'error'
            if (task.retryCount >= MAX_RETRIES) {
                await db.syncQueue.update(task.id, { status: 'error', errorMessage: 'Max retries reached' });
                return;
            }

            try {
                // De acordo com a ação mapeada, executa algo contra o Firebase
                if (task.type === 'createOrUpdate') {
                    const docRef = doc(firestore, task.targetCollection, task.documentId);
                    // Retira os campos de controle locais pro firebase nao poluir
                    const { syncStatus, ...firebasePayload } = task.payload;

                    // Salva na coleção final
                    await setDoc(docRef, { ...firebasePayload, updatedAt: serverTimestamp() }, { merge: true });

                    // Tenta atualizar o status no Dexie pra saber que já sincronizou
                    if (task.targetCollection === "estimativas_safra") {
                         await db.estimativas.update(task.documentId, { syncStatus: "synced" });
                    }
                } else if (task.type === 'addHistory') {
                    const { localId, ...firebasePayload } = task.payload;
                    await addDoc(collection(firestore, task.targetCollection), {
                        ...firebasePayload,
                        createdAt: serverTimestamp()
                    });
                }

                // Tarefa foi processada com sucesso no Firebase: deleta ela da fila!
                await db.syncQueue.delete(task.id);

            } catch (error) {
                console.error("Erro durante push da task", task.id, error);

                // Se foi um problema de conexão, marcamos que tentou mais uma vez
                const errorMsg = error.message || "Erro genérico";
                await db.syncQueue.update(task.id, {
                    retryCount: task.retryCount + 1,
                    errorMessage: errorMsg
                });
            }
        }));

        console.log("Processamento da fila de sincronização finalizado.");

        // Emite um evento customizado para o navegador informando que o sync rodou com sucesso.
        // A UI vai escutar esse evento para atualizar os dados visuais automaticamente (mapa, tabelas, histórico).
        window.dispatchEvent(new CustomEvent('sync-completed', { detail: { count: pendingTasks.length } }));
    } catch (err) {
        console.error("Erro critico processando fila:", err);
    } finally {
        isSyncing = false;
    }
};

/**
 * Registra uma operação no banco local do Dexie para ser executada em background
 * quando a conexão voltar.
 */
export const enqueueTask = async (type, targetCollection, documentId, payload) => {
    // Se for um update em um mesmo documento, removemos a tarefa antiga pendente
    // para não encher a fila com atualizações obsoletas e sobrepor dados.
    if (type === 'createOrUpdate' && documentId) {
        const existingTasks = await db.syncQueue
            .where('[type+documentId]') // Necessita de index
            .equals([type, documentId])
            .toArray();

        for (const t of existingTasks) {
            if (t.status === 'pending') {
                await db.syncQueue.delete(t.id);
            }
        }
    }

    await db.syncQueue.add({
        type, // ex: 'createOrUpdate' ou 'addHistory'
        targetCollection, // ex: 'estimativas_safra'
        documentId, // String da primary key ou null se for add()
        payload, // O próprio JSON do form
        status: 'pending',
        retryCount: 0,
        createdAt: new Date().toISOString()
    });

    // Se a gente tá online nesse exato segundo que enfileirou, já tenta despachar.
    // Isso é bom pois a fila acaba não crescendo.
    if (navigator.onLine) {
        processQueue();
    }
};

// Listeners Globais: Quando a rede voltar (evento do navegador), a gente reprocessa automaticamente!
if (typeof window !== "undefined") {
    window.addEventListener('online', () => {
        console.log("Internet restaurada! Reprocessando pendências.");
        processQueue();
    });

    // Tentativa inicial no momento do carregamento do app (startup), caso tenha sido
    // fechado enquanto offline e reaberto enquanto online.
    setTimeout(() => {
        if (navigator.onLine) {
            processQueue();
        }
    }, 2000); // pequeno delay pra garantir que auth do firebase resolveu
}