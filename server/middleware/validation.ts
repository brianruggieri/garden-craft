/**
 * Request validation middleware using AJV
 */

import Ajv, { ValidateFunction } from "ajv";
import { VEGGIE_TYPES } from "../veggieMetadata";
import type { Request, Response, NextFunction } from "express";

const ajv = new Ajv({
  allErrors: true,
  removeAdditional: false, // Don't remove extra properties (preserve flexibility)
  useDefaults: true,
  coerceTypes: false, // Strict type checking
});

/**
 * Request schema for /api/optimize endpoint
 */
const optimizeRequestSchema = {
  type: "object",
  properties: {
    provider: {
      type: "string",
      enum: ["openai", "anthropic", "gemini", "local"],
      description: "AI provider to use for layout generation",
    },
    beds: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          width: { type: "number", minimum: 1, maximum: 10000 },
          height: { type: "number", minimum: 1, maximum: 10000 },
          x: { type: "number", minimum: 0 },
          y: { type: "number", minimum: 0 },
        },
        required: ["id", "width", "height"],
        additionalProperties: true, // Allow extra bed properties
      },
    },
    seeds: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          type: {
            type: "string",
            enum: VEGGIE_TYPES.length > 0 ? VEGGIE_TYPES : undefined,
          },
          veggieType: {
            type: "string",
            enum: VEGGIE_TYPES.length > 0 ? VEGGIE_TYPES : undefined,
          },
          quantity: { type: "integer", minimum: 1, maximum: 10000 },
          count: { type: "integer", minimum: 1, maximum: 10000 },
        },
        required: [], // Seeds can have various formats
        additionalProperties: true, // Allow variety, spacing, etc.
      },
    },
    sunOrientation: {
      type: "string",
      enum: ["North", "South", "East", "West"],
      description: "Primary sun direction for the garden",
    },
    style: {
      type: "object",
      additionalProperties: true,
      description: "Visual styling preferences",
    },
    optimizationGoals: {
      type: "array",
      items: { type: "string" },
      description: 'Goals like "maximize yield", "companion planting", etc.',
    },
    auth: {
      type: "object",
      properties: {
        apiKey: { type: "string" },
        oauthAccessToken: { type: "string" },
      },
      additionalProperties: false,
    },
    model: {
      type: "string",
      description: "Specific model name to use with the provider",
    },
  },
  required: ["beds", "seeds", "sunOrientation"],
  additionalProperties: false,
};

export const validateOptimizeRequest: ValidateFunction = ajv.compile(
  optimizeRequestSchema,
);

/**
 * Express middleware factory for validating request bodies against a schema
 *
 * @param validator - Compiled AJV validator function
 * @returns Express middleware
 */
export function createValidationMiddleware(validator: ValidateFunction) {
  return (req: Request, res: Response, next: NextFunction) => {
    const valid = validator(req.body);

    if (!valid) {
      // validator.errors can be null/undefined - guard before mapping
      const rawErrors = validator.errors ?? [];
      const errors = (rawErrors as any[]).map((err) => {
        const path = err?.instancePath || "body";
        const message = err?.message || "validation failed";
        return `${path}: ${message}`;
      });

      return res.status(400).json({
        error: "Validation failed",
        details: errors,
      });
    }

    next();
  };
}

/**
 * Pre-built middleware for /api/optimize endpoint
 */
export const validateOptimize = createValidationMiddleware(
  validateOptimizeRequest,
);

export default {
  createValidationMiddleware,
  validateOptimize,
  validateOptimizeRequest,
};
