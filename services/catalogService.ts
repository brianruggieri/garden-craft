import { PlantCatalog } from "../shared/types";
import { getServerUrl, withServerUrl } from "./serverUrl";

export async function fetchPlantCatalog(
  serverUrl: string = getServerUrl(),
): Promise<PlantCatalog> {
  const response = await fetch(withServerUrl("/api/catalog", serverUrl));
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Catalog request failed (${response.status}): ${text || "Unknown error"}`,
    );
  }
  return response.json();
}
