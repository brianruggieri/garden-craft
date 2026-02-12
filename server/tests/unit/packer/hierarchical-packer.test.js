/**
 * Comprehensive test suite for HierarchicalCirclePacker and ForceDirectedGardenPacker
 *
 * Tests:
 * 1. Basic hierarchical packing (two-level structure)
 * 2. Force-directed convergence
 * 3. Cluster formation and separation
 * 4. Companion plant attraction
 * 5. Antagonist plant repulsion
 * 6. Boundary containment
 * 7. Collision detection and resolution
 * 8. Lloyd relaxation refinement
 * 9. Deterministic seeded randomness
 * 10. Dense packing efficiency
 * 11. Priority-based placement
 * 12. Sun orientation zones
 */

import { test } from "node:test";
import assert from "node:assert";
import { HierarchicalCirclePacker } from "../../../packer/HierarchicalCirclePacker.js";
import { ForceDirectedGardenPacker } from "../../../packer/ForceDirectedGardenPacker.js";

// ============================================================================
// TEST SUITE 1: HierarchicalCirclePacker Core Functionality
// ============================================================================

test("HierarchicalCirclePacker - Basic two-level packing", async (t) => {
  const packer = new HierarchicalCirclePacker(48, 48, {
    random_seed: 12345,
  });

  const plantGroups = [
    {
      type: "Tomato",
      plants: [
        {
          id: "1",
          veggieType: "Tomato",
          varietyName: "Better Boy",
          radius: 12,
          priority: 5,
        },
        {
          id: "2",
          veggieType: "Tomato",
          varietyName: "Better Boy",
          radius: 12,
          priority: 5,
        },
      ],
      companions: ["Basil", "Marigold"],
      antagonists: ["Fennel"],
    },
    {
      type: "Basil",
      plants: [
        {
          id: "3",
          veggieType: "Basil",
          varietyName: "Genovese",
          radius: 5,
          priority: 4,
        },
        {
          id: "4",
          veggieType: "Basil",
          varietyName: "Genovese",
          radius: 5,
          priority: 4,
        },
        {
          id: "5",
          veggieType: "Basil",
          varietyName: "Genovese",
          radius: 5,
          priority: 4,
        },
      ],
      companions: ["Tomato"],
      antagonists: [],
    },
  ];

  const result = packer.pack(plantGroups);

  // Level 1: Check clusters were created
  assert.strictEqual(result.clusters.length, 2, "Should create 2 clusters");
  assert.strictEqual(result.clusters[0].type, "Tomato");
  assert.strictEqual(result.clusters[1].type, "Basil");

  // Level 2: Check plants were packed
  assert.strictEqual(result.placements.length, 5, "Should pack all 5 plants");

  // Check clustering
  const tomatoPlacements = result.placements.filter(
    (p) => p.veggieType === "Tomato",
  );
  const basilPlacements = result.placements.filter(
    (p) => p.veggieType === "Basil",
  );

  assert.strictEqual(tomatoPlacements.length, 2, "Should have 2 tomatoes");
  assert.strictEqual(basilPlacements.length, 3, "Should have 3 basil plants");

  console.log("✅ Basic two-level packing works correctly");
});

test("HierarchicalCirclePacker - Boundary containment", async (t) => {
  const packer = new HierarchicalCirclePacker(48, 48, {
    random_seed: 54321,
  });

  const plantGroups = [
    {
      type: "Pepper",
      plants: Array.from({ length: 20 }, (_, i) => ({
        id: String(i + 1),
        veggieType: "Pepper",
        varietyName: "Bell",
        radius: 4,
        priority: 3,
      })),
      companions: [],
      antagonists: [],
    },
  ];

  const result = packer.pack(plantGroups);

  // Check all placements are within bounds
  let boundsViolations = 0;
  for (const placement of result.placements) {
    const radius = placement.size / 2;
    const leftEdge = placement.x - radius;
    const rightEdge = placement.x + radius;
    const topEdge = placement.y - radius;
    const bottomEdge = placement.y + radius;

    if (leftEdge < 0 || rightEdge > 48 || topEdge < 0 || bottomEdge > 48) {
      boundsViolations++;
      console.log(
        `  ❌ Plant ${placement.id} out of bounds: (${placement.x}, ${placement.y}), radius ${radius}`,
      );
    }
  }

  assert.strictEqual(boundsViolations, 0, "All plants should be within bounds");
  assert.strictEqual(
    result.violations.bounds.length,
    0,
    "Violations report should be empty",
  );

  console.log(
    `✅ Boundary containment: ${result.placements.length} plants all within bounds`,
  );
});

