/**
 * server/providers/providerUtils.ts
 *
 * Shared provider helper utilities to centralize request/validation logic for LLM adapters.
 *
 * Goals:
 * - Make provider implementations consistent by handling schema hinting, parsing,
 *   and canonical JSON Schema validation in one place.
 * - Be SDK-agnostic: providers provide a small `invoke(client, opts)` function and an
 *   `extractResponseText(response)` function appropriate for the SDK they use.
 * - Support provider-specific structured output APIs:
 *   * OpenAI: response_format with json_schema wrapper, strict mode, object root required
 *   * Anthropic: output_config.format, flexible (array or object root)
 *   * Gemini: responseMimeType + responseSchema with Type system
 * - Normalize responses: convert object-root { layouts: [...] } to array [...] when needed
 *   so the rest of the server can work with a consistent format.
 *
 * Provider-Specific Structured Output Requirements:
 *
 * OpenAI Structured Outputs:
 * - Root MUST be an object (not an array)
 * - additionalProperties: false required on all objects
 * - All fields must be required (use null unions for optional)
 * - Format: response_format: { type: "json_schema", json_schema: { name, strict: true, schema } }
 * - Supported models: gpt-4o-mini, gpt-4o-2024-08-06, gpt-4o-2024-11-20, etc.
 * - Refusal detection: message.refusal
 * - Incomplete detection: finish_reason === "length"
 * - Reference: https://platform.openai.com/docs/guides/structured-outputs
 *
 * Anthropic Structured Outputs:
 * - Root can be object OR array (more flexible)
 * - additionalProperties: false is optional
 * - Fields can be truly optional (no null union required)
 * - Format: output_config: { format: { type: "json_schema", schema } }
 * - Supports regex patterns, format constraints, number/array constraints
 * - Refusal detection: stop_reason === "refusal"
 * - Incomplete detection: stop_reason === "max_tokens"
 * - Reference: https://docs.anthropic.com/en/docs/build-with-claude/structured-outputs
 *
 * Gemini Structured Output:
 * - Root can be object OR array (most flexible)
 * - Uses provider-specific Type system (Type.STRING, Type.OBJECT, etc.)
 * - Format: responseMimeType: "application/json", responseSchema: {...}
 * - Supports string formats, number constraints, array constraints
 * - Reference: https://ai.google.dev/gemini-api/docs/structured-output
 *
 * Usage (example):
 *
 * import { runProviderRequest, openaiSchemaInserter, detectOpenAIRefusalOrIncomplete } from './providerUtils.js'
 *
 * const result = await runProviderRequest({
 *   createClient: (auth) => new OpenAI({ apiKey: auth.apiKey }),
 *   auth,
 *   buildBaseOptions: () => ({ model: 'gpt-4o', messages: [...] }),
 *   invoke: (client, opts) => client.chat.completions.create(opts),
 *   extractResponseText: defaultResponseExtractor,
 *   schema: buildOpenAISchema(),
 *   schemaInserter: openaiSchemaInserter,
 *   detectRefusalOrIncomplete: detectOpenAIRefusalOrIncomplete,
 * });
 *
 */

import Ajv, { type Options as AjvOptions, type ValidateFunction } from "ajv";

/**
 * OpenAI models that support Structured Outputs (strict schema mode).
 * Only these models can use response_format with strict: true.
 * https://platform.openai.com/docs/guides/structured-outputs
 */
const OPENAI_STRUCTURED_OUTPUT_MODELS = [
  "gpt-4o", // Base model name (includes all gpt-4o snapshots)
  "gpt-4o-mini", // Base model name (includes all gpt-4o-mini snapshots)
  "gpt-4o-2024-08-06", // Specific snapshot
  "gpt-4o-mini-2024-07-18", // Specific snapshot
  "gpt-4o-2024-11-20", // Specific snapshot
  // Add future compatible models here
];

/**
 * Check if a given OpenAI model supports Structured Outputs.
 */
export function supportsStructuredOutputs(model: string = ""): boolean {
  if (!model || typeof model !== "string") return false;
  const normalized = model.toLowerCase().trim();
  // Check for exact matches or if the model name starts with a known prefix
  // This handles both base names (gpt-4o) and snapshots (gpt-4o-2024-08-06)
  return OPENAI_STRUCTURED_OUTPUT_MODELS.some((m) => {
    const prefix = m.toLowerCase();
    return normalized === prefix || normalized.startsWith(prefix + "-");
  });
}

