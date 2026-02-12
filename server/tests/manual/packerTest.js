/**
 * Test the circle packer and garden packer algorithms
 */

import { CirclePacker } from "../../packer/CirclePacker.js";
import { GardenPacker } from "../../packer/GardenPacker.js";

console.log("=== CirclePacker Tests ===\n");

// Test 1: Basic circle packing
console.log("Test 1: Basic Circle Packing (48x48 bed)");
const packer1 = new CirclePacker(48, 48, 50, 0.5);

// Try to add some circles of various sizes
const circles = [];
let attempts = 0;
const maxAttempts = 1000;

while (attempts < maxAttempts) {
  const x = Math.random() * 48;
  const y = Math.random() * 48;
  const result = packer1.tryToAddCircle(x, y, 2, 12, true);

  if (result) {
    circles.push(result);
  }

  attempts++;
}

const stats1 = packer1.getStats();
console.log(`  Placed ${stats1.itemCount} circles in ${maxAttempts} attempts`);
console.log(`  Packing density: ${stats1.packingDensity}`);
console.log(
  `  Success rate: ${((stats1.itemCount / maxAttempts) * 100).toFixed(1)}%\n`,
);

// Test 2: Garden packer with realistic plants
console.log("Test 2: GardenPacker with Real Plants (48x48 bed)");

const testBed = {
  id: "1",
  name: "Test Bed",
  width: 48,
  height: 48,
  x: 0,
  y: 0,
};

const gardenPacker = new GardenPacker(testBed, {
  sunOrientation: "South",
  padding: 0.5,
  allowRootOverlap: true,
  companionProximity: 12,
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
    veggieType: "Pepper",
    varietyName: "Bell",
    size: 18,
    count: 2,
    priority: 5,
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
    varietyName: "English",
    size: 8,
    count: 10,
    priority: 1,
  },
  {
    veggieType: "Marigold",
    varietyName: "French Dwarf",
    size: 10,
    count: 6,
    priority: 3,
  },
  {
    veggieType: "Sage",
    varietyName: "Common",
    size: 18,
    count: 2,
    priority: 3,
  },
];

const result = gardenPacker.packPlants(plantList);

console.log(
  `  Requested plants: ${plantList.reduce((sum, p) => sum + p.count, 0)}`,
);
console.log(`  Successfully placed: ${result.stats.placed}`);
console.log(`  Failed to place: ${result.stats.failed}`);
console.log(`  Success rate: ${result.stats.successRate}`);
console.log(`  Packing density: ${result.stats.packingDensity}\n`);

// Show breakdown by plant type
const plantCounts = {};
result.placements.forEach((p) => {
  plantCounts[p.veggieType] = (plantCounts[p.veggieType] || 0) + 1;
});

console.log("  Placement breakdown:");
for (const [type, count] of Object.entries(plantCounts)) {
  const requested = plantList.find((p) => p.veggieType === type)?.count || 0;
  console.log(`    ${type}: ${count}/${requested}`);
}

// Test 3: Bounds validation
console.log("\nTest 3: Bounds Validation");
let boundsViolations = 0;

for (const placement of result.placements) {
  const radius = placement.size / 2;
  const leftEdge = placement.x - radius;
  const rightEdge = placement.x + radius;
  const topEdge = placement.y - radius;
  const bottomEdge = placement.y + radius;

  if (leftEdge < 0 || rightEdge > 48 || topEdge < 0 || bottomEdge > 48) {
    boundsViolations++;
    console.log(`  ❌ ${placement.veggieType} #${placement.id} out of bounds:`);
    console.log(
      `     Position: (${placement.x}, ${placement.y}), Size: ${placement.size}`,
    );
    console.log(
      `     Bounds: [${leftEdge}, ${rightEdge}] x [${topEdge}, ${bottomEdge}]`,
    );
  }
}

if (boundsViolations === 0) {
  console.log("  ✅ All placements within bounds!");
} else {
  console.log(`  ❌ ${boundsViolations} bounds violations detected`);
}

