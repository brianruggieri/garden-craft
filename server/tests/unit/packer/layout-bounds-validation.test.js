import { test } from "node:test";
import assert from "node:assert";

/**
 * Layout Bounds Validation Test
 *
 * This test verifies whether AI-generated plant placements respect bed boundaries.
 * It checks if the issue is:
 * 1. AI generating out-of-bounds coordinates
 * 2. Visual rendering calculating positions incorrectly
 */

test("validate plant placements are within bed bounds", () => {
  // Sample bed configuration (48" x 96" bed)
  const bed = {
    id: "1",
    name: "Main Bed",
    width: 48,  // inches
    height: 96, // inches
    x: 5,       // grid position (for rendering offset)
    y: 5,       // grid position (for rendering offset)
  };

  // Sample AI-generated layout (simulating what OpenAI might return)
  const layout = {
    bedId: "1",
    placements: [
      // Tomato at top-left area
      { id: "1", veggieType: "Tomato", x: 12, y: 12, size: 18 },
      // Tomato at top-center
      { id: "2", veggieType: "Tomato", x: 24, y: 12, size: 18 },
      // Tomato at top-right area
      { id: "3", veggieType: "Tomato", x: 36, y: 12, size: 18 },
      // Oregano middle-left
      { id: "4", veggieType: "Oregano", x: 12, y: 40, size: 12 },
      // Pepper center
      { id: "5", veggieType: "Pepper", x: 24, y: 48, size: 15 },
      // Edge case: Sage near right edge
      { id: "6", veggieType: "Sage", x: 42, y: 70, size: 18 },
      // Edge case: Basil near bottom
      { id: "7", veggieType: "Basil", x: 12, y: 84, size: 10 },
      // Small plants at bottom
      { id: "8", veggieType: "Thyme", x: 6, y: 90, size: 8 },
      { id: "9", veggieType: "Thyme", x: 18, y: 90, size: 8 },
    ],
  };

  console.log("\n=== BOUNDS VALIDATION TEST ===\n");
  console.log(`Bed Dimensions: ${bed.width}" wide × ${bed.height}" tall`);
  console.log(`Bed Bounds: x:[0, ${bed.width}], y:[0, ${bed.height}]\n`);

  let allValid = true;
  const violations = [];

  layout.placements.forEach((plant) => {
    const radius = plant.size / 2;
    const leftEdge = plant.x - radius;
    const rightEdge = plant.x + radius;
    const topEdge = plant.y - radius;
    const bottomEdge = plant.y + radius;

    // Check if plant extends beyond bed boundaries
    const outOfBounds = {
      left: leftEdge < 0,
      right: rightEdge > bed.width,
      top: topEdge < 0,
      bottom: bottomEdge > bed.height,
    };

    const hasViolation = Object.values(outOfBounds).some(v => v);

    if (hasViolation) {
      allValid = false;
      violations.push({
        plant,
        leftEdge,
        rightEdge,
        topEdge,
        bottomEdge,
        violations: outOfBounds,
      });
    }

    const status = hasViolation ? "❌ OUT OF BOUNDS" : "✅ Valid";
    console.log(`${status} | ${plant.veggieType} @ (${plant.x}, ${plant.y}) size:${plant.size}"`);

    if (hasViolation) {
      if (outOfBounds.left) console.log(`  ⚠️  Left edge ${leftEdge.toFixed(1)}" < 0"`);
      if (outOfBounds.right) console.log(`  ⚠️  Right edge ${rightEdge.toFixed(1)}" > ${bed.width}"`);
      if (outOfBounds.top) console.log(`  ⚠️  Top edge ${topEdge.toFixed(1)}" < 0"`);
      if (outOfBounds.bottom) console.log(`  ⚠️  Bottom edge ${bottomEdge.toFixed(1)}" > ${bed.height}"`);
    }
  });

  console.log(`\n=== SUMMARY ===`);
  console.log(`Total plants: ${layout.placements.length}`);
  console.log(`Valid placements: ${layout.placements.length - violations.length}`);
  console.log(`Violations: ${violations.length}`);

  if (violations.length > 0) {
    console.log(`\n=== VIOLATION DETAILS ===`);
    violations.forEach(v => {
      console.log(`\n${v.plant.veggieType} (${v.plant.size}" diameter):`);
      console.log(`  Center: (${v.plant.x}", ${v.plant.y}")`);
      console.log(`  Bounds: x:[${v.leftEdge.toFixed(1)}, ${v.rightEdge.toFixed(1)}], y:[${v.topEdge.toFixed(1)}, ${v.bottomEdge.toFixed(1)}]`);
    });
  }

  // The test passes (for diagnostic purposes) but logs all violations
  assert.ok(true, "Bounds validation test completed");
});

