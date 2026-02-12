/**
 * Test script to verify pill-shaped bed bounds checking
 * Validates that plants respect rounded edges of pill/stadium-shaped beds
 */

import { HierarchicalCirclePacker } from "../../packer/HierarchicalCirclePacker";

console.log("=== Testing Pill-Shaped Bed Bounds ===\n");

// Test 1: Horizontal pill (width > height)
console.log('Test 1: Horizontal Pill (100" × 48")');
const horizontalPacker = new HierarchicalCirclePacker(100, 48, {
  shape: "pill",
  random_seed: 12345,
});

// Test bounds checking at various points
const horizontalTests = [
  // Points that should be INSIDE
  { x: 50, y: 24, r: 5, expected: true, desc: "Center of bed" },
  { x: 30, y: 24, r: 8, expected: true, desc: "Middle rectangle area" },
  { x: 70, y: 24, r: 8, expected: true, desc: "Middle rectangle area (right)" },

  // Points near left cap
  { x: 24, y: 24, r: 18, expected: true, desc: "Left cap center, well inside" },
  { x: 24, y: 10, r: 8, expected: true, desc: "Left cap, upper area" },
  { x: 24, y: 38, r: 8, expected: true, desc: "Left cap, lower area" },

  // Points near right cap
  {
    x: 76,
    y: 24,
    r: 18,
    expected: true,
    desc: "Right cap center, well inside",
  },
  { x: 76, y: 10, r: 8, expected: true, desc: "Right cap, upper area" },
  { x: 76, y: 38, r: 8, expected: true, desc: "Right cap, lower area" },

  // Points that should be OUTSIDE (overlapping rounded edges)
  {
    x: 15,
    y: 5,
    r: 8,
    expected: false,
    desc: "Left cap corner, should overflow",
  },
  {
    x: 15,
    y: 43,
    r: 8,
    expected: false,
    desc: "Left cap corner (bottom), should overflow",
  },
  {
    x: 85,
    y: 5,
    r: 8,
    expected: false,
    desc: "Right cap corner, should overflow",
  },
  {
    x: 85,
    y: 43,
    r: 8,
    expected: false,
    desc: "Right cap corner (bottom), should overflow",
  },
  { x: 10, y: 24, r: 20, expected: false, desc: "Too large for left cap" },
  { x: 90, y: 24, r: 20, expected: false, desc: "Too large for right cap" },
];

let horizontalPassed = 0;
let horizontalFailed = 0;

horizontalTests.forEach((test) => {
  const result = horizontalPacker.isCircleInsideBed(test.x, test.y, test.r);
  const passed = result === test.expected;

  if (passed) {
    console.log(`  ✓ ${test.desc} - at (${test.x}, ${test.y}) r=${test.r}`);
    horizontalPassed++;
  } else {
    console.log(`  ✗ ${test.desc} - at (${test.x}, ${test.y}) r=${test.r}`);
    console.log(`    Expected: ${test.expected}, Got: ${result}`);
    horizontalFailed++;
  }
});

console.log(
  `\nHorizontal Pill: ${horizontalPassed}/${horizontalTests.length} tests passed\n`,
);

// Test 2: Vertical pill (height > width)
console.log('Test 2: Vertical Pill (48" × 136")');
const verticalPacker = new HierarchicalCirclePacker(48, 136, {
  shape: "pill",
  random_seed: 12345,
});

const verticalTests = [
  // Points that should be INSIDE
  { x: 24, y: 68, r: 5, expected: true, desc: "Center of bed" },
  { x: 24, y: 40, r: 8, expected: true, desc: "Middle rectangle area (upper)" },
  { x: 24, y: 96, r: 8, expected: true, desc: "Middle rectangle area (lower)" },

  // Points near top cap
  { x: 24, y: 24, r: 18, expected: true, desc: "Top cap center, well inside" },
  { x: 10, y: 24, r: 8, expected: true, desc: "Top cap, left area" },
  { x: 38, y: 24, r: 8, expected: true, desc: "Top cap, right area" },

  // Points near bottom cap
  {
    x: 24,
    y: 112,
    r: 18,
    expected: true,
    desc: "Bottom cap center, well inside",
  },
  { x: 10, y: 112, r: 8, expected: true, desc: "Bottom cap, left area" },
  { x: 38, y: 112, r: 8, expected: true, desc: "Bottom cap, right area" },

  // Points that should be OUTSIDE (overlapping rounded edges)
  {
    x: 5,
    y: 15,
    r: 8,
    expected: false,
    desc: "Top cap corner, should overflow",
  },
  {
    x: 43,
    y: 15,
    r: 8,
    expected: false,
    desc: "Top cap corner (right), should overflow",
  },
  {
    x: 5,
    y: 121,
    r: 8,
    expected: false,
    desc: "Bottom cap corner, should overflow",
  },
  {
    x: 43,
    y: 121,
    r: 8,
    expected: false,
    desc: "Bottom cap corner (right), should overflow",
  },
  { x: 24, y: 10, r: 20, expected: false, desc: "Too large for top cap" },
  { x: 24, y: 126, r: 20, expected: false, desc: "Too large for bottom cap" },
];