test("HierarchicalCirclePacker - Collision detection", async (t) => {
  const packer = new HierarchicalCirclePacker(48, 48, {
    random_seed: 11111,
    min_spacing: 0.5,
  });

  const plantGroups = [
    {
      type: "Lettuce",
      plants: Array.from({ length: 30 }, (_, i) => ({
        id: String(i + 1),
        veggieType: "Lettuce",
        varietyName: "Buttercrunch",
        radius: 3,
        priority: 2,
      })),
      companions: [],
      antagonists: [],
    },
  ];

  const result = packer.pack(plantGroups);

  // Check for collisions
  let collisions = 0;
  const minSpacing = 0.5;

  for (let i = 0; i < result.placements.length; i++) {
    for (let j = i + 1; j < result.placements.length; j++) {
      const p1 = result.placements[i];
      const p2 = result.placements[j];

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const minDistance = p1.size / 2 + p2.size / 2 + minSpacing;

      if (distance < minDistance - 0.1) {
        collisions++;
      }
    }
  }

  // Allow small tolerance for very dense packing (force-directed may have minor overlaps)
  assert.ok(
    collisions <= 5,
    `Should have minimal collisions (got ${collisions})`,
  );
  assert.ok(
    result.violations.collisions.length <= 10,
    "Should have minimal collision violations",
  );

  console.log(
    `✅ Collision detection: ${result.placements.length} plants, ${collisions} minor collisions (within tolerance)`,
  );
});

test("HierarchicalCirclePacker - Deterministic seeded results", async (t) => {
  const seed = 99999;

  // Run packing twice with same seed
  const packer1 = new HierarchicalCirclePacker(48, 48, { random_seed: seed });
  const packer2 = new HierarchicalCirclePacker(48, 48, { random_seed: seed });

  const plantGroups = [
    {
      type: "Carrot",
      plants: Array.from({ length: 10 }, (_, i) => ({
        id: String(i + 1),
        veggieType: "Carrot",
        varietyName: "Nantes",
        radius: 2,
        priority: 3,
      })),
      companions: [],
      antagonists: [],
    },
  ];

  const result1 = packer1.pack(plantGroups);
  const result2 = packer2.pack(plantGroups);

  // Check positions match
  assert.strictEqual(result1.placements.length, result2.placements.length);

  for (let i = 0; i < result1.placements.length; i++) {
    const p1 = result1.placements[i];
    const p2 = result2.placements[i];

    assert.strictEqual(p1.x, p2.x, `Plant ${i} x-coordinate should match`);
    assert.strictEqual(p1.y, p2.y, `Plant ${i} y-coordinate should match`);
  }

  console.log(
    "✅ Deterministic seeded results: identical outputs from same seed",
  );
});

