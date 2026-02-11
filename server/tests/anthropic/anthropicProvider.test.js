import test from "node:test";
import assert from "node:assert/strict";
import {
  anthropicProvider,
  buildAnthropicSchema,
} from "../../providers/anthropicProvider.js";

/**
 * Unit tests for the Anthropic provider.
 *
 * These tests inject a lightweight mock client that implements the subset of the
 * Anthropic SDK surface the provider uses:
 *   client.messages.create({ model, system, messages, response_format? })
 *
 * Tests mirror other provider tests: ensure parsing, request shape, and schema hint behavior.
 */

test("generateLayout parses valid JSON response from Anthropic client", async () => {
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
          varietyName: "Standard tomato",
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

  // Anthropic supports array-root format directly (no wrapper needed)
  const mockResponse = expectedLayouts;

  let receivedOptions = null;

  // Minimal mock client matching the subset of Anthropic SDK used by the provider.
  const mockClient = {
    messages: {
      create: async (opts) => {
        // capture the options for assertions
        receivedOptions = opts;
        // Anthropic response content is an array of content blocks; include a text block.
        return {
          content: [{ type: "text", text: JSON.stringify(mockResponse) }],
        };
      },
    },
  };

  // Inject mock factory onto the provider and restore afterwards.
  const originalFactory = anthropicProvider.createClient;
  try {
    anthropicProvider.createClient = () => mockClient;

    const layouts = await anthropicProvider.generateLayout({
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
    assert.ok(receivedOptions, "Expected messages.create to be called");
    assert.strictEqual(receivedOptions.model, "test-model");
    assert.ok(
      typeof receivedOptions.system === "string" &&
        receivedOptions.system.length > 0,
      "Expected system string",
    );
    assert.ok(
      Array.isArray(receivedOptions.messages),
      "Expected messages array",
    );

    // If the provider attempted to include a response schema hint, ensure it matches the canonical schema.
    // Check if provider used output_config.format (Anthropic's correct API)
    if (
      receivedOptions.output_config &&
      receivedOptions.output_config.format &&
      receivedOptions.output_config.format.schema
    ) {
      const schema = buildAnthropicSchema();
      assert.deepStrictEqual(
        receivedOptions.output_config.format.schema,
        schema,
        "Provider should send the canonical JSON schema when requesting structured output",
      );
    }
  } finally {
    if (originalFactory === undefined) {
      delete anthropicProvider.createClient;
    } else {
      anthropicProvider.createClient = originalFactory;
    }
  }
});

test("generateLayout throws on malformed JSON from Anthropic", async () => {
  const mockClient = {
    messages: {
      create: async () => {
        // Return a text block that is not JSON
        return { content: [{ type: "text", text: "not json" }] };
      },
    },
  };

  const originalFactory = anthropicProvider.createClient;
  try {
    anthropicProvider.createClient = () => mockClient;

    await assert.rejects(
      async () => {
        await anthropicProvider.generateLayout({
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
      delete anthropicProvider.createClient;
    } else {
      anthropicProvider.createClient = originalFactory;
    }
  }
});
