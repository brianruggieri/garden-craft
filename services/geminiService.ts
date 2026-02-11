import { GoogleGenAI, Type } from "@google/genai";
import {
  GardenBed,
  Vegetable,
  SunOrientation,
  BedLayout,
  VeggieType,
} from "../types";
import { VEGGIE_METADATA } from "../constants";

/**
 * Gemini service (with dev-mode procedural generator).
 *
 * This file implements:
 * - A production path that attempts to use a server-side GoogleGenAI client when an API key is present.
 * - A development-only, non-deterministic procedural generator that:
 *   - Is intentionally non-deterministic per-generate (not seeded by bed id)
 *   - Produces denser layouts than before (reduced skip rates)
 *   - Uses a higher cluster frequency so small groups / patches are common
 *   - Uses Bridson Poisson-disc sampling as the base, then assigns vegetable types with cluster bias
 *
 * Note: the dev generator uses secure randomness when available (Web Crypto). This makes each
 * run produce a different layout (non-deterministic), per your request.
 */

/* Environment detection */
const isBrowser =
  typeof window !== "undefined" && typeof window.document !== "undefined";

// Vite / NODE envs
const MODE =
  (typeof (import.meta as any) !== "undefined" &&
    (import.meta as any).env?.MODE) ||
  (typeof process !== "undefined" && (process.env as any)?.NODE_ENV) ||
  "production";
const isDev = String(MODE).toLowerCase() === "development";

// API key: prefer server-side env but allow reading VITE var if intentionally exposed
const API_KEY =
  (typeof process !== "undefined" && (process.env as any)?.API_KEY) ||
  (typeof (import.meta as any) !== "undefined" &&
    (import.meta as any).env?.VITE_API_KEY) ||
  null;

let ai: any = null;
if (!isDev) {
  if (isBrowser && !API_KEY) {
    // safe fallback for browser environments without an API key
    ai = { models: { generateContent: async () => ({ text: "[]" }) } };
  } else {
    ai = new GoogleGenAI({ apiKey: API_KEY });
  }
}

/* ----------------------
 * Random helpers
 * ---------------------- */