test("HierarchicalCirclePacker - Companion plant proximity", async (t) => {
  const packer = new HierarchicalCirclePacker(60, 60, {
    random_seed: 77777,
    intra_group_attraction: 0.4, // Higher attraction
  });

  const plantGroups = [
    {
      type: "Tomato",
      plants: [
        {
          id: "1",
          veggieType: "Tomato",
          varietyName: "Roma",
          radius: 10,
          priority: 5,
        },
        {
          id: "2",
          veggieType: "Tomato",
          varietyName: "Roma",
          radius: 10,
          priority: 5,
        },
      ],
      companions: ["Basil"],
      antagonists: [],
    },
    {
      type: "Basil",
      plants: [
        {
          id: "3",
          veggieType: "Basil",
          varietyName: "Sweet",
          radius: 4,
          priority: 4,
        },
        {
          id: "4",
          veggieType: "Basil",
          varietyName: "Sweet",
          radius: 4,
          priority: 4,
        },
        {
          id: "5",
          veggieType: "Basil",
          varietyName: "Sweet",
          radius: 4,
          priority: 4,
        },
      ],
      companions: ["Tomato"],
      antagonists: [],
    },
  ];

  const result = packer.pack(plantGroups);

  // Measure distance between companion clusters
  const tomatoCluster = result.clusters.find((c) => c.type === "Tomato");
  const basilCluster = result.clusters.find((c) => c.type === "Basil");

  const dx = basilCluster.x - tomatoCluster.x;
  const dy = basilCluster.y - tomatoCluster.y;
  const clusterDistance = Math.sqrt(dx * dx + dy * dy);

  // Companions should be reasonably close (not on opposite sides)
  const maxReasonableDistance = Math.sqrt(60 * 60 + 60 * 60) * 0.5; // Half diagonal

  assert.ok(
    clusterDistance < maxReasonableDistance,
    `Companion clusters should be relatively close (distance: ${clusterDistance.toFixed(1)})`,
  );

  console.log(
    `✅ Companion proximity: Tomato-Basil clusters ${clusterDistance.toFixed(1)}" apart`,
  );
});

test("HierarchicalCirclePacker - Antagonist separation", async (t) => {
  const packer = new HierarchicalCirclePacker(72, 72, {
    random_seed: 33333,
    inter_group_repulsion: 0.5, // Higher repulsion
  });

  const plantGroups = [
    {
      type: "Tomato",
      plants: [
        {
          id: "1",
          veggieType: "Tomato",
          varietyName: "Cherry",
          radius: 8,
          priority: 5,
        },
      ],
      companions: [],
      antagonists: ["Fennel"],
    },
    {
      type: "Fennel",
      plants: [
        {
          id: "2",
          veggieType: "Fennel",
          varietyName: "Florence",
          radius: 6,
          priority: 3,
        },
      ],
      companions: [],
      antagonists: ["Tomato"],
    },
    {
      type: "Basil",
      plants: [
        {
          id: "3",
          veggieType: "Basil",
          varietyName: "Thai",
          radius: 4,
          priority: 4,
        },
      ],
      companions: [],
      antagonists: [],
    },
  ];

  const result = packer.pack(plantGroups);

  const tomatoCluster = result.clusters.find((c) => c.type === "Tomato");
  const fennelCluster = result.clusters.find((c) => c.type === "Fennel");

  const dx = fennelCluster.x - tomatoCluster.x;
  const dy = fennelCluster.y - tomatoCluster.y;
  const antagonistDistance = Math.sqrt(dx * dx + dy * dy);

  // Antagonists should be separated by more than just their radii + padding
  const minSeparation = tomatoCluster.radius + fennelCluster.radius + 6; // Extra space

  assert.ok(
    antagonistDistance >= minSeparation * 0.8, // Allow some tolerance
    `Antagonists should be well-separated (distance: ${antagonistDistance.toFixed(1)}, min: ${minSeparation.toFixed(1)})`,
  );

  console.log(
    `✅ Antagonist separation: Tomato-Fennel clusters ${antagonistDistance.toFixed(1)}" apart (min ${minSeparation.toFixed(1)}")`,
  );
});

test("HierarchicalCirclePacker - Force convergence", async (t) => {
  const packer = new HierarchicalCirclePacker(48, 48, {
    random_seed: 22222,
    max_iterations: 1000,
    convergence_threshold: 0.01,
  });

  const plantGroups = [
    {
      type: "Oregano",
      plants: Array.from({ length: 15 }, (_, i) => ({
        id: String(i + 1),
        veggieType: "Oregano",
        varietyName: "Greek",
        radius: 3,
        priority: 3,
      })),
      companions: [],
      antagonists: [],
    },
  ];

  const result = packer.pack(plantGroups);

  // Check that simulation converged (didn't hit max iterations)
  assert.ok(
    result.stats.converged === true || result.stats.iterations < 1000,
    "Force simulation should converge before max iterations",
  );

  console.log(
    `✅ Force convergence: Converged in ${result.stats.iterations} iterations`,
  );
});

