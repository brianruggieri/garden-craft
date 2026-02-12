import { readFile } from "node:fs/promises";
import { PLANT_CATALOG } from "../shared/plantCatalog.js";

async function loadCatalogFromJsonEnv() {
  const raw = process.env.PLANT_CATALOG_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn("PLANT_CATALOG_JSON is not valid JSON.");
    return null;
  }
}

async function loadCatalogFromFile() {
  const filePath = process.env.PLANT_CATALOG_PATH;
  if (!filePath) return null;
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.warn("Failed to load catalog from PLANT_CATALOG_PATH.");
    return null;
  }
}

async function loadCatalogFromDatabase() {
  if (!process.env.PLANT_CATALOG_DB_URL) return null;
  console.warn("PLANT_CATALOG_DB_URL configured but DB client not wired.");
  return null;
}

export async function getPlantCatalog() {
  const dbCatalog = await loadCatalogFromDatabase();
  if (dbCatalog) return dbCatalog;

  const envCatalog = await loadCatalogFromJsonEnv();
  if (envCatalog) return envCatalog;

  const fileCatalog = await loadCatalogFromFile();
  if (fileCatalog) return fileCatalog;

  return PLANT_CATALOG;
}
