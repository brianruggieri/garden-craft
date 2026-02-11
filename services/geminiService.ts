
import { GoogleGenAI, Type } from "@google/genai";
import { GardenBed, Vegetable, SunOrientation, BedLayout, VeggieType } from "../types";
import { VEGGIE_METADATA } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateGardenLayout = async (
  beds: GardenBed[],
  seeds: Vegetable[],
  sunOrientation: SunOrientation
): Promise<BedLayout[]> => {
  const model = "gemini-3-pro-preview";
  
  // Format specific variety data OR fallback to generic veggie metadata
  const varietyContext = seeds.flatMap(v => {
    if (v.selectedVarieties.length > 0) {
      return v.selectedVarieties.map(sv => ({
        veggieType: sv.type,
        varietyName: sv.name,
        priority: v.priority,
        spacing: sv.spacing,
        height: sv.height,
        habit: sv.habit,
        root: sv.rootDepth,
        desc: sv.description
      }));
    } else {
      const meta = VEGGIE_METADATA[v.type];
      return [{
        veggieType: v.type,
        varietyName: `Standard ${v.type}`,
        priority: v.priority,
        spacing: meta.spacing,
        height: meta.height,
        habit: meta.habit,
        root: meta.root,
        desc: "General variety used as fallback."
      }];
    }
  });

  const baseMeta = Object.entries(VEGGIE_METADATA).map(([type, meta]) => ({
    type,
    likes: meta.companions,
    dislikes: meta.antagonists
  }));

  const prompt = `
    Design a master HIGH-DENSITY horticultural layout for these beds.
    
    Beds: ${JSON.stringify(beds.map(b => ({ id: b.id, name: b.name, w: b.width, h: b.height, shape: b.shape || 'rectangle' })))}
    Sun Direction: ${sunOrientation}
    
    Plant Context (Use these spacing and height rules):
    ${JSON.stringify(varietyContext)}
    
    Relationship Rules (Companions/Antagonists):
    ${JSON.stringify(baseMeta)}

    GOALS:
    1. EXTREME DENSITY: Use "intercropping". Overlap spreads up to 40% if heights differ (e.g. tall tomatoes over low lettuce).
    2. VARIETY SPECIFIC: Respect the 'spacing' and 'height' provided in the context.
    3. SHADE MGMT: Tall varieties on the ${sunOrientation === 'North' ? 'South' : sunOrientation === 'South' ? 'North' : sunOrientation === 'East' ? 'West' : 'East'} side.
    4. GEOMETRY: Placements (x, y) must stay within the bed dimensions (0 to width, 0 to height) and fit the bed shape.
    
    Return a JSON array of BedLayout objects.
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
                  veggieType: { type: Type.STRING, enum: Object.values(VeggieType) },
                  varietyName: { type: Type.STRING },
                  x: { type: Type.NUMBER, description: "Inches from origin" },
                  y: { type: Type.NUMBER, description: "Inches from origin" },
                  size: { type: Type.NUMBER, description: "Spread in inches" },
                  placementReasoning: { type: Type.STRING },
                  spacingAnalysis: { type: Type.STRING },
                  companionInsights: { type: Type.STRING }
                },
                required: ["id", "veggieType", "varietyName", "x", "y", "size", "placementReasoning", "spacingAnalysis", "companionInsights"]
              }
            }
          },
          required: ["bedId", "placements"]
        }
      }
    }
  });

  try {
    const text = response.text || "[]";
    return JSON.parse(text) as BedLayout[];
  } catch (error) {
    console.error("Gemini failed:", error);
    return [];
  }
};