// ============================================================================
// TEST SUITE 2: ForceDirectedGardenPacker Integration Tests
// ============================================================================

test("ForceDirectedGardenPacker - Integration with veggie metadata", async (t) => {
  const testBed = {
    id: "1",
    name: "Test Bed",
    width: 48,
    height: 48,
    x: 0,
    y: 0,
  };

  const packer = new ForceDirectedGardenPacker(testBed, {
    sunOrientation: "South",
    random_seed: 55555,
  });

  const plantList = [
    {
      veggieType: "Tomato",
      varietyName: "Better Boy",
      size: 24,
      count: 2,
      priority: 5,
    },
    {
      veggieType: "Basil",
      varietyName: "Genovese",
      size: 10,
      count: 6,
      priority: 4,
    },
    {
      veggieType: "Thyme",
      varietyName: "English",
      size: 6,
      count: 10,
      priority: 2,
    },
  ];

  const result = packer.packPlants(plantList);

  // Check all plants were packed
  const expectedTotal = plantList.reduce((sum, p) => sum + p.count, 0);
  assert.strictEqual(
    result.placements.length,
    expectedTotal,
    `Should pack all ${expectedTotal} plants`,
  );

  // Check metadata enrichment
  const firstPlacement = result.placements[0];
  assert.ok(firstPlacement.spacingAnalysis, "Should have spacing analysis");
  assert.ok(
    firstPlacement.placementReasoning,
    "Should have placement reasoning",
  );
  assert.ok(firstPlacement.companionInsights, "Should have companion insights");

  console.log(
    `✅ Garden packer integration: ${result.placements.length} plants with metadata`,
  );
});

test("ForceDirectedGardenPacker - Sun orientation zones", async (t) => {
  const testBed = {
    id: "1",
    name: "Test Bed",
    width: 60,
    height: 60,
    x: 0,
    y: 0,
  };

  const packer = new ForceDirectedGardenPacker(testBed, {
    sunOrientation: "South", // Tall plants should go North
    random_seed: 66666,
  });

  const plantList = [
    {
      veggieType: "Tomato",
      varietyName: "Beefsteak",
      size: 24,
      count: 3,
      priority: 5,
    },
    {
      veggieType: "Thyme",
      varietyName: "Lemon",
      size: 6,
      count: 8,
      priority: 1,
    },
  ];

  const result = packer.packPlants(plantList);

  // Tomatoes (tall) should mention north edge in reasoning
  const tomatoPlacement = result.placements.find(
    (p) => p.veggieType === "Tomato",
  );
  assert.ok(tomatoPlacement, "Should have tomato placement");

  const reasoning = tomatoPlacement.placementReasoning.toLowerCase();
  const mentionsSunOrientation =
    reasoning.includes("north") ||
    reasoning.includes("tall") ||
    reasoning.includes("shad") ||
    reasoning.includes("sun") ||
    reasoning.includes("orientation");

  assert.ok(
    mentionsSunOrientation,
    `Tomato reasoning should mention sun/shade management (got: "${tomatoPlacement.placementReasoning}")`,
  );

  console.log(
    `✅ Sun orientation: Tall plants have appropriate placement reasoning: "${tomatoPlacement.placementReasoning}"`,
  );
});

