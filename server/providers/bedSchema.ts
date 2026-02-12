// Canonical schema builders for different provider requirements.
//
// Each provider has different structured output capabilities:
//
// - OpenAI: Strictest requirements (object root, additionalProperties: false, all required)
// - Anthropic: Flexible (array or object root, optional additionalProperties, optional fields allowed)
// - Gemini: Provider-specific types (Type.STRING, etc.), flexible structure
//
// This module provides schema builders tailored to each provider's constraints.

import { VEGGIE_TYPES } from "../veggieMetadata";

interface JsonSchemaProperty {
  type?: string;
  description?: string;
  enum?: string[];
  anyOf?: Array<{ type: string }>;
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
  minimum?: number;
  maximum?: number;
  minItems?: number;
}

interface JsonSchema {
  $schema?: string;
  type: string;
  description?: string;
  properties?: Record<string, JsonSchemaProperty>;
  items?: JsonSchemaProperty;
  required?: string[];
  additionalProperties?: boolean;
}

/**
 * Build OpenAI-compatible JSON Schema with strict requirements.
 *
 * OpenAI Structured Outputs requirements:
 * - Root MUST be an object (not an array)
 * - additionalProperties: false on all objects
 * - All fields must be required (use null unions for optional fields)
 * - Supported models: gpt-4o-mini, gpt-4o-2024-08-06, gpt-4o-2024-11-20
 *
 * Returns an object-root schema: { layouts: [...] }
 */
export function buildOpenAISchema(): JsonSchema {
  const placementItem = {
    type: "object",
    properties: {
      id: {
        type: "string",
        description: "Unique identifier for this placement",
      },
      veggieType: {
        type: "string",
        description: "Type of vegetable being planted",
        // Use enum for better model guidance
        ...(Array.isArray(VEGGIE_TYPES) && VEGGIE_TYPES.length > 0
          ? { enum: VEGGIE_TYPES }
          : {}),
      },
      varietyName: {
        type: "string",
        description: "Specific variety or cultivar name",
      },
      x: { type: "number", description: "Inches from bed left edge" },
      y: { type: "number", description: "Inches from bed top edge" },
      size: {
        type: "number",
        description: "Diameter of the plant canopy in inches",
      },
      // Optional fields use null unions (OpenAI requirement)
      placementReasoning: {
        anyOf: [{ type: "string" }, { type: "null" }],
        description: "Why this plant is in this specific spot",
      },
      spacingAnalysis: {
        anyOf: [{ type: "string" }, { type: "null" }],
        description: "How it relates to its immediate neighbors",
      },
      companionInsights: {
        anyOf: [{ type: "string" }, { type: "null" }],
        description: "Specific companion planting benefit achieved here",
      },
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
    additionalProperties: false, // OpenAI requirement
  };

  const bedItem = {
    type: "object",
    properties: {
      bedId: {
        type: "string",
        description: "Identifier matching the garden bed this layout is for",
      },
      placements: {
        type: "array",
        description: "Array of plant placements within this bed",
        items: placementItem,
      },
    },
    required: ["bedId", "placements"],
    additionalProperties: false, // OpenAI requirement
  };

  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object", // OpenAI requires object root
    properties: {
      layouts: {
        type: "array",
        description: "Array of layouts, one per garden bed",
        items: bedItem,
      },
    },
    required: ["layouts"],
    additionalProperties: false, // OpenAI requirement
  };
}

/**
 * Build Anthropic-compatible JSON Schema with flexible requirements.
 *
 * Anthropic Structured Outputs features:
 * - Root can be object OR array (more flexible than OpenAI)
 * - additionalProperties: false is optional
 * - Fields can be truly optional (no null union required)
 * - Supports regex patterns
 * - Supports format constraints (date-time, email, etc.)
 * - Supports number constraints (minimum, maximum, multipleOf)
 * - Supports array constraints (minItems, maxItems)
 *
 * Returns an array-root schema for direct compatibility: [...]
 */
export function buildAnthropicSchema(): JsonSchema {
  const placementItem = {
    type: "object",
    properties: {
      id: {
        type: "string",
        description: "Unique identifier for this placement",
      },
      veggieType: {
        type: "string",
        description: "Type of vegetable being planted",
        ...(Array.isArray(VEGGIE_TYPES) && VEGGIE_TYPES.length > 0
          ? { enum: VEGGIE_TYPES }
          : {}),
      },
      varietyName: {
        type: "string",
        description: "Specific variety or cultivar name",
      },
      x: {
        type: "number",
        description: "Inches from bed left edge",
        minimum: 0,
      },
      y: {
        type: "number",
        description: "Inches from bed top edge",
        minimum: 0,
      },
      size: {
        type: "number",
        description: "Diameter of the plant canopy in inches",
        minimum: 1,
        maximum: 120,
      },
      // Optional fields - Anthropic allows truly optional fields
      placementReasoning: {
        type: "string",
        description: "Why this plant is in this specific spot",
      },
      spacingAnalysis: {
        type: "string",
        description: "How it relates to its immediate neighbors",
      },
      companionInsights: {
        type: "string",
        description: "Specific companion planting benefit achieved here",
      },
    },
    required: ["id", "veggieType", "varietyName", "x", "y", "size"],
    // additionalProperties omitted - Anthropic doesn't require it
  };

  const bedItem = {
    type: "object",
    properties: {
      bedId: {
        type: "string",
        description: "Identifier matching the garden bed this layout is for",
      },
      placements: {
        type: "array",
        description: "Array of plant placements within this bed",
        items: placementItem,
        minItems: 0,
      },
    },
    required: ["bedId", "placements"],
  };

  // Anthropic supports array root - more natural for this use case
  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "array",
    description: "Garden bed layouts with plant placements",
    items: bedItem,
  };
}

/**
 * Legacy function name for backward compatibility.
 * Delegates to buildOpenAISchema() which is the current canonical strict format.
 *
 * @deprecated Use buildOpenAISchema() or buildAnthropicSchema() explicitly.
 */
export function buildBedJsonSchema(): JsonSchema {
  return buildOpenAISchema();
}

/**
 * Get the appropriate schema for a given provider.
 *
 * @param {string} providerId - Provider identifier ('openai', 'anthropic', 'gemini', 'local')
 * @returns {object} JSON Schema appropriate for the provider
 */
export function getSchemaForProvider(providerId?: string): JsonSchema {
  switch (providerId?.toLowerCase()) {
    case "openai":
      return buildOpenAISchema();
    case "anthropic":
      return buildAnthropicSchema();
    case "gemini":
      // Gemini uses its own Type system via buildGeminiSchema() in geminiProvider.js
      // Return OpenAI schema as fallback for validation purposes
      return buildOpenAISchema();
    case "local":
      // Local provider returns array format directly
      return buildAnthropicSchema();
    default:
      // Default to OpenAI's strict schema for unknown providers
      return buildOpenAISchema();
  }
}

export default {
  buildOpenAISchema,
  buildAnthropicSchema,
  buildBedJsonSchema,
  getSchemaForProvider,
};
