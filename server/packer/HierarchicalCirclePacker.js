/**
 * HierarchicalCirclePacker - Force-directed two-level circle packing with clustering
 *
 * Implements hierarchical circle packing for garden planning:
 * - Level 1: Pack cluster meta-circles (plant type groups)
 * - Level 2: Pack individual plant circles within cluster boundaries
 *
 * Uses force-directed iterative relaxation:
 * - Collision forces (separation between overlapping circles)
 * - Intra-group attraction (keep same types together)
 * - Inter-group repulsion (separate different types)
 * - Boundary forces (containment within garden bed)
 * - Optional Lloyd relaxation for refinement
 *
 * Based on research:
 * - Fruchterman & Reingold (1991) - Force-directed graph drawing
 * - Wang et al. (2006) - Hierarchical circle packing visualization
 * - Bridson (2007) - Poisson disk sampling
 * - Position-based dynamics for collision resolution
 *
 * @author GardenCraft
 * @version 2.0.0
 */

export class HierarchicalCirclePacker {
  /**
   * @param {number} width - Bed width in inches
   * @param {number} height - Bed height in inches
   * @param {Object} config - Configuration parameters
   * @param {number} config.intra_group_attraction - Attraction force within same type (0-1, default 0.3)
   * @param {number} config.inter_group_repulsion - Repulsion between different types (0-1, default 0.2)
   * @param {number} config.collision_strength - Collision resolution force (0-1, default 0.8)
   * @param {number} config.boundary_force - Containment force at edges (0-1, default 0.5)
   * @param {number} config.cluster_padding - Minimum space between clusters in inches (default 2)
   * @param {number} config.min_spacing - Minimum space between individual circles in inches (default 0.5)
   * @param {number} config.max_iterations - Maximum simulation steps (default 500)
   * @param {number} config.convergence_threshold - Energy threshold for stopping (default 0.01)
   * @param {number} config.damping - Velocity damping factor (0-1, default 0.9)
   * @param {number|null} config.random_seed - Seed for deterministic randomness (default null)
   */
  constructor(width, height, options = {}) {
    this.width = width;
    this.height = height;
    this.shape = options.shape || "rectangle"; // Support rectangle, circle, rounded

    // Tunable force parameters
    this.intra_group_attraction = options.intra_group_attraction ?? 0.3;
    this.inter_group_repulsion = options.inter_group_repulsion ?? 0.2;
    this.collision_strength = options.collision_strength ?? 0.8;
    this.boundary_force = options.boundary_force ?? 0.5;
    this.cluster_padding = options.cluster_padding ?? 2;
    this.min_spacing = options.min_spacing ?? 0.5;
    this.max_iterations = options.max_iterations ?? 500;
    this.convergence_threshold = options.convergence_threshold ?? 0.01;
    this.damping = options.damping ?? 0.85; // Lower damping for better collision resolution

    // Random seed for determinism
    this.random_seed = options.random_seed ?? null;
    this._random_state = this.random_seed ?? Math.random() * 1000000;

    // Tracking structures
    this.clusters = []; // Meta-circles for plant groups
    this.circles = []; // Individual plant circles
    this.iteration_count = 0;
    this.converged = false;
  }

  /**
   * Seeded pseudo-random number generator (LCG algorithm)
   * Ensures deterministic layouts when seed is provided
   */
  random() {
    if (this.random_seed === null) {
      return Math.random();
    }
    // Linear Congruential Generator
    this._random_state =
      (this._random_state * 1664525 + 1013904223) % 4294967296;
    return this._random_state / 4294967296;
  }

  /**
   * Pack plants with hierarchical two-level clustering
   *
   * @param {Array} plantGroups - Array of plant type groups
   *   [{
   *     type: 'Tomato',
   *     plants: [{id, varietyName, radius, priority, ...meta}, ...],
   *     companions: ['Basil', 'Marigold'],
   *     antagonists: ['Fennel']
   *   }, ...]
   * @returns {Object} - Packing result with placements and stats
   */
  pack(plantGroups) {
    console.log(
      `[HierarchicalPacker] Starting two-level packing for ${plantGroups.length} plant groups`,
    );

    // Track requested counts by type for reporting
    this.requestedCounts = {};
    plantGroups.forEach((group) => {
      this.requestedCounts[group.type] = group.plants.length;
    });

    // Store original plant groups for space-filling phase
    this.plantGroups = plantGroups;

    // Level 1: Create and pack cluster meta-circles
    this.createClusters(plantGroups);
    this.packClusters();

    console.log(
      `[HierarchicalPacker] Level 1 complete: ${this.clusters.length} clusters packed`,
    );

    // Level 2: Pack individual plants within each cluster
    this.packPlantsInClusters(plantGroups);

    console.log(
      `[HierarchicalPacker] Level 2 complete: ${this.circles.length} plants packed`,
    );

    // Check if packing is realistic
    const totalRequestedPlants = plantGroups.reduce(
      (sum, g) => sum + g.plants.length,
      0,
    );
    if (this.circles.length < totalRequestedPlants) {
      console.warn(
        `[HierarchicalPacker] Could not fit all ${totalRequestedPlants} plants, packed ${this.circles.length}`,
      );

      // Log counts by type
      const actualCounts = {};
      this.circles.forEach((c) => {
        actualCounts[c.veggieType] = (actualCounts[c.veggieType] || 0) + 1;
      });

      Object.keys(this.requestedCounts).forEach((type) => {
        const requested = this.requestedCounts[type];
        const actual = actualCounts[type] || 0;
        if (actual < requested) {
          console.warn(
            `[HierarchicalPacker]   ${type}: ${actual}/${requested} (${((actual / requested) * 100).toFixed(0)}%)`,
          );
        }
      });
    }

    // Optional: Lloyd relaxation for refinement
    if (this.circles.length > 0) {
      this.applyLloydRelaxation(2); // 2 iterations to avoid introducing overlaps
    }

    // Final collision resolution pass (critical for dense packing)
    this.finalCollisionResolution();

    // Space-filling optimization: Try to add more plants (largest to smallest)
    this.spaceFillOptimization();

    // Final cleanup: Ensure all plants respect bed shape bounds
    this.finalBoundsCleanup();

    return this.buildResult();
  }