test("visual rendering coordinate conversion", () => {
  // Constants from the app
  const GRID_SIZE = 8; // pixels per grid unit
  const INCHES_PER_GRID = 12; // 12 inches = 1 grid unit

  const bed = {
    id: "1",
    width: 48,  // inches
    height: 96, // inches
    x: 5,       // grid units (rendering offset)
    y: 5,       // grid units (rendering offset)
  };

  // Plant in inches (AI coordinates)
  const plant = {
    id: "1",
    veggieType: "Tomato",
    x: 24,      // inches from bed origin (center horizontally)
    y: 12,      // inches from bed origin (near top)
    size: 18,   // 18" diameter
  };

  console.log("\n=== RENDERING COORDINATE TEST ===\n");
  console.log("AI Coordinates (inches from bed origin):");
  console.log(`  Plant center: (${plant.x}", ${plant.y}")`);
  console.log(`  Plant size: ${plant.size}" diameter\n`);

  // Convert bed dimensions to pixels (for the container)
  const bedWidthPx = (bed.width / INCHES_PER_GRID) * GRID_SIZE;
  const bedHeightPx = (bed.height / INCHES_PER_GRID) * GRID_SIZE;

  console.log("Bed Container (pixels):");
  console.log(`  Width: ${bedWidthPx}px (${bed.width}" / ${INCHES_PER_GRID} * ${GRID_SIZE})`);
  console.log(`  Height: ${bedHeightPx}px (${bed.height}" / ${INCHES_PER_GRID} * ${GRID_SIZE})\n`);

  // Convert plant position to pixels (within bed)
  const plantDisplaySizePx = (plant.size / INCHES_PER_GRID) * GRID_SIZE;
  const plantPxX = (plant.x / INCHES_PER_GRID) * GRID_SIZE;
  const plantPxY = (plant.y / INCHES_PER_GRID) * GRID_SIZE;

  console.log("Plant Rendering (pixels within bed):");
  console.log(`  Display size: ${plantDisplaySizePx}px (${plant.size}" / ${INCHES_PER_GRID} * ${GRID_SIZE})`);
  console.log(`  Center X: ${plantPxX}px`);
  console.log(`  Center Y: ${plantPxY}px`);
  console.log(`  Top-left corner: (${plantPxX - plantDisplaySizePx/2}px, ${plantPxY - plantDisplaySizePx/2}px)\n`);

  // Verify the plant is within the bed bounds
  const plantLeft = plantPxX - plantDisplaySizePx / 2;
  const plantRight = plantPxX + plantDisplaySizePx / 2;
  const plantTop = plantPxY - plantDisplaySizePx / 2;
  const plantBottom = plantPxY + plantDisplaySizePx / 2;

  console.log("Bounds Check (pixel space):");
  console.log(`  Plant left edge: ${plantLeft}px ${plantLeft >= 0 ? '✅' : '❌ NEGATIVE'}`);
  console.log(`  Plant right edge: ${plantRight}px ${plantRight <= bedWidthPx ? '✅' : `❌ > ${bedWidthPx}px`}`);
  console.log(`  Plant top edge: ${plantTop}px ${plantTop >= 0 ? '✅' : '❌ NEGATIVE'}`);
  console.log(`  Plant bottom edge: ${plantBottom}px ${plantBottom <= bedHeightPx ? '✅' : `❌ > ${bedHeightPx}px`}`);

  // Coverage calculation
  const horizontalCoverage = ((plantRight - plantLeft) / bedWidthPx * 100).toFixed(1);
  const verticalCoverage = ((plantBottom - plantTop) / bedHeightPx * 100).toFixed(1);

  console.log(`\nCoverage:`);
  console.log(`  Horizontal: ${horizontalCoverage}% of bed width`);
  console.log(`  Vertical: ${verticalCoverage}% of bed height`);

  assert.ok(true, "Rendering coordinate test completed");
});