// Test 4: Collision detection
console.log("\nTest 4: Collision Detection (should be no overlaps)");
let collisions = 0;

for (let i = 0; i < result.placements.length; i++) {
  for (let j = i + 1; j < result.placements.length; j++) {
    const p1 = result.placements[i];
    const p2 = result.placements[j];

    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDistance = p1.size / 2 + p2.size / 2 + 0.5; // Include padding

    if (distance < minDistance) {
      collisions++;
      console.log(
        `  ❌ Collision between ${p1.veggieType} #${p1.id} and ${p2.veggieType} #${p2.id}`,
      );
      console.log(
        `     Distance: ${distance.toFixed(2)}", Min: ${minDistance.toFixed(2)}"`,
      );
    }
  }
}

if (collisions === 0) {
  console.log("  ✅ No collisions detected!");
} else {
  console.log(`  ❌ ${collisions} collisions detected`);
}

// Test 5: Companion planting proximity
console.log("\nTest 5: Companion Planting (Tomato + Basil)");
const tomatoes = result.placements.filter((p) => p.veggieType === "Tomato");
const basils = result.placements.filter((p) => p.veggieType === "Basil");

let companionPairs = 0;
for (const tomato of tomatoes) {
  for (const basil of basils) {
    const dx = tomato.x - basil.x;
    const dy = tomato.y - basil.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 12) {
      // Companion proximity threshold
      companionPairs++;
      console.log(
        `  ✅ Tomato #${tomato.id} near Basil #${basil.id} (${distance.toFixed(1)}" apart)`,
      );
    }
  }
}

if (companionPairs === 0 && tomatoes.length > 0 && basils.length > 0) {
  console.log(
    "  ⚠️  No close companion pairs found (may be OK depending on bed density)",
  );
}

// Test 6: Compare with target density
console.log("\nTest 6: Density Analysis");
const bedArea = 48 * 48; // square inches
const bedSqFt = bedArea / 144; // 16 sq ft
const targetMin = Math.ceil(bedSqFt * 2.5); // 40 plants
const targetMax = Math.ceil(bedSqFt * 3.5); // 56 plants

console.log(`  Bed size: ${bedSqFt} sq ft`);
console.log(
  `  Target density: ${targetMin}-${targetMax} plants (2.5-3.5 per sq ft)`,
);
console.log(`  Actual placed: ${result.stats.placed} plants`);

if (result.stats.placed >= targetMin && result.stats.placed <= targetMax) {
  console.log("  ✅ Density within target range!");
} else if (result.stats.placed < targetMin) {
  console.log(
    `  ⚠️  Below target (${targetMin - result.stats.placed} plants short)`,
  );
} else {
  console.log(
    `  ⚠️  Above target (${result.stats.placed - targetMax} extra plants)`,
  );
}

// Test 7: Verify type clustering (same plants placed together)
console.log("\nTest 7: Type Clustering (same plants placed consecutively)");
let clustered = true;
const typeRanges = {};

result.placements.forEach((plant, index) => {
  if (!typeRanges[plant.veggieType]) {
    typeRanges[plant.veggieType] = { start: index, end: index };
  } else {
    typeRanges[plant.veggieType].end = index;
  }
});

// Check if each type forms a contiguous block
for (const [type, range] of Object.entries(typeRanges)) {
  const expectedCount = result.placements.filter(
    (p) => p.veggieType === type,
  ).length;
  const actualRange = range.end - range.start + 1;

  if (expectedCount !== actualRange) {
    clustered = false;
    console.log(
      `  ❌ ${type}: scattered (${expectedCount} plants across ${actualRange} positions)`,
    );
  } else {
    console.log(
      `  ✅ ${type}: clustered (${expectedCount} plants in positions ${range.start + 1}-${range.end + 1})`,
    );
  }
}

if (clustered) {
  console.log("  ✅ All plant types form visual clusters!");
}

console.log("\n=== Tests Complete ===");
