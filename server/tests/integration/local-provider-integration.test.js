/**
 * Integration test for Local Provider with Hierarchical Force-Directed Packer
 *
 * Tests the complete flow:
 * 1. Local semantic plan generation (no LLM)
 * 2. Hierarchical force-directed packing
 * 3. Layout validation and quality metrics
 */

import { test } from "node:test";
import assert from "node:assert";
import localProvider from "../../providers/localProvider";

test("Local Provider - Basic layout generation", async (t) => {
  const beds = [
    {
      id: "1",
      name: "Test Bed",
      width: 48,
      height: 48,
      x: 0,
      y: 0,
    },
  ];

  const seeds = [
    {
      type: "Tomato",
      priority: 5,
      selectedVarieties: [{ name: "Better Boy", spacing: 24 }],
    },
    {
      type: "Basil",
      priority: 4,
      selectedVarieties: [{ name: "Genovese", spacing: 10 }],
    },
    {
      type: "Thyme",
      priority: 2,
      selectedVarieties: [{ name: "English", spacing: 8 }],
    },
  ];

  const result = await localProvider.generateLayout({
    beds,
    seeds,
    sunOrientation: "South",
  });

  assert.ok(Array.isArray(result), "Should return array of layouts");
  assert.strictEqual(result.length, 1, "Should have 1 layout for 1 bed");

  const layout = result[0];
  assert.strictEqual(layout.bedId, "1");
  assert.ok(Array.isArray(layout.placements), "Should have placements array");
  assert.ok(layout.placements.length > 0, "Should have at least some plants");
  assert.ok(layout.stats, "Should include packing stats");
  assert.ok(layout.clusters, "Should include cluster information");

  console.log(
    `✅ Basic layout generation: ${layout.placements.length} plants packed`,
  );
});

test("Local Provider - Bounds validation", async (t) => {
  const beds = [
    {
      id: "1",
      name: "Small Bed",
      width: 36,
      height: 36,
      x: 0,
      y: 0,
    },
  ];

  const seeds = [
    { type: "Pepper", priority: 5, selectedVarieties: [] },
    { type: "Oregano", priority: 3, selectedVarieties: [] },
    { type: "Marigold", priority: 3, selectedVarieties: [] },
  ];

  const result = await localProvider.generateLayout({
    beds,
    seeds,
    sunOrientation: "East",
  });

  const layout = result[0];

  // Check all placements are within bounds
  let boundsViolations = 0;
  for (const placement of layout.placements) {
    const radius = placement.size / 2;
    const leftEdge = placement.x - radius;
    const rightEdge = placement.x + radius;
    const topEdge = placement.y - radius;
    const bottomEdge = placement.y + radius;

    if (leftEdge < 0 || rightEdge > 36 || topEdge < 0 || bottomEdge > 36) {
      boundsViolations++;
    }
  }

  assert.strictEqual(boundsViolations, 0, "All plants should be within bounds");
  assert.strictEqual(
    layout.violations.bounds.length,
    0,
    "Violations report should show no bounds violations",
  );

  console.log(
    `✅ Bounds validation: ${layout.placements.length} plants all within 36x36" bed`,
  );
});

test("Local Provider - Multiple beds", async (t) => {
  const beds = [
    { id: "1", name: "Bed 1", width: 48, height: 48, x: 0, y: 0 },
    { id: "2", name: "Bed 2", width: 60, height: 36, x: 0, y: 50 },
  ];

  const seeds = [
    { type: "Tomato", priority: 5, selectedVarieties: [] },
    { type: "Basil", priority: 4, selectedVarieties: [] },
  ];

  const result = await localProvider.generateLayout({
    beds,
    seeds,
    sunOrientation: "South",
  });

  assert.strictEqual(result.length, 2, "Should have layouts for both beds");

  for (const layout of result) {
    assert.ok(["1", "2"].includes(layout.bedId), "Should have correct bed IDs");
    assert.ok(layout.placements.length > 0, "Each bed should have plants");
  }

  console.log(
    `✅ Multiple beds: Bed 1 has ${result[0].placements.length} plants, Bed 2 has ${result[1].placements.length} plants`,
  );
});