/**
 * OpenAI-specific schema inserter that uses the response_format wrapper
 * for Structured Outputs when the model supports it.
 *
 * Returns options with:
 * - `response_format: { type: "json_schema", json_schema: { name, strict, schema } }`
 *   if schema is provided and model supports Structured Outputs
 * - `response_format: { type: "json_object" }` otherwise (JSON mode fallback)
 */
export function openaiSchemaInserter(
  baseOpts: Record<string, any> = {},
  schema: Record<string, any> | null = null
): Record<string, any> {
  const clone = { ...baseOpts };
  const model = baseOpts.model || "";

  if (schema && supportsStructuredOutputs(model)) {
    // Use Structured Outputs with strict mode
    clone.response_format = {
      type: "json_schema",
      json_schema: {
        name: "garden_layout_schema",
        strict: true,
        schema,
      },
    };
  } else if (schema) {
    // Model doesn't support Structured Outputs, fall back to JSON mode
    clone.response_format = { type: "json_object" };
  } else {
    // No schema, use JSON mode
    clone.response_format = { type: "json_object" };
  }
  return clone;
}

/**
 * Detect OpenAI refusal or incomplete responses and throw appropriate errors.
 * Called by runProviderRequest when using OpenAI-style responses.
 *
 * Checks for:
 * - message.refusal (Structured Outputs refusal)
 * - finish_reason === "length" (incomplete/truncated)
 * - response.status === "incomplete" (streaming)
 */
export function detectOpenAIRefusalOrIncomplete(response: any): void {
  if (!response) return;

  // Check for refusal in message
  if (response.choices && Array.isArray(response.choices)) {
    const firstChoice = response.choices[0];
    if (firstChoice?.message?.refusal) {
      throw new Error(
        `OpenAI refused to generate response: ${firstChoice.message.refusal}`
      );
    }

    // Check for incomplete response (length limit exceeded)
    if (firstChoice?.finish_reason === "length") {
      throw new Error(
        "OpenAI response incomplete: output was truncated due to length limit. " +
          "Consider increasing max_tokens or simplifying the request."
      );
    }
  }

  // Check for incomplete streaming response
  if (response.status === "incomplete") {
    throw new Error(
      "OpenAI response incomplete: streaming response did not complete successfully."
    );
  }
}

/**
 * Normalize provider responses to canonical array format.
 * If response is { layouts: [...] }, extract the layouts array.
 * Otherwise return response as-is (assumed to already be an array).
 */
export function normalizeProviderResponse(parsed: any): any {
  // If it's an object with layouts property, extract it
  if (
    parsed &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    Array.isArray(parsed.layouts)
  ) {
    return parsed.layouts;
  }
  // Otherwise assume it's already in the correct format
  return parsed;
}

/**
 * Extract a JSON substring from text that may contain surrounding commentary.
 * Preserves the first outer array or object found (providers may return array or object root).
 */
export function extractJson(text: string = ""): string {
  if (typeof text !== "string") {
    text = String(text || "");
  }
  const trimmed = text.trim();
  if (!trimmed) return "{}";
  // Accept both array and object roots
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) return trimmed;
  // Try to extract array or object
  const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
  if (arrayMatch) return arrayMatch[0];
  const objectMatch = trimmed.match(/\{[\s\S]*\}/);
  if (objectMatch) return objectMatch[0];
  return trimmed;
}

/**
 * Default response extractor covering a few common SDK shapes:
 * - OpenAI responses: { choices: [{ message: { content: "..." } }] }
 * - Gemini-like / other: { text: "..." }
 * - Generic: if response is string, use it; otherwise JSON.stringify(response)
 *
 * Providers with custom response shapes (e.g. Anthropic content blocks) should pass
 * their own extractor.
 */
export function defaultResponseExtractor(response: any): string {
  if (!response) return "";
  // OpenAI-style
  if (response.choices && Array.isArray(response.choices)) {
    const c = response.choices[0];
    if (c?.message?.content) return String(c.message.content);
    if (c?.text) return String(c.text);
  }
  // Some SDKs return top-level text
  if (typeof response.text === "string") return response.text;
  // Anthropic-like content blocks (array)
  if (Array.isArray(response.content)) {
    // Join text blocks if present
    return response.content
      .map((block: any) => (block && block.type === "text" ? block.text : ""))
      .join("\n")
      .trim();
  }
  // If it's a string, return it
  if (typeof response === "string") return response;
  // Fallback: stringify
  try {
    return JSON.stringify(response);
  } catch {
    return String(response);
  }
}

/**
 * Default schema inserter: returns an options object that contains a `response_format`
 * hint the provider may understand. If `schema` is non-null, use `{ type: 'json_schema', json_schema: schema }`.
 * Otherwise return `{ type: 'json_object' }` fallback.
 *
 * Providers with bespoke SDKs can pass their own `schemaInserter(baseOpts, schema)` function
 * that returns an options object compatible with their SDK.
 */
