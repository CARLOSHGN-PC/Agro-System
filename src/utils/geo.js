import JSZip from "jszip";
import shp from "shpjs";

/**
 * Zips shapefile components (.shp, .shx, .dbf, .prj) and processes them into GeoJSON.
 * @param {File[]} files Array of files that make up the shapefile.
 * @returns {Promise<Object>} The parsed GeoJSON object.
 */
export const processShapefileToGeoJSON = async (files) => {
  const zip = new JSZip();

  // Add all files to the zip archive
  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    zip.file(file.name, arrayBuffer);
  }

  // Generate the zip file as an ArrayBuffer
  const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });

  // Parse the zip buffer into GeoJSON using shpjs
  const geojson = await shp(zipBuffer);

  return { geojson, zipBuffer };
};