test("Local Provider - Dense packing efficiency", async (t) => {
  const beds = [
    {
      id: "1",
      name: "Intensive Bed",
      width: 48,
      height: 48,
      x: 0,
      y: 0,
    },
  ];

  const seeds = [
    { type: "Tomato", priority: 5, selectedVarieties: [] },
    { type: "Pepper", priority: 5, selectedVarieties: [] },
    { type: "Basil", priority: 4, selectedVarieties: [] },
    { type: "Oregano", priority: 3, selectedVarieties: [] },
    { type: "Thyme", priority: 2, selectedVarieties: [] },
    { type: "Marigold", priority: 3, selectedVarieties: [] },
  ];

  const result = await localProvider.generateLayout({
    beds,
    seeds,
    sunOrientation: "South",
  });

  const layout = result[0];
  const bedSqFt = (48 * 48) / 144; // 16 sq ft

  // Intensive gardening target: 2.5-3.5 plants per sq ft
  const targetMin = Math.ceil(bedSqFt * 2.5); // 40 plants
  const targetMax = Math.ceil(bedSqFt * 3.5); // 56 plants

  assert.ok(
    layout.placements.length >= targetMin * 0.7, // Allow 70% of minimum
    `Should achieve reasonable density (${layout.placements.length}/${targetMin} plants)`,
  );

  // Check packing density
  const densityPercent = parseFloat(layout.stats.packingDensity);
  assert.ok(
    densityPercent > 30,
    `Packing density should be > 30% (got ${densityPercent}%)`,
  );

  console.log(
    `✅ Dense packing: ${layout.placements.length} plants (target ${targetMin}-${targetMax}), density ${layout.stats.packingDensity}`,
  );
});

test("Local Provider - Cluster formation", async (t) => {
  const beds = [
    {
      id: "1",
      name: "Test Bed",
      width: 60,
      height: 60,
      x: 0,
      y: 0,
    },
  ];

  const seeds = [
    { type: "Tomato", priority: 5, selectedVarieties: [] },
    { type: "Basil", priority: 4, selectedVarieties: [] },
    { type: "Thyme", priority: 2, selectedVarieties: [] },
  ];

  const result = await localProvider.generateLayout({
    beds,
    seeds,
    sunOrientation: "South",
  });

  const layout = result[0];

  // Should have clusters for each plant type
  assert.ok(
    layout.clusters.length >= 3,
    `Should have at least 3 clusters (got ${layout.clusters.length})`,
  );

  // Verify cluster information
  const clusterTypes = layout.clusters.map((c) => c.type);
  assert.ok(clusterTypes.includes("Tomato"), "Should have Tomato cluster");
  assert.ok(clusterTypes.includes("Basil"), "Should have Basil cluster");
  assert.ok(clusterTypes.includes("Thyme"), "Should have Thyme cluster");

  // Each cluster should have plants
  for (const cluster of layout.clusters) {
    assert.ok(
      cluster.plantCount > 0,
      `Cluster ${cluster.type} should have plants`,
    );
  }

  console.log(
    `✅ Cluster formation: ${layout.clusters.length} clusters - ${layout.clusters.map((c) => `${c.type} (${c.plantCount})`).join(", ")}`,
  );
});