export function defaultSchemaInserter(
  baseOpts: Record<string, any> = {},
  schema: Record<string, any> | null = null
): Record<string, any> {
  const clone = { ...baseOpts };
  if (schema) {
    clone.response_format = { type: "json_schema", json_schema: schema };
  } else {
    clone.response_format = { type: "json_object" };
  }
  return clone;
}

export type ResponseExtractorFn = (response: any) => string;
export type SchemaInserterFn = (
  baseOpts: Record<string, any>,
  schema: Record<string, any> | null
) => Record<string, any>;
export type RefusalDetectorFn = (response: any) => void;
export type InvokeFn<TClient = any> = (
  client: TClient,
  opts: Record<string, any>
) => Promise<any>;
export type CreateClientFn<TAuth = any, TClient = any> = (
  auth: TAuth
) => TClient | Promise<TClient>;

export interface RunProviderRequestOptions<TAuth = any, TClient = any> {
  createClient?: CreateClientFn<TAuth, TClient>;
  auth?: TAuth;
  buildBaseOptions: () => Record<string, any>;
  invoke: InvokeFn<TClient>;
  extractResponseText?: ResponseExtractorFn;
  schema?: Record<string, any> | null;
  schemaInserter?: SchemaInserterFn;
  useSchema?: boolean;
  ajvOptions?: AjvOptions;
  detectRefusalOrIncomplete?: RefusalDetectorFn | null;
  normalizeResponse?: boolean;
  clientInstance?: TClient;
}

/**
 * Run a provider request in a standard way:
 *
 * - `createClient(auth)` : factory returning a client instance (or provider can pass a client directly)
 * - `auth` : auth object passed to createClient
 * - `buildBaseOptions()` : function building the SDK call options (system/prompt/messages etc.)
 * - `invoke(client, opts)` : function to invoke the SDK call, returns the SDK response
 * - `extractResponseText(response)` : function to extract raw text out of the SDK response
 * - `schema` : canonical JSON Schema (optional) used for local validation via AJV
 * - `schemaInserter(baseOpts, schema)` : function that takes baseOpts and returns a schema-hinted opts object
 * - `useSchema` : whether to attempt schema-hinting (default true)
 * - `detectRefusalOrIncomplete` : optional function to detect provider-specific refusal/incomplete responses
 * - `normalizeResponse` : whether to normalize object-root responses to arrays (default true)
 *
 * Returns parsed JSON (the provider's canonical object, normalized to array of bed layouts).
 *
 * Throws on parse errors or schema validation failures.
 */
export async function runProviderRequest<TAuth = any, TClient = any>({
  createClient,
  auth,
  buildBaseOptions,
  invoke,
  extractResponseText = defaultResponseExtractor,
  schema = null,
  schemaInserter = defaultSchemaInserter,
  useSchema = true,
  ajvOptions = { allErrors: true, strict: false },
  detectRefusalOrIncomplete = null,
  normalizeResponse = true,
  clientInstance = undefined,
}: RunProviderRequestOptions<TAuth, TClient>): Promise<any> {
  if (!createClient && !clientInstance) {
    throw new Error(
      "runProviderRequest requires createClient or clientInstance"
    );
  }
  if (typeof buildBaseOptions !== "function") {
    throw new Error("runProviderRequest requires buildBaseOptions() function");
  }
  if (typeof invoke !== "function") {
    throw new Error(
      "runProviderRequest requires invoke(client, opts) function"
    );
  }

  const client = clientInstance ?? (await createClient!(auth || ({} as TAuth)));

  const baseOpts = buildBaseOptions();

  // Prepare AJV validator if schema provided
  let validate: ValidateFunction | null = null;
  let ajv: Ajv | null = null;
  if (schema) {
    ajv = new Ajv(ajvOptions);
    validate = ajv.compile(schema);
  }

  // Try to request schema-aware output if requested; fallback to json_object.
  let response: any = null;
  if (useSchema && schema) {
    try {
      const optsWithSchema = schemaInserter(baseOpts, schema);
      response = await invoke(client, optsWithSchema);
    } catch (err) {
      // If provider/SDK rejected schema attempt, retry without schema hint.
      // This is a best-effort schema hint; local validation still applies below.
      try {
        const fallbackOpts = schemaInserter(baseOpts, null);
        response = await invoke(client, fallbackOpts);
      } catch (err2) {
        // Re-throw the secondary error to preserve the most relevant failure.
        throw err2;
      }
    }
  } else {
    // Schema not requested or not provided: request generic json object if possible.
    const fallbackOpts = schemaInserter(baseOpts, null);
    response = await invoke(client, fallbackOpts);
  }

  // Check for refusal or incomplete responses if detector provided
  if (typeof detectRefusalOrIncomplete === "function") {
    detectRefusalOrIncomplete(response);
  }

  // Extract raw text and parse JSON (tolerant extraction)
  const rawText = extractResponseText(response) ?? "";
  let parsed: any;
  try {
    parsed = JSON.parse(extractJson(rawText));
  } catch (err: any) {
    const safeSnippet = String(rawText).slice(0, 1024);
    throw new Error(
      `Provider response parse failed: ${err.message} — snippet: ${safeSnippet}`
    );
  }

  // Validate locally if schema present
  if (validate) {
    const valid = validate(parsed);
    if (!valid) {
      const errors = validate.errors || [];
      const msg =
        errors.length > 0
          ? errors
              .slice(0, 5)
              .map((e) => `${e.instancePath || "/"} ${e.message}`)
              .join("; ")
          : "unknown schema validation error";
      throw new Error(`Provider response schema validation failed: ${msg}`);
    }
  }

  // Normalize response format if requested (object root → array)
  if (normalizeResponse) {
    parsed = normalizeProviderResponse(parsed);
  }

  return parsed;
}