let verticalPassed = 0;
let verticalFailed = 0;

verticalTests.forEach((test) => {
  const result = verticalPacker.isCircleInsideBed(test.x, test.y, test.r);
  const passed = result === test.expected;

  if (passed) {
    console.log(`  ✓ ${test.desc} - at (${test.x}, ${test.y}) r=${test.r}`);
    verticalPassed++;
  } else {
    console.log(`  ✗ ${test.desc} - at (${test.x}, ${test.y}) r=${test.r}`);
    console.log(`    Expected: ${test.expected}, Got: ${result}`);
    verticalFailed++;
  }
});

console.log(
  `\nVertical Pill: ${verticalPassed}/${verticalTests.length} tests passed\n`,
);

// Test 3: Clamp position functionality
console.log("Test 3: Position Clamping");

// Test horizontal pill clamping
const clampTests = [
  {
    packer: horizontalPacker,
    x: 85,
    y: 5,
    r: 8,
    desc: "Clamp point from right cap corner",
  },
  {
    packer: horizontalPacker,
    x: 15,
    y: 43,
    r: 8,
    desc: "Clamp point from left cap corner",
  },
  {
    packer: verticalPacker,
    x: 5,
    y: 15,
    r: 8,
    desc: "Clamp point from top cap corner",
  },
  {
    packer: verticalPacker,
    x: 43,
    y: 121,
    r: 8,
    desc: "Clamp point from bottom cap corner",
  },
];

clampTests.forEach((test) => {
  const clamped = test.packer.clampPositionToBed(test.x, test.y, test.r);
  const isInside = test.packer.isCircleInsideBed(clamped.x, clamped.y, test.r);

  if (isInside) {
    console.log(`  ✓ ${test.desc}`);
    console.log(
      `    Original: (${test.x}, ${test.y}) → Clamped: (${clamped.x.toFixed(1)}, ${clamped.y.toFixed(1)})`,
    );
  } else {
    console.log(`  ✗ ${test.desc} - clamped position still outside!`);
    console.log(
      `    Original: (${test.x}, ${test.y}) → Clamped: (${clamped.x.toFixed(1)}, ${clamped.y.toFixed(1)})`,
    );
  }
});

// Test 4: Full packing test with pill shape
console.log("\nTest 4: Full Packing with Pill Shape");

const testPacker = new HierarchicalCirclePacker(100, 48, {
  shape: "pill",
  random_seed: 42,
  max_iterations: 300,
});

const plantGroups = [
  {
    type: "Tomato",
    plants: [
      { id: "t1", varietyName: "Roma", radius: 12, priority: 3, spacing: 24 },
      { id: "t2", varietyName: "Cherry", radius: 10, priority: 3, spacing: 20 },
    ],
  },
  {
    type: "Basil",
    plants: [
      { id: "b1", varietyName: "Sweet", radius: 4, priority: 3, spacing: 8 },
      { id: "b2", varietyName: "Thai", radius: 4, priority: 3, spacing: 8 },
      { id: "b3", varietyName: "Purple", radius: 4, priority: 3, spacing: 8 },
      { id: "b4", varietyName: "Lemon", radius: 4, priority: 3, spacing: 8 },
    ],
  },
  {
    type: "Pepper",
    plants: [
      { id: "p1", varietyName: "Bell", radius: 9, priority: 3, spacing: 18 },
      {
        id: "p2",
        varietyName: "Jalapeño",
        radius: 8,
        priority: 3,
        spacing: 16,
      },
    ],
  },
];

const result = testPacker.pack(plantGroups);

console.log(`  Placed ${result.placements.length} plants`);
console.log(`  Requested: ${result.requested}, Fill rate: ${result.fillRate}%`);

// Verify all placements are inside bounds
let allInside = true;
let edgeViolations = 0;

result.placements.forEach((placement) => {
  const isInside = testPacker.isCircleInsideBed(
    placement.x,
    placement.y,
    placement.size / 2,
  );
  if (!isInside) {
    allInside = false;
    edgeViolations++;
    console.log(
      `  ✗ Plant ${placement.id} at (${placement.x.toFixed(1)}, ${placement.y.toFixed(1)}) r=${(placement.size / 2).toFixed(1)} is OUTSIDE bed bounds!`,
    );
  }
});

if (allInside) {
  console.log(
    `  ✓ All ${result.placements.length} plants are correctly bounded within pill shape`,
  );
} else {
  console.log(
    `  ✗ ${edgeViolations}/${result.placements.length} plants violate pill boundaries!`,
  );
}

// Summary
console.log("\n=== Summary ===");
const totalTests = horizontalTests.length + verticalTests.length;
const totalPassed = horizontalPassed + verticalPassed;
console.log(`Geometry Tests: ${totalPassed}/${totalTests} passed`);
console.log(
  `Full Packing Test: ${allInside ? "PASSED" : "FAILED"} (${edgeViolations} violations)`,
);

const overallSuccess = totalPassed === totalTests && allInside;
console.log(
  `\nOverall Result: ${overallSuccess ? "✓ ALL TESTS PASSED" : "✗ SOME TESTS FAILED"}`,
);

process.exit(overallSuccess ? 0 : 1);
