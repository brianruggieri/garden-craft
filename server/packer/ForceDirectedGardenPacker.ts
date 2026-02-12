import { HierarchicalCirclePacker } from "./HierarchicalCirclePacker";
import type { HierarchicalOptions } from "./HierarchicalCirclePacker";
import { VEGGIE_METADATA } from "../veggieMetadata";
import type { GardenBed, VeggieType } from "../../shared/types";

type ForceDirectedConfig = HierarchicalOptions;

interface PlantSpec {
  veggieType: VeggieType;
  varietyName?: string;
  size: number;
  count?: number;
  priority?: number;
}

interface PlantRequest {
  veggieType: VeggieType;
  varietyName?: string;
  radius: number;
  id?: string;
  priority?: number;
  meta?: Record<string, any>;
}

interface PlantGroup {
  type: VeggieType;
  plants: PlantRequest[];
  companions: VeggieType[];
  antagonists: VeggieType[];
}

type Placement = {
  id: string;
  veggieType: VeggieType;
  varietyName?: string;
  x: number;
  y: number;
  size: number;
  clusterId?: string;
  clusterType?: string;
  priority?: number;
  [k: string]: any;
};

type PackResult = {
  placements: Placement[];
  stats: Record<string, any>;
  violations: Record<string, any>;
  clusters: any[];
  failedPlants: any[];
};

export class ForceDirectedGardenPacker {
  bed: GardenBed;
  width: number;
  height: number;
  sunOrientation: string;
  allowRootOverlap: boolean;
  config: ForceDirectedConfig;
  packer: HierarchicalCirclePacker;
  nextId: number;

  constructor(
    bed: GardenBed,
    options: Partial<
      ForceDirectedConfig & {
        sunOrientation?: string;
        allowRootOverlap?: boolean;
      }
    > = {},
  ) {
    this.bed = bed;
    this.width = bed.width;
    this.height = bed.height;

    // Garden-specific options
    this.sunOrientation = (options as any).sunOrientation || "South";
    this.allowRootOverlap = (options as any).allowRootOverlap !== false;

    // Force-directed packing configuration
    this.config = {
      shape:
        ((bed as any).shape as "rectangle" | "pill" | "circle") || "rectangle", // Pass bed shape to packer
      intra_group_attraction: options.intra_group_attraction ?? 0.3,
      inter_group_repulsion: options.inter_group_repulsion ?? 0.2,
      collision_strength: options.collision_strength ?? 0.8,
      boundary_force: options.boundary_force ?? 0.5,
      cluster_padding: options.cluster_padding ?? 2,
      min_spacing: options.min_spacing ?? 0.5,
      max_iterations: options.max_iterations ?? 500,
      convergence_threshold: options.convergence_threshold ?? 0.01,
      damping: options.damping ?? 0.9,
      random_seed: options.random_seed ?? null,
    } as ForceDirectedConfig;

    // Create hierarchical packer instance
    this.packer = new HierarchicalCirclePacker(
      this.width,
      this.height,
      this.config,
    );

    // Track metadata for analysis
    this.nextId = 1;
  }

  /**
   * Pack a list of plants into the garden bed
   */
  packPlants(plantList: PlantSpec[]): PackResult {
    console.log(
      `[ForceDirectedGardenPacker] Packing ${plantList.length} plant types into ${this.bed.name || "bed"}`,
    );

    // Group plants by type
    const plantGroups = this.groupPlantsByType(plantList);

    // Pack using hierarchical force-directed algorithm
    const result = this.packer.pack(plantGroups);

    // Enrich placements with horticultural metadata
    const enrichedPlacements = this.enrichPlacements(
      (result as any).placements || [],
    );

    return {
      placements: enrichedPlacements,
      stats: (result as any).stats ?? {},
      violations: (result as any).violations ?? {},
      clusters: (result as any).clusters ?? [],
      failedPlants: (result as any).failedPlants ?? [],
    };
  }

  /**
   * Group plants by type for hierarchical clustering
   */
  groupPlantsByType(plantList: PlantSpec[]): PlantGroup[] {
    const groups = new Map<string, PlantGroup>();

    for (const plantSpec of plantList) {
      const { veggieType, varietyName, size, count = 1, priority } = plantSpec;
      const meta = (VEGGIE_METADATA as any)[veggieType] || {};

      if (!groups.has(String(veggieType))) {
        groups.set(String(veggieType), {
          type: veggieType,
          plants: [],
          companions: meta.companions || [],
          antagonists: meta.antagonists || [],
        });
      }

      const group = groups.get(String(veggieType)) as PlantGroup;

      for (let i = 0; i < (count || 1); i++) {
        group.plants.push({
          id: String(this.nextId++),
          veggieType,
          varietyName,
          radius: (size || 0) / 2,
          priority: priority ?? 1,
          meta: {
            spacing: meta.spacing,
            height: meta.height,
            habit: meta.habit,
            root: meta.root,
            color: meta.color,
            icon: meta.icon,
            companions: meta.companions || [],
            antagonists: meta.antagonists || [],
          },
        });
      }
    }

    return Array.from(groups.values());
  }

