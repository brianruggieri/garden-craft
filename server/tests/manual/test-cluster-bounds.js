/**
 * Simple test to verify cluster initial placement respects bounds
 */

import { HierarchicalCirclePacker } from "../../packer/HierarchicalCirclePacker.js";

console.log("=".repeat(80));
console.log("CLUSTER BOUNDS TEST");
console.log("=".repeat(80));

const bed = {
  width: 48,
  height: 96,
  shape: "rectangle",
};

console.log(`\nBed: ${bed.width}" × ${bed.height}" (${bed.shape})`);

// Create plant groups with different sizes
const plantGroups = [
  {
    type: "Tomato",
    plants: [
      {
        id: "1",
        radius: 12,
        priority: 3,
        veggieType: "Tomato",
        meta: { spacing: 24 },
      },
      {
        id: "2",
        radius: 12,
        priority: 3,
        veggieType: "Tomato",
        meta: { spacing: 24 },
      },
      {
        id: "3",
        radius: 12,
        priority: 3,
        veggieType: "Tomato",
        meta: { spacing: 24 },
      },
      {
        id: "4",
        radius: 12,
        priority: 3,
        veggieType: "Tomato",
        meta: { spacing: 24 },
      },
      {
        id: "5",
        radius: 12,
        priority: 3,
        veggieType: "Tomato",
        meta: { spacing: 24 },
      },
    ],
    companions: [],
    antagonists: [],
  },
  {
    type: "Basil",
    plants: [
      {
        id: "6",
        radius: 6,
        priority: 3,
        veggieType: "Basil",
        meta: { spacing: 12 },
      },
      {
        id: "7",
        radius: 6,
        priority: 3,
        veggieType: "Basil",
        meta: { spacing: 12 },
      },
      {
        id: "8",
        radius: 6,
        priority: 3,
        veggieType: "Basil",
        meta: { spacing: 12 },
      },
    ],
    companions: [],
    antagonists: [],
  },
  {
    type: "Lettuce",
    plants: [
      {
        id: "9",
        radius: 4,
        priority: 3,
        veggieType: "Lettuce",
        meta: { spacing: 8 },
      },
      {
        id: "10",
        radius: 4,
        priority: 3,
        veggieType: "Lettuce",
        meta: { spacing: 8 },
      },
    ],
    companions: [],
    antagonists: [],
  },
];

const packer = new HierarchicalCirclePacker(bed.width, bed.height, {
  shape: bed.shape,
  random_seed: 42,
});

console.log("\nCreating clusters...\n");

// Create clusters (this will trigger the console.log in createClusters)
packer.createClusters(plantGroups);

console.log("\n" + "-".repeat(80));
console.log("VERIFICATION");
console.log("-".repeat(80));

let allClustersValid = true;

packer.clusters.forEach((cluster) => {
  const leftEdge = cluster.x - cluster.radius;
  const rightEdge = cluster.x + cluster.radius;
  const topEdge = cluster.y - cluster.radius;
  const bottomEdge = cluster.y + cluster.radius;

  const withinBounds =
    leftEdge >= 0 &&
    rightEdge <= bed.width &&
    topEdge >= 0 &&
    bottomEdge <= bed.height;

  const status = withinBounds ? "✓" : "✗";

  console.log(`${status} ${cluster.type}:`);
  console.log(
    `    Center: (${cluster.x.toFixed(1)}, ${cluster.y.toFixed(1)}), Radius: ${cluster.radius.toFixed(1)}"`,
  );
  console.log(
    `    Edges: left=${leftEdge.toFixed(1)}", right=${rightEdge.toFixed(1)}", top=${topEdge.toFixed(1)}", bottom=${bottomEdge.toFixed(1)}"`,
  );

  if (leftEdge < 0) {
    console.log(`    ⚠️  LEFT VIOLATION: ${leftEdge.toFixed(1)}" < 0`);
    allClustersValid = false;
  }
  if (rightEdge > bed.width) {
    console.log(
      `    ⚠️  RIGHT VIOLATION: ${rightEdge.toFixed(1)}" > ${bed.width}"`,
    );
    allClustersValid = false;
  }
  if (topEdge < 0) {
    console.log(`    ⚠️  TOP VIOLATION: ${topEdge.toFixed(1)}" < 0`);
    allClustersValid = false;
  }
  if (bottomEdge > bed.height) {
    console.log(
      `    ⚠️  BOTTOM VIOLATION: ${bottomEdge.toFixed(1)}" > ${bed.height}"`,
    );
    allClustersValid = false;
  }

  console.log("");
});

console.log("=".repeat(80));
if (allClustersValid) {
  console.log("✓ ALL CLUSTERS WITHIN BOUNDS");
} else {
  console.log("✗ SOME CLUSTERS VIOLATE BOUNDS");
}
console.log("=".repeat(80));
