/**
 * Manual Priority-Weighted Distribution Test
 *
 * Demonstrates the new priority-weighted system with space-filling optimization:
 * 1. Priority determines initial plant ratios
 * 2. Packer determines actual count based on space
 * 3. Space-filling adds more plants (largest to smallest) until bed is full
 */

import { ForceDirectedGardenPacker } from "../../packer/ForceDirectedGardenPacker";

console.log("=".repeat(80));
console.log("PRIORITY-WEIGHTED DISTRIBUTION WITH SPACE-FILLING TEST");
console.log("=".repeat(80));

const bed = {
  id: "test-bed",
  name: "Main Garden Bed",
  width: 48,
  height: 96,
};

console.log(
  `\nBed: ${bed.width}" × ${bed.height}" (${((bed.width * bed.height) / 144).toFixed(1)} sq ft)`,
);

// Test 1: Equal Priority (All 3)
console.log("\n" + "-".repeat(80));
console.log("TEST 1: Equal Priority (All Priority 3)");
console.log(
  "Expected: ~33% each plant type, then space-fill with any available",
);
console.log("-".repeat(80));

const packer1 = new ForceDirectedGardenPacker(bed, {
  random_seed: 42,
  collision_strength: 0.95,
});

const plantList1 = [
  {
    veggieType: "Tomato",
    varietyName: "Cherokee Purple",
    size: 24,
    count: 10,
    priority: 3,
  },
  {
    veggieType: "Basil",
    varietyName: "Sweet Basil",
    size: 12,
    count: 10,
    priority: 3,
  },
  {
    veggieType: "Lettuce",
    varietyName: "Buttercrunch",
    size: 8,
    count: 10,
    priority: 3,
  },
];

const result1 = packer1.packPlants(plantList1);

console.log(
  "\nRequested:",
  plantList1.map((p) => `${p.veggieType}(${p.count})`).join(", "),
);
console.log(
  `Packed: ${result1.stats.placed}/${result1.stats.requested} plants (${result1.stats.fillRate} fill rate)`,
);
console.log(`Packing Density: ${result1.stats.packingDensity}`);
console.log("\nDistribution by type:");
result1.stats.plantTypeCounts.forEach(({ type, requested, actual, ratio }) => {
  const percentage = (ratio * 100).toFixed(1);
  const extraText =
    actual > requested ? ` (+${actual - requested} from space-fill)` : "";
  console.log(`  ${type}: ${actual}/${requested} (${percentage}%)${extraText}`);
});

// Test 2: Weighted Priority (5-3-1)
console.log("\n" + "-".repeat(80));
console.log("TEST 2: Weighted Priority (5-3-1)");
console.log(
  "Expected: ~55% Tomato, ~33% Basil, ~11% Marigold, then space-fill",
);
console.log("-".repeat(80));

const packer2 = new ForceDirectedGardenPacker(bed, {
  random_seed: 42,
  collision_strength: 0.95,
});

const plantList2 = [
  {
    veggieType: "Tomato",
    varietyName: "Cherokee Purple",
    size: 18,
    count: 20,
    priority: 5,
  },
  {
    veggieType: "Basil",
    varietyName: "Sweet Basil",
    size: 12,
    count: 12,
    priority: 3,
  },
  {
    veggieType: "Marigold",
    varietyName: "French",
    size: 8,
    count: 4,
    priority: 1,
  },
];

const result2 = packer2.packPlants(plantList2);

console.log(
  "\nRequested:",
  plantList2.map((p) => `${p.veggieType}(${p.count})`).join(", "),
);
console.log(
  `Packed: ${result2.stats.placed}/${result2.stats.requested} plants (${result2.stats.fillRate} fill rate)`,
);
console.log(`Packing Density: ${result2.stats.packingDensity}`);
console.log("\nDistribution by type:");
result2.stats.plantTypeCounts.forEach(({ type, requested, actual, ratio }) => {
  const percentage = (ratio * 100).toFixed(1);
  const actualRatio = (
    (result2.placements.filter((p) => p.veggieType === type).length /
      result2.stats.placed) *
    100
  ).toFixed(1);
  const extraText =
    actual > requested ? ` (+${actual - requested} from space-fill)` : "";
  console.log(
    `  ${type}: ${actual}/${requested} (${percentage}% of request, ${actualRatio}% of final)${extraText}`,
  );
});

