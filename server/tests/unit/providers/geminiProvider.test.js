import test from "node:test";
import assert from "node:assert/strict";
import {
  geminiProvider,
  buildGeminiSchema,
} from "../../../providers/geminiProvider.js";

/**
 * Unit tests for the Gemini provider.
 *
 * These tests inject a lightweight mock client that implements the subset of the
 * GoogleGenAI surface the provider uses:
 *   client.models.generateContent({ model, contents, config })
 *
 * This keeps tests hermetic and lets you run them locally while you wire real
 * OAuth/API credentials into the dev server for manual testing.
 */

test("generateLayout parses valid JSON response from Gemini client", async () => {
  // Sample inputs
  const beds = [{ id: "bed-1", width: 48, height: 24 }];
  const seeds = [{ type: "tomato", selectedVarieties: [] }];
  const sunOrientation = "south";

  const expectedLayouts = [
    {
      bedId: "bed-1",
      placements: [
        {
          id: "p1",
          veggieType: "Tomato",
          varietyName: "Standard Tomato",
          x: 6,
          y: 6,
          size: 12,
          placementReasoning: "Good sun exposure",
          spacingAnalysis: "Sufficient spacing",
          companionInsights: "Pairs well with basil",
        },
      ],
    },
  ];

  // Mock response in object-root format
  const mockResponse = { layouts: expectedLayouts };

  // Capture the options the provider sends to the client
  let receivedOptions = null;

  // Minimal mock client
  const mockClient = {
    models: {
      generateContent: async (opts) => {
        receivedOptions = opts;
        return { text: JSON.stringify(mockResponse) };
      },
    },
  };

  // Inject mock factory onto the provider (tests should restore afterwards).
  const originalFactory = geminiProvider.createClient;
  try {
    geminiProvider.createClient = () => mockClient;

    const layouts = await geminiProvider.generateLayout({
      beds,
      seeds,
      sunOrientation,
      style: {},
      optimizationGoals: [],
      auth: {}, // not used by mock
      model: "test-model",
    });

    // Validate returned value
    assert.deepStrictEqual(layouts, expectedLayouts);

    // Ensure provider passed expected shape to the client
    assert.ok(receivedOptions, "Expected generateContent to be called");
    assert.strictEqual(receivedOptions.model, "test-model");
    assert.ok(
      typeof receivedOptions.contents === "string" &&
        receivedOptions.contents.length > 0,
      "Expected contents to be provided",
    );
    assert.ok(
      receivedOptions.config &&
        receivedOptions.config.responseMimeType === "application/json",
      "Expected responseMimeType application/json",
    );

    // The provider should pass a schema that has object root with layouts
    const schema = receivedOptions.config.responseSchema;
    assert.ok(schema && schema.properties && schema.properties.layouts);
    assert.ok(
      schema.properties.layouts.items &&
        schema.properties.layouts.items.properties,
    );
    assert.ok(
      Object.prototype.hasOwnProperty.call(
        schema.properties.layouts.items.properties,
        "bedId",
      ),
      "Schema should have bedId in layouts items",
    );
    assert.ok(
      Object.prototype.hasOwnProperty.call(
        schema.properties.layouts.items.properties,
        "placements",
      ),
      "Schema should have placements in layouts items",
    );
  } finally {
    // restore
    if (originalFactory === undefined) {
      delete geminiProvider.createClient;
    } else {
      geminiProvider.createClient = originalFactory;
    }
  }
});

test("generateLayout surfaces parse errors when Gemini returns invalid JSON", async () => {
  const mockClient = {
    models: {
      generateContent: async () => {
        // Simulate a response that is not valid JSON
        return { text: "this is not json" };
      },
    },
  };

  const originalFactory = geminiProvider.createClient;
  try {
    geminiProvider.createClient = () => mockClient;

    await assert.rejects(
      async () => {
        await geminiProvider.generateLayout({
          beds: [],
          seeds: [],
          sunOrientation: "north",
          style: {},
          optimizationGoals: [],
          auth: {},
          model: "x",
        });
      },
      (err) =>
        err &&
        /Provider response parse failed/i.test(err.message) &&
        typeof err.message === "string",
      "Expected a provider response parse failure",
    );
  } finally {
    if (originalFactory === undefined) {
      delete geminiProvider.createClient;
    } else {
      geminiProvider.createClient = originalFactory;
    }
  }
});

test("buildGeminiSchema returns a structure with expected top-level keys", () => {
  const schema = buildGeminiSchema();
  assert.ok(schema && typeof schema === "object", "Schema should be an object");
  assert.strictEqual(
    schema.type !== undefined,
    true,
    "Schema should have a type",
  );
  assert.ok(
    schema.properties && schema.properties.layouts,
    "Schema should have layouts property",
  );
  assert.ok(
    schema.properties.layouts.items &&
      schema.properties.layouts.items.properties,
    "Schema layouts should have items with properties",
  );
  assert.ok(
    schema.properties.layouts.items.properties.bedId,
    "Schema should describe bedId",
  );
  assert.ok(
    schema.properties.layouts.items.properties.placements &&
      schema.properties.layouts.items.properties.placements.items &&
      schema.properties.layouts.items.properties.placements.items.properties,
    "Placements should have item properties",
  );
});
