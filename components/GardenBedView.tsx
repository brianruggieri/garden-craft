
import React, { useState } from 'react';
import { GardenBed, BedLayout, PlantPlacement } from '../types';
import { GRID_SIZE, INCHES_PER_GRID, VEGGIE_METADATA } from '../constants';

interface GardenBedViewProps {
  bed: GardenBed;
  layout?: BedLayout;
  onDragStart: (e: React.MouseEvent, id: string) => void;
  isSelected: boolean;
  onClick: () => void;
}

const GardenBedView: React.FC<GardenBedViewProps> = ({ 
  bed, 
  layout, 
  onDragStart, 
  isSelected,
  onClick
}) => {
  const [hoveredPlant, setHoveredPlant] = useState<PlantPlacement | null>(null);
  const widthPx = (bed.width / INCHES_PER_GRID) * GRID_SIZE;
  const heightPx = (bed.height / INCHES_PER_GRID) * GRID_SIZE;

  const handlePlantHover = (e: React.MouseEvent, plant: PlantPlacement) => {
    e.stopPropagation();
    setHoveredPlant(plant);
  };

  const getBorderRadius = () => {
    switch (bed.shape) {
      case 'circle': return '50%';
      case 'pill': return '9999px';
      default: return '4px';
    }
  };

  const hoveredMeta = hoveredPlant ? VEGGIE_METADATA[hoveredPlant.veggieType] : null;

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onMouseDown={(e) => !hoveredPlant && onDragStart(e, bed.id)}
      className={`absolute cursor-move border-4 transition-all duration-200 bed-texture shadow-xl flex items-center justify-center ${
        isSelected ? 'border-emerald-500 ring-4 ring-emerald-100 z-30' : 'border-[#4e342e]'
      }`}
      style={{
        left: bed.x * GRID_SIZE,
        top: bed.y * GRID_SIZE,
        width: widthPx,
        height: heightPx,
        borderRadius: getBorderRadius(),
      }}
    >
      {/* Bed Info Overlay */}
      <div className="absolute top-2 left-2 flex flex-col items-start gap-1 z-30 pointer-events-none">
        {bed.name && (
          <div className="bg-emerald-800 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm uppercase tracking-wider">
            {bed.name}
          </div>
        )}
        <div className="bg-black/80 backdrop-blur-sm text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm tracking-widest uppercase">
          {bed.width}" × {bed.height}"
        </div>
      </div>
      
      {/* Condensed Tooltip */}
      {hoveredPlant && (
        <div 
          className={`absolute pointer-events-none z-[100] animate-in fade-in zoom-in-95 duration-200 ${
            hoveredPlant.x > bed.width / 2 ? 'right-full mr-4' : 'left-full ml-4'
          }`}
          style={{
            top: (hoveredPlant.y / INCHES_PER_GRID) * GRID_SIZE - 20,
            width: '220px'
          }}
        >
          <div className="bg-slate-900/95 backdrop-blur-lg rounded-xl shadow-2xl border border-white/10 overflow-hidden ring-1 ring-black/20">
            <div className="p-3 border-b border-white/5 flex items-center gap-2">
              <span className="text-xl">{hoveredMeta?.icon}</span>
              <div className="overflow-hidden">
                <h4 className="text-white font-black text-[11px] truncate uppercase tracking-tight">{hoveredPlant.varietyName}</h4>
                <p className="text-emerald-400 text-[8px] font-black opacity-80 uppercase">{hoveredPlant.veggieType}</p>
              </div>
            </div>
            
            <div className="p-3 space-y-2">
              <div className="flex gap-2">
                <div className="flex-1 bg-white/5 p-1.5 rounded-md text-center">
                  <span className="block text-[6px] text-white/40 font-black uppercase">Ht</span>
                  <span className="text-white font-black text-[10px]">{hoveredMeta?.height}"</span>
                </div>
                <div className="flex-1 bg-white/5 p-1.5 rounded-md text-center">
                  <span className="block text-[6px] text-white/40 font-black uppercase">Spr</span>
                  <span className="text-white font-black text-[10px]">{hoveredPlant.size || hoveredMeta?.spacing}"</span>
                </div>
              </div>
              <p className="text-[9px] leading-tight text-white/70 italic line-clamp-2">
                {hoveredPlant.placementReasoning}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Inner Soil Area (Plants) */}
      <div className="relative w-full h-full overflow-hidden" style={{ borderRadius: 'inherit' }}>
        {layout?.placements.map((plant) => {
          const meta = VEGGIE_METADATA[plant.veggieType];
          const spreadInches = plant.size || meta.spacing;
          const displaySizePx = (spreadInches / INCHES_PER_GRID) * GRID_SIZE;
          const pxX = (plant.x / INCHES_PER_GRID) * GRID_SIZE;
          const pxY = (plant.y / INCHES_PER_GRID) * GRID_SIZE;
          
          const isThisHovered = hoveredPlant?.id === plant.id;
          
          // Use color highlights instead of text badges to reduce clutter
          let statusRing = "";
          if (hoveredPlant && !isThisHovered) {
            if (hoveredMeta?.companions.includes(plant.veggieType)) {
              statusRing = "ring-4 ring-emerald-400/80 shadow-[0_0_15px_rgba(52,211,153,0.5)] z-40 scale-105";
            } else if (hoveredMeta?.antagonists.includes(plant.veggieType)) {
              statusRing = "ring-4 ring-red-500/90 shadow-[0_0_20px_rgba(239,68,68,0.6)] z-50 scale-110 animate-pulse";
            } else {
              statusRing = "opacity-40 grayscale-[0.5]";
            }
          }

          return (
            <div
              key={plant.id}
              onMouseEnter={(e) => handlePlantHover(e, plant)}
              onMouseLeave={() => setHoveredPlant(null)}
              className={`absolute flex items-center justify-center rounded-full transition-all duration-300 cursor-help ${
                isThisHovered ? 'z-50 ring-2 ring-white scale-110 shadow-2xl' : 'z-20'
              } ${statusRing}`}
              style={{
                left: pxX - (displaySizePx / 2),
                top: pxY - (displaySizePx / 2),
                width: displaySizePx,
                height: displaySizePx,
                backgroundColor: isThisHovered ? meta.color : `${meta.color}CC`,
                border: isThisHovered ? `2px solid white` : `1px solid rgba(255,255,255,0.2)`,
                fontSize: `${Math.max(10, displaySizePx * 0.45)}px`,
              }}
            >
              <span className="drop-shadow-lg">{meta.icon}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GardenBedView;