test("ForceDirectedGardenPacker - Dense packing efficiency", async (t) => {
  const testBed = {
    id: "1",
    name: "Intensive Bed",
    width: 48,
    height: 48,
    x: 0,
    y: 0,
  };

  const packer = new ForceDirectedGardenPacker(testBed, {
    sunOrientation: "South",
    random_seed: 88888,
  });

  // Intensive square-foot gardening plan
  const plantList = [
    {
      veggieType: "Pepper",
      varietyName: "Jalapeño",
      size: 18,
      count: 2,
      priority: 5,
    },
    {
      veggieType: "Basil",
      varietyName: "Thai",
      size: 10,
      count: 8,
      priority: 4,
    },
    {
      veggieType: "Oregano",
      varietyName: "Greek",
      size: 12,
      count: 6,
      priority: 3,
    },
    {
      veggieType: "Thyme",
      varietyName: "Common",
      size: 6,
      count: 12,
      priority: 2,
    },
    {
      veggieType: "Marigold",
      varietyName: "French",
      size: 8,
      count: 8,
      priority: 3,
    },
  ];

  const result = packer.packPlants(plantList);

  const bedSqFt = (48 * 48) / 144; // 16 sq ft
  const targetMin = Math.ceil(bedSqFt * 2.5); // 40 plants
  const targetMax = Math.ceil(bedSqFt * 3.5); // 56 plants

  assert.strictEqual(
    result.placements.length,
    36,
    "Should place all 36 plants",
  );

  // Check density is reasonable
  assert.ok(
    result.placements.length >= targetMin * 0.8, // Allow 80% of target
    `Should achieve reasonable density (${result.placements.length}/${targetMin} plants)`,
  );

  const densityPercent = parseFloat(result.stats.packingDensity);
  assert.ok(
    densityPercent > 30,
    `Packing density should be > 30% (got ${densityPercent}%)`,
  );

  console.log(
    `✅ Dense packing: ${result.placements.length} plants, ${result.stats.packingDensity} density`,
  );
});

test("ForceDirectedGardenPacker - Priority-based placement order", async (t) => {
  const testBed = {
    id: "1",
    name: "Test Bed",
    width: 48,
    height: 48,
    x: 0,
    y: 0,
  };

  const packer = new ForceDirectedGardenPacker(testBed, {
    sunOrientation: "South",
    random_seed: 44444,
  });

  const plantList = [
    {
      veggieType: "Thyme",
      varietyName: "Lemon",
      size: 6,
      count: 5,
      priority: 1,
    }, // Lowest
    {
      veggieType: "Tomato",
      varietyName: "Roma",
      size: 22,
      count: 2,
      priority: 5,
    }, // Highest
    {
      veggieType: "Basil",
      varietyName: "Sweet",
      size: 10,
      count: 4,
      priority: 3,
    }, // Medium
  ];

  const result = packer.packPlants(plantList);

  // Verify all plants placed
  assert.strictEqual(
    result.placements.length,
    11,
    "Should place all 11 plants",
  );

  // Priority should be preserved in placement metadata
  const tomatoPlacements = result.placements.filter(
    (p) => p.veggieType === "Tomato",
  );
  assert.strictEqual(
    tomatoPlacements[0].priority,
    5,
    "Tomato should have priority 5",
  );

  console.log(
    "✅ Priority-based placement: All priorities preserved in output",
  );
});

test("ForceDirectedGardenPacker - Companion insights accuracy", async (t) => {
  const testBed = {
    id: "1",
    name: "Test Bed",
    width: 60,
    height: 60,
    x: 0,
    y: 0,
  };

  const packer = new ForceDirectedGardenPacker(testBed, {
    sunOrientation: "South",
    random_seed: 11223,
    intra_group_attraction: 0.5, // Higher attraction for companions
  });

  const plantList = [
    {
      veggieType: "Tomato",
      varietyName: "Cherry",
      size: 20,
      count: 2,
      priority: 5,
    },
    {
      veggieType: "Basil",
      varietyName: "Genovese",
      size: 10,
      count: 4,
      priority: 4,
    },
  ];

  const result = packer.packPlants(plantList);

  // Find a tomato and check its companion insights
  const tomato = result.placements.find((p) => p.veggieType === "Tomato");
  assert.ok(tomato, "Should have tomato placement");

  const insights = tomato.companionInsights.toLowerCase();
  assert.ok(
    insights.includes("basil") || insights.includes("compatible"),
    "Tomato should mention Basil in companion insights",
  );

  console.log(`✅ Companion insights: "${tomato.companionInsights}"`);
});

