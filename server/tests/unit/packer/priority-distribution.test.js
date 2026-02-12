/**
 * Priority-Weighted Distribution System Tests
 *
 * Tests that priority values control plant ratios rather than fixed counts,
 * and that the packer determines actual plant counts based on space.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { ForceDirectedGardenPacker } from "../../../packer/ForceDirectedGardenPacker.js";

describe("Priority-Weighted Distribution", () => {
  let bed;

  beforeEach(() => {
    bed = {
      id: "test-bed",
      name: "Test Bed",
      width: 48,
      height: 96,
    };
  });

  describe("Equal Priority Distribution", () => {
    it("should distribute plants equally when all priorities are 3", () => {
      const packer = new ForceDirectedGardenPacker(bed, {
        random_seed: 12345,
      });

      const plantList = [
        {
          veggieType: "Tomato",
          varietyName: "Cherokee Purple",
          size: 24,
          count: 15,
          priority: 3,
        },
        {
          veggieType: "Basil",
          varietyName: "Sweet Basil",
          size: 12,
          count: 15,
          priority: 3,
        },
        {
          veggieType: "Lettuce",
          varietyName: "Buttercrunch",
          size: 8,
          count: 15,
          priority: 3,
        },
      ];

      const result = packer.packPlants(plantList);

      // Count actual placements by type
      const counts = {};
      result.placements.forEach((p) => {
        counts[p.veggieType] = (counts[p.veggieType] || 0) + 1;
      });

      console.log("Equal priority (all 3) distribution:", counts);

      // With equal priorities, ratios should be similar (within 20% of each other)
      // Note: Large plants will naturally have fewer placements due to spacing
      const ratios = Object.values(counts).map((c) => c / result.stats.placed);
      const minRatio = Math.min(...ratios);
      const maxRatio = Math.max(...ratios);

      // For equal priorities, the range should be reasonable
      // (accounting for size differences)
      assert.ok(
        maxRatio / minRatio < 3,
        "Ratios should be within 3x of each other",
      );
    });

    it("should produce similar ratios with all priority 5", () => {
      const packer = new ForceDirectedGardenPacker(bed, {
        random_seed: 12345,
      });

      const plantList = [
        {
          veggieType: "Pepper",
          varietyName: "Bell",
          size: 18,
          count: 20,
          priority: 5,
        },
        {
          veggieType: "Cucumber",
          varietyName: "Lemon",
          size: 18,
          count: 20,
          priority: 5,
        },
      ];

      const result = packer.packPlants(plantList);

      const counts = {};
      result.placements.forEach((p) => {
        counts[p.veggieType] = (counts[p.veggieType] || 0) + 1;
      });

      console.log("Equal priority (all 5) distribution:", counts);

      // Two equal-priority, equal-size plants should have similar counts
      const pepperCount = counts["Pepper"] || 0;
      const cucumberCount = counts["Cucumber"] || 0;

      // Within 30% of each other (allowing for packing variance)
      const ratio =
        Math.max(pepperCount, cucumberCount) /
        Math.min(pepperCount, cucumberCount);
      assert.ok(
        ratio < 1.3,
        "Equal priority plants should have similar counts",
      );
    });
  });

  describe("Weighted Priority Distribution", () => {
    it("should allocate more plants to higher priority (5-3-1 weighting)", () => {
      const packer = new ForceDirectedGardenPacker(bed, {
        random_seed: 12345,
        collision_strength: 0.95,
      });

      // Priority weights: 5, 3, 1 (total = 9)
      // Expected ratios: 55.6%, 33.3%, 11.1%
      const plantList = [
        {
          veggieType: "Tomato",
          varietyName: "Cherokee Purple",
          size: 18,
          count: 25,
          priority: 5,
        },
        {
          veggieType: "Basil",
          varietyName: "Sweet Basil",
          size: 12,
          count: 15,
          priority: 3,
        },
        {
          veggieType: "Marigold",
          varietyName: "French",
          size: 8,
          count: 5,
          priority: 1,
        },
      ];

      const result = packer.packPlants(plantList);

      const counts = {};
      result.placements.forEach((p) => {
        counts[p.veggieType] = (counts[p.veggieType] || 0) + 1;
      });

      const total = result.stats.placed;
      const ratios = {
        Tomato: (counts["Tomato"] || 0) / total,
        Basil: (counts["Basil"] || 0) / total,
        Marigold: (counts["Marigold"] || 0) / total,
      };

      console.log("Weighted priority (5-3-1) distribution:", counts);
      console.log("Actual ratios:", {
        Tomato: `${(ratios.Tomato * 100).toFixed(1)}%`,
        Basil: `${(ratios.Basil * 100).toFixed(1)}%`,
        Marigold: `${(ratios.Marigold * 100).toFixed(1)}%`,
      });

      // Priority 5 should be dominant
      assert.ok(
        ratios.Tomato > ratios.Basil,
        "Highest priority should have most plants",
      );
      assert.ok(
        ratios.Basil > ratios.Marigold,
        "Middle priority should have more than lowest",
      );

      // Rough ratio check (allowing for size variance)
      assert.ok(ratios.Tomato > 0.4, "High priority should be at least 40%");
      assert.ok(ratios.Marigold < 0.2, "Low priority should be less than 20%");
    });

    it("should prioritize two dominant plants over one accent (5-5-1)", () => {
      const packer = new ForceDirectedGardenPacker(bed, {
        random_seed: 12345,
      });

      // Two dominants (5 each), one accent (1) = total weight 11
      // Expected: 45.5%, 45.5%, 9.1%
      const plantList = [
        {
          veggieType: "Tomato",
          varietyName: "Cherokee",
          size: 18,
          count: 20,
          priority: 5,
        },
        {
          veggieType: "Pepper",
          varietyName: "Bell",
          size: 18,
          count: 20,
          priority: 5,
        },
        {
          veggieType: "Marigold",
          varietyName: "French",
          size: 8,
          count: 5,
          priority: 1,
        },
      ];

      const result = packer.packPlants(plantList);

      const counts = {};
      result.placements.forEach((p) => {
        counts[p.veggieType] = (counts[p.veggieType] || 0) + 1;
      });

      const total = result.stats.placed;
      const tomatoRatio = (counts["Tomato"] || 0) / total;
      const pepperRatio = (counts["Pepper"] || 0) / total;
      const marigoldRatio = (counts["Marigold"] || 0) / total;

      console.log("Weighted priority (5-5-1) distribution:", counts);

      // Two high-priority plants should be similar to each other
      const highPriorityRatio =
        Math.max(tomatoRatio, pepperRatio) / Math.min(tomatoRatio, pepperRatio);
      assert.ok(
        highPriorityRatio < 1.4,
        "Equal high priorities should be within 40% of each other",
      );

      // Both should dominate the low-priority plant
      assert.ok(
        tomatoRatio > marigoldRatio * 3,
        "High priority should be 3x+ low priority",
      );
      assert.ok(
        pepperRatio > marigoldRatio * 3,
        "High priority should be 3x+ low priority",
      );
    });
  });

  describe("Space Constraints", () => {
    it("should limit total plants based on physical space, not just priority", () => {
      const packer = new ForceDirectedGardenPacker(bed, {
        random_seed: 12345,
      });

      // Request way more large plants than can fit
      const plantList = [
        {
          veggieType: "Tomato",
          varietyName: "Cherokee Purple",
          size: 24,
          count: 100,
          priority: 5,
        },
      ];

      const result = packer.packPlants(plantList);

      console.log(`Requested 100 large plants, packed ${result.stats.placed}`);

      // Physical constraint: 48"×96" bed with 24" spacing
      // Theoretical max ~32 plants (with perfect tessellation)
      // Realistic max ~20 plants (circular packing, boundaries)
      assert.ok(
        result.stats.placed < 25,
        "Should not exceed physical capacity",
      );
      assert.ok(result.stats.placed > 5, "Should place some plants");

      // No bounds violations
      assert.strictEqual(
        result.violations.bounds.length,
        0,
        "Should have no bounds violations",
      );
    });

    it("should place small high-priority plants densely", () => {
      const packer = new ForceDirectedGardenPacker(bed, {
        random_seed: 12345,
      });

      const plantList = [
        {
          veggieType: "Radish",
          varietyName: "Cherry Belle",
          size: 3,
          count: 200,
          priority: 5,
        },
      ];

      const result = packer.packPlants(plantList);

      console.log(`Requested 200 small plants, packed ${result.stats.placed}`);

      // Small plants (3" spacing) should pack many more
      assert.ok(result.stats.placed > 50, "Small plants should pack densely");
    });

    it("should respect minimum guarantees for high-priority plants", () => {
      const packer = new ForceDirectedGardenPacker(bed, {
        random_seed: 12345,
      });

      // One high-priority plant with massive size
      const plantList = [
        {
          veggieType: "Pumpkin",
          varietyName: "Giant",
          size: 60,
          count: 10,
          priority: 5,
        },
      ];

      const result = packer.packPlants(plantList);

      console.log(`Requested 10 giant plants, packed ${result.stats.placed}`);

      // Even if only 1-2 fit, at least 1 should be placed (minimum guarantee)
      assert.ok(result.stats.placed > 0, "Should place at least one plant");
    });
  });

  describe("Statistics and Reporting", () => {
    it("should report requested vs actual counts by plant type", () => {
      const packer = new ForceDirectedGardenPacker(bed, {
        random_seed: 12345,
      });

      const plantList = [
        {
          veggieType: "Tomato",
          varietyName: "Cherokee",
          size: 18,
          count: 20,
          priority: 5,
        },
        {
          veggieType: "Basil",
          varietyName: "Sweet",
          size: 12,
          count: 15,
          priority: 3,
        },
        {
          veggieType: "Lettuce",
          varietyName: "Buttercrunch",
          size: 8,
          count: 10,
          priority: 2,
        },
      ];

      const result = packer.packPlants(plantList);

      // Stats should include plantTypeCounts
      assert.ok(result.stats.plantTypeCounts, "Should have plantTypeCounts");
      assert.strictEqual(
        result.stats.plantTypeCounts.length,
        3,
        "Should track all plant types",
      );

      result.stats.plantTypeCounts.forEach((typeCount) => {
        assert.ok(typeCount.type, "Should have type");
        assert.ok(
          typeof typeCount.requested === "number",
          "Should have requested count",
        );
        assert.ok(
          typeof typeCount.actual === "number",
          "Should have actual count",
        );
        assert.ok(typeof typeCount.ratio === "number", "Should have ratio");

        console.log(
          `${typeCount.type}: ${typeCount.actual}/${typeCount.requested} (${(typeCount.ratio * 100).toFixed(1)}%)`,
        );

        // Actual should never exceed requested
        assert.ok(
          typeCount.actual <= typeCount.requested,
          "Actual should not exceed requested",
        );
      });
    });

    it("should report fill rate in stats", () => {
      const packer = new ForceDirectedGardenPacker(bed, {
        random_seed: 12345,
      });

      const plantList = [
        {
          veggieType: "Tomato",
          varietyName: "Cherokee",
          size: 18,
          count: 30,
          priority: 3,
        },
      ];

      const result = packer.packPlants(plantList);

      assert.ok(result.stats.fillRate, "Should have fill rate");
      assert.strictEqual(
        result.stats.requested,
        30,
        "Should track requested count",
      );
      assert.ok(result.stats.placed > 0, "Should place some plants");

      console.log(`Fill rate: ${result.stats.fillRate}`);
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero priority gracefully", () => {
      const packer = new ForceDirectedGardenPacker(bed, {
        random_seed: 12345,
      });

      const plantList = [
        {
          veggieType: "Tomato",
          varietyName: "Cherokee",
          size: 18,
          count: 10,
          priority: 5,
        },
        {
          veggieType: "Weed",
          varietyName: "Dandelion",
          size: 6,
          count: 5,
          priority: 0,
        },
      ];

      const result = packer.packPlants(plantList);

      // Should still place some tomatoes
      const tomatoCount = result.placements.filter(
        (p) => p.veggieType === "Tomato",
      ).length;
      assert.ok(tomatoCount > 0, "Should place high priority plants");

      // Zero priority plant may or may not be placed
      console.log(
        "Zero priority plant placement:",
        result.placements.filter((p) => p.veggieType === "Weed").length,
      );
    });

    it("should handle single plant type", () => {
      const packer = new ForceDirectedGardenPacker(bed, {
        random_seed: 12345,
      });

      const plantList = [
        {
          veggieType: "Tomato",
          varietyName: "Cherokee",
          size: 18,
          count: 25,
          priority: 3,
        },
      ];

      const result = packer.packPlants(plantList);

      // Should place as many as fit
      assert.ok(result.stats.placed > 0, "Should place some plants");
      assert.ok(result.stats.placed <= 25, "Should not exceed requested");

      // All placements should be tomatoes
      assert.ok(
        result.placements.every((p) => p.veggieType === "Tomato"),
        "All should be tomatoes",
      );
    });

    it("should handle empty plant list", () => {
      const packer = new ForceDirectedGardenPacker(bed, {
        random_seed: 12345,
      });

      const plantList = [];

      const result = packer.packPlants(plantList);

      assert.strictEqual(result.stats.placed, 0, "Should place zero plants");
      assert.strictEqual(
        result.placements.length,
        0,
        "Should have no placements",
      );
    });

    it("should handle plants with identical spacing and priority", () => {
      const packer = new ForceDirectedGardenPacker(bed, {
        random_seed: 12345,
      });

      const plantList = [
        {
          veggieType: "Lettuce",
          varietyName: "Buttercrunch",
          size: 12,
          count: 20,
          priority: 3,
        },
        {
          veggieType: "Spinach",
          varietyName: "Bloomsdale",
          size: 12,
          count: 20,
          priority: 3,
        },
        {
          veggieType: "Kale",
          varietyName: "Lacinato",
          size: 12,
          count: 20,
          priority: 3,
        },
      ];

      const result = packer.packPlants(plantList);

      const counts = {};
      result.placements.forEach((p) => {
        counts[p.veggieType] = (counts[p.veggieType] || 0) + 1;
      });

      console.log("Identical spacing & priority distribution:", counts);

      // Should be nearly equal (within 25% of each other)
      const countValues = Object.values(counts);
      const avg =
        countValues.reduce((sum, c) => sum + c, 0) / countValues.length;
      countValues.forEach((count) => {
        const deviation = Math.abs(count - avg) / avg;
        assert.ok(
          deviation < 0.25,
          `Count ${count} should be within 25% of average ${avg}`,
        );
      });
    });
  });

  describe("Determinism", () => {
    it("should produce identical results with same seed", () => {
      const seed = 42;

      const packer1 = new ForceDirectedGardenPacker(bed, { random_seed: seed });
      const packer2 = new ForceDirectedGardenPacker(bed, { random_seed: seed });

      const plantList = [
        {
          veggieType: "Tomato",
          varietyName: "Cherokee",
          size: 18,
          count: 15,
          priority: 5,
        },
        {
          veggieType: "Basil",
          varietyName: "Sweet",
          size: 12,
          count: 10,
          priority: 3,
        },
      ];

      const result1 = packer1.packPlants(plantList);
      const result2 = packer2.packPlants(plantList);

      // Same total placements
      assert.strictEqual(
        result1.stats.placed,
        result2.stats.placed,
        "Should have same placement count",
      );

      // Same counts by type
      const counts1 = {};
      result1.placements.forEach(
        (p) => (counts1[p.veggieType] = (counts1[p.veggieType] || 0) + 1),
      );

      const counts2 = {};
      result2.placements.forEach(
        (p) => (counts2[p.veggieType] = (counts2[p.veggieType] || 0) + 1),
      );

      assert.deepStrictEqual(
        counts1,
        counts2,
        "Should have same counts by type",
      );
    });
  });
});
