/**
 * ForceDirectedGardenPacker - Horticultural-aware hierarchical circle packing
 *
 * Integrates HierarchicalCirclePacker with garden-specific constraints:
 * - Companion planting (attraction between compatible plants)
 * - Antagonist separation (repulsion between incompatible plants)
 * - Sun orientation and height-based placement zones
 * - Priority-based placement order
 * - Plant metadata integration (spacing, height, root depth)
 *
 * This packer uses a two-level hierarchical approach:
 * 1. Group plants by type into clusters
 * 2. Pack clusters using force-directed layout
 * 3. Pack individual plants within each cluster
 *
 * @author GardenCraft
 * @version 2.0.0
 */

import { HierarchicalCirclePacker } from './HierarchicalCirclePacker.js';
import { VEGGIE_METADATA } from '../veggieMetadata.js';

export class ForceDirectedGardenPacker {
  constructor(bed, options = {}) {
    this.bed = bed;
    this.width = bed.width;
    this.height = bed.height;

    // Garden-specific options
    this.sunOrientation = options.sunOrientation || 'South';
    this.allowRootOverlap = options.allowRootOverlap !== false;

    // Force-directed packing configuration
    this.config = {
      shape: bed.shape || 'rectangle', // Pass bed shape to packer
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
    };

    // Create hierarchical packer instance
    this.packer = new HierarchicalCirclePacker(this.width, this.height, this.config);

    // Track metadata for analysis
    this.nextId = 1;
  }

  /**
   * Pack a list of plants into the garden bed
   *
   * @param {Array} plantList - Array of {veggieType, varietyName, size, count, priority}
   * @returns {Object} - Packing result with placements and statistics
   */
  packPlants(plantList) {
    console.log(`[ForceDirectedGardenPacker] Packing ${plantList.length} plant types into ${this.bed.name || 'bed'}`);

    // Group plants by type
    const plantGroups = this.groupPlantsByType(plantList);

    // Pack using hierarchical force-directed algorithm
    const result = this.packer.pack(plantGroups);

    // Enrich placements with horticultural metadata
    const enrichedPlacements = this.enrichPlacements(result.placements);

    return {
      placements: enrichedPlacements,
      stats: result.stats,
      violations: result.violations,
      clusters: result.clusters,
      failedPlants: [], // Hierarchical packer doesn't fail, just packs tighter
    };
  }

