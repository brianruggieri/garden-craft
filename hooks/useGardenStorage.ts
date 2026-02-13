import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  BedLayout,
  BedShape,
  GardenBed,
  SunOrientation,
  Vegetable,
} from "../shared/types";

type GardenStorageArgs = {
  beds: GardenBed[];
  sunOrientation: SunOrientation;
  seeds: Vegetable[];
  layouts: BedLayout[];
  setBeds: Dispatch<SetStateAction<GardenBed[]>>;
  setSunOrientation: Dispatch<SetStateAction<SunOrientation>>;
  setSeeds: Dispatch<SetStateAction<Vegetable[]>>;
  setLayouts: Dispatch<SetStateAction<BedLayout[]>>;
};

const safeParseJson = (raw: string | null) => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch (err) {
    console.warn("Failed to parse saved data", err);
    return null;
  }
};

const isString = (value: unknown): value is string => typeof value === "string";
const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isBedShape = (value: unknown): value is BedShape =>
  value === "rectangle" || value === "pill" || value === "circle";
const isSunOrientation = (value: unknown): value is SunOrientation =>
  value === "North" ||
  value === "East" ||
  value === "South" ||
  value === "West";
const isGardenBed = (value: unknown): value is GardenBed => {
  if (!value || typeof value !== "object") return false;
  const bed = value as GardenBed;
  return (
    isString(bed.id) &&
    isString(bed.name) &&
    isNumber(bed.width) &&
    isNumber(bed.height) &&
    isNumber(bed.x) &&
    isNumber(bed.y) &&
    isBedShape(bed.shape)
  );
};
const isVegetable = (value: unknown): value is Vegetable => {
  if (!value || typeof value !== "object") return false;
  const veg = value as Vegetable;
  return (
    isString(veg.type) &&
    isNumber(veg.priority) &&
    Array.isArray(veg.selectedVarieties)
  );
};

export const useGardenStorage = ({
  beds,
  sunOrientation,
  seeds,
  layouts,
  setBeds,
  setSunOrientation,
  setSeeds,
  setLayouts,
}: GardenStorageArgs) => {
  const [savedGardens, setSavedGardens] = useState<string[]>([]);
  const [savedPlantings, setSavedPlantings] = useState<string[]>([]);

  useEffect(() => {
    const gardenKeys = Object.keys(localStorage).filter((k) =>
      k.startsWith("garden_v1_"),
    );
    setSavedGardens(gardenKeys.map((k) => k.replace("garden_v1_", "")));
    const plantingKeys = Object.keys(localStorage).filter((k) =>
      k.startsWith("planting_v1_"),
    );
    setSavedPlantings(plantingKeys.map((k) => k.replace("planting_v1_", "")));
  }, []);

  const handleSaveGarden = (name: string) => {
    const data = { beds, sunOrientation };
    localStorage.setItem(`garden_v1_${name}`, JSON.stringify(data));
    setSavedGardens((prev) => (prev.includes(name) ? prev : [...prev, name]));
  };

  const handleLoadGarden = (name: string) => {
    const data = safeParseJson(localStorage.getItem(`garden_v1_${name}`));
    if (!data || typeof data !== "object") return;
    const payload = data as { beds?: unknown; sunOrientation?: unknown };
    if (Array.isArray(payload.beds) && payload.beds.every(isGardenBed)) {
      setBeds(payload.beds);
    }
    if (isSunOrientation(payload.sunOrientation)) {
      setSunOrientation(payload.sunOrientation);
    }
  };

  const handleSavePlanting = (name: string) => {
    const data = { seeds, layouts };
    localStorage.setItem(`planting_v1_${name}`, JSON.stringify(data));
    setSavedPlantings((prev) =>
      prev.includes(name) ? prev : [...prev, name],
    );
  };

  const handleLoadPlanting = (name: string) => {
    const data = safeParseJson(localStorage.getItem(`planting_v1_${name}`));
    if (!data || typeof data !== "object") return;
    const payload = data as { seeds?: unknown; layouts?: unknown };
    if (Array.isArray(payload.seeds) && payload.seeds.every(isVegetable)) {
      setSeeds(payload.seeds);
    }
    if (Array.isArray(payload.layouts)) {
      setLayouts(payload.layouts as BedLayout[]);
    }
  };

  return {
    savedGardens,
    savedPlantings,
    handleSaveGarden,
    handleLoadGarden,
    handleSavePlanting,
    handleLoadPlanting,
  };
};