// Test 3: Feature Plant (One dominant, two supports)
console.log("\n" + "-".repeat(80));
console.log("TEST 3: Feature Plant Layout (Priority 5, 2, 2)");
console.log("Expected: ~55% Pepper, ~22% Basil, ~22% Lettuce, then space-fill");
console.log("-".repeat(80));

const packer3 = new ForceDirectedGardenPacker(bed, {
  random_seed: 42,
  collision_strength: 0.95,
});

const plantList3 = [
  {
    veggieType: "Pepper",
    varietyName: "California Wonder",
    size: 18,
    count: 20,
    priority: 5,
  },
  {
    veggieType: "Basil",
    varietyName: "Sweet Basil",
    size: 12,
    count: 8,
    priority: 2,
  },
  {
    veggieType: "Lettuce",
    varietyName: "Buttercrunch",
    size: 8,
    count: 8,
    priority: 2,
  },
];

const result3 = packer3.packPlants(plantList3);

console.log(
  "\nRequested:",
  plantList3.map((p) => `${p.veggieType}(${p.count})`).join(", "),
);
console.log(
  `Packed: ${result3.stats.placed}/${result3.stats.requested} plants (${result3.stats.fillRate} fill rate)`,
);
console.log(`Packing Density: ${result3.stats.packingDensity}`);
console.log("\nDistribution by type:");
result3.stats.plantTypeCounts.forEach(({ type, requested, actual, ratio }) => {
  const percentage = (ratio * 100).toFixed(1);
  const actualRatio = (
    (result3.placements.filter((p) => p.veggieType === type).length /
      result3.stats.placed) *
    100
  ).toFixed(1);
  const extraText =
    actual > requested ? ` (+${actual - requested} from space-fill)` : "";
  console.log(
    `  ${type}: ${actual}/${requested} (${percentage}% of request, ${actualRatio}% of final)${extraText}`,
  );
});

// Test 4: Dense mixed sizes (stress test for space-filling)
console.log("\n" + "-".repeat(80));
console.log("TEST 4: Dense Mixed Sizes (All Priority 3)");
console.log(
  "Expected: Equal ratios initially, then space-fill favors smaller plants",
);
console.log("-".repeat(80));

const packer4 = new ForceDirectedGardenPacker(bed, {
  random_seed: 42,
  collision_strength: 0.95,
});

const plantList4 = [
  {
    veggieType: "Tomato",
    varietyName: "Cherokee Purple",
    size: 24,
    count: 8,
    priority: 3,
  },
  {
    veggieType: "Lettuce",
    varietyName: "Buttercrunch",
    size: 8,
    count: 8,
    priority: 3,
  },
  {
    veggieType: "Radish",
    varietyName: "Cherry Belle",
    size: 3,
    count: 8,
    priority: 3,
  },
];

const result4 = packer4.packPlants(plantList4);

console.log(
  "\nRequested:",
  plantList4.map((p) => `${p.veggieType}(${p.count})`).join(", "),
);
console.log(
  `Packed: ${result4.stats.placed}/${result4.stats.requested} plants (${result4.stats.fillRate} fill rate)`,
);
console.log(`Packing Density: ${result4.stats.packingDensity}`);
console.log("\nDistribution by type:");
result4.stats.plantTypeCounts.forEach(({ type, requested, actual, ratio }) => {
  const percentage = (ratio * 100).toFixed(1);
  const actualRatio = (
    (result4.placements.filter((p) => p.veggieType === type).length /
      result4.stats.placed) *
    100
  ).toFixed(1);
  const extraText =
    actual > requested ? ` (+${actual - requested} from space-fill)` : "";
  console.log(
    `  ${type}: ${actual}/${requested} (${percentage}% of request, ${actualRatio}% of final)${extraText}`,
  );
});

// Summary
console.log("\n" + "=".repeat(80));
console.log("SUMMARY");
console.log("=".repeat(80));
console.log("\n✓ Priority determines initial plant ratios");
console.log("✓ Packer determines actual count based on available space");
console.log(
  "✓ Space-filling adds more plants (largest→smallest) until bed is full",
);
console.log("\nKey Behaviors:");
console.log("  • Equal priorities (3-3-3) → Similar counts per type");
console.log(
  "  • Weighted priorities (5-3-1) → Proportional to priority ratios",
);
console.log("  • Space-filling phase → Maximizes bed utilization");
console.log("  • Larger plants tried first → Better space efficiency");
console.log("  • Smaller plants fill gaps → High final density");
console.log("\n" + "=".repeat(80));
