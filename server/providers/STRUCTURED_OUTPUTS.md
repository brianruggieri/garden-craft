# Structured Outputs Implementation Guide

This document describes how structured outputs are implemented for each LLM provider in GardenCraft. Each provider has different capabilities and API requirements for structured JSON generation.

---

## Overview

GardenCraft uses structured outputs to ensure LLM providers return consistent, schema-compliant JSON for garden layout generation. This eliminates parsing errors, type mismatches, and missing fields.

### Provider Support Matrix

| Provider | Structured Outputs | Root Type | additionalProperties | Required Fields | Pattern/Regex | Format Constraints | Number Constraints |
|----------|-------------------|-----------|----------------------|-----------------|---------------|-------------------|-------------------|
| **OpenAI** | ✅ Strict | Object only | Must be `false` | All required (null unions) | ❌ | Limited | ❌ |
| **Anthropic** | ✅ Flexible | Array or Object | Optional | Can be optional | ✅ | ✅ | ✅ |
| **Gemini** | ✅ Custom | Array or Object | Optional | Listed in `required` | ❌ | ✅ | ✅ |
| **Local** | N/A | Array | N/A | N/A | N/A | N/A | N/A |

---

## OpenAI Structured Outputs

**Documentation:** https://platform.openai.com/docs/guides/structured-outputs

### Requirements

1. **Root must be an object** (not an array)
   ```javascript
   // ✅ Valid
   { type: "object", properties: { layouts: { type: "array", ... } } }
   
   // ❌ Invalid
   { type: "array", items: {...} }
   ```

2. **additionalProperties: false required on all objects**
   ```javascript
   {
     type: "object",
     properties: { ... },
     additionalProperties: false  // Required!
   }
   ```

3. **All fields must be required** (use null unions for optional fields)
   ```javascript
   // ✅ Valid - all fields required
   {
     properties: {
       name: { type: "string" },
       age: { anyOf: [{ type: "number" }, { type: "null" }] }  // Optional via null union
     },
     required: ["name", "age"]  // Both required!
   }
   ```

4. **Supported models:**
   - `gpt-4o-mini`
   - `gpt-4o-2024-08-06`
   - `gpt-4o-2024-11-20`
   - `gpt-4o-mini-2024-07-18`

### API Format

```javascript
{
  model: "gpt-4o-2024-08-06",
  messages: [...],
  response_format: {
    type: "json_schema",
    json_schema: {
      name: "garden_layout_schema",
      strict: true,
      schema: { ... }
    }
  }
}
```

### Error Detection

```javascript
// Refusal detection
if (response.choices[0].message.refusal) {
  throw new Error(`OpenAI refused: ${response.choices[0].message.refusal}`);
}

// Incomplete response
if (response.choices[0].finish_reason === "length") {
  throw new Error("Response truncated - increase max_tokens");
}
```

### Implementation

- **Schema Builder:** `buildOpenAISchema()` in `bedSchema.js`
- **Schema Inserter:** `openaiSchemaInserter()` in `providerUtils.js`
- **Model Check:** `supportsStructuredOutputs()` checks model compatibility
- **Response Format:** Object root `{ layouts: [...] }` → normalized to array `[...]`

---

## Anthropic Structured Outputs

**Documentation:** https://docs.anthropic.com/en/docs/build-with-claude/structured-outputs

### Features

Anthropic offers **two complementary features**:

1. **JSON outputs** (`output_config.format`) - Controls Claude's response format
2. **Strict tool use** (`strict: true`) - Validates tool parameters

We use JSON outputs for layout generation.

### Requirements (More Flexible than OpenAI!)

1. **Root can be array OR object**
   ```javascript
   // ✅ Array root - valid!
   { type: "array", items: {...} }
   
   // ✅ Object root - also valid!
   { type: "object", properties: {...} }
   ```

2. **additionalProperties is optional** (not required)
   ```javascript
   {
     type: "object",
     properties: { ... }
     // additionalProperties can be omitted or set to true/false
   }
   ```

3. **Fields can be truly optional** (no null union required)
   ```javascript
   {
     properties: {
       name: { type: "string" },
       age: { type: "number" }  // Optional - just omit from required
     },
     required: ["name"]  // Only name is required
   }
   ```

