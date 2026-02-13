import React from "react";
import { PlantMeta, VeggieType } from "../shared/types";

type VeggieLegendProps = {
  veggieTypes: VeggieType[];
  plantMetadata: Record<string, PlantMeta>;
};

const VeggieLegend: React.FC<VeggieLegendProps> = ({
  veggieTypes,
  plantMetadata,
}) => (
  <div className="bg-white border-t border-slate-300 p-4 flex flex-wrap gap-5 justify-center z-30 shadow-inner">
    {veggieTypes.map((value) => {
      const meta = plantMetadata[value];
      if (!meta) return null;
      return (
        <div key={value} className="flex items-center gap-2 group cursor-default">
          <div
            className="w-4 h-4 rounded-full border border-black/20 shadow-sm transition-transform group-hover:scale-125"
            style={{ backgroundColor: meta.color }}
          ></div>
          <span className="text-[11px] font-black text-slate-900 group-hover:text-emerald-800 transition-colors uppercase tracking-[0.15em]">
            {value}
          </span>
        </div>
      );
    })}
  </div>
);

export default VeggieLegend;
