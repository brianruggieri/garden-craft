import React, { useState } from "react";
import {
  GardenBed,
  Vegetable,
  VeggieType,
  SunOrientation,
  BedLayout,
} from "./shared/types";
import ControlPanel from "./components/ControlPanel";
import GardenBedView from "./components/GardenBedView";
import ContextBar from "./components/ContextBar";
import CatalogStatusBanner from "./components/CatalogStatusBanner";
import VeggieLegend from "./components/VeggieLegend";
import { generateGardenLayout } from "./services/geminiService";
import { GRID_SIZE } from "./constants";
import { useGardenStorage } from "./hooks/useGardenStorage";
import { usePlantCatalog } from "./hooks/usePlantCatalog";
import { useSeedInit } from "./hooks/useSeedInit";
import { useAIProviders } from "./hooks/useAIProviders";
import { useCanvasNavigation } from "./hooks/useCanvasNavigation";
import { useBedDrag } from "./hooks/useBedDrag";
import { useAddBed } from "./hooks/useAddBed";
import { useBedHandlers } from "./hooks/useBedHandlers";
import { useSeedHandlers } from "./hooks/useSeedHandlers";

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

  const { handleAddBed } = useAddBed({
    setBeds,
    getCenteredGridPoint,
    pan,
    zoom,
  });

  const {
    selectedBed,
    handleRemoveBed,
    handleUpdateBedName,
    handleUpdateBedShape,
    handleUpdateBedWidth,
    handleUpdateBedHeight,
  } = useBedHandlers({
    beds,
    setBeds,
    selectedBedId,
    setSelectedBedId,
  });

  const { handleUpdateSeed, handleUpdateVarieties } = useSeedHandlers({
    setSeeds,
  });

  // Layout generation
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
        <CatalogStatusBanner
          catalogLoading={catalogLoading}
          catalogError={catalogError}
        />
        {/* Optimized Context Bar with High Contrast */}
        <ContextBar
          sunOrientation={sunOrientation}
          selectedBed={selectedBed}
          onUpdateBedName={handleUpdateBedName}
          onUpdateBedShape={handleUpdateBedShape}
          onUpdateBedWidth={handleUpdateBedWidth}
          onUpdateBedHeight={handleUpdateBedHeight}
        />

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

        <VeggieLegend
          veggieTypes={veggieTypes}
          plantMetadata={plantMetadata}
        />
      </main>
    </div>
  );
};

export default App;
