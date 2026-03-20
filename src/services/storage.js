import { ref, uploadBytes, getDownloadURL, uploadString, listAll } from "firebase/storage";
import { storage } from "./firebase";
import db from "./localDb";

/**
 * storage.js (Offline-First Refactor)
 *
 * O que mudou:
 * O `fetchLatestGeoJson` agora salva a string do mapa convertido dentro do Dexie (`localDb.mapData`).
 * Se não houver internet, ele retorna diretamente a versão armazenada localmente sem disparar erros 403 do Firebase.
 */

export const uploadFile = async (path, file) => {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
};

export const uploadJson = async (path, jsonObject) => {
  const storageRef = ref(storage, path);
  const jsonString = JSON.stringify(jsonObject);
  await uploadString(storageRef, jsonString, "raw", {
    contentType: "application/json",
  });
  return await getDownloadURL(storageRef);
};

export const fetchLatestGeoJson = async (companyId = "empresa_default") => {
  // 1. TENTATIVA RÁPIDA: Busca o último mapa cacheado no Dexie para essa empresa
  try {
      const localMap = await db.mapData.get(`${companyId}_default`);
      if (localMap && !navigator.onLine) {
          // Se estamos offline e temos cache, usamos o cache e pronto
          return { data: JSON.parse(localMap.geojson), error: null, source: 'local' };
      }
  } catch (err) {
      console.warn("Erro ao buscar mapa local do Dexie", err);
  }

  // Se estamos online, tentamos puxar a versão mais nova do Storage
  if (navigator.onLine) {
      try {
        const listRef = ref(storage, `${companyId}/mapas/processados/`);
        const res = await listAll(listRef);

        if (res.items.length === 0) return { data: null, error: null };

        const items = res.items.map(item => {
          const match = item.name.match(/geojson_(\d+)\.json/);
          return {
            itemRef: item,
            timestamp: match ? parseInt(match[1]) : 0
          };
        });

        items.sort((a, b) => b.timestamp - a.timestamp);
        const latestRef = items[0].itemRef;

        const url = await getDownloadURL(latestRef);
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch GeoJSON via URL");

        const json = await response.json();

        // 2. ATUALIZAÇÃO DO CACHE: Salva o novo mapa puxado da nuvem no Dexie pra usar offline depois
        await db.mapData.put({
            id: `${companyId}_default`,
            companyId,
            geojson: JSON.stringify(json),
            updatedAt: new Date().toISOString()
        });

        return { data: json, error: null, source: 'remote' };
      } catch (error) {
        console.error("Error fetching latest GeoJSON:", error);

        // Se a chamada de rede falhou, mas temos cache, caímos nele
        try {
            const fallbackLocal = await db.mapData.get(`${companyId}_default`);
            if (fallbackLocal) {
                 return { data: JSON.parse(fallbackLocal.geojson), error: null, source: 'local_fallback' };
            }
        } catch(e) {}

        let errorMessage = "Erro ao carregar o mapa do Storage.";
        if (error.code === 'storage/unauthorized' || (error.message && error.message.includes('403'))) {
          errorMessage = "Erro de permissão no Firebase Storage. Verifique as regras de segurança.";
        }
        return { data: null, error: errorMessage };
      }
  }

  // Se chegou aqui, tá offline e não tem cache
  return { data: null, error: "Você está offline e ainda não baixou nenhum mapa para visualização." };
};