  /**
   * Enrich placements with horticultural analysis and metadata
   */
  enrichPlacements(placements: any[]): Placement[] {
    return placements.map((placement: any) => {
      const meta = (VEGGIE_METADATA as any)[placement.veggieType] || {};

      const enriched: Placement = {
        ...placement,
        spacingAnalysis: this.generateSpacingAnalysis(placement, placements),
        placementReasoning: this.generatePlacementReasoning(placement, meta),
        companionInsights: this.generateCompanionInsights(
          placement,
          placements,
          meta,
        ),
      };

      return enriched;
    });
  }

  /**
   * Generate spacing analysis for a placement
   */
  generateSpacingAnalysis(placement: any, allPlacements: any[]): string {
    const radius = (placement.size ?? placement.radius ?? 0) / 2;

    // Find nearby plants (within 4x radius)
    const nearby = allPlacements.filter((p) => {
      if (p.id === placement.id) return false;

      const dx = p.x - placement.x;
      const dy = p.y - placement.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      return distance < radius * 4;
    });

    if (nearby.length === 0) {
      return `Isolated placement with ${Math.round((placement.size ?? placement.radius * 2) || 0)}" canopy space.`;
    }

    const nearbyTypes = [...new Set(nearby.map((p) => p.veggieType))];

    if (nearbyTypes.length <= 2) {
      return `Adjacent to ${nearbyTypes.join(" and ")}, maintaining proper spacing.`;
    }

    const more = nearbyTypes.length - 2;
    return `Surrounded by ${nearbyTypes.slice(0, 2).join(", ")}, and ${more} other type${more > 1 ? "s" : ""}.`;
  }

  /**
   * Generate placement reasoning based on sun orientation and plant characteristics
   */
  generatePlacementReasoning(placement: any, meta: any): string {
    const reasons: string[] = [];
    const heightValue = meta?.height ?? 18;
    const tallEdge = this.getTallPlantEdge();

    const isTall = heightValue >= 48;
    const isShort = heightValue <= 12;

    if (isTall) {
      const isNearEdge = this.isNearEdge(placement, tallEdge);
      if (isNearEdge) {
        reasons.push(
          `Tall plant placed on ${tallEdge} edge to avoid shading shorter plants`,
        );
      } else {
        reasons.push(
          `Tall plant positioned with sun orientation in mind (${this.sunOrientation} exposure)`,
        );
      }
    } else if (isShort) {
      reasons.push(`Low-growing plant suitable for intercropping`);
    }

    if (meta?.root === "shallow") {
      reasons.push(`shallow roots allow underplanting`);
    } else if (meta?.root === "deep") {
      reasons.push(`deep roots access lower soil layers`);
    }

    if (placement.clusterId && !isTall) {
      reasons.push(`grouped with other ${placement.clusterType} plants`);
    }

    if (reasons.length === 0) {
      reasons.push(`Standard placement in available space`);
    }

    return reasons.join("; ") + ".";
  }

  /**
   * Generate companion planting insights
   */
  generateCompanionInsights(
    placement: any,
    allPlacements: any[],
    meta: any,
  ): string {
    const companions: string[] = meta?.companions || [];
    const antagonists: string[] = meta?.antagonists || [];

    if (companions.length === 0 && antagonists.length === 0) {
      return "No specific companion requirements.";
    }

    const nearbyCompanions = allPlacements.filter((p) => {
      if (p.id === placement.id) return false;
      if (!companions.includes(p.veggieType)) return false;

      const dx = p.x - placement.x;
      const dy = p.y - placement.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      return distance < 12;
    });

    const nearbyAntagonists = allPlacements.filter((p) => {
      if (p.id === placement.id) return false;
      if (!antagonists.includes(p.veggieType)) return false;

      const dx = p.x - placement.x;
      const dy = p.y - placement.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      return distance < 18;
    });

    const insights: string[] = [];

    if (nearbyCompanions.length > 0) {
      const types = [...new Set(nearbyCompanions.map((p) => p.veggieType))];
      insights.push(`Benefits from proximity to ${types.join(", ")}`);
    } else if (companions.length > 0) {
      insights.push(`Compatible with ${companions.slice(0, 3).join(", ")}`);
    }

    if (nearbyAntagonists.length > 0) {
      const types = [...new Set(nearbyAntagonists.map((p) => p.veggieType))];
      insights.push(`⚠️ Warning: Near incompatible ${types.join(", ")}`);
    }

    return insights.join(". ") + ".";
  }

  /**
   * Determine which edge tall plants should go on based on sun orientation
   */
  getTallPlantEdge(): string {
    const edgeMap: Record<string, string> = {
      North: "south",
      South: "north",
      East: "west",
      West: "east",
    };
    return edgeMap[this.sunOrientation] || "north";
  }

  /**
   * Check if a placement is near a specific edge
   */
  isNearEdge(placement: any, edge: string): boolean {
    const margin = Math.max(
      placement.size ?? placement.radius ?? 0,
      this.height * 0.25,
    );

    switch (edge) {
      case "north":
        return placement.y < margin;
      case "south":
        return placement.y > this.height - margin;
      case "east":
        return placement.x > this.width - margin;
      case "west":
        return placement.x < margin;
      default:
        return false;
    }
  }

  /**
   * Get packing statistics
   */
  getStats(): any {
    return (this.packer as any).getState();
  }

  /**
   * Reset the packer
   */
  reset(): void {
    (this.packer as any).reset();
    this.nextId = 1;
  }
}