4. **Additional support:**
   - Regex patterns (`pattern` property)
   - String formats: `date-time`, `time`, `date`, `duration`, `email`, `hostname`, `ipv4`, `ipv6`, `uuid`
   - Number constraints: `minimum`, `maximum`, `multipleOf`, `exclusiveMinimum`, `exclusiveMaximum`
   - Array constraints: `minItems`, `maxItems`

### API Format

```javascript
{
  model: "claude-sonnet-4-5",
  max_tokens: 2048,
  system: "...",
  messages: [...],
  output_config: {  // NOT response_format!
    format: {
      type: "json_schema",
      schema: { ... }  // No wrapper object needed
    }
  }
}
```

### Error Detection

```javascript
// Refusal detection
if (response.stop_reason === "refusal") {
  throw new Error(`Anthropic refused: ${response.content[0].text}`);
}

// Incomplete response
if (response.stop_reason === "max_tokens") {
  throw new Error("Response truncated - increase max_tokens");
}
```

### Implementation

- **Schema Builder:** `buildAnthropicSchema()` in `bedSchema.js`
- **Schema Inserter:** `anthropicSchemaInserter()` in `anthropicProvider.js`
- **Response Format:** Array root `[...]` directly (no normalization needed!)

---

## Gemini Structured Output

**Documentation:** https://ai.google.dev/gemini-api/docs/structured-output

### Features

Gemini uses a **provider-specific Type system** rather than standard JSON Schema.

1. **Root can be array OR object**
   ```javascript
   // ✅ Array using Type.ARRAY
   { type: Type.ARRAY, items: {...} }
   
   // ✅ Object using Type.OBJECT
   { type: Type.OBJECT, properties: {...} }
   ```

2. **Type system:**
   - `Type.STRING`
   - `Type.NUMBER`
   - `Type.INTEGER`
   - `Type.BOOLEAN`
   - `Type.OBJECT`
   - `Type.ARRAY`

3. **Additional support:**
   - String: `enum`, `format` (date-time, date, time)
   - Number: `enum`, `minimum`, `maximum`
   - Array: `items`, `prefixItems`, `minItems`, `maxItems`
   - Note: Gemini 2.0 requires `propertyOrdering` for structure

### API Format

```javascript
{
  model: "gemini-3-flash-preview",
  contents: "...",
  config: {
    responseMimeType: "application/json",
    responseSchema: {  // Using Type system
      type: Type.OBJECT,
      properties: {
        layouts: {
          type: Type.ARRAY,
          items: { ... }
        }
      }
    }
  }
}
```

### Implementation

- **Schema Builder:** `buildGeminiSchema()` in `geminiProvider.js` (uses Type system)
- **Schema Inserter:** Custom inserter in `geminiProvider.js`
- **Validation:** Uses OpenAI schema for local AJV validation
- **Response Format:** Object root `{ layouts: [...] }` → normalized to array `[...]`

---

## Schema Builders

### buildOpenAISchema()

Returns OpenAI-compliant schema with strictest requirements:

```javascript
{
  type: "object",  // Must be object
  properties: {
    layouts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          bedId: { type: "string" },
          placements: { type: "array", items: {...} }
        },
        required: ["bedId", "placements"],
        additionalProperties: false  // Required
      }
    }
  },
  required: ["layouts"],
  additionalProperties: false  // Required
}
```

### buildAnthropicSchema()

Returns Anthropic-friendly schema with flexibility:

```javascript
{
  type: "array",  // Array root allowed!
  items: {
    type: "object",
    properties: {
      bedId: { type: "string", description: "..." },
      placements: {
        type: "array",
        items: {
          properties: {
            x: { type: "number", minimum: 0 },  // Number constraints!
            size: { type: "number", minimum: 1, maximum: 120 },
            // Optional fields - no null union needed
            placementReasoning: { type: "string" }
          },
          required: ["id", "veggieType", "x", "y", "size"]  // Only core fields
        },
        minItems: 0  // Array constraints
      }
    },
    required: ["bedId", "placements"]
    // No additionalProperties constraint
  }
}
```

### buildGeminiSchema()

Returns Gemini Type-based schema:

```javascript
{
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
                veggieType: { type: Type.STRING, enum: VEGGIE_TYPES },
                x: { type: Type.NUMBER },
                // ...
              },
              required: ["id", "veggieType", "x", "y", "size", ...]
            }
          }
        },
        required: ["bedId", "placements"]
      }
    }
  },
  required: ["layouts"]
}
```

