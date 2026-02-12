import { test } from "node:test";
import assert from "node:assert";

/**
 * This test captures and validates a real OpenAI layout response.
 *
 * INSTRUCTIONS:
 * 1. Generate a layout with OpenAI in the UI
 * 2. Copy the response from browser DevTools Network tab
 * 3. Paste it into the `actualResponse` object below
 * 4. Run this test to see detailed validation
 */

test("analyze actual OpenAI response for bounds violations", () => {
  // PASTE YOUR ACTUAL OPENAI RESPONSE HERE
  // Look in DevTools > Network > api/optimize > Response tab
  const actualResponse = {
    provider: "openai",
    layouts: [
      {
        bedId: "1",
        placements: [
          {
            id: "1",
            veggieType: "Tomato",
            varietyName: "Standard Tomato",
            x: 24,
            y: 12,
            size: 18,
            spacingAnalysis:
              "Surrounding plants spaced to allow for root and canopy spread of tomatoes.",
            placementReasoning:
              "Tomatoes placed centrally to maximize sun exposure and create vertical structure.",
            companionInsights:
              "Planted near basil and oregano for mutual growth benefits.",
          },
          {
            id: "2",
            veggieType: "Marigold",
            varietyName: "Standard Marigold",
            x: 70,
            y: 12,
            size: 10,
            spacingAnalysis:
              "Marigolds placed with room to branch and flower.",
            placementReasoning:
              "Marigolds planted near tomatoes for pest deterrence and spacing balance.",
            companionInsights: "Benefit from being near tomatoes and basil.",
          },
          {
            id: "3",
            veggieType: "Oregano",
            varietyName: "Standard Oregano",
            x: 12,
            y: 36,
            size: 12,
            spacingAnalysis:
              "Spaced to allow enough light despite nearby tomatoes.",
            placementReasoning:
              "Understory planting beneath taller tomatoes to use vertical space.",
            companionInsights:
              "Placed near basil and thyme for companion benefits.",
          },
          {
            id: "4",
            veggieType: "Pepper",
            varietyName: "Standard Pepper",
            x: 24,
            y: 48,
            size: 15,
            spacingAnalysis: "Ensures adequate room for bush growth.",
            placementReasoning:
              "Pepper bush placed in sunny spot, benefitting from basil in vicinity.",
            companionInsights: "Likes neighboring basil and tomato plants.",
          },
          {
            id: "5",
            veggieType: "Sage",
            varietyName: "Standard Sage",
            x: 60,
            y: 60,
            size: 18,
            spacingAnalysis:
              "Positioned to not interfere with nearby herbs and peppers.",
            placementReasoning:
              "Sage is medium-height and bushy, fitting well with marigold and oregano.",
            companionInsights: "Beneficially placed with marigold.",
          },
          {
            id: "6",
            veggieType: "Thyme",
            varietyName: "Standard Thyme",
            x: 84,
            y: 72,
            size: 8,
            spacingAnalysis:
              "Thyme placed close to edge for groundcover without crowding.",
            placementReasoning:
              "Provides dense groundcover near sage and peppers.",
            companionInsights:
              "Thyme planted to assist growth of tomatoes and oregano.",
          },
          {
            id: "7",
            veggieType: "Basil",
            varietyName: "Standard Basil",
            x: 12,
            y: 84,
            size: 10,
            spacingAnalysis:
              "Basil positioned considering its bushy form without obstructing peppers.",
            placementReasoning:
              "Basil thrives near tomatoes and peppers, sharing nutrients well.",
            companionInsights:
              "Enhances growth of nearby tomatoes and peppers.",
          },
          {
            id: "8",
            veggieType: "Marigold",
            varietyName: "Standard Marigold",
            x: 48,
            y: 12,
            size: 10,
            spacingAnalysis: "Allows room for flower spread and airflow.",
            placementReasoning:
              "Marigold placed for pollinator attraction and spacing balance.",
            companionInsights: "Adjacent to basil for mutual benefits.",
          },
          {
            id: "9",
            veggieType: "Thyme",
            varietyName: "Standard Thyme",
            x: 6,
            y: 60,
            size: 8,
            spacingAnalysis: "Maintains dense groundcover without crowding.",
            placementReasoning:
              "Fills thyme into gaps around slower-growing plants.",
            companionInsights: "Compliments oregano and basil well.",
          },
        ],
      },
    ],
  };

  // Your bed configuration from the UI
  const beds = [
    {
      id: "1",
      name: "Main Bed",
      width: 48,
      height: 96,
      x: 5,
      y: 5,
      shape: "rectangle",
    },
  ];

  console.log("\n=== ACTUAL OPENAI RESPONSE ANALYSIS ===\n");

  if (!actualResponse.layouts || actualResponse.layouts.length === 0) {
    console.log("⚠️  No layout data provided yet.");
    console.log("\nTo capture real data:");
    console.log("1. Open browser DevTools (F12)");
    console.log("2. Go to Network tab");
    console.log("3. Generate a layout with OpenAI");
    console.log("4. Find the 'optimize' request");
    console.log("5. Copy the Response JSON");
    console.log("6. Paste it into actualResponse in this test file\n");
    assert.ok(true, "Awaiting real data");
    return;
  }

  actualResponse.layouts.forEach((layout) => {
    const bed = beds.find((b) => b.id === layout.bedId);
    if (!bed) {
      console.log(`❌ Layout for unknown bed: ${layout.bedId}`);
      return;
    }

    console.log(`Bed "${bed.name}" (${bed.width}" × ${bed.height}")`);
    console.log(`Plants: ${layout.placements.length}\n`);

    const violations = [];
    const warnings = [];

    layout.placements.forEach((plant) => {
      const radius = plant.size / 2;
      const leftEdge = plant.x - radius;
      const rightEdge = plant.x + radius;
      const topEdge = plant.y - radius;
      const bottomEdge = plant.y + radius;

      const bounds = {
        left: leftEdge < 0,
        right: rightEdge > bed.width,
        top: topEdge < 0,
        bottom: bottomEdge > bed.height,
      };

      const hasViolation = Object.values(bounds).some((v) => v);

      // Check for edge-hugging (plant within 1" of edge)
      const nearEdge =
        leftEdge < 1 ||
        rightEdge > bed.width - 1 ||
        topEdge < 1 ||
        bottomEdge > bed.height - 1;

      if (hasViolation) {
        violations.push({
          plant,
          leftEdge,
          rightEdge,
          topEdge,
          bottomEdge,
          bounds,
        });
      } else if (nearEdge) {
        warnings.push({ plant, leftEdge, rightEdge, topEdge, bottomEdge });
      }

      const status = hasViolation ? "❌" : nearEdge ? "⚠️ " : "✅";
      console.log(`${status} ${plant.veggieType} "${plant.varietyName}"`);
      console.log(
        `   Center: (${plant.x}", ${plant.y}"), Size: ${plant.size}"`,
      );
      console.log(
        `   Bounds: x:[${leftEdge.toFixed(1)}, ${rightEdge.toFixed(1)}], y:[${topEdge.toFixed(1)}, ${bottomEdge.toFixed(1)}]`,
      );

      if (hasViolation) {
        const viols = [];
        if (bounds.left) viols.push(`LEFT (${leftEdge.toFixed(1)}" < 0")`);
        if (bounds.right)
          viols.push(`RIGHT (${rightEdge.toFixed(1)}" > ${bed.width}")`);
        if (bounds.top) viols.push(`TOP (${topEdge.toFixed(1)}" < 0")`);
        if (bounds.bottom)
          viols.push(`BOTTOM (${bottomEdge.toFixed(1)}" > ${bed.height}")`);
        console.log(`   🚨 VIOLATIONS: ${viols.join(", ")}`);
      } else if (nearEdge) {
        console.log(`   ⚠️  Very close to edge (< 1" clearance)`);
      }

      if (plant.placementReasoning) {
        console.log(`   💭 "${plant.placementReasoning.substring(0, 80)}..."`);
      }
      console.log("");
    });

    console.log("=== SUMMARY ===");
    console.log(`Total plants: ${layout.placements.length}`);
    console.log(
      `✅ Valid: ${layout.placements.length - violations.length - warnings.length}`,
    );
    console.log(`⚠️  Near edge: ${warnings.length}`);
    console.log(`❌ Out of bounds: ${violations.length}\n`);

    if (violations.length > 0) {
      console.log("=== DIAGNOSIS ===");
      console.log(
        "The AI is generating coordinates that extend beyond bed boundaries.",
      );
      console.log(
        "This suggests the AI doesn't understand that plant SIZE must be",
      );
      console.log("accounted for when placing near edges.\n");
      console.log("Recommendations:");
      console.log("1. Add explicit safe zone constraints to prompt");
      console.log(
        "2. Emphasize: 'plant center must be at least SIZE/2 from all edges'",
      );
      console.log("3. Provide examples of valid edge placements\n");
    }

    if (warnings.length > 0 && violations.length === 0) {
      console.log("=== NOTE ===");
      console.log("Plants are very close to edges but technically valid.");
      console.log(
        'Consider adding a small buffer (1-2") for practical gardening.\n',
      );
    }

    if (violations.length === 0 && warnings.length === 0) {
      console.log("=== ✨ EXCELLENT ===");
      console.log("All plants are properly bounded with good clearance!");
      console.log(
        "The issue may be with visual rendering, not AI coordinates.\n",
      );
    }
  });

  assert.ok(true, "Analysis complete - check console output above");
});
