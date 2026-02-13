import React from "react";
import { BedShape, GardenBed, SunOrientation } from "../shared/types";

type ContextBarProps = {
  sunOrientation: SunOrientation;
  selectedBed: GardenBed | undefined;
  onUpdateBedName: (value: string) => void;
  onUpdateBedShape: (value: BedShape) => void;
  onUpdateBedWidth: (value: number) => void;
  onUpdateBedHeight: (value: number) => void;
};

const ContextBar: React.FC<ContextBarProps> = ({
  sunOrientation,
  selectedBed,
  onUpdateBedName,
  onUpdateBedShape,
  onUpdateBedWidth,
  onUpdateBedHeight,
}) => (
  <div className="bg-white border-b border-slate-300 p-4 flex justify-between items-center z-30 shadow-md">
    <div className="flex gap-8 items-center">
      <div className="flex items-center gap-3">
        <div className="bg-emerald-700 p-2 rounded-xl shadow-sm">
          <i className="fas fa-layer-group text-white text-sm"></i>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest leading-none mb-1">
            Canvas Mode
          </span>
          <span className="text-xs font-bold text-slate-900">
            Precision Planning
          </span>
        </div>
      </div>
      <div className="h-8 w-[1px] bg-slate-200"></div>
      <div className="flex items-center gap-3">
        <div className="bg-orange-600 p-2 rounded-xl shadow-sm">
          <i className="fas fa-compass text-white text-sm"></i>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest leading-none mb-1">
            Solar Bias
          </span>
          <span className="text-xs font-bold text-slate-900">
            {sunOrientation} Axis
          </span>
        </div>
      </div>
    </div>

    {selectedBed && (
      <div className="flex gap-6 animate-in fade-in slide-in-from-right-4 duration-500 items-center bg-white px-5 py-2.5 rounded-2xl border border-slate-400 shadow-2xl">
        <div className="flex flex-col gap-1.5 pr-6 border-r border-slate-300">
          <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
            Name
          </span>
          <input
            type="text"
            className="bg-slate-50 border-2 border-slate-300 rounded-lg px-3 py-1.5 text-sm font-black outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 min-w-[140px]"
            value={selectedBed.name || ""}
            onChange={(e) => onUpdateBedName(e.target.value)}
            placeholder="Bed Name"
          />
        </div>

        <div className="flex flex-col gap-1.5 pr-6 border-r border-slate-300">
          <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
            Shape
          </span>
          <select
            className="bg-slate-50 border-2 border-slate-300 rounded-lg px-3 py-1.5 text-sm font-black outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 cursor-pointer"
            value={selectedBed.shape || "rectangle"}
            onChange={(e) => onUpdateBedShape(e.target.value as BedShape)}
          >
            <option value="rectangle">Rectangle</option>
            <option value="pill">Pill</option>
            <option value="circle">Circle</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
            Size (inches)
          </span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              className="w-24 p-1.5 bg-slate-50 border-2 border-slate-300 rounded-lg text-sm font-black text-center outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
              value={selectedBed.width}
              onChange={(e) => onUpdateBedWidth(parseInt(e.target.value) || 0)}
            />
            {selectedBed.shape !== "circle" && (
              <>
                <span className="text-slate-600 font-black">×</span>
                <input
                  type="number"
                  className="w-24 p-1.5 bg-slate-50 border-2 border-slate-300 rounded-lg text-sm font-black text-center outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
                  value={selectedBed.height}
                  onChange={(e) =>
                    onUpdateBedHeight(parseInt(e.target.value) || 0)
                  }
                />
              </>
            )}
          </div>
        </div>
      </div>
    )}
  </div>
);

export default ContextBar;