---

## Response Normalization

The server expects responses in **array format**: `[{bedId, placements}, ...]`

### Normalization Strategy

- **OpenAI:** Returns `{ layouts: [...] }` → normalized to `[...]` ✅
- **Anthropic:** Returns `[...]` directly → no normalization needed ✅
- **Gemini:** Returns `{ layouts: [...] }` → normalized to `[...]` ✅
- **Local:** Returns `[...]` directly → no normalization needed ✅

`normalizeProviderResponse()` in `providerUtils.js` handles this automatically:

```javascript
function normalizeProviderResponse(parsed) {
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && Array.isArray(parsed.layouts)) {
    return parsed.layouts;  // Extract layouts array
  }
  return parsed;  // Already in correct format
}
```

---

## Error Handling

All providers must handle:

1. **Parse errors** - Invalid JSON syntax
2. **Validation errors** - JSON doesn't match schema (local AJV validation)
3. **Refusals** - Provider refuses for safety reasons
4. **Incomplete responses** - Truncated due to token limits

### Example Flow

```javascript
try {
  // 1. Request with schema
  const response = await provider.generateLayout({...});
  
  // 2. Detect provider-specific errors
  detectRefusalOrIncomplete(response);
  
  // 3. Parse JSON
  const parsed = JSON.parse(extractJson(response.text));
  
  // 4. Validate schema
  const valid = validate(parsed);
  if (!valid) throw new Error("Schema validation failed");
  
  // 5. Normalize format
  return normalizeProviderResponse(parsed);
  
} catch (error) {
  // Handle parse, validation, refusal, or incomplete errors
  throw error;
}
```

---

## Best Practices

1. **Use provider-appropriate schemas**
   - OpenAI: Use `buildOpenAISchema()` (strict)
   - Anthropic: Use `buildAnthropicSchema()` (flexible)
   - Gemini: Use `buildGeminiSchema()` (Type system)

2. **Always validate locally with AJV**
   - Provider schema hints are best-effort
   - Local validation ensures contract compliance

3. **Handle provider-specific errors**
   - Check for refusals and incomplete responses
   - Provide clear error messages to users

4. **Test with real providers**
   - Mock tests verify integration logic
   - Real API tests verify schema compliance

5. **Document schema changes**
   - Update this file when adding new fields
   - Note any provider-specific limitations

---

## Adding a New Provider

1. **Create provider file** (`server/providers/newProvider.js`)
2. **Choose schema strategy:**
   - Use OpenAI schema if provider is OpenAI-compatible
   - Create custom schema builder if provider has unique requirements
3. **Implement schema inserter:**
   - Format schema according to provider's API
   - Handle fallback to JSON mode if schema unsupported
4. **Add error detection:**
   - Detect refusals and incomplete responses
   - Throw clear errors for debugging
5. **Set normalization:**
   - `normalizeResponse: true` if provider returns object root
   - `normalizeResponse: false` if provider returns array directly
6. **Write tests:**
   - Test valid response parsing
   - Test schema validation
   - Test error handling

---

## Troubleshooting

### "Schema validation failed"

- Check that provider response matches expected schema
- Verify all required fields are present
- Check that field types match (string vs number, etc.)
- Review AJV error messages for specific violations

### "Provider refused to generate response"

- Review request content for safety policy violations
- Check if input is appropriate for the provider
- Consider adjusting system prompt or user input

### "Response truncated due to max_tokens"

- Increase `max_tokens` parameter
- Simplify request to generate shorter responses
- Consider pagination or chunking for large layouts

### "Model does not support structured outputs"

- Check model compatibility (OpenAI only certain models)
- Verify model name/version is correct
- Fall back to JSON mode + local validation

---

## References

- **OpenAI:** https://platform.openai.com/docs/guides/structured-outputs
- **Anthropic:** https://docs.anthropic.com/en/docs/build-with-claude/structured-outputs
- **Gemini:** https://ai.google.dev/gemini-api/docs/structured-output
- **JSON Schema:** https://json-schema.org/draft-07/json-schema-release-notes
- **AJV:** https://ajv.js.org/

---

## Version History

- **v1.0** (2025-01) - Initial implementation with OpenAI object-root schema
- **v1.1** (2025-01) - Added provider-specific schemas and response normalization
- **v1.2** (2025-01) - Fixed Anthropic to use correct `output_config.format` API