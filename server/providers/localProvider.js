import { randomBytes } from "crypto";
import { VEGGIE_METADATA } from "../veggieMetadata.js";

/**
 * Local procedural provider (server-side).
 * Non-deterministic, dense, clustered layout generator.
 */

function rng() {
  const buf = randomBytes(4);
  const value = buf.readUInt32LE(0);
  return value / 4294967296;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function bridsonPoisson(width, height, minDist, k = 30) {
  if (minDist <= 0) {
    const pts = [];
    const count = Math.max(1, Math.floor((width * height) / 150));
    for (let i = 0; i < count; i++) {
      pts.push({
        x: Math.floor(rng() * width),
        y: Math.floor(rng() * height),
      });
    }
    return pts;
  }

  const cellSize = minDist / Math.SQRT2;
  const gridCols = Math.ceil(width / cellSize);
  const gridRows = Math.ceil(height / cellSize);
  const grid = new Array(gridCols * gridRows).fill(null);

  const samples = [];
  const active = [];

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
      const radius = minDist * (1 + rng());
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
    if (samples.length > 5000) break;
  }

  return samples;
}

function generateProceduralLayouts({ beds, seeds }) {
  const activeSeeds = (seeds || []).filter((s) => s.priority > 0);
  const layouts = [];

  for (const bed of beds || []) {
    const placements = [];

    if (activeSeeds.length === 0) {
      layouts.push({ bedId: bed.id, placements });
      continue;
    }

    const activeSpacings = activeSeeds.map(
      (s) => VEGGIE_METADATA[s.type]?.spacing ?? 12,
    );
    const baseline = Math.max(8, Math.round(Math.max(...activeSpacings)));
    const variation = 0.8 + rng() * 0.8;
    const minDist = Math.max(6, Math.round(baseline * variation));

    const densityFactor = 1.2 + rng() * 1.1;
    const estimatedCount = Math.max(
      6,
      Math.min(
        2000,
        Math.floor(
          ((bed.width * bed.height) / (minDist * minDist)) * densityFactor,
        ),
      ),
    );

    const clusterCount = 1 + Math.floor(rng() * 4);
    const clusters = [];
    for (let c = 0; c < clusterCount; c++) {
      clusters.push({
        cx: Math.floor(rng() * bed.width),
        cy: Math.floor(rng() * bed.height),
        radius: Math.max(
          8,
          Math.round((rng() * 0.2 + 0.08) * Math.min(bed.width, bed.height)),
        ),
        preferred: Math.floor(rng() * activeSeeds.length),
        boost: 0.8 + rng() * 2.0,
      });
    }

    const points = bridsonPoisson(bed.width, bed.height, minDist, 30);
    const pts =
      points.length > estimatedCount
        ? points.filter(
            (_, i) => i % Math.ceil(points.length / estimatedCount) === 0,
          )
        : points.slice();

    let idxCounter = 0;

    for (const p of pts) {
      if (rng() < 0.12) continue;

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

      const jitterRadius = Math.max(
        2,
        Math.round(minDist * (0.2 + rng() * 0.6)),
      );
      const jx = Math.round((rng() - 0.5) * jitterRadius * 2);
      const jy = Math.round((rng() - 0.5) * jitterRadius * 2);
      const x = clamp(p.x + jx, 0, bed.width);
      const y = clamp(p.y + jy, 0, bed.height);

      const neighborTypes = new Set();
      for (
        let ni = Math.max(placements.length - 12, 0);
        ni < placements.length;
        ni++
      ) {
        const np = placements[ni];
        const dx = np.x - x;
        const dy = np.y - y;
        if (dx * dx + dy * dy < minDist * minDist * 1.6)
          neighborTypes.add(np.veggieType);
      }
      const companions = (meta.companions || []).filter((t) =>
        neighborTypes.has(t),
      );
      const antagonists = (meta.antagonists || []).filter((t) =>
        neighborTypes.has(t),
      );

      placements.push({
        id: `${bed.id}-${veg.type}-${idxCounter++}`,
        veggieType: veg.type,
        varietyName:
          (veg.selectedVarieties &&
            veg.selectedVarieties[0] &&
            veg.selectedVarieties[0].name) ||
          `Standard ${veg.type}`,
        x,
        y,
        size: veg.selectedVarieties?.[0]?.spacing || meta.spacing || minDist,
        placementReasoning: `Procedural (local) placement; priority ${veg.priority}.`,
        spacingAnalysis: `Target spacing ~${Math.round(minDist)}in (varied).`,
        companionInsights:
          companions.length > 0
            ? `Near companions: ${companions.join(", ")}`
            : antagonists.length > 0
              ? `Potential antagonists nearby: ${antagonists.join(", ")}`
              : `No strong companion signals.`,
      });
    }

    const desiredMinimal = Math.max(4, Math.floor(estimatedCount * 0.45));
    if (placements.length < desiredMinimal) {
      const refill = bridsonPoisson(
        bed.width,
        bed.height,
        Math.max(5, Math.round(minDist * 0.7)),
        20,
      );
      for (const p of refill) {
        if (
          placements.length >=
          Math.max(desiredMinimal, Math.floor(estimatedCount * 0.85))
        )
          break;
        if (rng() < 0.5) continue;
        const choice = activeSeeds[Math.floor(rng() * activeSeeds.length)];
        const meta = VEGGIE_METADATA[choice.type] || { spacing: minDist };
        placements.push({
          id: `${bed.id}-refill-${placements.length}`,
          veggieType: choice.type,
          varietyName:
            (choice.selectedVarieties &&
              choice.selectedVarieties[0] &&
              choice.selectedVarieties[0].name) ||
            `Standard ${choice.type}`,
          x: clamp(p.x + Math.round((rng() - 0.5) * 6), 0, bed.width),
          y: clamp(p.y + Math.round((rng() - 0.5) * 6), 0, bed.height),
          size: Math.max(4, Math.round((meta.spacing || minDist) * 0.8)),
          placementReasoning: `Refill placement (local).`,
          spacingAnalysis: `Refill ~${Math.round(
            (meta.spacing || minDist) * 0.8,
          )}in`,
          companionInsights: `Procedural refill.`,
        });
      }
    }

    layouts.push({ bedId: bed.id, placements });
  }

  return layouts;
}

export const localProvider = {
  id: "local",
  name: "Local Procedural",
  supportsOAuth: false,
  async generateLayout({ beds, seeds, sunOrientation }) {
    return generateProceduralLayouts({ beds, seeds, sunOrientation });
  },
};

export default localProvider;
