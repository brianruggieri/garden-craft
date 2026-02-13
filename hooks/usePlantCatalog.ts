import { useEffect, useState } from "react";
import { PlantCatalog, PlantMeta, SeedVariety, VeggieType } from "../shared/types";
import { fetchPlantCatalog } from "../services/catalogService";

export const usePlantCatalog = () => {
  const [catalog, setCatalog] = useState<PlantCatalog | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);

  useEffect(() => {
    let isActive = true;

    const loadCatalog = async () => {
      setCatalogLoading(true);
      setCatalogError(null);
      try {
        const data = await fetchPlantCatalog();
        if (isActive) setCatalog(data);
      } catch (err) {
        if (isActive) {
          setCatalogError(
            err instanceof Error ? err.message : "Failed to load catalog",
          );
          setCatalog(null);
        }
      } finally {
        if (isActive) setCatalogLoading(false);
      }
    };

    loadCatalog();

    return () => {
      isActive = false;
    };
  }, []);

  const plantMetadata = (catalog?.plants || {}) as Record<string, PlantMeta>;
  const seedVarieties = (catalog?.varieties || []) as SeedVariety[];
  const veggieTypes = Object.keys(plantMetadata) as VeggieType[];

  return {
    catalog,
    catalogError,
    catalogLoading,
    plantMetadata,
    seedVarieties,
    veggieTypes,
  };
};