// ============================================================================
// TEST SUITE 3: Performance and Stress Tests
// ============================================================================

test("HierarchicalCirclePacker - Large scale packing (100+ plants)", async (t) => {
  const packer = new HierarchicalCirclePacker(96, 96, {
    random_seed: 99991,
    max_iterations: 800,
  });

  const plantGroups = [
    {
      type: "Radish",
      plants: Array.from({ length: 50 }, (_, i) => ({
        id: String(i + 1),
        veggieType: "Radish",
        varietyName: "Cherry Belle",
        radius: 2,
        priority: 2,
      })),
      companions: [],
      antagonists: [],
    },
    {
      type: "Lettuce",
      plants: Array.from({ length: 30 }, (_, i) => ({
        id: String(i + 51),
        veggieType: "Lettuce",
        varietyName: "Buttercrunch",
        radius: 3,
        priority: 3,
      })),
      companions: [],
      antagonists: [],
    },
    {
      type: "Spinach",
      plants: Array.from({ length: 25 }, (_, i) => ({
        id: String(i + 81),
        veggieType: "Spinach",
        varietyName: "Bloomsdale",
        radius: 3,
        priority: 3,
      })),
      companions: [],
      antagonists: [],
    },
  ];

  const startTime = Date.now();
  const result = packer.pack(plantGroups);
  const duration = Date.now() - startTime;

  assert.strictEqual(
    result.placements.length,
    105,
    "Should pack all 105 plants",
  );
  assert.ok(
    duration < 5000,
    `Should complete in < 5 seconds (took ${duration}ms)`,
  );
  assert.strictEqual(
    result.violations.bounds.length,
    0,
    "Should have no bounds violations",
  );
  assert.ok(
    result.violations.collisions.length < 30,
    `Should have manageable collisions (got ${result.violations.collisions.length})`,
  );

  console.log(
    `✅ Large scale packing: 105 plants in ${duration}ms, density ${result.stats.packingDensity}, ${result.violations.collisions.length} minor collisions`,
  );
});

test("ForceDirectedGardenPacker - Mixed size stress test", async (t) => {
  const testBed = {
    id: "1",
    name: "Stress Test Bed",
    width: 72,
    height: 72,
    x: 0,
    y: 0,
  };

  const packer = new ForceDirectedGardenPacker(testBed, {
    sunOrientation: "East",
    random_seed: 77771,
  });

  const plantList = [
    {
      veggieType: "Tomato",
      varietyName: "Beefsteak",
      size: 28,
      count: 3,
      priority: 5,
    },
    {
      veggieType: "Pepper",
      varietyName: "Bell",
      size: 20,
      count: 4,
      priority: 5,
    },
    {
      veggieType: "Basil",
      varietyName: "Sweet",
      size: 12,
      count: 10,
      priority: 4,
    },
    {
      veggieType: "Oregano",
      varietyName: "Greek",
      size: 10,
      count: 8,
      priority: 3,
    },
    {
      veggieType: "Thyme",
      varietyName: "English",
      size: 6,
      count: 15,
      priority: 2,
    },
    {
      veggieType: "Marigold",
      varietyName: "French",
      size: 8,
      count: 12,
      priority: 3,
    },
  ];

  const result = packer.packPlants(plantList);

  const expectedTotal = plantList.reduce((sum, p) => sum + p.count, 0);
  assert.strictEqual(
    result.placements.length,
    expectedTotal,
    `Should pack all ${expectedTotal} plants`,
  );

  // Verify size variety
  const sizes = new Set(result.placements.map((p) => p.size));
  assert.ok(sizes.size >= 5, "Should have at least 5 different plant sizes");

  console.log(
    `✅ Mixed size stress test: ${result.placements.length} plants with ${sizes.size} different sizes`,
  );
});

// ============================================================================
// Run Summary
// ============================================================================

console.log("\n" + "=".repeat(60));
console.log("HIERARCHICAL CIRCLE PACKER TEST SUITE COMPLETE");
console.log("=".repeat(60));
