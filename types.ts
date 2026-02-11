
export enum VeggieType {
  TOMATO = "Tomato",
  CARROT = "Carrot",
  LETTUCE = "Lettuce",
  PEPPER = "Pepper",
  KALE = "Kale",
  CUCUMBER = "Cucumber",
  ZUCCHINI = "Zucchini",
  ONION = "Onion",
  RADISH = "Radish",
  BASIL = "Basil"
}

export type BedShape = "rectangle" | "pill" | "circle";

export interface SeedVariety {
  id: string;
  name: string;
  type: VeggieType;
  spacing: number;
  height: number;
  rootDepth: string;
  habit: string;
  description: string;
  isCustom?: boolean;
}

export interface Vegetable {
  type: VeggieType;
  priority: number; 
  selectedVarieties: SeedVariety[];
}

export interface GardenBed {
  id: string;
  name?: string;
  width: number; // inches
  height: number; // inches
  x: number; // grid units
  y: number; // grid units
  shape?: BedShape;
}

export interface PlantPlacement {
  id: string;
  veggieType: VeggieType;
  varietyName: string;
  x: number; // inches from bed origin
  y: number; // inches from bed origin
  size: number; // visual diameter in inches
  placementReasoning: string;
  spacingAnalysis: string;
  companionInsights: string;
}

export interface BedLayout {
  bedId: string;
  placements: PlantPlacement[];
}

export type SunOrientation = "North" | "South" | "East" | "West";

export interface GardenState {
  beds: GardenBed[];
  seeds: Vegetable[];
  sunOrientation: SunOrientation;
}
