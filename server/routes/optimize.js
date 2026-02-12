/**
 * Optimization route handlers
 */

import { getProvider } from '../providers/index.js';
import { resolveAuth } from '../utils/authResolver.js';
import { VEGGIE_METADATA } from '../veggieMetadata.js';

export function createOptimizeHandler(oauthTokenStore) {
  return async (req, res) => {
    try {
      const {
        provider: providerId = 'local',
        beds, seeds, sunOrientation, style, optimizationGoals, auth, model,
      } = req.body || {};

      const provider = getProvider(providerId);
      if (!provider) {
        return res.status(400).json({ error: `Unknown provider: ${providerId}` });
      }

      const resolvedAuth = resolveAuth({ providerId, auth, tokenStore: oauthTokenStore });

      const rawLayouts = await provider.generateLayout({
        beds, seeds, sunOrientation, style, optimizationGoals,
        auth: resolvedAuth, model,
      });

      validateBounds(rawLayouts, beds);
      const layouts = normalizePlacementData(rawLayouts);

      res.json({ provider: provider.id, layouts });
    } catch (err) {
      console.error('Optimize error:', err);
      res.status(500).json({ error: err.message || 'Optimization failed.' });
    }
  };
}

function validateBounds(layouts, beds) {
  if (!Array.isArray(layouts) || !Array.isArray(beds)) return;
  layouts.forEach((layout) => {
    const bed = beds.find((b) => b.id === layout.bedId);
    if (!bed || !Array.isArray(layout.placements)) return;
    const violations = [];
    layout.placements.forEach((plant) => {
      const radius = (plant.size || 0) / 2;
      if (plant.x - radius < 0 || plant.x + radius > bed.width || 
          plant.y - radius < 0 || plant.y + radius > bed.height) {
        violations.push({ veggieType: plant.veggieType, center: `(${plant.x}", ${plant.y}")` });
      }
    });
    if (violations.length > 0) {
      console.warn(`⚠️  ${violations.length} bounds violations in bed "${bed.name || bed.id}"`);
    }
  });
}

function normalizePlacementData(rawLayouts) {
  const normalizeType = (value) => {
    if (!value) return value;
    const key = String(value).trim();
    if (VEGGIE_METADATA[key]) return key;
    const title = key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
    return VEGGIE_METADATA[title] ? title : key;
  };

  const makeId = (maybeId, idx) => 
    maybeId !== undefined && maybeId !== null ? String(maybeId) : `p-${Date.now().toString(36)}-${idx}`;

  const normalizePlant = (plant = {}, idx = 0) => ({
    id: makeId(plant.id, idx),
    veggieType: normalizeType(plant.veggieType || plant.type || plant.name || ''),
    varietyName: plant.varietyName || plant.variety || `Standard ${normalizeType(plant.veggieType || plant.type || '')}`,
    x: typeof plant.x === 'number' ? plant.x : Number(plant.left ?? plant.cx ?? 0),
    y: typeof plant.y === 'number' ? plant.y : Number(plant.top ?? plant.cy ?? 0),
    size: plant.size ?? plant.spacing ?? plant.spread ?? null,
    spacingAnalysis: plant.spacingAnalysis ?? plant.spacingNotes ?? null,
    placementReasoning: plant.placementReasoning ?? plant.reasoning ?? null,
    companionInsights: plant.companionInsights ?? plant.companionNotes ?? null,
  });

  return (Array.isArray(rawLayouts) ? rawLayouts : []).map((layout) => {
    const source = layout?.placements ?? layout?.plants ?? [];
    return { ...layout, placements: source.map(normalizePlant) };
  });
}

export default { createOptimizeHandler };
