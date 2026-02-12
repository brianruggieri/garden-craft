import { GoogleGenAI, type Type } from "@google/genai";
import { buildGardenPrompt } from "./prompt";
import { VEGGIE_TYPES } from "../veggieMetadata";
import { buildOpenAISchema } from "./bedSchema";
import { runProviderRequest } from "./providerUtils";
import type { GardenBed, Vegetable } from "../../shared/types";

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash-001";

interface AuthConfig {
  apiKey?: string;
  oauthAccessToken?: string;
}

function resolveApiKey(auth: AuthConfig = {}): string | null {
  return (
    auth.apiKey ||
    auth.oauthAccessToken ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    null
  );
}

/**
 * Exported client factory so tests can inject a mock GoogleGenAI-like client.
 * Tests may override `geminiProvider.createClient` at runtime; generateLayout
 * will prefer the provider-level override when present.
 */
export let createClient = (auth: AuthConfig = {}): GoogleGenAI => {
  const apiKey = resolveApiKey(auth);
  if (!apiKey) {
    throw new Error(
      "Gemini API key missing. Set GEMINI_API_KEY/GOOGLE_API_KEY or pass auth.apiKey.",
    );
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Keep the original buildGeminiSchema for compatibility with tests that expect
 * the provider to expose the provider-specific schema shape (Type.*).
 */
function buildGeminiSchema(): any {
  // Using any here because @google/genai Type is a const enum
  const Type = {
    OBJECT: "object",
    ARRAY: "array",
    STRING: "string",
    NUMBER: "number",
  } as any;

  return {
    type: Type.OBJECT,
    properties: {
      layouts: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            bedId: { type: Type.STRING },
            placements: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  veggieType: { type: Type.STRING, enum: VEGGIE_TYPES },
                  varietyName: { type: Type.STRING },
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER },
                  size: { type: Type.NUMBER },
                  placementReasoning: { type: Type.STRING },
                  spacingAnalysis: { type: Type.STRING },
                  companionInsights: { type: Type.STRING },
                },
                required: [
                  "id",
                  "veggieType",
                  "varietyName",
                  "x",
                  "y",
                  "size",
                  "placementReasoning",
                  "spacingAnalysis",
                  "companionInsights",
                ],
              },
            },
          },
          required: ["bedId", "placements"],
        },
      },
    },
    required: ["layouts"],
  };
}

/**
 * Exports for testing and a small override hook:
 * - `createClient` and `buildGeminiSchema` are exported so tests can import and exercise them directly.
 */
export { buildGeminiSchema };

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

export interface GeminiProvider {
  id: string;
  name: string;
  supportsOAuth: boolean;
  createClient?: (auth: AuthConfig) => GoogleGenAI;
  generateLayout(options: GenerateLayoutOptions): Promise<any>;
}

export const geminiProvider: GeminiProvider = {
  id: "gemini",
  name: "Google Gemini",
  supportsOAuth: true,
  /**
   * Optional: tests or higher-level initialization code can set `geminiProvider.createClient`
   * to a custom factory function (auth) => client. If not present, the module-level createClient is used.
   */
  async generateLayout({
    beds,
    seeds,
    sunOrientation,
    style,
    optimizationGoals,
    auth,
    model,
    customPrompt,
  }) {
    // Prefer runtime override on provider for tests, otherwise use module-level factory.
    const clientFactory =
      (typeof geminiProvider !== "undefined" && geminiProvider.createClient) ||
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

    // Use OpenAI schema for local validation (object root with layouts array).
    // Gemini will receive its own Type-based schema via the inserter.
    const schema = customSchema || buildOpenAISchema();

    // buildBaseOptions produces the SDK-specific base options the invoke function expects.
    const buildBaseOptions = () => ({
      model: model || DEFAULT_MODEL,
      contents: [system, prompt].join("\n\n"),
    });

    // For Gemini we need a schemaInserter that maps our base opts into the GoogleGenAI API shape.
    const schemaInserter = (
      baseOpts: Record<string, any>,
      providedSchema: Record<string, any> | null,
    ) => {
      return {
        ...baseOpts,
        config: providedSchema
          ? {
              responseMimeType: "application/json",
              responseSchema: buildGeminiSchema(),
            }
          : { responseMimeType: "application/json" },
      };
    };

    // invoke maps to the actual SDK call
    const invoke = (aiClient: GoogleGenAI, opts: any) =>
      aiClient.models.generateContent(opts);

    // response extractor for Gemini is simply `text`
    const extractResponseText = (resp: any) => resp?.text ?? "";

    // Delegate parsing + validation to the shared helper to keep the provider small and consistent.
    return runProviderRequest({
      createClient: clientFactory,
      auth,
      buildBaseOptions,
      invoke,
      extractResponseText,
      schema,
      schemaInserter,
      useSchema: true,
      clientInstance: client,
    });
  },
};

export default geminiProvider;
