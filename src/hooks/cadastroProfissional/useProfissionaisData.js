import { useLiveQuery } from "dexie-react-hooks";
import db from "../../services/localDb";
import { enqueueTask } from "../../services/syncService";
import { showSuccess, showError } from "../../utils/alert";
import { v4 as uuidv4 } from "uuid";

/**
 * useProfissionaisData.js
 *
 * O que este bloco faz:
 * Hook central de leitura e escrita do IndexedDB para os Profissionais,
 * integrando a lógica "offline-first". O React.memo reage automaticamente as changes (useLiveQuery).
 *
 * Por que ele existe:
 * O componente de UI não deve "conhecer" o Dexie ou o Firestore diretamente,
 * ele só pede `saveProfissional(data)` e a lógica aqui decide os UUIDs, o "syncStatus" e a fila.
 */
export function useProfissionaisData(companyId) {
  // Lê todos os profissionais em cache local do Dexie dessa empresa.
  // Observando ao vivo. Se houver inserção, o componente list será re-renderizado.
  const profissionais = useLiveQuery(
    () => {
      if (!companyId) return [];
      return db.profissionais
        .where("companyId")
        .equals(companyId)
        .reverse()
        .sortBy("updatedAt");
    },
    [companyId],
    [] // Fallback vazio
  );

  /**
   * Verifica se a matrícula e/ou CPF já existem localmente.
   * Não criamos bloqueio de nuvem (Firestore rules), porque a internet pode estar offline.
   * A verificação offline é a prioridade aqui.
   */
  const checkDuplicates = async (matricula, cpf, excludeId) => {
    const list = await db.profissionais.where({ companyId }).toArray();

    // Verifica apenas registros que não sejam o próprio profissional sendo atualizado.
    const others = list.filter(p => p.id !== excludeId);

    const matriculaExists = others.some(p => p.matricula === matricula);
    const cpfExists = cpf && others.some(p => p.cpf === cpf);

    if (matriculaExists) throw new Error("A matrícula informada já está cadastrada.");
    if (cpfExists) throw new Error("O CPF informado já está cadastrado.");
  };

  /**
   * Salva ou edita um profissional, registrando localmente no Dexie e,
   * em seguida, colocando uma tarefa na Fila de Sincronização.
   *
   * @param {Object} formData - Dados do formulário para salvar.
   */
  const saveProfissional = async (formData) => {
    try {
      // 1. Verificar duplicidades
      await checkDuplicates(formData.matricula, formData.cpf, formData.id);

      // 2. Preparar payload local
      const isNew = !formData.id;
      const now = new Date().toISOString();
      const uuid = formData.uuid || uuidv4();
      const id = formData.id || uuid; // O ID do IndexedDB = UUID no caso de profissionais.

      const payload = {
        ...formData,
        id,
        uuid,
        companyId,
        syncStatus: "pending", // Sempre pendente, porque deve subir pro cloud depois
        createdAt: formData.createdAt || now,
        updatedAt: now,
      };

      // 3. Salvar no Dexie (offline)
      await db.profissionais.put(payload);

      // 4. Jogar pra SyncQueue (Envia pro Firestore no background)
      const actionType = isNew ? "create" : "update";

      // Montamos o docId pro Firestore, aqui você usará a Collection "profissionais".
      // Não temos o documento na store mapData, mas será o `uuid` na collection raiz ou subcoleção.
      const firebaseDocId = payload.uuid;

      // 4. Jogar pra SyncQueue (Envia pro Firestore no background)
      // O syncService espera 4 argumentos: type, targetCollection, documentId, payload
      // e usa 'createOrUpdate' para atualizações padronizadas.
      await enqueueTask(
        "createOrUpdate",
        "profissionais",
        firebaseDocId,
        payload
      );

      showSuccess("Salvo offline com sucesso!", "Sincronizando em background...");
      return true;
    } catch (error) {
      console.error("[useProfissionaisData] Erro ao salvar:", error);
      showError("Não foi possível salvar", error.message || "Erro desconhecido");
      return false;
    }
  };

  /**
   * Altera apenas o status de Ativo para Inativo (ou vice-versa).
   * Sem exclusão física, soft-delete.
   */
  const toggleStatus = async (profissional) => {
    try {
      const novoStatus = profissional.status === "ativo" ? "inativo" : "ativo";
      const payload = {
        ...profissional,
        status: novoStatus,
        updatedAt: new Date().toISOString(),
        syncStatus: "pending",
      };

      await db.profissionais.put(payload);

      await enqueueTask(
        "createOrUpdate",
        "profissionais",
        profissional.uuid,
        payload
      );

      return true;
    } catch (error) {
      console.error("[useProfissionaisData] Erro ao alternar status:", error);
      showError("Erro", "Não foi possível alterar o status do profissional.");
      return false;
    }
  };

  return {
    profissionais,
    saveProfissional,
    toggleStatus
  };
}
