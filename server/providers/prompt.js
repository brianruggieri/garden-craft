import { VEGGIE_METADATA, VEGGIE_TYPES } from "../veggieMetadata.js";

const DEFAULT_SYSTEM = [
  "You are an expert horticultural planner and spatial designer.",
  "Return only valid JSON (no markdown, no commentary).",
  "Use inches for all spatial values.",
  "Respect bed bounds and avoid overlaps.",
].join(" ");

function normalizeVariety(veg) {
  const meta = VEGGIE_METADATA[veg.type] || {};
  if (
    Array.isArray(veg.selectedVarieties) &&
    veg.selectedVarieties.length > 0
  ) {
    return veg.selectedVarieties.map((sv) => ({
      veggieType: sv.type || veg.type,
      varietyName: sv.name,
      priority: veg.priority ?? 1,
      spacing: sv.spacing ?? meta.spacing,
      height: sv.height ?? meta.height,
      habit: sv.habit ?? meta.habit,
      root: sv.rootDepth ?? meta.root,
      desc: sv.description ?? "Selected variety.",
    }));
  }
  return [
    {
      veggieType: veg.type,
      varietyName: `Standard ${veg.type}`,
      priority: veg.priority ?? 1,
      spacing: meta.spacing,
      height: meta.height,
      habit: meta.habit,
      root: meta.root,
      desc: "General variety used as fallback.",
    },
  ];
}

export function buildGardenPrompt({
  beds,
  seeds,
  sunOrientation,
  style = {},
  optimizationGoals = [],
}) {
  const varieties = (seeds || []).flatMap(normalizeVariety);
  const guild = Object.entries(VEGGIE_METADATA).map(([type, meta]) => ({
    type,
    likes: meta.companions,
    dislikes: meta.antagonists,
  }));

  const system = DEFAULT_SYSTEM;

  const schema = {
    type: "array",
    items: {
      type: "object",
      properties: {
        bedId: { type: "string" },
        placements: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              veggieType: { type: "string", enum: VEGGIE_TYPES },
              varietyName: { type: "string" },
              x: {
                type: "number",
                description: "Inches from bed left edge",
              },
              y: {
                type: "number",
                description: "Inches from bed top edge",
              },
              size: {
                type: "number",
                description: "Diameter of the plant canopy in inches",
              },
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
                description:
                  "Specific companion planting benefit achieved here",
              },
            },
            required: ["id", "veggieType", "varietyName", "x", "y", "size"],
          },
        },
      },
      required: ["bedId", "placements"],
    },
  };

  const payload = {
    system,
    prompt: [
      "Generate a JSON array of BedLayout objects.",
      "",
      `BED CONFIGURATIONS: ${JSON.stringify(beds || [])}`,
      `ENVIRONMENT: Sun orientation is ${sunOrientation || "Unknown"}`,
      "",
      `PLANT VARIETIES TO USE: ${JSON.stringify(varieties)}`,
      "",
      `COMPANION PLANTING GUILD (likes/dislikes): ${JSON.stringify(guild)}`,
      "",
      `STYLE PREFERENCES: ${JSON.stringify(style)}`,
      `OPTIMIZATION GOALS: ${JSON.stringify(optimizationGoals)}`,
      "",
      "REQUIREMENTS:",
      "- All placements must stay within each bed's bounds (x, y, size)",
      "- Respect minimum spacing requirements for each variety",
      "- Consider companion planting relationships (likes/dislikes)",
      "- Provide detailed reasoning for each placement decision",
      "- Analyze spacing relative to immediate neighbors",
      "- Explain specific companion planting benefits achieved",
    ].join("\n"),
    schema,
  };

  return payload;
}
