import React, { useState } from "react";
import {
  GardenBed,
  Vegetable,
  VeggieType,
  SunOrientation,
  BedLayout,
  BedShape,
  SeedVariety,
} from "./shared/types";
import ControlPanel from "./components/ControlPanel";
import GardenBedView from "./components/GardenBedView";
import { generateGardenLayout } from "./services/geminiService";
import { GRID_SIZE } from "./constants";
import { useGardenStorage } from "./hooks/useGardenStorage";
import { usePlantCatalog } from "./hooks/usePlantCatalog";
import { useSeedInit } from "./hooks/useSeedInit";
import { useAIProviders } from "./hooks/useAIProviders";
import { useCanvasNavigation } from "./hooks/useCanvasNavigation";
import { useBedDrag } from "./hooks/useBedDrag";

const App: React.FC = () => {
  const [beds, setBeds] = useState<GardenBed[]>([
    {
      id: "1",
      name: "Main Bed",
      width: 48,
      height: 96,
      x: 5,
      y: 5,
      shape: "rectangle",
    },
  ]);
  const [seeds, setSeeds] = useState<Vegetable[]>([]);
  const [sunOrientation, setSunOrientation] = useState<SunOrientation>("South");
  const [layouts, setLayouts] = useState<BedLayout[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null);

  const {
    zoom,
    pan,
    isPanning,
    isSpacePressed,
    canvasRef,
    setZoom,
    setPan,
    setIsPanning,
    setIsSpacePressed,
    handleWheel,
    handleCanvasMouseDown,
    getCenteredGridPoint,
  } = useCanvasNavigation();

  const { catalogLoading, catalogError, plantMetadata, seedVarieties, veggieTypes } =
    usePlantCatalog();

  useSeedInit({ seeds, setSeeds, veggieTypes });

  const {
    savedGardens,
    savedPlantings,
    handleSaveGarden,
    handleLoadGarden,
    handleSavePlanting,
    handleLoadPlanting,
  } = useGardenStorage({
    beds,
    sunOrientation,
    seeds,
    layouts,
    setBeds,
    setSunOrientation,
    setSeeds,
    setLayouts,
  });

  const {
    aiProvider,
    aiModel,
    aiApiKey,
    aiProviders,
    setAiProvider,
    setAiModel,
    setAiApiKey,
    oauthStatus,
    oauthChecking,
    handleTriggerOAuth,
    handleStartDeviceFlow,
    handlePollDeviceFlow,
    handleDisconnectProvider,
  } = useAIProviders();

  const { onBedDragStart } = useBedDrag({
    beds,
    setBeds,
    pan,
    zoom,
    isPanning,
    setPan,
    isSpacePressed,
    setSelectedBedId,
    setIsPanning,
  });

  const handleAddBed = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    const { centerX, centerY } = getCenteredGridPoint(pan, zoom);

    setBeds((prev) => [
      ...prev,
      {
        id: newId,
        name: `Bed ${prev.length + 1}`,
        width: 48,
        height: 48,
        x: Math.round(centerX),
        y: Math.round(centerY),
        shape: "rectangle",
      },
    ]);
  };

  const handleRemoveBed = (id: string) => {
    setBeds((prev) => prev.filter((b) => b.id !== id));
    if (selectedBedId === id) setSelectedBedId(null);
  };

  const handleUpdateSeed = (type: VeggieType, priority: number) => {
    setSeeds((prev) =>
      prev.map((s) => (s.type === type ? { ...s, priority } : s)),
    );
  };

  const handleUpdateVarieties = (
    type: VeggieType,
    varieties: SeedVariety[],
  ) => {
    setSeeds((prev) =>
      prev.map((s) =>
        s.type === type ? { ...s, selectedVarieties: varieties } : s,
      ),
    );
  };

  const handleGenerate = async () => {
    if (beds.length === 0) return;
    // Allow proceeding even if varieties aren't picked; service will use defaults
    const activeVegetables = seeds.filter((s) => s.priority > 0);
    if (activeVegetables.length === 0) {
      alert(
        "Please increase the priority of at least one vegetable to generate a layout.",
      );
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateGardenLayout(
        beds,
        activeVegetables,
        sunOrientation,
        {
          provider: aiProvider,
          model: aiModel || undefined,
          auth: aiApiKey ? { apiKey: aiApiKey } : undefined,
        },
      );
      setLayouts(result);
    } catch (err) {
      console.error(err);
      alert("Something went wrong generating the layout.");
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedBed = beds.find((b) => b.id === selectedBedId);

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] overflow-hidden select-none text-slate-800">
      <ControlPanel
        beds={beds}
        seeds={seeds}
        sunOrientation={sunOrientation}
        layouts={layouts}
        veggieMetadata={plantMetadata}
        seedVarieties={seedVarieties}
        veggieTypes={veggieTypes}
        onAddBed={handleAddBed}
        onRemoveBed={handleRemoveBed}
        onUpdateSeed={handleUpdateSeed}
        onUpdateVarieties={handleUpdateVarieties}
        onSetSun={setSunOrientation}
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
        onSaveGarden={handleSaveGarden}
        onLoadGarden={handleLoadGarden}
        onSavePlanting={handleSavePlanting}
        onLoadPlanting={handleLoadPlanting}
        savedGardens={savedGardens}
        savedPlantings={savedPlantings}
        onSelectBed={(id) => setSelectedBedId(id)}
        aiProvider={aiProvider}
        aiModel={aiModel}
        aiApiKey={aiApiKey}
        aiProviders={aiProviders}
        onChangeAIProvider={setAiProvider}
        onChangeAIModel={setAiModel}
        onChangeAIApiKey={setAiApiKey}
        onTriggerOAuth={handleTriggerOAuth}
        // Device flow handlers for headless sign-in
        onStartDeviceFlow={handleStartDeviceFlow}
        onPollDeviceFlow={handlePollDeviceFlow}
        // Disconnect a provider (dev-only) to clear in-memory tokens on the server
        onDisconnectProvider={handleDisconnectProvider}
        oauthStatus={oauthStatus}
        oauthChecking={oauthChecking}
      />

      <main className="flex-1 relative flex flex-col overflow-hidden">
        {catalogLoading && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-xs font-bold px-4 py-2">
            Loading plant catalog...
          </div>
        )}
        {catalogError && (
          <div className="bg-red-50 border-b border-red-200 text-red-700 text-xs font-bold px-4 py-2">
            {catalogError}
          </div>
        )}
        {/* Optimized Context Bar with High Contrast */}
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
                  onChange={(e) => {
                    const val = e.target.value;
                    setBeds((prev) =>
                      prev.map((b) =>
                        b.id === selectedBedId ? { ...b, name: val } : b,
                      ),
                    );
                  }}
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
                  onChange={(e) => {
                    const newShape = e.target.value as BedShape;
                    setBeds((prev) =>
                      prev.map((b) =>
                        b.id === selectedBedId
                          ? {
                              ...b,
                              shape: newShape,
                              height:
                                newShape === "circle" ? b.width : b.height,
                            }
                          : b,
                      ),
                    );
                  }}
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
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setBeds((prev) =>
                        prev.map((b) =>
                          b.id === selectedBedId
                            ? {
                                ...b,
                                width: val,
                                height: b.shape === "circle" ? val : b.height,
                              }
                            : b,
                        ),
                      );
                    }}
                  />
                  {selectedBed.shape !== "circle" && (
                    <>
                      <span className="text-slate-600 font-black">×</span>
                      <input
                        type="number"
                        className="w-24 p-1.5 bg-slate-50 border-2 border-slate-300 rounded-lg text-sm font-black text-center outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
                        value={selectedBed.height}
                        onChange={(e) =>
                          setBeds((prev) =>
                            prev.map((b) =>
                              b.id === selectedBedId
                                ? {
                                    ...b,
                                    height: parseInt(e.target.value) || 0,
                                  }
                                : b,
                            ),
                          )
                        }
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div
          id="garden-viewport"
          ref={canvasRef}
          className={`flex-1 relative overflow-hidden bg-[#cbd5e1] cursor-default ${isPanning || isSpacePressed ? "cursor-grabbing" : ""}`}
          onWheel={handleWheel}
          onMouseDown={handleCanvasMouseDown}
          onClick={() => setSelectedBedId(null)}
        >
          <div
            className="absolute origin-top-left transition-transform duration-75 ease-out"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              width: "5000px",
              height: "5000px",
              backgroundImage:
                "radial-gradient(#94a3b8 1.5px, transparent 1.5px)",
              backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
            }}
          >
            {beds.map((bed) => (
              <GardenBedView
                key={bed.id}
                bed={bed}
                layout={layouts.find((l) => l.bedId === bed.id)}
                veggieMetadata={plantMetadata}
                onDragStart={onBedDragStart}
                isSelected={selectedBedId === bed.id}
                onClick={() => setSelectedBedId(bed.id)}
              />
            ))}
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white p-2.5 rounded-2xl shadow-2xl border-2 border-slate-300 z-40">
            <button
              onClick={() => setZoom((prev) => Math.max(prev - 0.1, 0.1))}
              className="w-12 h-12 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-800 transition-colors"
              title="Zoom Out"
            >
              <i className="fas fa-minus"></i>
            </button>
            <div
              className="px-6 min-w-[100px] text-center font-black text-sm text-slate-900 cursor-pointer hover:text-emerald-700"
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              title="Reset View"
            >
              {Math.round(zoom * 100)}%
            </div>
            <button
              onClick={() => setZoom((prev) => Math.min(prev + 0.1, 5))}
              className="w-12 h-12 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-800 transition-colors"
              title="Zoom In"
            >
              <i className="fas fa-plus"></i>
            </button>
            <div className="h-8 w-[2px] bg-slate-200 mx-1"></div>
            <button
              onClick={() => setIsSpacePressed(!isSpacePressed)}
              className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all ${isSpacePressed ? "bg-emerald-700 text-white shadow-lg shadow-emerald-200" : "hover:bg-slate-100 text-slate-800 border border-slate-200"}`}
              title="Pan Tool (Space)"
            >
              <i className="fas fa-hand"></i>
            </button>
          </div>

          <div className="absolute top-8 right-8 flex flex-col items-center opacity-80 pointer-events-none z-30">
            <div className="text-[12px] font-black mb-1 text-slate-900 tracking-tighter">
              N
            </div>
            <div className="w-16 h-16 border-2 border-slate-400 rounded-full flex items-center justify-center relative bg-white backdrop-blur-sm shadow-xl">
              <div className="w-px h-full bg-slate-300 absolute"></div>
              <div className="w-full h-px bg-slate-300 absolute"></div>
              <div
                className={`absolute w-2.5 h-12 bg-gradient-to-t from-orange-500 to-orange-700 rounded-full transition-transform duration-1000 ease-in-out origin-bottom shadow-md ${
                  sunOrientation === "North"
                    ? "rotate-0"
                    : sunOrientation === "East"
                      ? "rotate-90"
                      : sunOrientation === "South"
                        ? "rotate-180"
                        : "rotate-270"
                }`}
                style={{ top: -24 }}
              ></div>
              <div className="w-4 h-4 rounded-full bg-slate-500 border-2 border-white shadow-inner z-10"></div>
            </div>
            <div className="text-[12px] font-black mt-1 text-slate-900 tracking-tighter">
              S
            </div>
          </div>
        </div>

        <div className="bg-white border-t border-slate-300 p-4 flex flex-wrap gap-5 justify-center z-30 shadow-inner">
          {veggieTypes.map((value) => {
            const meta = plantMetadata[value];
            if (!meta) return null;
            return (
              <div
                key={value}
                className="flex items-center gap-2 group cursor-default"
              >
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
      </main>
    </div>
  );
};

export default App;
