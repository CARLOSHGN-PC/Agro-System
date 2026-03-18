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
    const geoJson = await processShapefileToGeoJSON(files);

    // 3. Upload Original Files to Firebase Storage
    const timestamp = Date.now();
    const basePath = `${companyId}/mapas/shapefiles/${timestamp}`;

    const originalUploadPromises = files.map((file) =>
      uploadFile(`${basePath}/${file.name}`, file)
    );

    await Promise.all(originalUploadPromises);

    // 4. Upload Processed GeoJSON to Firebase Storage
    const processedPath = `${companyId}/mapas/processados/geojson_${timestamp}.json`;
    const geoJsonUrl = await uploadJson(processedPath, geoJson);

    return {
      success: true,
      geoJson,
      geoJsonUrl,
      message: "Shapefile processado e armazenado com sucesso.",
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || "Erro desconhecido ao processar shapefile.",
    };
  }
};
