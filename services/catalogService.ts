import { PlantCatalog } from "../types";

const DEFAULT_SERVER_URL =
  (typeof window !== "undefined" &&
    (window.localStorage?.getItem("GARDENCRAFT_AI_SERVER_URL") ||
      (typeof (import.meta as any) !== "undefined" &&
        (import.meta as any).env?.VITE_AI_SERVER_URL) ||
      window.location?.origin)) ||
  "http://localhost:8787";

export async function fetchPlantCatalog(
  serverUrl: string = DEFAULT_SERVER_URL,
): Promise<PlantCatalog> {
  const response = await fetch(`${serverUrl}/api/catalog`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Catalog request failed (${response.status}): ${text || "Unknown error"}`,
    );
  }
  return response.json();
}
