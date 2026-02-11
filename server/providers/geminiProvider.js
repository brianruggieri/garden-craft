import { GoogleGenAI, Type } from "@google/genai";
import { buildGardenPrompt } from "./prompt.js";
import { VEGGIE_TYPES } from "../veggieMetadata.js";

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash-001";

function resolveApiKey(auth = {}) {
  return (
    auth.apiKey ||
    auth.oauthAccessToken ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    null
  );
}

function createClient(auth = {}) {
  const apiKey = resolveApiKey(auth);
  if (!apiKey) {
    throw new Error(
      "Gemini API key missing. Set GEMINI_API_KEY/GOOGLE_API_KEY or pass auth.apiKey.",
    );
  }
  return new GoogleGenAI({ apiKey });
}

function buildGeminiSchema() {
  return {
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
            required: ["id", "veggieType", "varietyName", "x", "y", "size"],
          },
        },
      },
      required: ["bedId", "placements"],
    },
  };
}

export const geminiProvider = {
  id: "gemini",
  name: "Google Gemini",
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
    const ai = createClient(auth);
    const { system, prompt } = buildGardenPrompt({
      beds,
      seeds,
      sunOrientation,
      style,
      optimizationGoals,
    });

    const response = await ai.models.generateContent({
      model: model || DEFAULT_MODEL,
      contents: [system, prompt].join("\n\n"),
      config: {
        responseMimeType: "application/json",
        responseSchema: buildGeminiSchema(),
      },
    });

    const text = response?.text || "[]";
    try {
      return JSON.parse(text);
    } catch (err) {
      throw new Error(`Gemini response parse failed: ${err.message}`);
    }
  },
};

export default geminiProvider;