// Prefer crypto-quality RNG when available for stronger non-determinism
function rng(): number {
  if (typeof crypto !== "undefined" && (crypto as any).getRandomValues) {
    // produce a uniform float [0,1)
    const arr = new Uint32Array(1);
    (crypto as any).getRandomValues(arr);
    // divide by 2^32
    return arr[0] / 4294967296;
  }
  return Math.random();
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/* ------------------------------------
 * Bridson Poisson-disc sampling
 * Returns points inside [0,width) x [0,height)
 * Non-deterministic because it uses global rng()
 * ------------------------------------ */
function bridsonPoisson(
  width: number,
  height: number,
  minDist: number,
  k = 30,
): { x: number; y: number }[] {
  if (minDist <= 0) {
    // fallback scatter
    const pts: { x: number; y: number }[] = [];
    const count = Math.max(1, Math.floor((width * height) / 150));
    for (let i = 0; i < count; i++) {
      pts.push({ x: Math.floor(rng() * width), y: Math.floor(rng() * height) });
    }
    return pts;
  }

  const cellSize = minDist / Math.SQRT2;
  const gridCols = Math.ceil(width / cellSize);
  const gridRows = Math.ceil(height / cellSize);
  const grid: (null | { x: number; y: number })[] = new Array(
    gridCols * gridRows,
  ).fill(null);

  const samples: { x: number; y: number }[] = [];
  const active: { x: number; y: number }[] = [];

  // first point: completely random
  const first = {
    x: Math.round(rng() * (width - 1)),
    y: Math.round(rng() * (height - 1)),
  };
  samples.push(first);
  active.push(first);
  grid[
    Math.floor(first.x / cellSize) + Math.floor(first.y / cellSize) * gridCols
  ] = first;

  while (active.length > 0) {
    const idx = Math.floor(rng() * active.length);
    const a = active[idx];
    let found = false;

    for (let i = 0; i < k; i++) {
      const radius = minDist * (1 + rng()); // [minDist, 2*minDist]
      const angle = rng() * Math.PI * 2;
      const nx = a.x + radius * Math.cos(angle);
      const ny = a.y + radius * Math.sin(angle);
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;

      const gx = Math.floor(nx / cellSize);
      const gy = Math.floor(ny / cellSize);

      let ok = true;
      const minX = Math.max(0, gx - 2);
      const maxX = Math.min(gridCols - 1, gx + 2);
      const minY = Math.max(0, gy - 2);
      const maxY = Math.min(gridRows - 1, gy + 2);

      for (let yy = minY; yy <= maxY && ok; yy++) {
        for (let xx = minX; xx <= maxX; xx++) {
          const g = grid[xx + yy * gridCols];
          if (g) {
            const dx = g.x - nx;
            const dy = g.y - ny;
            if (dx * dx + dy * dy < minDist * minDist) {
              ok = false;
              break;
            }
          }
        }
      }

      if (ok) {
        const candidate = { x: Math.round(nx), y: Math.round(ny) };
        samples.push(candidate);
        active.push(candidate);
        grid[gx + gy * gridCols] = candidate;
        found = true;
        break;
      }
    }

    if (!found) active.splice(idx, 1);

    // safety cap
    if (samples.length > 5000) break;
  }

  return samples;
}

/* ------------------------------------
 * Development procedural generator (non-deterministic)
 * - Higher density than previous dev generator
 * - Increased cluster frequency (clusters common)
 * - Not seeded by bed id; different generate() -> different layout
 * ------------------------------------ */
function generateProceduralLayouts(
  beds: GardenBed[],
  seeds: Vegetable[],
  sunOrientation: SunOrientation,
): BedLayout[] {
  const activeSeeds = seeds.filter((s) => s.priority > 0);
  const layouts: BedLayout[] = [];

  for (const bed of beds) {
    const placements: any[] = [];

    if (activeSeeds.length === 0) {
      layouts.push({ bedId: bed.id, placements });
      continue;
    }

    // baseline spacing: prefer larger spacing but allow denser layouts (we want more than before)
    const activeSpacings = activeSeeds.map(
      (s) => VEGGIE_METADATA[s.type]?.spacing ?? 12,
    );
    const baseline = Math.max(8, Math.round(Math.max(...activeSpacings)));
    const variation = 0.8 + rng() * 0.8; // 0.8 .. 1.6
    const minDist = Math.max(6, Math.round(baseline * variation));

    // target density is higher than previous: densityFactor larger
    const densityFactor = 1.2 + rng() * 1.1; // ~1.2 .. 2.3

    // estimate how many points we'll aim for (used for downsampling)
    const estimatedCount = Math.max(
      6,
      Math.min(
        2000,
        Math.floor(
          ((bed.width * bed.height) / (minDist * minDist)) * densityFactor,
        ),
      ),
    );

    // cluster frequency increased: 1..4 clusters (more likely to have clusters)
    const clusterCount = 1 + Math.floor(rng() * 4); // 1..4
    const clusters: {
      cx: number;
      cy: number;
      radius: number;
      preferred: number;
      boost: number;
    }[] = [];
    for (let c = 0; c < clusterCount; c++) {
      clusters.push({
        cx: Math.floor(rng() * bed.width),
        cy: Math.floor(rng() * bed.height),
        radius: Math.max(
          8,
          Math.round((rng() * 0.2 + 0.08) * Math.min(bed.width, bed.height)),
        ),
        preferred: Math.floor(rng() * activeSeeds.length),
        boost: 0.8 + rng() * 2.0, // stronger boost range
      });
    }

    // get Poisson-disc points
    const points = bridsonPoisson(bed.width, bed.height, minDist, 30);

    // downsample deterministically (but since points are non-deterministic, result varies each call)
    const pts =
      points.length > estimatedCount
        ? points.filter(
            (_, i) => i % Math.ceil(points.length / estimatedCount) === 0,
          )
        : points.slice();

    const placementsLocal: any[] = [];
    let idxCounter = 0;

    for (const p of pts) {
      // reduce skip rate for denser layout (previously ~0.18 skip); now lower so more placements
      if (rng() < 0.12) continue; // ~12% skip

      // compute weights for vegetable selection (priority + cluster bias)
      const weights = activeSeeds.map((s) => Math.max(1, s.priority));
      for (const cl of clusters) {
        const dx = p.x - cl.cx;
        const dy = p.y - cl.cy;
        const d2 = dx * dx + dy * dy;
        const inf = Math.exp(-d2 / (cl.radius * cl.radius * 0.9));
        if (inf > 0.03) {
          weights[cl.preferred] = weights[cl.preferred] * (1 + inf * cl.boost);
        }
      }

      const wsum = weights.reduce((a, b) => a + b, 0);
      let r = rng() * wsum;
      let chosen = weights.length - 1;
      for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r <= 0) {
          chosen = i;
          break;
        }
      }

      const veg = activeSeeds[chosen];
      const meta = VEGGIE_METADATA[veg.type] || { spacing: minDist };

      // jitter more strongly to break any residual regularity
      const jitterRadius = Math.max(
        2,
        Math.round(minDist * (0.2 + rng() * 0.6)),
      );
      const jx = Math.round((rng() - 0.5) * jitterRadius * 2);
      const jy = Math.round((rng() - 0.5) * jitterRadius * 2);
      const x = clamp(p.x + jx, 0, bed.width);
      const y = clamp(p.y + jy, 0, bed.height);

      // neighbor-based companion hints (look back a short window)
      const neighborTypes = new Set<string>();
      for (
        let ni = Math.max(placementsLocal.length - 12, 0);
        ni < placementsLocal.length;
        ni++
      ) {
        const np = placementsLocal[ni];
        const dx = np.x - x;
        const dy = np.y - y;
        if (dx * dx + dy * dy < minDist * minDist * 1.6)
          neighborTypes.add(np.veggieType);
      }
      const companions = (meta.companions || []).filter((t: string) =>
        neighborTypes.has(t),
      );
      const antagonists = (meta.antagonists || []).filter((t: string) =>
        neighborTypes.has(t),
      );

      placementsLocal.push({
        id: `${bed.id}-${veg.type}-${idxCounter++}`,
        veggieType: veg.type,
        varietyName:
          (veg.selectedVarieties[0] && veg.selectedVarieties[0].name) ||
          `Standard ${veg.type}`,
        x,
        y,
        size: veg.selectedVarieties[0]?.spacing || meta.spacing || minDist,
        placementReasoning: `Procedural (dev) placement; priority ${veg.priority}.`,
        spacingAnalysis: `Target spacing ~${Math.round(minDist)}in (varied).`,
        companionInsights:
          companions.length > 0
            ? `Near companions: ${companions.join(", ")}`
            : antagonists.length > 0
              ? `Potential antagonists nearby: ${antagonists.join(", ")}`
              : `No strong companion signals.`,
      });
    }

    // If too few placements, perform a light refill with smaller minDist to improve coverage
    const desiredMinimal = Math.max(4, Math.floor(estimatedCount * 0.45));
    if (placementsLocal.length < desiredMinimal) {
      const refill = bridsonPoisson(
        bed.width,
        bed.height,
        Math.max(5, Math.round(minDist * 0.7)),
        20,
      );
      for (const p of refill) {
        if (
          placementsLocal.length >=
          Math.max(desiredMinimal, Math.floor(estimatedCount * 0.85))
        )
          break;
        if (rng() < 0.5) continue;
        const choice = activeSeeds[Math.floor(rng() * activeSeeds.length)];
        const meta = VEGGIE_METADATA[choice.type] || { spacing: minDist };
        placementsLocal.push({
          id: `${bed.id}-refill-${placementsLocal.length}`,
          veggieType: choice.type,
          varietyName:
            (choice.selectedVarieties[0] && choice.selectedVarieties[0].name) ||
            `Standard ${choice.type}`,
          x: clamp(p.x + Math.round((rng() - 0.5) * 6), 0, bed.width),
          y: clamp(p.y + Math.round((rng() - 0.5) * 6), 0, bed.height),
          size: Math.max(4, Math.round((meta.spacing || minDist) * 0.8)),
          placementReasoning: `Refill placement (dev).`,
          spacingAnalysis: `Refill ~${Math.round((meta.spacing || minDist) * 0.8)}in`,
          companionInsights: `Procedural refill.`,
        });
      }
    }

    layouts.push({ bedId: bed.id, placements: placementsLocal });
  }

  return layouts;
}

