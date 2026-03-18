import { ref, uploadBytes, getDownloadURL, uploadString, listAll } from "firebase/storage";
import { storage } from "./firebase";

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
  try {
    const listRef = ref(storage, `${companyId}/mapas/processados/`);
    const res = await listAll(listRef);

    if (res.items.length === 0) return null;

    // Get the most recently uploaded file based on timestamp in filename (geojson_TIMESTAMP.json)
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
    if (!response.ok) throw new Error("Failed to fetch GeoJSON");
    return await response.json();
  } catch (error) {
    console.error("Error fetching latest GeoJSON:", error);
    return null;
  }
};
