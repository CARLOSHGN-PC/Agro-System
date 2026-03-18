import { uploadFile, uploadJson } from "./storage";
import { processShapefileToGeoJSON } from "../utils/geo";

export const validateShapefileSet = (files) => {
  const extensions = files.map((f) => {
    const parts = f.name.split(".");
    return parts.length > 1 ? parts.pop().toLowerCase() : "";
  });

  const requiredExts = ["shp", "shx", "dbf", "prj"];
  const missing = requiredExts.filter((ext) => !extensions.includes(ext));

  if (missing.length > 0) {
    throw new Error(`Arquivos obrigatórios ausentes: ${missing.map(e => "." + e).join(", ")}`);
  }

  // Basic check to ensure they share the same base name
  const baseNames = new Set(files.map((f) => {
    const parts = f.name.split(".");
    parts.pop();
    return parts.join(".");
  }));

  if (baseNames.size > 1) {
    throw new Error("Todos os arquivos do shapefile devem ter o mesmo nome base.");
  }

  return true;
};

export const importShapefile = async (files, companyId = "empresa_default") => {
  try {
    // 1. Validation
    validateShapefileSet(files);

    // 2. Process to GeoJSON locally
    const { geojson: geoJson, zipBuffer } = await processShapefileToGeoJSON(files);

    const timestamp = Date.now();

    // 3. Upload Zipped Original Files to Firebase Storage
    const zipPath = `${companyId}/mapas/shapefiles/${timestamp}/shapefile.zip`;
    // Create a Blob from the ArrayBuffer
    const zipBlob = new Blob([zipBuffer], { type: "application/zip" });
    const zipUrl = await uploadFile(zipPath, zipBlob);

    // 4. Upload Processed GeoJSON to Firebase Storage
    const processedPath = `${companyId}/mapas/processados/geojson_${timestamp}.json`;
    const geoJsonUrl = await uploadJson(processedPath, geoJson);

    return {
      success: true,
      geoJson,
      geoJsonUrl,
      zipUrl,
      message: "Shapefile processado e armazenado com sucesso.",
    };
  } catch (error) {
    let errorMessage = error.message || "Erro desconhecido ao processar shapefile.";

    // Check for Firebase Storage permission errors
    if (error.code === 'storage/unauthorized' || errorMessage.includes('permission to access') || errorMessage.includes('403')) {
      errorMessage = "Acesso Negado (403): O Firebase Storage bloqueou o envio. Vá ao Console do Firebase > Storage > Rules e altere temporariamente para: 'allow read, write: if true;' ou configure a autenticação.";
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
};