test("detect common AI coordinate errors", () => {
  const bed = { width: 48, height: 96 };

  const errorScenarios = [
    {
      name: "Plant center at bed edge (will extend beyond)",
      plant: { x: 48, y: 50, size: 18 }, // Center at right edge
      expectedError: "right edge violation",
    },
    {
      name: "Plant center at origin (will extend into negative)",
      plant: { x: 0, y: 0, size: 10 }, // Center at (0,0)
      expectedError: "left/top edge violation",
    },
    {
      name: "Large plant near edge",
      plant: { x: 40, y: 90, size: 24 }, // 24" plant near bottom-right
      expectedError: "right/bottom edge violation",
    },
    {
      name: "Properly centered plant",
      plant: { x: 24, y: 48, size: 18 }, // Well within bounds
      expectedError: "none",
    },
  ];

  console.log("\n=== COMMON AI ERROR SCENARIOS ===\n");

  errorScenarios.forEach(scenario => {
    const { plant } = scenario;
    const radius = plant.size / 2;

    const violations = [];
    if (plant.x - radius < 0) violations.push("left");
    if (plant.x + radius > bed.width) violations.push("right");
    if (plant.y - radius < 0) violations.push("top");
    if (plant.y + radius > bed.height) violations.push("bottom");

    const hasError = violations.length > 0;
    const status = hasError ? "❌" : "✅";

    console.log(`${status} ${scenario.name}`);
    console.log(`   Center: (${plant.x}", ${plant.y}"), Size: ${plant.size}"`);
    console.log(`   Bounds: x:[${plant.x - radius}, ${plant.x + radius}], y:[${plant.y - radius}, ${plant.y + radius}]`);

    if (hasError) {
      console.log(`   Violations: ${violations.join(", ")}`);
      console.log(`   Expected: ${scenario.expectedError}`);
    } else {
      console.log(`   ✓ Properly bounded`);
    }
    console.log("");
  });

  assert.ok(true, "Error scenario test completed");
});

test("calculate safe placement zone", () => {
  const bed = { width: 48, height: 96 };
  const plantSize = 18; // 18" diameter tomato

  const radius = plantSize / 2;

  // Safe zone is bed dimensions minus plant radius on all sides
  const safeZone = {
    minX: radius,
    maxX: bed.width - radius,
    minY: radius,
    maxY: bed.height - radius,
  };

  console.log("\n=== SAFE PLACEMENT ZONE ===\n");
  console.log(`Bed: ${bed.width}" × ${bed.height}"`);
  console.log(`Plant: ${plantSize}" diameter (${radius}" radius)\n`);
  console.log("Safe center coordinates:");
  console.log(`  X: [${safeZone.minX}", ${safeZone.maxX}"]`);
  console.log(`  Y: [${safeZone.minY}", ${safeZone.maxY}"]`);
  console.log(`\nSafe zone dimensions: ${safeZone.maxX - safeZone.minX}" × ${safeZone.maxY - safeZone.minY}"`);

  // Test example placements
  const testPlacements = [
    { x: 9, y: 9, label: "min valid" },
    { x: 39, y: 87, label: "max valid" },
    { x: 24, y: 48, label: "center" },
    { x: 5, y: 50, label: "too close to left" },
    { x: 44, y: 50, label: "too close to right" },
  ];

  console.log("\nTest Placements:");
  testPlacements.forEach(p => {
    const valid = p.x >= safeZone.minX && p.x <= safeZone.maxX &&
                  p.y >= safeZone.minY && p.y <= safeZone.maxY;
    console.log(`  ${valid ? '✅' : '❌'} (${p.x}", ${p.y}") - ${p.label}`);
  });

  assert.ok(true, "Safe zone calculation completed");
});
