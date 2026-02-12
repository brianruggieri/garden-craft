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
  optimizationGoals = [
    "Maximize space utilization - fill as much of each bed as possible",
    "Plant as many vegetables as the space allows while respecting minimum spacing",
    "Prioritize companion planting relationships to increase plant density",
    "Use vertical and horizontal space efficiently - tall plants don't waste ground space",
    "Fill gaps with small, fast-growing plants (radishes, lettuce, herbs)",
    "Layer plantings by root depth - shallow, medium, and deep roots can coexist",
    "Avoid leaving large empty spaces - if there's room for another plant, add it",
    "Respect absolute minimums: spacing, bed boundaries, and plant size requirements",
    "Favor strategic density over sparse layouts - gardens are most productive when full",
  ],
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
      "- MAXIMIZE DENSITY: Fill as much of each bed as possible with plants",
      "- FILL GAPS: If there's space for another plant (considering spacing), add it",
      "- LAYER BY DEPTH: Combine plants with different root depths (shallow/medium/deep)",
      "- USE VERTICAL SPACE: Tall plants (tomatoes, kale) don't prevent ground crops (lettuce, radish)",
      "- COMPANION PLANTING: Place compatible plants together to increase density safely",
      "- All placements must stay within each bed's bounds (x, y, size)",
      "- Respect minimum spacing requirements for each variety (critical constraint)",
      "- Provide detailed reasoning for each placement decision",
      "- Analyze spacing relative to immediate neighbors",
      "- Explain specific companion planting benefits achieved",
      "",
      "SPACE UTILIZATION STRATEGY:",
      "1. Start with large plants (tomatoes, zucchini, kale) - these define the structure",
      "2. Fill medium spaces with medium plants (peppers, cucumbers)",
      "3. Pack small plants (radish, lettuce, basil, carrots) into remaining gaps",
      "4. Use vertical layering - tall plants with shallow-root understory plants",
      "5. Check for wasted space - every 6-12 inch gap can fit something",
      "6. Aim for 80-95% bed coverage while maintaining minimum spacing",
    ].join("\n"),
    schema,
  };

  return payload;
}