/* ------------------------------------
 * Public API
 * ------------------------------------ */
export const generateGardenLayout = async (
  beds: GardenBed[],
  seeds: Vegetable[],
  sunOrientation: SunOrientation,
): Promise<BedLayout[]> => {
  // Dev: use procedural generator (non-deterministic per call)
  if (isDev) {
    try {
      return generateProceduralLayouts(beds, seeds, sunOrientation);
    } catch (err) {
      console.error("Dev procedural generator failed:", err);
      return [];
    }
  }

  // Production: use AI client if available (server-side)
  if (!ai) {
    console.warn("No AI client available; returning empty layouts.");
    return [];
  }

  const model = "gemini-3-pro-preview";
  const varietyContext = seeds.flatMap((v) => {
    if (v.selectedVarieties.length > 0) {
      return v.selectedVarieties.map((sv) => ({
        veggieType: sv.type,
        varietyName: sv.name,
        priority: v.priority,
        spacing: sv.spacing,
        height: sv.height,
        habit: sv.habit,
        root: sv.rootDepth,
        desc: sv.description,
      }));
    } else {
      const meta = VEGGIE_METADATA[v.type];
      return [
        {
          veggieType: v.type,
          varietyName: `Standard ${v.type}`,
          priority: v.priority,
          spacing: meta.spacing,
          height: meta.height,
          habit: meta.habit,
          root: meta.root,
          desc: "General variety used as fallback.",
        },
      ];
    }
  });

  const baseMeta = Object.entries(VEGGIE_METADATA).map(([type, meta]) => ({
    type,
    likes: meta.companions,
    dislikes: meta.antagonists,
  }));

  const prompt = `
    You are an expert Horticultural Planner. Return a JSON array of BedLayout objects.
    BED CONFIGS: ${JSON.stringify(beds)}
    ENV: SunOrientation ${sunOrientation}
    VARIETIES: ${JSON.stringify(varietyContext)}
    GUILD: ${JSON.stringify(baseMeta)}
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
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
                  veggieType: {
                    type: Type.STRING,
                    enum: Object.values(VeggieType),
                  },
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
      },
    },
  });

  try {
    const text = response.text || "[]";
    const parsed = JSON.parse(text) as BedLayout[];
    return parsed;
  } catch (err) {
    console.error("AI response parse failed:", err);
    return [];
  }
};
