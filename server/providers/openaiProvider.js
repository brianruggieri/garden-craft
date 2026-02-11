import OpenAI from "openai";
import { buildGardenPrompt } from "./prompt.js";

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-5.2";

function resolveApiKey(auth = {}) {
  return auth.apiKey || auth.oauthAccessToken || process.env.OPENAI_API_KEY || null;
}

function createClient(auth = {}) {
  const apiKey = resolveApiKey(auth);
  if (!apiKey) {
    throw new Error(
      "OpenAI API key missing. Set OPENAI_API_KEY or pass auth.apiKey/auth.oauthAccessToken.",
    );
  }
  return new OpenAI({ apiKey });
}

function extractJson(text = "") {
  const trimmed = text.trim();
  if (!trimmed) return "[]";
  if (trimmed.startsWith("[")) return trimmed;
  const match = trimmed.match(/\[[\s\S]*\]/);
  return match ? match[0] : trimmed;
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
    const client = createClient(auth);
    const { system, prompt } = buildGardenPrompt({
      beds,
      seeds,
      sunOrientation,
      style,
      optimizationGoals,
    });

    const response = await client.responses.create({
      model: model || DEFAULT_MODEL,
      instructions: system,
      input: prompt,
    });

    const raw = response?.output_text || "[]";
    try {
      return JSON.parse(extractJson(raw));
    } catch (err) {
      throw new Error(`OpenAI response parse failed: ${err.message}`);
    }
  },
};

export default openaiProvider;
