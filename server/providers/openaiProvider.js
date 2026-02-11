import OpenAI from "openai";
import { buildGardenPrompt } from "./prompt.js";
import { buildOpenAISchema } from "./bedSchema.js";
import {
  runProviderRequest,
  extractJson as utilExtractJson,
  defaultResponseExtractor,
  openaiSchemaInserter,
  detectOpenAIRefusalOrIncomplete,
} from "./providerUtils.js";

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o";

/**
 * Whether to attempt sending a JSON schema to the OpenAI responses API.
 * Defaults to enabled for stricter output; set OPENAI_USE_SCHEMA=false to disable.
 */
const USE_SCHEMA = process.env.OPENAI_USE_SCHEMA !== "false";

function resolveApiKey(auth = {}) {
  return (
    auth.apiKey || auth.oauthAccessToken || process.env.OPENAI_API_KEY || null
  );
}

/**
 * Exported client factory so tests can inject a mock OpenAI-like client.
 * Tests may override `openaiProvider.createClient` at runtime; generateLayout
 * will use the provider-level function when present (keeps test injection behavior).
 */
export let createClient = (auth = {}) => {
  const apiKey = resolveApiKey(auth);
  if (!apiKey) {
    throw new Error(
      "OpenAI API key missing. Set OPENAI_API_KEY or pass auth.apiKey/auth.oauthAccessToken.",
    );
  }
  return new OpenAI({ apiKey });
};

// Re-export tolerant JSON extraction helper for tests that reference it.
export const extractJson = utilExtractJson;

// Export OpenAI-specific schema builder.
export function buildOpenAiSchema() {
  return buildOpenAISchema();
}

export const openaiProvider = {
  id: "openai",
  name: "OpenAI",
  supportsOAuth: true,
  async generateLayout({
    beds,
    seeds,
    sunOrientation,
    style,
    optimizationGoals,
    auth,
    model,
  }) {
    // Maintain test-friendly override semantics: prefer a runtime property on the provider
    // object if present, otherwise fall back to the module-level createClient.
    const clientFactory =
      (typeof openaiProvider !== "undefined" && openaiProvider.createClient) ||
      createClient;

    const { system, prompt } = buildGardenPrompt({
      beds,
      seeds,
      sunOrientation,
      style,
      optimizationGoals,
    });

    // Use the shared runProviderRequest helper with OpenAI-specific inserter and refusal detection.
    // This enables Structured Outputs on compatible models and handles refusal/incomplete responses.
    return runProviderRequest({
      createClient: clientFactory,
      auth,
      buildBaseOptions: () => ({
        model: model || DEFAULT_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
      invoke: (client, opts) => client.chat.completions.create(opts),
      extractResponseText: defaultResponseExtractor,
      schema: buildOpenAiSchema(),
      schemaInserter: openaiSchemaInserter,
      detectRefusalOrIncomplete: detectOpenAIRefusalOrIncomplete,
      useSchema: USE_SCHEMA,
    });
  },
};

export default openaiProvider;
