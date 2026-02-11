import test from "node:test";
import assert from "node:assert/strict";
import {
  openaiProvider,
  extractJson,
  buildOpenAiSchema,
} from "../../providers/openaiProvider.js";

/**
 * Unit tests for the OpenAI provider.
 *
 * These tests inject a lightweight mock client that implements the subset of the
 * OpenAI surface the provider uses:
 *   client.chat.completions.create({ model, messages, response_format })
 *
 * Tests also assert that the provider attempts to request a schema (when enabled)
 * and validates responses locally, so all providers can converge on the same
 * structured output shape.
 */

test("extractJson extracts array content from mixed text", () => {
  const raw =
    'Some intro text. Result follows:\n[{"a":1,"b":2}]\n-- end of response';
  const extracted = extractJson(raw);
  assert.strictEqual(extracted, '[{"a":1,"b":2}]');
});

test("generateLayout parses valid JSON response from OpenAI client and requests schema when available", async () => {
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

  // Mock response in object-root format (normalized to array by providerUtils)
  const mockResponse = { layouts: expectedLayouts };

  let receivedOptions = null;

  const mockClient = {
    chat: {
      completions: {
        create: async (opts) => {
          // Capture options the provider passed (including response_format / json_schema)
          receivedOptions = opts;
          return {
            choices: [
              {
                message: {
                  content: JSON.stringify(mockResponse),
                },
              },
            ],
          };
        },
      },
    },
  };

  // Inject mock factory onto the provider and restore afterwards
  const originalFactory = openaiProvider.createClient;
  try {
    openaiProvider.createClient = () => mockClient;

    const layouts = await openaiProvider.generateLayout({
      beds,
      seeds,
      sunOrientation,
      style: {},
      optimizationGoals: [],
      auth: {}, // not used by mock
      model: "test-model",
    });

    assert.deepStrictEqual(
      layouts,
      expectedLayouts,
      "Provider should return parsed layouts",
    );

    // Ensure provider passed expected args to the client
    assert.ok(receivedOptions, "Expected chat.completions.create to be called");
    assert.strictEqual(receivedOptions.model, "test-model");
    assert.ok(
      Array.isArray(receivedOptions.messages),
      "Expected messages array",
    );
    assert.ok(
      receivedOptions.messages.length >= 2,
      "Expected system and user messages",
    );
    assert.strictEqual(receivedOptions.messages[0].role, "system");
    assert.strictEqual(receivedOptions.messages[1].role, "user");

    // Response format should either request a JSON schema (json_schema) or fall back to json_object.
    assert.ok(
      receivedOptions.response_format,
      "Expected response_format to be provided",
    );

    // If json_schema was provided, verify it has the expected wrapper structure
    if (receivedOptions.response_format.type === "json_schema") {
      assert.ok(
        receivedOptions.response_format.json_schema,
        "Expected json_schema property when type is json_schema",
      );
      assert.ok(
        receivedOptions.response_format.json_schema.name,
        "Expected json_schema.name",
      );
      assert.strictEqual(
        receivedOptions.response_format.json_schema.strict,
        true,
        "Expected json_schema.strict to be true",
      );
      assert.ok(
        receivedOptions.response_format.json_schema.schema,
        "Expected json_schema.schema",
      );

      const expectedSchema = buildOpenAiSchema();
      assert.deepStrictEqual(
        receivedOptions.response_format.json_schema.schema,
        expectedSchema,
        "Provider should send the canonical JSON schema when requesting structured output",
      );
    } else {
      // Otherwise, ensure the provider at least requested a json_object fallback.
      assert.strictEqual(
        receivedOptions.response_format.type,
        "json_object",
        "Expected fallback response_format.type to be json_object",
      );
    }
  } finally {
    if (originalFactory === undefined) {
      delete openaiProvider.createClient;
    } else {
      openaiProvider.createClient = originalFactory;
    }
  }
});

test("generateLayout throws when JSON doesn't match the canonical schema", async () => {
  // Construct a parsed JSON payload that is syntactically correct but missing required fields
  // (e.g. placements entries miss `varietyName`, which is required by the schema).
  const invalidLayouts = {
    layouts: [
      {
        bedId: "bed-1",
        placements: [
          {
            id: "p1",
            veggieType: "tomato",
            // varietyName missing => schema validation should fail
            x: 1,
            y: 2,
            size: 3,
          },
        ],
      },
    ],
  };

  const mockClient = {
    chat: {
      completions: {
        create: async () => {
          return {
            choices: [
              {
                message: {
                  content: JSON.stringify(invalidLayouts),
                },
              },
            ],
          };
        },
      },
    },
  };

  const originalFactory = openaiProvider.createClient;
  try {
    openaiProvider.createClient = () => mockClient;

    await assert.rejects(
      async () => {
        await openaiProvider.generateLayout({
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
        /schema validation failed/i.test(err.message) &&
        typeof err.message === "string",
      "Expected an OpenAI response schema validation failure",
    );
  } finally {
    if (originalFactory === undefined) {
      delete openaiProvider.createClient;
    } else {
      openaiProvider.createClient = originalFactory;
    }
  }
});

test("generateLayout throws on malformed JSON from OpenAI", async () => {
  const mockClient = {
    chat: {
      completions: {
        create: async () => {
          return {
            choices: [
              {
                message: {
                  content: "this is not json",
                },
              },
            ],
          };
        },
      },
    },
  };

  const originalFactory = openaiProvider.createClient;
  try {
    openaiProvider.createClient = () => mockClient;

    await assert.rejects(
      async () => {
        await openaiProvider.generateLayout({
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
      delete openaiProvider.createClient;
    } else {
      openaiProvider.createClient = originalFactory;
    }
  }
});
