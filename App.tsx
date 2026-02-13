import React, { useEffect, useState } from "react";
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
import {
  GRID_PIXEL_SIZE,
  GRID_SIZE,
  GRID_UNITS,
  INCHES_PER_GRID,
} from "./constants";
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
  const initialBedWidthUnits = 48 / INCHES_PER_GRID;
  const initialBedHeightUnits = 96 / INCHES_PER_GRID;
  const initialBedX = Math.round(GRID_UNITS / 2 - initialBedWidthUnits / 2);
  const initialBedY = Math.round(GRID_UNITS / 2 - initialBedHeightUnits / 2);

  const [beds, setBeds] = useState<GardenBed[]>([
    {
      id: "1",
      name: "Main Bed",
      width: 48,
      height: 96,
      x: initialBedX,
      y: initialBedY,
      shape: "rectangle",
    },
  ]);
  const [seeds, setSeeds] = useState<Vegetable[]>([]);
  const [sunOrientation, setSunOrientation] = useState<SunOrientation>("South");
  const [layouts, setLayouts] = useState<BedLayout[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null);
  const [backgroundTiles, setBackgroundTiles] = useState<
    { id: string; name: string; url: string }[]
  >([]);
  const [backgroundTileId, setBackgroundTileId] = useState("none");
  const [dotColor, setDotColor] = useState("rgba(148, 163, 184, 0.9)");

  useEffect(() => {
    let isMounted = true;
    const loadTiles = async () => {
      try {
        const res = await fetch("/tiles.json");
        if (!res.ok) return;
        const files = (await res.json()) as string[];
        const tiles = [
          { id: "none", name: "None", url: "" },
          ...files
            .filter((file) => /-tile\.(png|jpe?g|svg)$/i.test(file))
            .map((file) => {
              const filename = file.split("/").pop() || file;
              const id = filename.replace(/\.[^.]+$/, "");
              const rawName = id.replace(/-tile$/, "");
              const name = rawName
                .split("-")
                .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                .join(" ");
              return {
                id,
                name,
                url: file.startsWith("/") ? file : `/${file}`,
              };
            })
            .sort((a, b) => a.name.localeCompare(b.name)),
        ];
        if (!isMounted) return;
        setBackgroundTiles(tiles);
        setBackgroundTileId((prev) => prev || "none");
      } catch (err) {
        // fallback: keep empty list if manifest missing
      }
    };
    loadTiles();
    return () => {
      isMounted = false;
    };
  }, []);

  const backgroundTile =
    backgroundTiles.find((tile) => tile.id === backgroundTileId) ??
    backgroundTiles[0];

  useEffect(() => {
    if (!backgroundTile?.url) {
      setDotColor("rgba(148, 163, 184, 0.9)");
      return;
    }

    const img = new Image();
    img.src = backgroundTile.url;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 32;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;
      let total = 0;
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        total += luminance;
        count += 1;
      }
      const avg = total / Math.max(1, count);
      setDotColor(
        avg > 0.6
          ? "rgba(30, 41, 59, 0.7)"
          : "rgba(241, 245, 249, 0.8)",
      );
    };
    img.onerror = () => {
      setDotColor("rgba(148, 163, 184, 0.9)");
    };
  }, [backgroundTile?.url]);

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
    centerCanvas,
  } = useCanvasNavigation();

  const {
    catalogLoading,
    catalogError,
    plantMetadata,
    seedVarieties,
    veggieTypes,
  } = usePlantCatalog();

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
        backgroundTile={backgroundTile}
        backgroundOptions={backgroundTiles}
        onChangeBackgroundTile={(tile) => setBackgroundTileId(tile.id)}
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
            className="absolute origin-top-left transition-transform duration-75 ease-out grid-boundary"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              width: `${GRID_PIXEL_SIZE}px`,
              height: `${GRID_PIXEL_SIZE}px`,
              backgroundImage: backgroundTile?.url
                ? `radial-gradient(${dotColor} 1.5px, transparent 1.5px), linear-gradient(rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0.45)), url(${backgroundTile.url})`
                : `radial-gradient(${dotColor} 1.5px, transparent 1.5px)`,
              backgroundSize: backgroundTile?.url
                ? `${GRID_SIZE}px ${GRID_SIZE}px, 100% 100%, 256px 256px`
                : `${GRID_SIZE}px ${GRID_SIZE}px`,
              backgroundRepeat: backgroundTile?.url
                ? "repeat, no-repeat, repeat"
                : "repeat",
            }}
          >
            <div className="grid-tape">
              <span className="grid-tape__edge grid-tape__edge--top" />
              <span className="grid-tape__edge grid-tape__edge--bottom" />
              <span className="grid-tape__edge grid-tape__edge--left" />
              <span className="grid-tape__edge grid-tape__edge--right" />
            </div>
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
                centerCanvas(1);
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

          <div className="absolute bottom-8 right-8 bg-white/95 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-xl px-4 py-3 z-30">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <i className="fas fa-ruler-combined text-emerald-600"></i> Scale
            </div>
            <div className="mt-2 flex items-center gap-3 text-[11px] font-bold text-slate-700">
              <span>{INCHES_PER_GRID}" per dot</span>
              <span className="text-slate-300">•</span>
              <span>1 ft = {(12 / INCHES_PER_GRID).toFixed(0)} dots</span>
            </div>
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

        <VeggieLegend veggieTypes={veggieTypes} plantMetadata={plantMetadata} />
      </main>
    </div>
  );
};

export default App;
