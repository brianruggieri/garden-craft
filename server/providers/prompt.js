import { VEGGIE_METADATA, VEGGIE_TYPES } from "../veggieMetadata.js";

const DEFAULT_SYSTEM = [
  "You are an expert horticultural planner and spatial designer.",
  "Return only valid JSON (no markdown, no commentary).",
  "Use inches for all spatial values.",
  "Respect bed bounds and avoid overlaps.",
].join(" ");

function normalizeVariety(veg) {
  const meta = VEGGIE_METADATA[veg.type] || {};
  if (Array.isArray(veg.selectedVarieties) && veg.selectedVarieties.length > 0) {
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
              x: { type: "number" },
              y: { type: "number" },
              size: { type: "number" },
              placementReasoning: { type: "string" },
              spacingAnalysis: { type: "string" },
              companionInsights: { type: "string" },
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
      `BED CONFIGS: ${JSON.stringify(beds || [])}`,
      `ENV: SunOrientation ${sunOrientation || "Unknown"}`,
      `VARIETIES: ${JSON.stringify(varieties)}`,
      `GUILD: ${JSON.stringify(guild)}`,
      `STYLE: ${JSON.stringify(style)}`,
      `GOALS: ${JSON.stringify(optimizationGoals)}`,
      "Ensure all placements stay within each bed's bounds.",
    ].join("\n"),
    schema,
  };

  return payload;
}