  /**
   * Level 1: Create cluster meta-circles for each plant type
   * Cluster radius is calculated from total area of member circles
   */
  createClusters(plantGroups) {
    this.clusters = plantGroups.map((group, index) => {
      // Calculate total area needed for this group
      const totalArea = group.plants.reduce((sum, plant) => {
        return sum + Math.PI * plant.radius * plant.radius;
      }, 0);

      // Cluster radius from area (with packing efficiency factor ~0.7)
      const packingEfficiency = 0.65; // Realistic packing density
      const clusterRadius = Math.sqrt(
        totalArea / (Math.PI * packingEfficiency),
      );

      // Clusters may overflow bed bounds - plants will be clamped during placement

      // Initialize cluster position (random, clusters may overflow - plants will be clamped)
      let x, y;

      // Generate position within bed area (clusters may extend beyond, plants will be bounded)
      if (this.shape === "circle") {
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const maxRadius = (Math.min(this.width, this.height) / 2) * 0.8; // Allow some overflow
        const angle = this.random() * Math.PI * 2;
        const r = Math.sqrt(this.random()) * maxRadius;
        x = centerX + r * Math.cos(angle);
        y = centerY + r * Math.sin(angle);
      } else {
        // Rectangle and rounded shapes - place clusters anywhere in bed
        // Add small margin to encourage central placement
        const margin = 10;
        x = margin + this.random() * (this.width - 2 * margin);
        y = margin + this.random() * (this.height - 2 * margin);
      }

      return {
        id: `cluster_${index}`,
        type: group.type,
        x,
        y,
        radius: clusterRadius,
        plants: group.plants,
        companions: group.companions || [],
        antagonists: group.antagonists || [],
        vx: 0, // velocity
        vy: 0,
        fx: 0, // force accumulator
        fy: 0,
      };
    });
  }

  /**
   * Level 1: Pack cluster meta-circles using force-directed layout
   * Applies inter-cluster forces until convergence
   */
  packClusters() {
    let iteration = 0;
    let prevEnergy = Infinity;

    while (iteration < this.max_iterations) {
      // Reset force accumulators
      for (const cluster of this.clusters) {
        cluster.fx = 0;
        cluster.fy = 0;
      }

      // Apply forces between clusters
      this.applyClusterCollisionForces();
      this.applyClusterCompanionForces();
      this.applyClusterBoundaryForces();

      // Update positions using velocity Verlet integration
      this.updateClusterPositions();

      // Calculate system energy
      const energy = this.calculateClusterEnergy();

      // Check convergence
      if (Math.abs(energy - prevEnergy) < this.convergence_threshold) {
        this.converged = true;
        console.log(
          `[HierarchicalPacker] Cluster packing converged at iteration ${iteration}`,
        );
        break;
      }

      prevEnergy = energy;
      iteration++;
    }

    this.iteration_count = iteration;

    if (!this.converged) {
      console.log(
        `[HierarchicalPacker] Cluster packing reached max iterations (${iteration})`,
      );
    }
  }

  /**
   * Apply collision/separation forces between overlapping clusters
   */
  applyClusterCollisionForces() {
    for (let i = 0; i < this.clusters.length; i++) {
      for (let j = i + 1; j < this.clusters.length; j++) {
        const c1 = this.clusters[i];
        const c2 = this.clusters[j];

        const dx = c2.x - c1.x;
        const dy = c2.y - c1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = c1.radius + c2.radius + this.cluster_padding;

        // Only apply force if overlapping or too close
        if (distance < minDistance && distance > 0.01) {
          const overlap = minDistance - distance;
          // Stronger force for clusters (exponential for severe overlaps)
          const force =
            overlap * this.collision_strength * (1 + overlap / minDistance);

          // Normalize direction
          const nx = dx / distance;
          const ny = dy / distance;

          // Apply equal and opposite forces
          c1.fx -= nx * force;
          c1.fy -= ny * force;
          c2.fx += nx * force;
          c2.fy += ny * force;
        }
      }
    }
  }

