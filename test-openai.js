#!/usr/bin/env node

/**
 * Manual test script for OpenAI provider integration.
 *
 * This script verifies that your OpenAI API key works and the provider
 * can generate garden layouts end-to-end.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-your-key node test-openai.js
 *
 * Or with a .env file:
 *   node test-openai.js
 */

import { config } from "dotenv";
import { openaiProvider } from "./server/providers/openaiProvider.js";

// Load .env file if it exists
config();

// Simple sample garden data
const sampleGarden = {
  beds: [
    {
      id: "bed-1",
      name: "Raised Bed 1",
      width: 48,
      height: 96,
      x: 0,
      y: 0,
      shape: "rectangle",
    },
  ],
  seeds: [
    {
      type: "tomato",
      priority: 3,
      selectedVarieties: [],
    },
    {
      type: "basil",
      priority: 2,
      selectedVarieties: [],
    },
    {
      type: "lettuce",
      priority: 2,
      selectedVarieties: [],
    },
  ],
  sunOrientation: "south",
  style: {
    densityPreference: "medium",
  },
  optimizationGoals: [
    "companion planting",
    "maximize yield",
    "efficient spacing",
  ],
};

async function testOpenAI() {
  console.log("🌱 Testing OpenAI Provider Integration\n");

  // Check for API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("❌ Error: OPENAI_API_KEY environment variable not set");
    console.error("\nYour .env file should contain:");
    console.error("  OPENAI_API_KEY=sk-your-key-here");
    console.error("\nIf you don't have a .env file:");
    console.error("  1. Copy: cp .env.example .env");
    console.error("  2. Edit .env and add your real API key");
    console.error("  3. Get a key at: https://platform.openai.com/api-keys");
    process.exit(1);
  }

  console.log("✓ API key found");
  console.log(`✓ Provider: ${openaiProvider.name} (${openaiProvider.id})`);
  console.log(
    `✓ Test garden: ${sampleGarden.beds.length} bed, ${sampleGarden.seeds.length} vegetables`,
  );
  console.log("\n⏳ Calling OpenAI API (this may take 5-15 seconds)...\n");

  try {
    const startTime = Date.now();

    const layouts = await openaiProvider.generateLayout({
      ...sampleGarden,
      auth: { apiKey },
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✅ Success! Generated layout in ${duration}s\n`);

    // Display results
    console.log("📊 Results:");
    console.log(`   Beds processed: ${layouts.length}`);

    layouts.forEach((layout, idx) => {
      console.log(`\n   Bed ${idx + 1} (${layout.bedId}):`);
      console.log(`   └─ ${layout.placements.length} placements`);

      layout.placements.forEach((p, pidx) => {
        console.log(
          `      ${pidx + 1}. ${p.varietyName} at (${p.x}, ${p.y}) size ${p.size}"`,
        );
        if (p.placementReasoning) {
          console.log(`         → ${p.placementReasoning}`);
        }
      });
    });

    console.log("\n✅ OpenAI integration is working correctly!");
    console.log("\nYou can now use the OpenAI provider in your app:");
    console.log("  1. npm run dev:server");
    console.log("  2. npm run dev");
    console.log("  3. Select 'OpenAI' provider in the UI");
    console.log("  4. Generate layouts!");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error calling OpenAI API:\n");

    if (error.message.includes("API key")) {
      console.error("  Problem: Invalid or missing API key");
      console.error("  Solution: Check your OPENAI_API_KEY is correct");
      console.error("           Get a key at: https://platform.openai.com");
    } else if (error.status === 401 || error.code === "invalid_api_key") {
      console.error("  Problem: Authentication failed");
      console.error("  Solution: Your API key is invalid or expired");
      console.error(
        "           Generate a new key at: https://platform.openai.com",
      );
    } else if (error.status === 429 || error.code === "rate_limit_exceeded") {
      console.error("  Problem: Rate limit or quota exceeded");
      console.error("  Solution:");
      console.error(
        "           1. Check your balance: https://platform.openai.com/usage",
      );
      console.error(
        "           2. Add credits: https://platform.openai.com/account/billing",
      );
      console.error("           3. Or wait a few minutes and try again");
      console.error("           Note: Free tier keys have strict rate limits");
    } else if (error.message.includes("parse failed")) {
      console.error("  Problem: OpenAI returned invalid JSON");
      console.error("  Solution: This is unusual - try again in a moment");
    } else {
      console.error("  Unexpected error:", error.message);
      if (error.stack) {
        console.error("\n  Stack trace:");
        console.error("  " + error.stack.split("\n").slice(1, 4).join("\n  "));
      }
    }

    console.error("\n💡 Debug tips:");
    console.error("  - Verify API key: echo $OPENAI_API_KEY");
    console.error("  - Check balance: https://platform.openai.com/usage");
    console.error("  - View API logs: https://platform.openai.com/logs");
    console.error("  - Run tests: npm run test");

    process.exit(1);
  }
}

// Run the test
testOpenAI();