  /**
   * Group plants by type for hierarchical clustering
   */
  groupPlantsByType(plantList) {
    const groups = new Map();

    for (const plantSpec of plantList) {
      const { veggieType, varietyName, size, count, priority } = plantSpec;
      const meta = VEGGIE_METADATA[veggieType] || {};

      // Get or create group for this type
      if (!groups.has(veggieType)) {
        groups.set(veggieType, {
          type: veggieType,
          plants: [],
          companions: meta.companions || [],
          antagonists: meta.antagonists || [],
        });
      }

      const group = groups.get(veggieType);

      // Add plant instances
      for (let i = 0; i < (count || 1); i++) {
        group.plants.push({
          id: String(this.nextId++),
          veggieType,
          varietyName,
          radius: size / 2, // Convert diameter to radius
          priority: priority || 1,
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
  enrichPlacements(placements) {
    return placements.map((placement) => {
      const meta = VEGGIE_METADATA[placement.veggieType] || {};

      return {
        ...placement,
        spacingAnalysis: this.generateSpacingAnalysis(placement, placements),
        placementReasoning: this.generatePlacementReasoning(placement, meta),
        companionInsights: this.generateCompanionInsights(placement, placements, meta),
      };
    });
  }

  /**
   * Generate spacing analysis for a placement
   */
  generateSpacingAnalysis(placement, allPlacements) {
    const radius = placement.size / 2;

    // Find nearby plants (within 2x radius)
    const nearby = allPlacements.filter((p) => {
      if (p.id === placement.id) return false;

      const dx = p.x - placement.x;
      const dy = p.y - placement.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      return distance < radius * 4;
    });

    if (nearby.length === 0) {
      return `Isolated placement with ${Math.round(placement.size)}" canopy space.`;
    }

    // Group nearby plants by type
    const nearbyTypes = [...new Set(nearby.map((p) => p.veggieType))];

    if (nearbyTypes.length <= 2) {
      return `Adjacent to ${nearbyTypes.join(' and ')}, maintaining proper spacing.`;
    }

    return `Surrounded by ${nearbyTypes.slice(0, 2).join(', ')}, and ${nearbyTypes.length - 2} other type${nearbyTypes.length - 2 > 1 ? 's' : ''}.`;
  }

  /**
   * Generate placement reasoning based on sun orientation and plant characteristics
   */
  generatePlacementReasoning(placement, meta) {
    const reasons = [];
    const heightValue = meta.height || 18;
    const tallEdge = this.getTallPlantEdge();

    // Convert numeric height to category
    const isTall = heightValue >= 48; // 48"+ is tall
    const isShort = heightValue <= 12; // 12" or less is short

    // Always mention sun orientation for tall plants first
    if (isTall) {
      const isNearEdge = this.isNearEdge(placement, tallEdge);
      if (isNearEdge) {
        reasons.push(`Tall plant placed on ${tallEdge} edge to avoid shading shorter plants`);
      } else {
        reasons.push(`Tall plant positioned with sun orientation in mind (${this.sunOrientation} exposure)`);
      }
    } else if (isShort) {
      reasons.push(`Low-growing plant suitable for intercropping`);
    }

    if (meta.root === 'shallow') {
      reasons.push(`shallow roots allow underplanting`);
    } else if (meta.root === 'deep') {
      reasons.push(`deep roots access lower soil layers`);
    }

    // Cluster-based reasoning (but not for tall plants, to keep sun orientation prominent)
    if (placement.clusterId && !isTall) {
      reasons.push(`grouped with other ${placement.clusterType} plants`);
    }

    if (reasons.length === 0) {
      reasons.push(`Standard placement in available space`);
    }

    return reasons.join('; ') + '.';
  }

  /**
   * Generate companion planting insights
   */
  generateCompanionInsights(placement, allPlacements, meta) {
    const companions = meta.companions || [];
    const antagonists = meta.antagonists || [];

    if (companions.length === 0 && antagonists.length === 0) {
      return 'No specific companion requirements.';
    }

    // Find nearby companions (within 12")
    const nearbyCompanions = allPlacements.filter((p) => {
      if (p.id === placement.id) return false;
      if (!companions.includes(p.veggieType)) return false;

      const dx = p.x - placement.x;
      const dy = p.y - placement.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      return distance < 12;
    });

    // Find nearby antagonists (within 18")
    const nearbyAntagonists = allPlacements.filter((p) => {
      if (p.id === placement.id) return false;
      if (!antagonists.includes(p.veggieType)) return false;

      const dx = p.x - placement.x;
      const dy = p.y - placement.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      return distance < 18;
    });

    const insights = [];

    if (nearbyCompanions.length > 0) {
      const types = [...new Set(nearbyCompanions.map((p) => p.veggieType))];
      insights.push(`Benefits from proximity to ${types.join(', ')}`);
    } else if (companions.length > 0) {
      insights.push(`Compatible with ${companions.slice(0, 3).join(', ')}`);
    }

    if (nearbyAntagonists.length > 0) {
      const types = [...new Set(nearbyAntagonists.map((p) => p.veggieType))];
      insights.push(`⚠️ Warning: Near incompatible ${types.join(', ')}`);
    }

    return insights.join('. ') + '.';
  }

  /**
   * Determine which edge tall plants should go on based on sun orientation
   */
  getTallPlantEdge() {
    const edgeMap = {
      North: 'south',
      South: 'north',
      East: 'west',
      West: 'east',
    };
    return edgeMap[this.sunOrientation] || 'north';
  }

  /**
   * Check if a placement is near a specific edge
   */
  isNearEdge(placement, edge) {
    const margin = Math.max(placement.size, this.height * 0.25); // Within 25% of dimension or plant size

    switch (edge) {
      case 'north':
        return placement.y < margin;
      case 'south':
        return placement.y > this.height - margin;
      case 'east':
        return placement.x > this.width - margin;
      case 'west':
        return placement.x < margin;
      default:
        return false;
    }
  }

  /**
   * Get packing statistics
   */
  getStats() {
    return this.packer.getState();
  }

  /**
   * Reset the packer
   */
  reset() {
    this.packer.reset();
    this.nextId = 1;
  }
}