  /**
   * Apply attraction/repulsion based on companion relationships
   */
  applyClusterCompanionForces() {
    for (let i = 0; i < this.clusters.length; i++) {
      for (let j = i + 1; j < this.clusters.length; j++) {
        const c1 = this.clusters[i];
        const c2 = this.clusters[j];

        const dx = c2.x - c1.x;
        const dy = c2.y - c1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 0.01) continue;

        // Check companion relationships
        const isCompanion =
          c1.companions.includes(c2.type) || c2.companions.includes(c1.type);
        const isAntagonist =
          c1.antagonists.includes(c2.type) || c2.antagonists.includes(c1.type);

        if (isCompanion) {
          // Weak attraction force (bring companions closer)
          const force = distance * 0.01 * this.intra_group_attraction;
          const nx = dx / distance;
          const ny = dy / distance;

          c1.fx += nx * force;
          c1.fy += ny * force;
          c2.fx -= nx * force;
          c2.fy -= ny * force;
        } else if (isAntagonist) {
          // Stronger repulsion (push antagonists apart)
          const minDistance = c1.radius + c2.radius + this.cluster_padding * 3;
          if (distance < minDistance) {
            const force = (minDistance - distance) * this.inter_group_repulsion;
            const nx = dx / distance;
            const ny = dy / distance;

            c1.fx -= nx * force;
            c1.fy -= ny * force;
            c2.fx += nx * force;
            c2.fy += ny * force;
          }
        }
      }
    }
  }

  /**
   * Apply gentle boundary containment forces to keep clusters reasonably centered
   * Clusters may overflow, but gentle forces improve initial packing quality
   */
  applyClusterBoundaryForces() {
    for (const cluster of this.clusters) {
      // Very gentle boundary forces - encourage central placement without hard limits
      const softMargin = Math.min(this.width, this.height) * 0.1; // 10% margin zone
      const gentleForce = this.boundary_force * 0.3; // Much weaker than plants

      if (this.shape === "circle") {
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const maxRadius = Math.min(this.width, this.height) / 2;

        const dx = cluster.x - centerX;
        const dy = cluster.y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Only apply force when far from center
        if (distance > maxRadius - softMargin) {
          const force = (distance - (maxRadius - softMargin)) * gentleForce;
          const nx = dx / distance;
          const ny = dy / distance;
          cluster.fx -= nx * force;
          cluster.fy -= ny * force;
        }
      } else {
        // Gentle forces near edges
        if (cluster.x < softMargin) {
          cluster.fx += (softMargin - cluster.x) * gentleForce;
        }
        if (cluster.x > this.width - softMargin) {
          cluster.fx -= (cluster.x - (this.width - softMargin)) * gentleForce;
        }
        if (cluster.y < softMargin) {
          cluster.fy += (softMargin - cluster.y) * gentleForce;
        }
        if (cluster.y > this.height - softMargin) {
          cluster.fy -= (cluster.y - (this.height - softMargin)) * gentleForce;
        }
      }
    }
  }

  /**
   * Update cluster positions using velocity Verlet integration
   */
  updateClusterPositions() {
    for (const cluster of this.clusters) {
      // Update velocity with damping
      cluster.vx = (cluster.vx + cluster.fx) * this.damping;
      cluster.vy = (cluster.vy + cluster.fy) * this.damping;

      // Update position
      cluster.x += cluster.vx;
      cluster.y += cluster.vy;

      // No hard boundary enforcement for clusters - they may overflow
      // Plants will be bounded during updatePlantPositions()
    }
  }

  /**
   * Calculate total system energy (sum of kinetic + potential)
   */
  calculateClusterEnergy() {
    let energy = 0;

    for (const cluster of this.clusters) {
      // Kinetic energy
      energy += 0.5 * (cluster.vx * cluster.vx + cluster.vy * cluster.vy);

      // Boundary potential
      const margin = cluster.radius;
      if (cluster.x < margin) energy += Math.pow(margin - cluster.x, 2);
      if (cluster.x > this.width - margin)
        energy += Math.pow(cluster.x - (this.width - margin), 2);
      if (cluster.y < margin) energy += Math.pow(margin - cluster.y, 2);
      if (cluster.y > this.height - margin)
        energy += Math.pow(cluster.y - (this.height - margin), 2);
    }

    return energy;
  }

  /**
   * Level 2: Pack individual plants within their assigned cluster boundaries
   */
  packPlantsInClusters(plantGroups) {
    this.circles = [];

    for (const cluster of this.clusters) {
      // Sort plants by priority (high to low) and size (large to small)
      const sortedPlants = [...cluster.plants].sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return b.radius - a.radius;
      });

      // Initialize plant circles near cluster centroid
      const plantCircles = sortedPlants.map((plant, index) => {
        // Spiral initialization pattern (better than pure random)
        const angle = index * 2.4; // Golden angle approximation
        const distance = Math.sqrt(index) * 3;
        const x = cluster.x + Math.cos(angle) * distance;
        const y = cluster.y + Math.sin(angle) * distance;

        return {
          id: plant.id || `plant_${this.circles.length + index}`,
          clusterId: cluster.id,
          clusterType: cluster.type,
          veggieType: plant.veggieType || cluster.type,
          varietyName: plant.varietyName,
          x,
          y,
          radius: plant.radius,
          priority: plant.priority,
          vx: 0,
          vy: 0,
          fx: 0,
          fy: 0,
          meta: plant.meta || {},
          originalSpacing: plant.radius * 2, // Store original diameter for visual display
        };
      });

      // Run force simulation for this cluster
      this.packPlantsInCluster(cluster, plantCircles);

      // Add successfully packed plants to global list
      this.circles.push(...plantCircles);
    }
  }

  /**
   * Pack plants within a single cluster using force-directed layout
   */
  packPlantsInCluster(cluster, plantCircles) {
    const maxIterations = 500; // Increased from 300
    let iteration = 0;
    let prevEnergy = Infinity;

    while (iteration < maxIterations) {
      // Reset force accumulators
      for (const circle of plantCircles) {
        circle.fx = 0;
        circle.fy = 0;
      }

      // Apply forces
      this.applyPlantCollisionForces(plantCircles);
      this.applyClusterAttractionForce(cluster, plantCircles);
      this.applyClusterBoundaryForces_Plants(cluster, plantCircles);

      // Update positions
      this.updatePlantPositions(plantCircles);

      // Calculate energy
      const energy = this.calculatePlantEnergy(plantCircles);

      // Check convergence (stricter threshold for plants)
      if (Math.abs(energy - prevEnergy) < this.convergence_threshold * 0.05) {
        break;
      }

      prevEnergy = energy;
      iteration++;
    }

    // Final collision resolution for this cluster
    this.resolveClusterCollisions(plantCircles);
  }

  /**
   * Resolve collisions within a cluster
   */
  resolveClusterCollisions(plantCircles) {
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < plantCircles.length; i++) {
        for (let j = i + 1; j < plantCircles.length; j++) {
          const p1 = plantCircles[i];
          const p2 = plantCircles[j];

          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const minDistance = p1.radius + p2.radius + this.min_spacing;

          if (distance < minDistance && distance > 0.01) {
            const overlap = (minDistance - distance) / 2;
            const nx = dx / distance;
            const ny = dy / distance;

            p1.x -= nx * overlap;
            p1.y -= ny * overlap;
            p2.x += nx * overlap;
            p2.y += ny * overlap;

            // Clamp to bounds
            p1.x = Math.max(p1.radius, Math.min(this.width - p1.radius, p1.x));
            p1.y = Math.max(p1.radius, Math.min(this.height - p1.radius, p1.y));
            p2.x = Math.max(p2.radius, Math.min(this.width - p2.radius, p2.x));
            p2.y = Math.max(p2.radius, Math.min(this.height - p2.radius, p2.y));
          }
        }
      }
    }
  }

  /**
   * Apply collision forces between plants in the same cluster
   */
  applyPlantCollisionForces(plantCircles) {
    for (let i = 0; i < plantCircles.length; i++) {
      for (let j = i + 1; j < plantCircles.length; j++) {
        const p1 = plantCircles[i];
        const p2 = plantCircles[j];

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = p1.radius + p2.radius + this.min_spacing;

        if (distance < minDistance && distance > 0.01) {
          const overlap = minDistance - distance;
          // Much stronger force for plants, exponential scaling
          const force =
            overlap *
            this.collision_strength *
            2.0 *
            (1 + overlap / minDistance);

          const nx = dx / distance;
          const ny = dy / distance;

          // Priority-weighted collision (higher priority plants "win")
          const weight1 = p1.priority / (p1.priority + p2.priority);
          const weight2 = p2.priority / (p1.priority + p2.priority);

          p1.fx -= nx * force * weight2;
          p1.fy -= ny * force * weight2;
          p2.fx += nx * force * weight1;
          p2.fy += ny * force * weight1;
        }
      }
    }
  }

  /**
   * Apply attraction force toward cluster centroid
   * Keeps plants within their assigned cluster
   */
  applyClusterAttractionForce(cluster, plantCircles) {
    for (const plant of plantCircles) {
      const dx = cluster.x - plant.x;
      const dy = cluster.y - plant.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 0.01) continue;

      // Weak spring force toward cluster center
      const force = distance * 0.02 * this.intra_group_attraction;
      const nx = dx / distance;
      const ny = dy / distance;

      plant.fx += nx * force;
      plant.fy += ny * force;
    }
  }

  /**
   * Keep plants within cluster boundary
   */
  applyClusterBoundaryForces_Plants(cluster, plantCircles) {
    for (const plant of plantCircles) {
      const dx = plant.x - cluster.x;
      const dy = plant.y - cluster.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxDistance = cluster.radius - plant.radius;

      // Push inward if exceeding cluster boundary
      if (distance > maxDistance && distance > 0.01) {
        const force = (distance - maxDistance) * this.boundary_force;
        const nx = dx / distance;
        const ny = dy / distance;

        plant.fx -= nx * force;
        plant.fy -= ny * force;
      }
    }
  }

  /**
   * Check if a circle (plant) is fully inside the bed shape
   * @param {number} x - Circle center x
   * @param {number} y - Circle center y
   * @param {number} radius - Circle radius
   * @returns {boolean} - True if circle is fully inside
   */
  isCircleInsideBed(x, y, radius) {
    if (this.shape === "circle") {
      const centerX = this.width / 2;
      const centerY = this.height / 2;
      const bedRadius = Math.min(this.width, this.height) / 2;
      const dx = x - centerX;
      const dy = y - centerY;
      const distanceToCenter = Math.sqrt(dx * dx + dy * dy);
      return distanceToCenter + radius <= bedRadius;
    } else if (this.shape === "pill") {
      // Pill shape is a stadium: rectangle with semicircular caps
      // Determine orientation based on dimensions
      if (this.width >= this.height) {
        // Horizontal pill
        const capRadius = this.height / 2;
        const leftCapCenterX = capRadius;
        const rightCapCenterX = this.width - capRadius;
        const capCenterY = this.height / 2;

        // Check if in middle rectangle region
        if (x >= leftCapCenterX && x <= rightCapCenterX) {
          return y - radius >= 0 && y + radius <= this.height;
        }
        // Check if in left cap
        else if (x < leftCapCenterX) {
          const dx = x - leftCapCenterX;
          const dy = y - capCenterY;
          const distanceToCenter = Math.sqrt(dx * dx + dy * dy);
          return distanceToCenter + radius <= capRadius;
        }
        // Check if in right cap
        else {
          const dx = x - rightCapCenterX;
          const dy = y - capCenterY;
          const distanceToCenter = Math.sqrt(dx * dx + dy * dy);
          return distanceToCenter + radius <= capRadius;
        }
      } else {
        // Vertical pill
        const capRadius = this.width / 2;
        const topCapCenterY = capRadius;
        const bottomCapCenterY = this.height - capRadius;
        const capCenterX = this.width / 2;

        // Check if in middle rectangle region
        if (y >= topCapCenterY && y <= bottomCapCenterY) {
          return x - radius >= 0 && x + radius <= this.width;
        }
        // Check if in top cap
        else if (y < topCapCenterY) {
          const dx = x - capCenterX;
          const dy = y - topCapCenterY;
          const distanceToCenter = Math.sqrt(dx * dx + dy * dy);
          return distanceToCenter + radius <= capRadius;
        }
        // Check if in bottom cap
        else {
          const dx = x - capCenterX;
          const dy = y - bottomCapCenterY;
          const distanceToCenter = Math.sqrt(dx * dx + dy * dy);
          return distanceToCenter + radius <= capRadius;
        }
      }
    } else {
      // Rectangle
      return (
        x - radius >= 0 &&
        x + radius <= this.width &&
        y - radius >= 0 &&
        y + radius <= this.height
      );
    }
  }

  /**
   * Clamp a circle position to be inside the bed shape
   * @param {number} x - Current x position
   * @param {number} y - Current y position
   * @param {number} radius - Circle radius
   * @returns {{x: number, y: number}} - Clamped position
   */
  clampPositionToBed(x, y, radius) {
    if (this.shape === "circle") {
      const centerX = this.width / 2;
      const centerY = this.height / 2;
      const maxRadius = Math.min(this.width, this.height) / 2 - radius;

      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > maxRadius) {
        const scale = maxRadius / distance;
        return {
          x: centerX + dx * scale,
          y: centerY + dy * scale,
        };
      }
      return { x, y };
    } else if (this.shape === "pill") {
      // Pill shape - clamp to stadium geometry
      if (this.width >= this.height) {
        // Horizontal pill
        const capRadius = this.height / 2;
        const leftCapCenterX = capRadius;
        const rightCapCenterX = this.width - capRadius;
        const capCenterY = this.height / 2;

        // Middle rectangle region
        if (x >= leftCapCenterX && x <= rightCapCenterX) {
          return {
            x: Math.max(radius, Math.min(this.width - radius, x)),
            y: Math.max(radius, Math.min(this.height - radius, y)),
          };
        }
        // Left cap
        else if (x < leftCapCenterX) {
          const dx = x - leftCapCenterX;
          const dy = y - capCenterY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const maxDist = capRadius - radius;

          if (distance > maxDist) {
            const scale = maxDist / distance;
            return {
              x: leftCapCenterX + dx * scale,
              y: capCenterY + dy * scale,
            };
          }
          return { x, y };
        }
        // Right cap
        else {
          const dx = x - rightCapCenterX;
          const dy = y - capCenterY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const maxDist = capRadius - radius;

          if (distance > maxDist) {
            const scale = maxDist / distance;
            return {
              x: rightCapCenterX + dx * scale,
              y: capCenterY + dy * scale,
            };
          }
          return { x, y };
        }
      } else {
        // Vertical pill
        const capRadius = this.width / 2;
        const topCapCenterY = capRadius;
        const bottomCapCenterY = this.height - capRadius;
        const capCenterX = this.width / 2;

        // Middle rectangle region
        if (y >= topCapCenterY && y <= bottomCapCenterY) {
          return {
            x: Math.max(radius, Math.min(this.width - radius, x)),
            y: Math.max(radius, Math.min(this.height - radius, y)),
          };
        }
        // Top cap
        else if (y < topCapCenterY) {
          const dx = x - capCenterX;
          const dy = y - topCapCenterY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const maxDist = capRadius - radius;

          if (distance > maxDist) {
            const scale = maxDist / distance;
            return {
              x: capCenterX + dx * scale,
              y: topCapCenterY + dy * scale,
            };
          }
          return { x, y };
        }
        // Bottom cap
        else {
          const dx = x - capCenterX;
          const dy = y - bottomCapCenterY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const maxDist = capRadius - radius;

          if (distance > maxDist) {
            const scale = maxDist / distance;
            return {
              x: capCenterX + dx * scale,
              y: bottomCapCenterY + dy * scale,
            };
          }
          return { x, y };
        }
      }
    } else {
      // Rectangle
      return {
        x: Math.max(radius, Math.min(this.width - radius, x)),
        y: Math.max(radius, Math.min(this.height - radius, y)),
      };
    }
  }

  /**
   * Update plant positions with velocity damping
   */
  updatePlantPositions(plantCircles) {
    for (const plant of plantCircles) {
      plant.vx = (plant.vx + plant.fx) * this.damping;
      plant.vy = (plant.vy + plant.fy) * this.damping;

      plant.x += plant.vx;
      plant.y += plant.vy;

      // Clamp to bed bounds (shape-aware)
      const clamped = this.clampPositionToBed(plant.x, plant.y, plant.radius);
      plant.x = clamped.x;
      plant.y = clamped.y;
    }
  }

  /**
   * Calculate energy for plant circles
   */
  calculatePlantEnergy(plantCircles) {
    let energy = 0;
    for (const plant of plantCircles) {
      energy += 0.5 * (plant.vx * plant.vx + plant.vy * plant.vy);
    }
    return energy;
  }

  /**
   * Apply Lloyd relaxation for uniform distribution refinement
   * Moves each circle toward the centroid of its Voronoi cell
   *
   * Based on Bridson (2007) and Lloyd's algorithm
   * Modified to be more conservative to prevent introducing overlaps
   */
  applyLloydRelaxation(iterations = 2) {
    console.log(
      `[HierarchicalPacker] Applying Lloyd relaxation (${iterations} iterations)`,
    );

    for (let iter = 0; iter < iterations; iter++) {
      // For each circle, compute centroid of its influence region
      for (const circle of this.circles) {
        const neighbors = this.findNeighbors(circle, 30); // 30" radius

        if (neighbors.length === 0) continue;

        // Calculate weighted centroid (Voronoi approximation)
        let cx = 0;
        let cy = 0;
        let totalWeight = 0;

        for (const neighbor of neighbors) {
          const dx = neighbor.x - circle.x;
          const dy = neighbor.y - circle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 0.01) continue;

          // Weight by inverse distance
          const weight = 1 / distance;
          cx += neighbor.x * weight;
          cy += neighbor.y * weight;
          totalWeight += weight;
        }

        if (totalWeight > 0) {
          cx /= totalWeight;
          cy /= totalWeight;

          // Move toward centroid (very small step to avoid introducing overlaps)
          const moveFactor = 0.15; // Reduced from 0.3
          circle.x += (cx - circle.x) * moveFactor;
          circle.y += (cy - circle.y) * moveFactor;

          // Ensure bounds (shape-aware)
          const clamped = this.clampPositionToBed(
            circle.x,
            circle.y,
            circle.radius,
          );
          circle.x = clamped.x;
          circle.y = clamped.y;
        }
      }

      // Resolve any collisions introduced by Lloyd moves (multiple passes)
      for (let pass = 0; pass < 3; pass++) {
        this.resolveAllCollisions();
      }
    }
  }

  /**
   * Find neighboring circles within a given radius
   */
  findNeighbors(circle, radius) {
    return this.circles.filter((other) => {
      if (other === circle) return false;
      const dx = other.x - circle.x;
      const dy = other.y - circle.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance < radius;
    });
  }

  /**
   * Resolve all collisions using position-based dynamics
   * Quick collision resolution pass after Lloyd relaxation
   */
  resolveAllCollisions() {
    for (let i = 0; i < this.circles.length; i++) {
      for (let j = i + 1; j < this.circles.length; j++) {
        const c1 = this.circles[i];
        const c2 = this.circles[j];

        const dx = c2.x - c1.x;
        const dy = c2.y - c1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = c1.radius + c2.radius + this.min_spacing;

        if (distance < minDistance && distance > 0.01) {
          const overlap = (minDistance - distance) / 2;
          const nx = dx / distance;
          const ny = dy / distance;

          c1.x -= nx * overlap;
          c1.y -= ny * overlap;
          c2.x += nx * overlap;
          c2.y += ny * overlap;
        }
      }
    }
  }

  /**
   * Final aggressive collision resolution pass
   * If force simulation fails, falls back to greedy non-overlapping placement
   */
  finalCollisionResolution() {
    console.log("[HierarchicalPacker] Running final collision resolution...");

    let maxIterations = 100;
    let iteration = 0;
    let collisionCount = 0;

    while (iteration < maxIterations) {
      collisionCount = 0;

      for (let i = 0; i < this.circles.length; i++) {
        for (let j = i + 1; j < this.circles.length; j++) {
          const c1 = this.circles[i];
          const c2 = this.circles[j];

          const dx = c2.x - c1.x;
          const dy = c2.y - c1.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const minDistance = c1.radius + c2.radius + this.min_spacing;

          if (distance < minDistance - 0.01 && distance > 0.01) {
            collisionCount++;

            const overlap = (minDistance - distance) * 1.1;
            const nx = dx / distance;
            const ny = dy / distance;

            const weight1 = c1.priority / (c1.priority + c2.priority);
            const weight2 = c2.priority / (c1.priority + c2.priority);

            c1.x -= nx * overlap * weight2;
            c1.y -= ny * overlap * weight2;
            c2.x += nx * overlap * weight1;
            c2.y += ny * overlap * weight1;

            c1.x = Math.max(c1.radius, Math.min(this.width - c1.radius, c1.x));
            c1.y = Math.max(c1.radius, Math.min(this.height - c1.radius, c1.y));
            c2.x = Math.max(c2.radius, Math.min(this.width - c2.radius, c2.x));
            c2.y = Math.max(c2.radius, Math.min(this.height - c2.radius, c2.y));
          }
        }
      }

      if (collisionCount === 0) {
        console.log(
          `[HierarchicalPacker] Collision resolution complete (${iteration} iterations)`,
        );
        break;
      }

      iteration++;
    }

    // If still have severe collisions, use greedy fallback
    if (collisionCount > this.circles.length * 0.1) {
      console.warn(
        `[HierarchicalPacker] ${collisionCount} collisions remain - using greedy fallback`,
      );
      this.greedyNonOverlappingFallback();
    } else if (collisionCount > 0) {
      console.warn(
        `[HierarchicalPacker] ${collisionCount} minor collisions remain (acceptable)`,
      );
    }
  }

  /**
   * Greedy non-overlapping fallback placement
   * Guarantees zero overlaps by trying positions until one fits
   */
  greedyNonOverlappingFallback() {
    console.log(
      "[HierarchicalPacker] Applying greedy non-overlapping placement...",
    );

    // Sort circles by priority (high first) then size (large first)
    const sortedCircles = [...this.circles].sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return b.radius - a.radius;
    });

    const placed = [];
    const failed = [];

    for (const circle of sortedCircles) {
      // Try to place near its cluster centroid first
      const cluster = this.clusters.find((c) => c.id === circle.clusterId);
      const targetX = cluster ? cluster.x : this.width / 2;
      const targetY = cluster ? cluster.y : this.height / 2;

      let bestPosition = null;
      let bestDistance = Infinity;

      // Try positions in expanding spiral around target
      const maxAttempts = 500;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const angle = attempt * 2.4; // Golden angle
        const distance = Math.sqrt(attempt) * 3;
        const x = targetX + Math.cos(angle) * distance;
        const y = targetY + Math.sin(angle) * distance;

        // Check bounds (shape-aware)
        if (!this.isWithinBounds(x, y, circle.radius)) {
          continue;
        }

        // Check collisions with placed circles
        let hasCollision = false;
        for (const other of placed) {
          const dx = other.x - x;
          const dy = other.y - y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = circle.radius + other.radius + this.min_spacing;
          if (dist < minDist) {
            hasCollision = true;
            break;
          }
        }

        if (!hasCollision) {
          const distFromTarget = Math.sqrt(
            (x - targetX) ** 2 + (y - targetY) ** 2,
          );
          if (distFromTarget < bestDistance) {
            bestPosition = { x, y };
            bestDistance = distFromTarget;
            if (distFromTarget < circle.radius * 2) break; // Good enough
          }
        }
      }

      if (bestPosition) {
        circle.x = bestPosition.x;
        circle.y = bestPosition.y;
        placed.push(circle);
      } else {
        failed.push(circle);
      }
    }

    // Update circles list to only include successfully placed
    this.circles = placed;

    if (failed.length > 0) {
      console.warn(
        `[HierarchicalPacker] Greedy fallback: ${placed.length} placed, ${failed.length} failed to fit`,
      );

      // Emergency recovery: If we placed zero plants, try with much larger search
      if (placed.length === 0 && failed.length > 0) {
        console.warn(
          `[HierarchicalPacker] CRITICAL: Zero plants placed. Attempting emergency recovery...`,
        );
        this.emergencyRecoveryPlacement(failed);
      }
    } else {
      console.log(
        `[HierarchicalPacker] Greedy fallback: All ${placed.length} plants placed with zero overlaps`,
      );
    }
  }

  /**
   * Emergency recovery when greedy fallback fails completely
   * Uses much larger search area and more lenient spacing
   */
  emergencyRecoveryPlacement(failedPlants) {
    const placed = [];

    // Sort by priority and size
    const sortedPlants = failedPlants.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return b.radius - a.radius;
    });

    for (const plant of sortedPlants) {
      let bestPosition = null;
      let bestDistance = Infinity;

      // Try grid-based placement with much larger search
      const gridSize = 5;
      const maxAttempts = 2000; // Much more attempts

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // Use larger spiral and random jitter
        const angle = attempt * 2.4;
        const distance = Math.sqrt(attempt) * 4; // Larger spiral
        const jitterX = (this.random() - 0.5) * 10;
        const jitterY = (this.random() - 0.5) * 10;
        const x = this.width / 2 + Math.cos(angle) * distance + jitterX;
        const y = this.height / 2 + Math.sin(angle) * distance + jitterY;

        // Check bounds
        if (!this.isWithinBounds(x, y, plant.radius)) {
          continue;
        }

        // Check collisions with more lenient spacing
        let hasCollision = false;
        const lenientSpacing = Math.max(0.5, this.min_spacing * 0.5);

        for (const other of placed) {
          const dx = other.x - x;
          const dy = other.y - y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = plant.radius + other.radius + lenientSpacing;
          if (dist < minDist) {
            hasCollision = true;
            break;
          }
        }

        if (!hasCollision) {
          bestPosition = { x, y };
          break;
        }
      }

      if (bestPosition) {
        plant.x = bestPosition.x;
        plant.y = bestPosition.y;
        placed.push(plant);
      }
    }

    this.circles = placed;
    console.warn(
      `[HierarchicalPacker] Emergency recovery placed ${placed.length}/${failedPlants.length} plants`,
    );
  }

  /**
   * Multipass ratio-balancing optimization with space-first approach
   * Phase 1: Fill available space as much as possible
   * Phase 2: Balance ratios intelligently based on physical constraints
   */
  spaceFillOptimization() {
    if (!this.plantGroups || this.plantGroups.length === 0) {
      return;
    }

    console.log(
      "[HierarchicalPacker] Starting space-first optimization with ratio balancing...",
    );

    const initialCount = this.circles.length;

    // Calculate target ratios based on priority weights
    const totalPriority = this.plantGroups.reduce(
      (sum, g) => sum + (g.plants[0]?.priority || 1),
      0,
    );
    const targetRatios = new Map();

    this.plantGroups.forEach((group) => {
      const priority = group.plants[0]?.priority || 1;
      targetRatios.set(group.type, priority / totalPriority);
    });

    console.log("[HierarchicalPacker] Target ratios:");
    targetRatios.forEach((ratio, type) => {
      console.log(
        `[HierarchicalPacker]   ${type}: ${(ratio * 100).toFixed(1)}%`,
      );
    });

    // Phase 1: Aggressively fill space (largest to smallest)
    const spaceFilled = this.aggressiveSpaceFilling(targetRatios);

    // Phase 2: Smart ratio balancing (respects physical constraints)
    this.intelligentRatioBalance(targetRatios, spaceFilled);

    const addedTotal = this.circles.length - initialCount;
    if (addedTotal > 0) {
      console.log(
        `[HierarchicalPacker] Optimization complete: added ${addedTotal} plant(s) (${initialCount} → ${this.circles.length})`,
      );
    } else {
      console.log(
        "[HierarchicalPacker] Optimization complete: distribution balanced",
      );
    }

    // Log final distribution
    const finalCounts = new Map();
    this.circles.forEach((c) => {
      finalCounts.set(c.veggieType, (finalCounts.get(c.veggieType) || 0) + 1);
    });

    console.log("[HierarchicalPacker] Final distribution:");
    finalCounts.forEach((count, type) => {
      const ratio = count / this.circles.length;
      const target = targetRatios.get(type) || 0;
      const deviation = ((ratio - target) * 100).toFixed(1);
      console.log(
        `[HierarchicalPacker]   ${type}: ${count} plants (${(ratio * 100).toFixed(1)}%, target ${(target * 100).toFixed(1)}%, ${deviation > 0 ? "+" : ""}${deviation}%)`,
      );
    });
  }

  /**
   * Aggressively fill available space with all plant types
   * Prioritizes larger plants for better space efficiency
   */
  aggressiveSpaceFilling(targetRatios) {
    const maxRounds = 30; // Much more rounds for better filling
    let totalAdded = 0;

    for (let round = 0; round < maxRounds; round++) {
      let addedInRound = 0;

      // Sort plant types by size (largest first) for each round
      const typesBySize = this.plantGroups
        .map((group) => ({
          group,
          type: group.type,
          avgRadius:
            group.plants.reduce((sum, p) => sum + p.radius, 0) /
            group.plants.length,
          currentCount: this.circles.filter((c) => c.veggieType === group.type)
            .length,
        }))
        .sort((a, b) => b.avgRadius - a.avgRadius);

      // Try to add one plant of each type per round (allows all types to succeed across rounds)
      for (const { group, type } of typesBySize) {
        const added = this.tryAddPlant(group);
        if (added) {
          addedInRound++;
          totalAdded++;
        }
      }

      if (addedInRound === 0) {
        console.log(
          `[HierarchicalPacker] Space-filling complete after ${round} rounds (added ${totalAdded} plants)`,
        );
        break;
      } else {
        console.log(
          `[HierarchicalPacker]   Round ${round + 1}: added ${addedInRound} plant(s)`,
        );
      }
    }

    return totalAdded;
  }

  /**
   * Intelligently balance ratios after space-filling
   * Only removes plants if ratios are severely imbalanced (>25% deviation)
   * Prefers adding underrepresented plants over removing overrepresented ones
   */
  intelligentRatioBalance(targetRatios, spaceFilled) {
    if (spaceFilled === 0) {
      // If no space-filling happened, do traditional balancing
      this.balanceToTargetRatios(targetRatios);
      return;
    }

    console.log("[HierarchicalPacker] Applying intelligent ratio balancing...");

    const currentCounts = new Map();
    this.circles.forEach((c) => {
      currentCounts.set(
        c.veggieType,
        (currentCounts.get(c.veggieType) || 0) + 1,
      );
    });

    const total = this.circles.length;

    // Calculate deviations
    const deviations = [];
    targetRatios.forEach((target, type) => {
      const current = (currentCounts.get(type) || 0) / total;
      const deviation = Math.abs(current - target);
      deviations.push({ type, target, current, deviation });
    });

    // Only rebalance if there's severe imbalance (>25% off target)
    const maxDeviation = Math.max(...deviations.map((d) => d.deviation));

    if (maxDeviation < 0.25) {
      console.log(
        `[HierarchicalPacker] Ratios acceptable (max deviation ${(maxDeviation * 100).toFixed(1)}%), keeping space-optimized layout`,
      );
      return;
    }

    console.log(
      `[HierarchicalPacker] Severe imbalance detected (${(maxDeviation * 100).toFixed(1)}% deviation), attempting gentle rebalancing...`,
    );

    // Try to add more underrepresented plants (max 5 additions)
    const underrepresented = deviations
      .filter((d) => d.current < d.target)
      .sort((a, b) => b.target - b.current - (a.target - a.current));

    let rebalanced = 0;
    for (const { type } of underrepresented) {
      if (rebalanced >= 5) break;

      const group = this.plantGroups.find((g) => g.type === type);
      if (group && this.tryAddPlant(group)) {
        console.log(
          `[HierarchicalPacker]   Added 1 ${type} (underrepresented)`,
        );
        rebalanced++;
      }
    }

    if (rebalanced > 0) {
      console.log(
        `[HierarchicalPacker] Gentle rebalancing complete: added ${rebalanced} plant(s)`,
      );
    }
  }

  /**
   * Balance existing plant distribution to match target ratios
   * Traditional approach - used when space-filling didn't occur
   */
  balanceToTargetRatios(targetRatios) {
    const maxBalanceIterations = 20;
    let iteration = 0;

    while (iteration < maxBalanceIterations) {
      // Calculate current ratios
      const currentCounts = new Map();
      this.circles.forEach((c) => {
        currentCounts.set(
          c.veggieType,
          (currentCounts.get(c.veggieType) || 0) + 1,
        );
      });

      const total = this.circles.length;
      const currentRatios = new Map();
      currentCounts.forEach((count, type) => {
        currentRatios.set(type, count / total);
      });

      // Find most underrepresented type (furthest below target)
      let maxDeficit = 0;
      let underrepType = null;

      targetRatios.forEach((target, type) => {
        const current = currentRatios.get(type) || 0;
        const deficit = target - current;
        if (deficit > maxDeficit) {
          maxDeficit = deficit;
          underrepType = type;
        }
      });

      // If no significant deficit, we're balanced
      if (maxDeficit < 0.05) {
        // Within 5% is acceptable for traditional balancing
        console.log(
          `[HierarchicalPacker] Distribution balanced after ${iteration} iterations`,
        );
        break;
      }

      // Try to add one plant of the underrepresented type
      const group = this.plantGroups.find((g) => g.type === underrepType);
      if (!group || group.plants.length === 0) {
        iteration++;
        continue;
      }

      const added = this.tryAddPlant(group);
      if (!added) {
        // Can't add more of this type - accept the distribution
        console.log(
          `[HierarchicalPacker] Cannot add more ${underrepType}, accepting current distribution`,
        );
        break;
      }

      iteration++;
    }
  }

  /**
   * Try to add one plant of the specified type
   * Returns true if successful, false otherwise
   */
  tryAddPlant(group) {
    const template = group.plants[0];
    const cluster = this.clusters.find((c) => c.type === group.type);
    if (!cluster) return false;

    let nextPlantId =
      Math.max(...this.circles.map((c) => parseInt(c.id) || 0), 0) + 1;

    const candidatePlant = {
      id: String(nextPlantId),
      veggieType: template.veggieType,
      varietyName: template.varietyName,
      radius: template.radius,
      priority: template.priority,
      clusterId: cluster.id,
      clusterType: cluster.type,
      meta: template.meta,
      originalSpacing: template.meta?.spacing || template.radius * 2,
      vx: 0,
      vy: 0,
      fx: 0,
      fy: 0,
    };

    const position = this.findSpaceForPlant(candidatePlant, cluster);
    if (position) {
      // Apply safety clamp to ensure position respects bed shape (especially pill bounds)
      const clamped = this.clampPositionToBed(
        position.x,
        position.y,
        candidatePlant.radius,
      );
      candidatePlant.x = clamped.x;
      candidatePlant.y = clamped.y;

      // Final verification that plant is within bounds
      if (
        !this.isCircleInsideBed(
          candidatePlant.x,
          candidatePlant.y,
          candidatePlant.radius,
        )
      ) {
        console.warn(
          `[HierarchicalPacker] Safety check failed: plant ${candidatePlant.id} would be outside bounds, skipping`,
        );
        return false;
      }

      this.circles.push(candidatePlant);
      return true;
    }
    return false;
  }

  /**
   * Remove one plant of the specified type (prefer edge plants)
   */
  removeOnePlant(type) {
    // Find plants of this type
    const plantsOfType = this.circles.filter((c) => c.veggieType === type);
    if (plantsOfType.length === 0) return;

    // Remove the one furthest from its cluster center (least well-placed)
    const plantsByDistance = plantsOfType.map((p) => {
      const cluster = this.clusters.find((c) => c.id === p.clusterId);
      const dx = p.x - (cluster?.x || this.width / 2);
      const dy = p.y - (cluster?.y || this.height / 2);
      return { plant: p, distance: Math.sqrt(dx * dx + dy * dy) };
    });

    plantsByDistance.sort((a, b) => b.distance - a.distance);
    const toRemove = plantsByDistance[0].plant;

    const index = this.circles.findIndex((c) => c.id === toRemove.id);
    if (index >= 0) {
      this.circles.splice(index, 1);
    }
  }

  /**
   * Find a valid position for a new plant in remaining space
   * Returns {x, y} if found, null otherwise
   */
  findSpaceForPlant(plant, cluster) {
    const targetX = cluster.x;
    const targetY = cluster.y;
    const maxAttempts = 800; // Much more attempts for better coverage

    let bestPosition = null;
    let bestDistance = Infinity;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let x, y;

      // Use multiple search strategies
      if (attempt < 400) {
        // Spiral pattern from cluster center
        const angle = attempt * 2.4; // Golden angle
        const distance = Math.sqrt(attempt) * 2.5;
        x = targetX + Math.cos(angle) * distance;
        y = targetY + Math.sin(angle) * distance;
      } else if (attempt < 600) {
        // Grid search across entire bed
        const gridAttempt = attempt - 400;
        const gridSize = 20;
        const gridX = gridAttempt % gridSize;
        const gridY = Math.floor(gridAttempt / gridSize);
        x = (gridX / gridSize) * this.width;
        y = (gridY / gridSize) * this.height;
      } else {
        // Random placement for remaining attempts
        x = plant.radius + this.random() * (this.width - 2 * plant.radius);
        y = plant.radius + this.random() * (this.height - 2 * plant.radius);
      }

      // Check bounds (shape-aware)
      if (!this.isWithinBounds(x, y, plant.radius)) {
        continue;
      }

      // Check collisions with all existing plants
      let hasCollision = false;
      const reducedSpacing = this.min_spacing * 0.8; // Slightly reduce spacing to allow denser packing

      for (const other of this.circles) {
        const dx = other.x - x;
        const dy = other.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = plant.radius + other.radius + reducedSpacing;

        if (dist < minDist) {
          hasCollision = true;
          break;
        }
      }

      if (!hasCollision) {
        const distFromTarget = Math.sqrt(
          (x - targetX) ** 2 + (y - targetY) ** 2,
        );
        if (distFromTarget < bestDistance) {
          bestPosition = { x, y };
          bestDistance = distFromTarget;

          // If we found a spot close to cluster center, use it immediately
          if (distFromTarget < plant.radius * 3) {
            return bestPosition;
          }
        }
      }
    }

    return bestPosition;
  }

  /**
   * Final cleanup pass to ensure all plants respect bed shape boundaries
   * This is critical for pill-shaped beds where plants may drift outside rounded edges
   */
  finalBoundsCleanup() {
    console.log("[HierarchicalPacker] Running final bounds cleanup...");

    let clamped = 0;
    let removed = 0;

    for (let i = this.circles.length - 1; i >= 0; i--) {
      const plant = this.circles[i];

      // Check if plant is outside bounds
      if (!this.isCircleInsideBed(plant.x, plant.y, plant.radius)) {
        // Try to clamp it to valid position
        const clampedPos = this.clampPositionToBed(
          plant.x,
          plant.y,
          plant.radius,
        );

        // Verify clamped position doesn't cause collisions
        let hasCollision = false;
        for (let j = 0; j < this.circles.length; j++) {
          if (i === j) continue;

          const other = this.circles[j];
          const dx = other.x - clampedPos.x;
          const dy = other.y - clampedPos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = plant.radius + other.radius + this.min_spacing;

          if (dist < minDist) {
            hasCollision = true;
            break;
          }
        }

        if (!hasCollision) {
          // Safe to clamp
          plant.x = clampedPos.x;
          plant.y = clampedPos.y;
          clamped++;
        } else {
          // Cannot clamp without collision - remove this plant
          console.warn(
            `[HierarchicalPacker] Removing plant ${plant.id} at (${plant.x.toFixed(1)}, ${plant.y.toFixed(1)}) - outside bounds and cannot clamp`,
          );
          this.circles.splice(i, 1);
          removed++;
        }
      }
    }

    if (clamped > 0 || removed > 0) {
      console.log(
        `[HierarchicalPacker] Bounds cleanup: clamped ${clamped}, removed ${removed} plants`,
      );
    } else {
      console.log(
        `[HierarchicalPacker] Bounds cleanup: all plants within bounds`,
      );
    }
  }

  /**
   * Check if a circle at (x, y) with radius r is within bed bounds
   * Handles rectangle, circle, and pill shapes
   */
  isWithinBounds(x, y, radius) {
    return this.isCircleInsideBed(x, y, radius);
  }

  /**
   * Build final result with placements and statistics
   */
  buildResult() {
    const placements = this.circles.map((circle) => ({
      id: circle.id,
      veggieType: circle.veggieType,
      varietyName: circle.varietyName,
      x: Math.round(circle.x * 10) / 10,
      y: Math.round(circle.y * 10) / 10,
      // Use original spacing from meta, fall back to computed diameter
      size:
        circle.meta?.spacing ||
        circle.originalSpacing ||
        Math.round(circle.radius * 2 * 10) / 10,
      clusterId: circle.clusterId,
      clusterType: circle.clusterType,
      priority: circle.priority,
    }));

    // Calculate actual vs requested counts by type
    const actualCounts = {};
    this.circles.forEach((c) => {
      actualCounts[c.veggieType] = (actualCounts[c.veggieType] || 0) + 1;
    });

    const plantTypeCounts = Object.keys(this.requestedCounts || {}).map(
      (type) => ({
        type,
        requested: this.requestedCounts[type],
        actual: actualCounts[type] || 0,
        ratio: actualCounts[type]
          ? actualCounts[type] / this.requestedCounts[type]
          : 0,
      }),
    );

    // Calculate statistics
    const totalArea = this.width * this.height;
    const packedArea = this.circles.reduce((sum, c) => {
      return sum + Math.PI * c.radius * c.radius;
    }, 0);

    const totalRequested = Object.values(this.requestedCounts || {}).reduce(
      (sum, count) => sum + count,
      0,
    );

    const stats = {
      placed: this.circles.length,
      requested: totalRequested,
      fillRate:
        totalRequested > 0
          ? ((this.circles.length / totalRequested) * 100).toFixed(1) + "%"
          : "100%",
      clusters: this.clusters.length,
      iterations: this.iteration_count,
      converged: this.converged,
      packingDensity: ((packedArea / totalArea) * 100).toFixed(1) + "%",
      totalArea: totalArea.toFixed(1),
      packedArea: packedArea.toFixed(1),
      plantTypeCounts,
    };

    // Validate placements
    const violations = this.validatePlacements();

    return {
      placements,
      stats,
      violations,
      clusters: this.clusters.map((c) => ({
        id: c.id,
        type: c.type,
        x: Math.round(c.x * 10) / 10,
        y: Math.round(c.y * 10) / 10,
        radius: Math.round(c.radius * 10) / 10,
        plantCount: c.plants.length,
      })),
    };
  }

  /**
   * Validate final placement for bounds and collision violations
   */
  validatePlacements() {
    const violations = {
      bounds: [],
      collisions: [],
      clusterOverflow: [],
    };

    // Check bounds
    for (const circle of this.circles) {
      const leftEdge = circle.x - circle.radius;
      const rightEdge = circle.x + circle.radius;
      const topEdge = circle.y - circle.radius;
      const bottomEdge = circle.y + circle.radius;

      if (
        leftEdge < 0 ||
        rightEdge > this.width ||
        topEdge < 0 ||
        bottomEdge > this.height
      ) {
        violations.bounds.push({
          id: circle.id,
          veggieType: circle.veggieType,
          position: { x: circle.x, y: circle.y },
          radius: circle.radius,
        });
      }
    }

    // Check collisions
    for (let i = 0; i < this.circles.length; i++) {
      for (let j = i + 1; j < this.circles.length; j++) {
        const c1 = this.circles[i];
        const c2 = this.circles[j];

        const dx = c2.x - c1.x;
        const dy = c2.y - c1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = c1.radius + c2.radius + this.min_spacing;

        if (distance < minDistance - 0.1) {
          // 0.1" tolerance
          violations.collisions.push({
            pair: [c1.id, c2.id],
            distance: distance.toFixed(2),
            minDistance: minDistance.toFixed(2),
            overlap: (minDistance - distance).toFixed(2),
          });
        }
      }
    }

    return violations;
  }

  /**
   * Get current state for visualization/debugging
   */
  getState() {
    return {
      clusters: this.clusters,
      circles: this.circles,
      config: {
        width: this.width,
        height: this.height,
        intra_group_attraction: this.intra_group_attraction,
        inter_group_repulsion: this.inter_group_repulsion,
        collision_strength: this.collision_strength,
        boundary_force: this.boundary_force,
        cluster_padding: this.cluster_padding,
        min_spacing: this.min_spacing,
      },
    };
  }

  /**
   * Reset the packer to initial state
   */
  reset() {
    this.clusters = [];
    this.circles = [];
    this.iteration_count = 0;
    this.converged = false;
    this._random_state = this.random_seed ?? Math.random() * 1000000;
  }
}
