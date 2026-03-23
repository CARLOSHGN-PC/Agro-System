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
  let cachedData = null;
  let localTimestamp = 0;

  // 1. OBTENÇÃO LOCAL (Sempre tenta ler o cache primeiro)
  // Isso garante que a UI nunca espere a nuvem se já houver um mapa baixado (verdadeiro Offline-First).
  try {
      const localMap = await db.mapData.get(`${companyId}_default`);
      if (localMap && localMap.geojson) {
          cachedData = JSON.parse(localMap.geojson);
          localTimestamp = localMap.mapTimestamp || 0;
          // Retornamos os dados cacheados na hora. Não amarramos o retorno inicial à internet.
      }
  } catch (err) {
      console.warn("Erro ao buscar mapa local do Dexie", err);
  }

  // 2. VERIFICAÇÃO DE REDE EM BACKGROUND (Se online, baixa mapa novo)
  // Como a interface (React) aguarda a promise terminar no onMount, se já tivermos `cachedData`
  // nós devolvemos o cache local IMEDIATAMENTE.
  // Criamos uma lógica para que, se não houver cache, ele seja forçado a esperar a nuvem.

  if (navigator.onLine) {
     const fetchFromRemote = async () => {
         try {
            const listRef = ref(storage, `${companyId}/mapas/processados/`);
            const res = await listAll(listRef);

            if (res.items.length > 0) {
                const items = res.items.map(item => {
                    const match = item.name.match(/geojson_(\d+)\.json/);
                    return { itemRef: item, timestamp: match ? parseInt(match[1]) : 0 };
                });

                items.sort((a, b) => b.timestamp - a.timestamp);
                const latestItem = items[0];
                const latestRef = latestItem.itemRef;

                // Verificação otimizada: Apenas faz o download pesado se o timestamp do arquivo
                // no Firebase for MAIOR que o timestamp do mapa que temos localmente.
                if (latestItem.timestamp > localTimestamp) {
                    console.log(`Nova versão do mapa detectada (${latestItem.timestamp} > ${localTimestamp}). Baixando...`);
                    const url = await getDownloadURL(latestRef);
                    const response = await fetch(url);
                    if (response.ok) {
                        const json = await response.json();

                        // ATUALIZAÇÃO DO CACHE: Salva/Sobrescreve no Dexie pra usar offline depois
                        await db.mapData.put({
                            id: `${companyId}_default`,
                            companyId,
                            geojson: JSON.stringify(json),
                            updatedAt: new Date().toISOString(),
                            mapTimestamp: latestItem.timestamp
                        });

                        // Dispara evento para o frontend avisar o usuário ou atualizar a tela
                        window.dispatchEvent(new CustomEvent('map-updated', { detail: { companyId } }));

                        return json;
                    }
                } else {
                    console.log(`Mapa local já está atualizado (${localTimestamp}). Nenhuma ação necessária.`);
                }
            }
         } catch (error) {
            console.error("Error fetching remote GeoJSON:", error);
         }
         return null;
     };

     // Se NUNCA tivermos entrado no app (não tem cache), precisamos bloquear e esperar a nuvem:
     if (!cachedData) {
         try {
             const remoteJson = await fetchFromRemote();
             if (remoteJson) {
                 return { data: remoteJson, error: null, source: 'remote' };
             } else {
                 return { data: null, error: "Nenhum mapa encontrado no servidor.", source: 'remote' };
             }
         } catch (e) {
             return { data: null, error: "Erro de permissão ou falha de rede ao baixar mapa do servidor." };
         }
     } else {
         // Se já tínhamos cache, baixamos do Firebase apenas em "background" de forma assíncrona,
         // e se ele baixar algo novo, fica lá gravado pro próximo F5 do usuário.
         // Isso evita a tela branca de carregamento!
         fetchFromRemote().catch(e => console.warn(e));
         return { data: cachedData, error: null, source: 'local' };
     }
  }

  // 3. CENÁRIO OFFLINE (ou Sem Resposta)
  if (cachedData) {
      return { data: cachedData, error: null, source: 'local_fallback' };
  }

  return { data: null, error: "Você está offline e ainda não baixou nenhum mapa para visualização." };
};