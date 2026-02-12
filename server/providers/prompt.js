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
    "Maximize density using Intensive Square Foot Gardening and Intercropping techniques",
    "Use under-planting: shallow herbs (thyme, oregano) beneath tall plants (tomato, pepper)",
    "Manage shade: tall vertical plants on appropriate edge to avoid casting shadows",
    "Respect companion relationships (likes) and separate antagonists (dislikes)",
    "Fill every available space with appropriate plant varieties",
  ],
}) {
  const varieties = (seeds || []).flatMap(normalizeVariety);
  const guild = Object.entries(VEGGIE_METADATA).map(([type, meta]) => ({
    type,
    likes: meta.companions,
    dislikes: meta.antagonists,
  }));

  const system = DEFAULT_SYSTEM;

  // Calculate priority-based variety distribution with target counts per bed
  const totalPriority = varieties.reduce((sum, v) => sum + v.priority, 0);

  // Build per-bed density targets and variety recipes
  const bedRecipes = beds.map((bed) => {
    const sqft = (bed.width * bed.height) / 144; // Convert sq inches to sq feet
    // Target: 2.5-3 plants per square foot for intensive gardening
    const targetMin = Math.ceil(sqft * 2.5);
    const targetMax = Math.ceil(sqft * 3.5);

    // Distribute plants across varieties by priority
    const varietyRecipe = varieties.map((v) => {
      const priorityRatio = v.priority / totalPriority;
      const minCount = Math.max(1, Math.floor(targetMin * priorityRatio));
      const maxCount = Math.ceil(targetMax * priorityRatio);

      return {
        veggieType: v.veggieType,
        varietyName: v.varietyName,
        spacing: v.spacing,
        minCount,
        maxCount,
        priority: v.priority,
      };
    });

    return {
      bedId: bed.id,
      bedName: bed.name,
      dimensions: `${bed.width}×${bed.height}"`,
      sqft: sqft.toFixed(1),
      targetPlants: `${targetMin}-${targetMax}`,
      recipe: varietyRecipe,
    };
  });

  // Calculate shade management direction
  const tallPlantEdge =
    sunOrientation === "North"
      ? "South"
      : sunOrientation === "South"
        ? "North"
        : sunOrientation === "East"
          ? "West"
          : "East";

  const payload = {
    system,
    prompt: [
      "You are an expert Horticultural Planner using Intensive Square Foot Gardening and Intercropping.",
      "",
      "PLANTING RECIPES (MANDATORY COUNTS PER BED):",
      JSON.stringify(bedRecipes, null, 2),
      "",
      "GUILD RULES (Companions & Antagonists):",
      JSON.stringify(guild),
      "",
      "CRITICAL REQUIREMENTS:",
      "1. PLANT COUNTS: You MUST place the number of plants specified in each bed's recipe (minCount to maxCount per variety).",
      '2. INTERCROPPING: Use under-planting - place small plants (Thyme 8", Oregano 12", Basil 10") beneath or between larger plants.',
      `3. SHADE MANAGEMENT: Place tall plants (Tomato, Pepper) on the ${tallPlantEdge} edge to avoid shading others.`,
      "4. COORDINATES: (x, y) are inches from top-left corner of the bed. Center of plant must be at least size/2 inches from all edges.",
      "5. SPACING: Use the 'spacing' value as the plant's 'size' (canopy diameter). Plants can overlap slightly if root depths differ (shallow/medium/deep).",
      "6. COMPANIONS: Cluster 'likes' together (Basil+Tomato, Marigold+Tomato), separate 'dislikes' when provided.",
      "7. DENSITY: Fill the entire bed area - use staggered rows, triangular spacing, and multi-layer planting.",
      "",
      "OUTPUT FORMAT:",
      "Return JSON array: [{bedId, placements: [{id, veggieType, varietyName, x, y, size, placementReasoning, spacingAnalysis, companionInsights}]}]",
      "",
      'EXAMPLE for a 48×48" bed with Tomato(24"), Basil(10"), Thyme(8"):',
      "- 2 Tomatoes at edges for height",
      "- 6-8 Basil tucked between tomatoes",
      "- 8-12 Thyme in remaining gaps",
      "= 16-22 plants total filling the space",
    ].join("\n"),
  };

  return payload;
}
