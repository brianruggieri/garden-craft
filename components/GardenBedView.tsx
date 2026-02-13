import React, { useState } from "react";
import {
  GardenBed,
  BedLayout,
  PlantPlacement,
  PlantMeta,
} from "../shared/types";
import { GRID_SIZE, INCHES_PER_GRID } from "../constants";

interface GardenBedViewProps {
  bed: GardenBed;
  layout?: BedLayout;
  veggieMetadata: Record<string, PlantMeta>;
  onDragStart: (e: React.MouseEvent, id: string) => void;
  isSelected: boolean;
  onClick: () => void;
  bedShadow?: { dx: number; dy: number } | "none";
}

const GardenBedView: React.FC<GardenBedViewProps> = ({
  bed,
  layout,
  veggieMetadata,
  onDragStart,
  isSelected,
  onClick,
  bedShadow,
}) => {
  const [hoveredPlant, setHoveredPlant] = useState<PlantPlacement | null>(null);
  const widthPx = (bed.width / INCHES_PER_GRID) * GRID_SIZE;
  const heightPx = (bed.height / INCHES_PER_GRID) * GRID_SIZE;

  const shadowForShape = () => {
    if (!bedShadow || bedShadow === "none") return "none";
    const { dx, dy } = bedShadow;
    const contactBlur =
      bed.shape === "circle" ? 4 : bed.shape === "pill" ? 3.5 : 3;
    const contactDx = dx * 0.12;
    const contactDy = dy * 0.12;
    return `${contactDx.toFixed(1)}px ${contactDy.toFixed(1)}px ${contactBlur}px rgba(15, 23, 42, 0.25)`;
  };

  const shadowHull = (() => {
    if (!bedShadow || bedShadow === "none") return null;
    const { dx, dy } = bedShadow;
    const w = widthPx;
    const h = heightPx;
    const minX = Math.min(0, dx);
    const minY = Math.min(0, dy);
    const maxX = Math.max(w, w + dx);
    const maxY = Math.max(h, h + dy);
    const points = [
      [0 - minX, 0 - minY],
      [w - minX, 0 - minY],
      [w - minX, h - minY],
      [0 - minX, h - minY],
      [dx - minX, dy - minY],
      [dx + w - minX, dy - minY],
      [dx + w - minX, dy + h - minY],
      [dx - minX, dy + h - minY],
    ];

    const cross = (o: number[], a: number[], b: number[]) =>
      (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

    const sorted = points
      .slice()
      .sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));
    const lower: number[][] = [];
    for (const p of sorted) {
      while (lower.length >= 2 &&
        cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
        lower.pop();
      }
      lower.push(p);
    }
    const upper: number[][] = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      const p = sorted[i];
      while (upper.length >= 2 &&
        cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
        upper.pop();
      }
      upper.push(p);
    }
    upper.pop();
    lower.pop();
    const hull = lower.concat(upper);

    return {
      hull,
      width: maxX - minX,
      height: maxY - minY,
      offsetX: minX,
      offsetY: minY,
    };
  })();

  const handlePlantHover = (e: React.MouseEvent, plant: PlantPlacement) => {
    e.stopPropagation();
    setHoveredPlant(plant);
  };

  const getBorderRadius = () => {
    switch (bed.shape) {
      case "circle":
        return "50%";
      case "pill":
        return "9999px";
      default:
        return "8px";
    }
  };

  const hoveredMeta = (() => {
    // Safe, case-insensitive lookup for hovered plant metadata.
    if (!hoveredPlant?.veggieType) return null;
    const key = String(hoveredPlant.veggieType).trim();
    if (!key) return null;
    // Direct lookup (exact)
    if (veggieMetadata[key]) return veggieMetadata[key];
    // Title-case (Tomato, Basil)
    const title = key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
    if (veggieMetadata[title]) return veggieMetadata[title];
    // Lower-case fallback
    const lower = key.toLowerCase();
    if (veggieMetadata[lower]) return veggieMetadata[lower];
    return null;
  })();

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseDown={(e) => !hoveredPlant && onDragStart(e, bed.id)}
      className={`absolute cursor-move border-4 transition-all duration-300 bed-texture shadow-2xl flex items-center justify-center ${
        isSelected
          ? "border-emerald-500 ring-4 ring-emerald-500/20 z-40 scale-[1.005]"
          : "border-[#4e342e]"
      }`}
      style={{
        left: bed.x * GRID_SIZE,
        top: bed.y * GRID_SIZE,
        width: widthPx,
        height: heightPx,
        borderRadius: getBorderRadius(),
        boxShadow: shadowForShape(),
      }}
    >
      {shadowHull && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: shadowHull.offsetX,
            top: shadowHull.offsetY,
            width: shadowHull.width,
            height: shadowHull.height,
            zIndex: -2,
          }}
        >
          <svg
            width={shadowHull.width}
            height={shadowHull.height}
            className="overflow-visible"
          >
            <polygon
              points={shadowHull.hull.map((p) => `${p[0]},${p[1]}`).join(" ")}
              fill="rgba(15, 23, 42, 0.28)"
              style={{
                filter:
                  bed.shape === "circle"
                    ? "blur(18px)"
                    : bed.shape === "pill"
                      ? "blur(14px)"
                      : "blur(12px)",
              }}
            />
            <polygon
              points={shadowHull.hull.map((p) => `${p[0]},${p[1]}`).join(" ")}
              fill="rgba(15, 23, 42, 0.38)"
              style={{
                filter:
                  bed.shape === "circle"
                    ? "blur(8px)"
                    : bed.shape === "pill"
                      ? "blur(6px)"
                      : "blur(5px)",
              }}
            />
          </svg>
        </div>
      )}
      {/* Bed Label - Stays on top of soil but under tooltips */}
      <div className="absolute top-3 left-3 flex flex-col items-start gap-1 z-10 pointer-events-none">
        {bed.name && (
          <div className="bg-emerald-900/90 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-lg uppercase tracking-widest border border-white/10">
            {bed.name}
          </div>
        )}
        <div className="bg-black/60 backdrop-blur-sm text-white/80 text-[8px] font-bold px-2 py-0.5 rounded shadow-inner uppercase tracking-widest">
          {bed.width}" × {bed.height}"
        </div>
      </div>

      {/* Floating Tooltip - Outside of the overflow container */}
      {hoveredPlant && (
        <div
          className={`absolute pointer-events-none z-[100] animate-in fade-in zoom-in-95 duration-200 drop-shadow-2xl ${
            hoveredPlant.x > bed.width / 2
              ? "right-full mr-6"
              : "left-full ml-6"
          }`}
          style={{
            top: (hoveredPlant.y / INCHES_PER_GRID) * GRID_SIZE - 40,
            width: "240px",
          }}
        >
          <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-[0_30px_60px_-12px_rgba(0,0,0,0.5)]">
            <div className="p-4 bg-gradient-to-br from-slate-800 to-slate-900 border-b border-white/5 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-3xl shadow-inner">
                {hoveredMeta?.icon}
              </div>
              <div className="min-w-0">
                <h4 className="text-white font-black text-xs truncate uppercase tracking-tight">
                  {hoveredPlant.varietyName}
                </h4>
                <p className="text-emerald-400 text-[9px] font-black uppercase tracking-wider">
                  {hoveredPlant.veggieType}
                </p>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                  <span className="block text-[7px] text-white/40 font-black uppercase mb-0.5">
                    Height
                  </span>
                  <span className="text-white font-black text-xs">
                    {hoveredMeta?.height}"
                  </span>
                </div>
                <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                  <span className="block text-[7px] text-white/40 font-black uppercase">
                    Spread
                  </span>
                  <span className="text-white font-black text-xs">
                    {hoveredPlant.size || hoveredMeta?.spacing}"
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] shrink-0" />
                  <p className="text-[10px] leading-snug text-slate-300 font-medium">
                    {hoveredPlant.placementReasoning}
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="mt-1 w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.5)] shrink-0" />
                  <p className="text-[10px] leading-snug text-slate-400 font-medium italic">
                    {hoveredPlant.companionInsights}
                  </p>
                </div>
              </div>
            </div>
          </div>
          {/* Arrow pointing to plant */}
          <div
            className={`absolute top-12 w-3 h-3 bg-slate-900 border-white/10 rotate-45 z-[-1] ${
              hoveredPlant.x > bed.width / 2
                ? "-right-1.5 border-r border-t"
                : "-left-1.5 border-l border-b"
            }`}
          />
        </div>
      )}

      {/* Inner Soil Area (Plants) - We use relative positioning here so tooltips can float above it */}
      <div
        className="relative w-full h-full"
        style={{ borderRadius: "inherit" }}
      >
        {layout?.placements.map((plant) => {
          // Resilient, case-tolerant metadata lookup for the plant type.
          const plantTypeKey = String(plant.veggieType || "").trim();
          const meta = (() => {
            const defaultMeta = {
              id: "plant_unknown",
              spacing: 6,
              height: 6,
              width: 6,
              rootWidth: 6,
              color: "#999999",
              icon: "🌱",
              companions: [],
              antagonists: [],
              habit: "Unknown",
              root: "Unknown",
            };
            if (!plantTypeKey) return defaultMeta;
            if (veggieMetadata[plantTypeKey])
              return veggieMetadata[plantTypeKey];
            const title =
              plantTypeKey.charAt(0).toUpperCase() +
              plantTypeKey.slice(1).toLowerCase();
            if (veggieMetadata[title]) return veggieMetadata[title];
            const lower = plantTypeKey.toLowerCase();
            if (veggieMetadata[lower]) return veggieMetadata[lower];
            return defaultMeta;
          })();

          const spreadInches = plant.size || meta.spacing;
          const displaySizePx = (spreadInches / INCHES_PER_GRID) * GRID_SIZE;
          // AI provides coordinates in inches directly, convert to pixels
          const pxX = (plant.x / INCHES_PER_GRID) * GRID_SIZE;
          const pxY = (plant.y / INCHES_PER_GRID) * GRID_SIZE;

          const isThisHovered = hoveredPlant?.id === plant.id;

          // Pure color logic for companions (case-insensitive comparison)
          let statusEffect = "";
          if (hoveredPlant && !isThisHovered) {
            const plantNorm = plantTypeKey.toLowerCase();
            const hoveredCompanions = (hoveredMeta?.companions || []).map((c) =>
              String(c).toLowerCase(),
            );
            const hoveredAntagonists = (hoveredMeta?.antagonists || []).map(
              (a) => String(a).toLowerCase(),
            );

            if (hoveredCompanions.includes(plantNorm)) {
              statusEffect =
                "ring-[6px] ring-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.6)] z-30 scale-110 blur-[0.5px]";
            } else if (hoveredAntagonists.includes(plantNorm)) {
              statusEffect =
                "ring-[8px] ring-red-600/80 shadow-[0_0_30px_rgba(220,38,38,0.7)] z-40 scale-115 animate-pulse blur-[1px]";
            } else {
              statusEffect = "opacity-20 grayscale scale-90";
            }
          }

          return (
            <div
              key={plant.id}
              onMouseEnter={(e) => handlePlantHover(e, plant)}
              onMouseLeave={() => setHoveredPlant(null)}
              className={`absolute flex items-center justify-center rounded-full transition-all duration-500 cursor-crosshair ${
                isThisHovered
                  ? "z-[60] ring-4 ring-white shadow-[0_0_40px_rgba(255,255,255,0.4)] scale-125"
                  : "z-20"
              } ${statusEffect}`}
              style={{
                left: pxX - displaySizePx / 2,
                top: pxY - displaySizePx / 2,
                width: displaySizePx,
                height: displaySizePx,
                backgroundColor: isThisHovered ? meta.color : `${meta.color}BB`,
                border: isThisHovered
                  ? `3px solid white`
                  : `1.5px solid rgba(255,255,255,0.3)`,
                fontSize: `${Math.max(12, displaySizePx * 0.5)}px`,
              }}
            >
              <span
                className={`drop-shadow-2xl transition-transform duration-500 ${isThisHovered ? "scale-110" : ""}`}
              >
                {meta.icon}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GardenBedView;
