import Anthropic from "@anthropic-ai/sdk";
import { buildGardenPrompt } from "./prompt";
import { buildAnthropicSchema } from "./bedSchema";
import { runProviderRequest } from "./providerUtils";
import type { GardenBed, Vegetable } from "../../shared/types";

const DEFAULT_MODEL =
  process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";

interface AuthConfig {
  apiKey?: string;
  oauthAccessToken?: string;
}

function resolveApiKey(auth: AuthConfig = {}): string | null {
  return (
    auth.apiKey ||
    auth.oauthAccessToken ||
    process.env.ANTHROPIC_API_KEY ||
    null
  );
}

/**
 * Exported client factory so tests can inject a mock Anthropic-like client.
 * Tests may override `anthropicProvider.createClient` at runtime; generateLayout
 * will prefer the provider-level override when present.
 */
export let createClient = (auth: AuthConfig = {}): Anthropic => {
  const apiKey = resolveApiKey(auth);
  if (!apiKey) {
    throw new Error(
      "Anthropic API key missing. Set ANTHROPIC_API_KEY or pass auth.apiKey/auth.oauthAccessToken.",
    );
  }
  return new Anthropic({ apiKey });
};

/**
 * Expose a JSON Schema for Anthropic.
 * This uses buildAnthropicSchema which provides a more flexible array-root schema
 * compatible with Anthropic's structured output capabilities.
 */
export function buildAnthropicJsonSchema(): Record<string, any> {
  return buildAnthropicSchema();
}

// Alias for test compatibility
export { buildAnthropicJsonSchema as buildAnthropicSchema };

/**
 * Extract raw text from Anthropic SDK response shape (content blocks).
 */
const extractAnthropicText = (resp: any): string => {
  if (!resp) return "";
  if (Array.isArray(resp.content)) {
    return resp.content
      .map((block: any) => (block && block.type === "text" ? block.text : ""))
      .join("\n")
      .trim();
  }
  // Fallbacks
  if (typeof resp.text === "string") return resp.text;
  return "";
};

/**
 * Anthropic-specific schema inserter using the correct output_config.format API.
 *
 * Anthropic's Structured Outputs API (as of the latest docs):
 * - Uses output_config.format (NOT response_format like OpenAI)
 * - Format: { type: "json_schema", schema: {...} }
 * - More flexible than OpenAI: supports array roots, optional additionalProperties
 * - Supports regex patterns, format constraints, number/array constraints
 *
 * Reference: https://docs.anthropic.com/en/docs/build-with-claude/structured-outputs
 */
const anthropicSchemaInserter = (
  baseOpts: Record<string, any>,
  schema: Record<string, any> | null,
): Record<string, any> => {
  const opts = { ...baseOpts };

  if (schema) {
    // Use Anthropic's output_config.format API
    opts.output_config = {
      format: {
        type: "json_schema",
        schema,
      },
    };
  } else {
    // Fallback to basic JSON mode
    opts.output_config = {
      format: {
        type: "json_object",
      },
    };
  }

  return opts;
};

/**
 * Detect Anthropic-specific refusal or incomplete responses.
 *
 * Anthropic's structured outputs may refuse for safety reasons or be incomplete.
 * - Refusal: stop_reason === "refusal"
 * - Incomplete: stop_reason === "max_tokens"
 *
 * Reference: https://docs.anthropic.com/en/docs/build-with-claude/structured-outputs
 */
const detectAnthropicRefusalOrIncomplete = (response: any): void => {
  if (!response) return;

  // Check for refusal stop reason
  if (response.stop_reason === "refusal") {
    const refusalMsg =
      response.content?.[0]?.text || "Request refused by model";
    throw new Error(`Anthropic refused to generate response: ${refusalMsg}`);
  }

  // Check for incomplete response (max_tokens limit)
  if (response.stop_reason === "max_tokens") {
    throw new Error(
      "Anthropic response incomplete: output was truncated due to max_tokens limit. " +
        "Consider increasing max_tokens or simplifying the request.",
    );
  }
};

interface GenerateLayoutOptions {
  beds: GardenBed[];
  seeds: Vegetable[];
  sunOrientation: string;
  style?: Record<string, any>;
  optimizationGoals?: string[];
  auth?: AuthConfig;
  model?: string;
  customPrompt?: {
    system: string;
    prompt: string;
    schema?: Record<string, any>;
  };
}

export const anthropicProvider = {
  id: "anthropic",
  name: "Anthropic",
  supportsOAuth: true,
  createClient: undefined as typeof createClient | undefined,
  async generateLayout({
    beds,
    seeds,
    sunOrientation,
    style,
    optimizationGoals,
    auth,
    model,
    customPrompt,
  }: GenerateLayoutOptions): Promise<any> {
    // Prefer runtime override on provider for tests, otherwise use module-level factory.
    const clientFactory =
      (typeof anthropicProvider !== "undefined" &&
        anthropicProvider.createClient) ||
      createClient;
    const client = clientFactory(auth || {});

    const {
      system,
      prompt,
      schema: customSchema,
    } = customPrompt ||
    buildGardenPrompt({
      beds,
      seeds,
      sunOrientation,
      style,
      optimizationGoals,
    });

    const buildBaseOptions = () => ({
      model: model || DEFAULT_MODEL,
      max_tokens: 2048,
      system,
      messages: [{ role: "user", content: prompt }],
    });

    // Use Anthropic's array-root schema (more natural for this use case)
    const schema = customSchema || buildAnthropicJsonSchema();

    // Anthropic returns array format directly, so disable normalization
    return runProviderRequest({
      createClient: clientFactory,
      auth,
      buildBaseOptions,
      invoke: (aiClient: Anthropic, opts: Record<string, any>) =>
        aiClient.messages.create(opts as any),
      extractResponseText: extractAnthropicText,
      schema,
      schemaInserter: anthropicSchemaInserter,
      detectRefusalOrIncomplete: detectAnthropicRefusalOrIncomplete,
      useSchema: process.env.ANTHROPIC_USE_SCHEMA !== "false",
      normalizeResponse: false, // Anthropic returns array directly
      clientInstance: client,
    });
  },
};

export default anthropicProvider;