export interface ProviderAdapterOptions<TAuth = any, TClient = any> {
  createClient?: CreateClientFn<TAuth, TClient>;
  invoke: InvokeFn<TClient>;
  extractResponseText?: ResponseExtractorFn;
  schemaInserter?: SchemaInserterFn;
  schemaBuilder?: (() => Record<string, any>) | null;
  useSchema?: boolean;
  detectRefusalOrIncomplete?: RefusalDetectorFn | null;
  normalizeResponse?: boolean;
}

export interface ProviderAdapterCallOptions<TAuth = any, TClient = any> {
  auth?: TAuth;
  buildBaseOptions: () => Record<string, any>;
  modelOverride?: string;
  clientInstance?: TClient;
}

/**
 * Convenience wrapper to create a simple provider adapter function that providers
 * can call. It returns an async function that accepts the same args as the
 * provider.generateLayout handler would and delegates to `runProviderRequest`.
 *
 * Example:
 *
 * const adapter = createProviderAdapter({
 *   createClient,
 *   invoke: (client, opts) => client.chat.completions.create(opts),
 *   extractResponseText: defaultResponseExtractor,
 *   schemaInserter: openaiSchemaInserter,
 *   schemaBuilder: buildBedJsonSchema,
 *   detectRefusalOrIncomplete: detectOpenAIRefusalOrIncomplete,
 * });
 *
 * Then provider.generateLayout can simply:
 * return adapter({ auth, buildBaseOptions: () => ({ model, messages: [...] }) });
 */
export function createProviderAdapter<TAuth = any, TClient = any>({
  createClient,
  invoke,
  extractResponseText = defaultResponseExtractor,
  schemaInserter = defaultSchemaInserter,
  schemaBuilder = null,
  useSchema = true,
  detectRefusalOrIncomplete = null,
  normalizeResponse = true,
}: ProviderAdapterOptions<TAuth, TClient>) {
  if (!invoke) {
    throw new Error(
      "createProviderAdapter requires invoke(client, opts) function"
    );
  }
  return async function providerAdapter({
    auth,
    buildBaseOptions,
    modelOverride,
    clientInstance,
  }: ProviderAdapterCallOptions<TAuth, TClient> = {} as ProviderAdapterCallOptions<TAuth, TClient>): Promise<any> {
    // buildBaseOptions is required here and should produce the SDK-specific base opts.
    if (typeof buildBaseOptions !== "function") {
      throw new Error("providerAdapter requires buildBaseOptions() function");
    }

    // If a schemaBuilder is provided, call it to obtain the canonical schema.
    const schema = typeof schemaBuilder === "function" ? schemaBuilder() : null;

    return runProviderRequest({
      createClient,
      auth,
      buildBaseOptions,
      invoke,
      extractResponseText,
      schema,
      schemaInserter,
      useSchema,
      detectRefusalOrIncomplete,
      normalizeResponse,
      clientInstance,
    });
  };
}

export default {
  extractJson,
  defaultResponseExtractor,
  defaultSchemaInserter,
  openaiSchemaInserter,
  supportsStructuredOutputs,
  detectOpenAIRefusalOrIncomplete,
  normalizeProviderResponse,
  runProviderRequest,
  createProviderAdapter,
};
