
import { VeggieType, SeedVariety } from './types';

export enum GrowthHabit {
  TALL_VERTICAL = "Tall & Vertical",
  BUSH_MEDIUM = "Bushy & Medium",
  GROUND_COVER = "Ground Cover",
  CLIMBING_VINE = "Climbing Vine",
  ROOT_CROP = "Underground Root",
}

export enum RootDepth {
  SHALLOW = "Shallow (< 6\")",
  MEDIUM = "Medium (6-12\")",
  DEEP = "Deep (> 12\")",
}

export interface VeggieMeta {
  spacing: number;
  height: number;
  color: string;
  icon: string;
  companions: VeggieType[];
  antagonists: VeggieType[];
  habit: GrowthHabit;
  root: RootDepth;
}

export const VEGGIE_METADATA: Record<VeggieType, VeggieMeta> = {
  [VeggieType.TOMATO]: { 
    spacing: 18, height: 48, color: "#ef4444", icon: "🍅",
    companions: [VeggieType.BASIL, VeggieType.ONION, VeggieType.CARROT],
    antagonists: [VeggieType.KALE],
    habit: GrowthHabit.TALL_VERTICAL,
    root: RootDepth.DEEP
  },
  [VeggieType.CARROT]: { 
    spacing: 3, height: 12, color: "#f97316", icon: "🥕",
    companions: [VeggieType.TOMATO, VeggieType.ONION, VeggieType.LETTUCE],
    antagonists: [],
    habit: GrowthHabit.ROOT_CROP,
    root: RootDepth.MEDIUM
  },
  [VeggieType.LETTUCE]: { 
    spacing: 6, height: 8, color: "#4ade80", icon: "🥬",
    companions: [VeggieType.CARROT, VeggieType.RADISH, VeggieType.CUCUMBER],
    antagonists: [],
    habit: GrowthHabit.GROUND_COVER,
    root: RootDepth.SHALLOW
  },
  [VeggieType.PEPPER]: { 
    spacing: 15, height: 24, color: "#facc15", icon: "🫑",
    companions: [VeggieType.BASIL, VeggieType.ONION],
    antagonists: [],
    habit: GrowthHabit.BUSH_MEDIUM,
    root: RootDepth.MEDIUM
  },
  [VeggieType.KALE]: { 
    spacing: 12, height: 18, color: "#166534", icon: "🥬",
    companions: [VeggieType.ONION, VeggieType.LETTUCE],
    antagonists: [VeggieType.TOMATO],
    habit: GrowthHabit.BUSH_MEDIUM,
    root: RootDepth.MEDIUM
  },
  [VeggieType.CUCUMBER]: { 
    spacing: 12, height: 12, color: "#22c55e", icon: "🥒",
    companions: [VeggieType.RADISH, VeggieType.LETTUCE],
    antagonists: [VeggieType.BASIL],
    habit: GrowthHabit.CLIMBING_VINE,
    root: RootDepth.MEDIUM
  },
  [VeggieType.ZUCCHINI]: { 
    spacing: 24, height: 24, color: "#15803d", icon: "🥒",
    companions: [VeggieType.RADISH],
    antagonists: [],
    habit: GrowthHabit.BUSH_MEDIUM,
    root: RootDepth.MEDIUM
  },
  [VeggieType.ONION]: { 
    spacing: 4, height: 12, color: "#e2e8f0", icon: "🧅",
    companions: [VeggieType.TOMATO, VeggieType.CARROT, VeggieType.PEPPER],
    antagonists: [],
    habit: GrowthHabit.ROOT_CROP,
    root: RootDepth.SHALLOW
  },
  [VeggieType.RADISH]: { 
    spacing: 2, height: 6, color: "#db2777", icon: "🏮",
    companions: [VeggieType.LETTUCE, VeggieType.CUCUMBER, VeggieType.ZUCCHINI],
    antagonists: [],
    habit: GrowthHabit.ROOT_CROP,
    root: RootDepth.SHALLOW
  },
  [VeggieType.BASIL]: { 
    spacing: 10, height: 15, color: "#86efac", icon: "🌿",
    companions: [VeggieType.TOMATO, VeggieType.PEPPER],
    antagonists: [VeggieType.CUCUMBER],
    habit: GrowthHabit.BUSH_MEDIUM,
    root: RootDepth.SHALLOW
  },
};

export const SEED_VARIETY_LIBRARY: SeedVariety[] = [
  { id: 't1', type: VeggieType.TOMATO, name: 'Roma', spacing: 12, height: 36, rootDepth: 'Medium', habit: 'Determinate/Bushy', description: 'Paste tomato, space-saving determinate growth.' },
  { id: 't2', type: VeggieType.TOMATO, name: 'Beefsteak', spacing: 24, height: 72, rootDepth: 'Deep', habit: 'Indeterminate/Vining', description: 'Large fruits, needs heavy staking and significant room.' },
  { id: 't3', type: VeggieType.TOMATO, name: 'Cherry (Tiny Tim)', spacing: 8, height: 12, rootDepth: 'Shallow', habit: 'Dwarf/Compact', description: 'Ultra-compact, perfect for pots or edge placement.' },
  
  { id: 'c1', type: VeggieType.CARROT, name: 'Danvers Half Long', spacing: 3, height: 10, rootDepth: 'Medium', habit: 'Root Crop', description: 'Classic adaptable carrot.' },
  { id: 'c2', type: VeggieType.CARROT, name: 'Paris Market', spacing: 2, height: 6, rootDepth: 'Shallow', habit: 'Root Crop (Round)', description: 'Bite-sized round carrots, tolerates shallow/clay soil.' },
  
  { id: 'l1', type: VeggieType.LETTUCE, name: 'Buttercrunch', spacing: 8, height: 6, rootDepth: 'Shallow', habit: 'Loose Head', description: 'Compact bibb lettuce.' },
  { id: 'l2', type: VeggieType.LETTUCE, name: 'Black Seeded Simpson', spacing: 4, height: 8, rootDepth: 'Shallow', habit: 'Cut-and-come-again', description: 'Fast leaf growth, can be crowded.' },

  { id: 'p1', type: VeggieType.PEPPER, name: 'California Wonder', spacing: 18, height: 24, rootDepth: 'Medium', habit: 'Bushy', description: 'Standard bell pepper.' },
  { id: 'p2', type: VeggieType.PEPPER, name: 'Thai Bird Eye', spacing: 12, height: 18, rootDepth: 'Shallow', habit: 'Compact Bush', description: 'Small hot peppers, dense growth.' },

  { id: 'z1', type: VeggieType.ZUCCHINI, name: 'Black Beauty', spacing: 36, height: 24, rootDepth: 'Deep', habit: 'Bushy Sprawl', description: 'Massive leaves, takes up major space.' },
  { id: 'z2', type: VeggieType.ZUCCHINI, name: 'Eight Ball', spacing: 24, height: 18, rootDepth: 'Medium', habit: 'Compact Bush', description: 'Round fruit, slightly smaller footprint.' },
];

export const GRID_SIZE = 24; // 1 grid unit = 6 inches (24px)
export const INCHES_PER_GRID = 6;
