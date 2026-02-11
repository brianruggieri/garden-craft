import Anthropic from "@anthropic-ai/sdk";
import { buildGardenPrompt } from "./prompt.js";

const DEFAULT_MODEL =
  process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";

function resolveApiKey(auth = {}) {
  return (
    auth.apiKey || auth.oauthAccessToken || process.env.ANTHROPIC_API_KEY || null
  );
}

function createClient(auth = {}) {
  const apiKey = resolveApiKey(auth);
  if (!apiKey) {
    throw new Error(
      "Anthropic API key missing. Set ANTHROPIC_API_KEY or pass auth.apiKey/auth.oauthAccessToken.",
    );
  }
  return new Anthropic({ apiKey });
}

function extractText(content = []) {
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => (block?.type === "text" ? block.text : ""))
    .join("\n")
    .trim();
}

function extractJson(text = "") {
  const trimmed = text.trim();
  if (!trimmed) return "[]";
  if (trimmed.startsWith("[")) return trimmed;
  const match = trimmed.match(/\[[\s\S]*\]/);
  return match ? match[0] : trimmed;
}

export const anthropicProvider = {
  id: "anthropic",
  name: "Anthropic",
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

    const message = await client.messages.create({
      model: model || DEFAULT_MODEL,
      max_tokens: 2048,
      system,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = extractText(message?.content || []);
    try {
      return JSON.parse(extractJson(raw));
    } catch (err) {
      throw new Error(`Anthropic response parse failed: ${err.message}`);
    }
  },
};

export default anthropicProvider;
