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

// Executa e desocupa a fila inteira.
export const processQueue = async () => {
    // Se não houver internet base, não prosseguimos com o processamento.
    if (!navigator.onLine) {
        console.log("Offline, pulando fila...");
        return;
    }

    try {
        // Pega somente tarefas que estão 'pending' e ordene pelas mais velhas primeiro.
        const pendingTasks = await db.syncQueue
            .where('status')
            .equals('pending')
            .sortBy('createdAt');

        if (pendingTasks.length === 0) return;

        console.log(`Iniciando sincronização de ${pendingTasks.length} tarefas.`);

        for (const task of pendingTasks) {
            // Se já falhou muitas vezes, marca o status da queue como 'error'
            // Pra pessoa conseguir saber que algo travou.
            if (task.retryCount >= MAX_RETRIES) {
                await db.syncQueue.update(task.id, { status: 'error', errorMessage: 'Max retries reached' });
                continue;
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
                // Problemas de PERMISSÃO no Firebase podem requerer intervenção manual
                const errorMsg = error.message || "Erro genérico";
                await db.syncQueue.update(task.id, {
                    retryCount: task.retryCount + 1,
                    errorMessage: errorMsg
                });
            }
        }

        console.log("Processamento da fila de sincronização finalizado.");
    } catch (err) {
        console.error("Erro critico processando fila:", err);
    }
};

/**
 * Registra uma operação no banco local do Dexie para ser executada em background
 * quando a conexão voltar.
 */
export const enqueueTask = async (type, targetCollection, documentId, payload) => {
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
}