test("Local Provider - Metadata enrichment", async (t) => {
  const beds = [
    {
      id: "1",
      name: "Test Bed",
      width: 48,
      height: 48,
      x: 0,
      y: 0,
    },
  ];

  const seeds = [
    {
      type: "Tomato",
      priority: 5,
      selectedVarieties: [{ name: "Cherry", spacing: 20 }],
    },
    {
      type: "Basil",
      priority: 4,
      selectedVarieties: [{ name: "Sweet", spacing: 10 }],
    },
  ];

  const result = await localProvider.generateLayout({
    beds,
    seeds,
    sunOrientation: "South",
  });

  const layout = result[0];
  const firstPlacement = layout.placements[0];

  // Check required fields
  assert.ok(firstPlacement.id, "Should have ID");
  assert.ok(firstPlacement.veggieType, "Should have veggieType");
  assert.ok(firstPlacement.varietyName, "Should have varietyName");
  assert.ok(
    typeof firstPlacement.x === "number",
    "Should have numeric x coordinate",
  );
  assert.ok(
    typeof firstPlacement.y === "number",
    "Should have numeric y coordinate",
  );
  assert.ok(
    typeof firstPlacement.size === "number",
    "Should have numeric size",
  );

  // Check enrichment fields
  assert.ok(firstPlacement.spacingAnalysis, "Should have spacingAnalysis");
  assert.ok(
    firstPlacement.placementReasoning,
    "Should have placementReasoning",
  );
  assert.ok(firstPlacement.companionInsights, "Should have companionInsights");

  console.log(`✅ Metadata enrichment: All fields present`);
  console.log(`   Example reasoning: "${firstPlacement.placementReasoning}"`);
});

test("Local Provider - Deterministic with seed", async (t) => {
  const beds = [{ id: "1", width: 48, height: 48, x: 0, y: 0 }];
  const seeds = [
    { type: "Carrot", priority: 3, selectedVarieties: [] },
    { type: "Lettuce", priority: 3, selectedVarieties: [] },
  ];
  const seed = 12345;

  // Run twice with same seed
  const result1 = await localProvider.generateLayout({
    beds,
    seeds,
    sunOrientation: "North",
    config: { random_seed: seed },
  });

  const result2 = await localProvider.generateLayout({
    beds,
    seeds,
    sunOrientation: "North",
    config: { random_seed: seed },
  });

  // Should have same number of placements
  assert.strictEqual(
    result1[0].placements.length,
    result2[0].placements.length,
    "Should have same number of plants",
  );

  // Check first few positions match (exact match for determinism)
  const count = Math.min(5, result1[0].placements.length);
  for (let i = 0; i < count; i++) {
    const p1 = result1[0].placements[i];
    const p2 = result2[0].placements[i];

    assert.strictEqual(p1.x, p2.x, `Plant ${i} x-coordinate should match`);
    assert.strictEqual(p1.y, p2.y, `Plant ${i} y-coordinate should match`);
    assert.strictEqual(
      p1.veggieType,
      p2.veggieType,
      `Plant ${i} type should match`,
    );
  }

  console.log(
    `✅ Deterministic with seed: Identical layouts from seed ${seed}`,
  );
});

test("Local Provider - Performance benchmark", async (t) => {
  const beds = [
    {
      id: "1",
      name: "Large Bed",
      width: 72,
      height: 72,
      x: 0,
      y: 0,
    },
  ];

  const seeds = [
    { type: "Tomato", priority: 5, selectedVarieties: [] },
    { type: "Pepper", priority: 5, selectedVarieties: [] },
    { type: "Basil", priority: 4, selectedVarieties: [] },
    { type: "Oregano", priority: 3, selectedVarieties: [] },
    { type: "Thyme", priority: 2, selectedVarieties: [] },
    { type: "Marigold", priority: 3, selectedVarieties: [] },
    { type: "Sage", priority: 3, selectedVarieties: [] },
  ];

  const startTime = Date.now();

  const result = await localProvider.generateLayout({
    beds,
    seeds,
    sunOrientation: "West",
  });

  const duration = Date.now() - startTime;

  const layout = result[0];

  assert.ok(
    duration < 5000,
    `Should complete in < 5 seconds (took ${duration}ms)`,
  );
  assert.ok(
    layout.placements.length > 30,
    "Should pack many plants in large bed",
  );

  console.log(
    `✅ Performance: ${layout.placements.length} plants in ${duration}ms (${layout.stats.packingDensity} density)`,
  );
});

console.log("\n" + "=".repeat(60));
console.log("LOCAL PROVIDER INTEGRATION TESTS COMPLETE");
console.log("=".repeat(60));
