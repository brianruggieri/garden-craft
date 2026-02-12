export type VeggieType = string;

export type PlantId = string;
export type VarietyId = string;

export interface PlantMeta {
  id: PlantId;
  spacing: number;
  height: number;
  width: number;
  rootWidth: number;
  color: string;
  icon: string;
  companions: VeggieType[];
  antagonists: VeggieType[];
  habit: string;
  root: string;
}

export interface PlantCatalog {
  plants: Record<VeggieType, PlantMeta>;
  varieties: SeedVariety[];
}

export type BedShape = "rectangle" | "pill" | "circle";

export interface SeedVariety {
  id: VarietyId;
  stableId?: VarietyId;
  plantId?: PlantId;
  name: string;
  type: VeggieType;
  spacing: number;
  height: number;
  width?: number;
  rootDepth: string;
  rootWidth?: number;
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

export type AIProviderId = "gemini" | "openai" | "anthropic" | "local";

export interface ProviderAuth {
  apiKey?: string;
  oauthAccessToken?: string;
}

export interface ProviderSelection {
  provider: AIProviderId;
  auth?: ProviderAuth;
  model?: string;
}
