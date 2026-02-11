import React, { useState } from "react";
import {
  GardenBed,
  Vegetable,
  VeggieType,
  SunOrientation,
  SeedVariety,
  BedLayout,
} from "../types";
import { SEED_VARIETY_LIBRARY, VEGGIE_METADATA } from "../constants";

interface ControlPanelProps {
  beds: GardenBed[];
  seeds: Vegetable[];
  sunOrientation: SunOrientation;
  layouts: BedLayout[];
  onAddBed: () => void;
  onRemoveBed: (id: string) => void;
  onUpdateSeed: (type: VeggieType, priority: number) => void;
  onUpdateVarieties: (type: VeggieType, varieties: SeedVariety[]) => void;
  onSetSun: (orient: SunOrientation) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  onSaveGarden: (name: string) => void;
  onLoadGarden: (name: string) => void;
  onSavePlanting: (name: string) => void;
  onLoadPlanting: (name: string) => void;
  savedGardens: string[];
  savedPlantings: string[];
  onSelectBed: (id: string) => void;
  aiProvider: string;
  aiModel: string;
  aiApiKey: string;
  aiProviders: { id: string; name: string; supportsOAuth?: boolean }[];
  onChangeAIProvider: (provider: string) => void;
  onChangeAIModel: (model: string) => void;
  onChangeAIApiKey: (key: string) => void;
  onTriggerOAuth: (provider: string) => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  beds,
  seeds,
  sunOrientation,
  layouts,
  onAddBed,
  onRemoveBed,
  onUpdateSeed,
  onUpdateVarieties,
  onSetSun,
  onGenerate,
  isGenerating,
  onSaveGarden,
  onLoadGarden,
  onSavePlanting,
  onLoadPlanting,
  savedGardens,
  savedPlantings,
  onSelectBed,
  aiProvider,
  aiModel,
  aiApiKey,
  aiProviders,
  onChangeAIProvider,
  onChangeAIModel,
  onChangeAIApiKey,
  onTriggerOAuth,
}) => {
  const [editingVarieties, setEditingVarieties] = useState<VeggieType | null>(
    null,
  );
  const [showVault, setShowVault] = useState(false);

  const providerOptions =
    aiProviders.length > 0
      ? aiProviders
      : [
          { id: "local", name: "Local Procedural", supportsOAuth: false },
          { id: "gemini", name: "Google Gemini", supportsOAuth: true },
          { id: "openai", name: "OpenAI", supportsOAuth: true },
          { id: "anthropic", name: "Anthropic", supportsOAuth: true },
        ];
  const selectedProvider = providerOptions.find(
    (provider) => provider.id === aiProvider,
  );
  const oauthEnabled = Boolean(selectedProvider?.supportsOAuth);

  const toggleVariety = (vType: VeggieType, variety: SeedVariety) => {
    const seed = seeds.find((s) => s.type === vType);
    const current = seed?.selectedVarieties || [];
    const exists = current.find((v) => v.id === variety.id);

    if (exists) {
      onUpdateVarieties(
        vType,
        current.filter((v) => v.id !== variety.id),
      );
    } else {
      onUpdateVarieties(vType, [...current, variety]);
    }
  };

  const handlePromptSaveGarden = () => {
    const name = prompt("Enter a name for this Garden Layout:");
    if (name) onSaveGarden(name);
  };

  const handlePromptSavePlanting = () => {
    const name = prompt("Enter a name for this Planting Plan:");
    if (name) onSavePlanting(name);
  };

  return (
    <div className="w-80 h-full bg-white border-r border-slate-200 flex flex-col shadow-lg overflow-y-auto z-10">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-green-800 flex items-center gap-2">
            <i className="fas fa-seedling"></i> GardenCraft
          </h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-tighter font-bold">
            Varietal Optimizer
          </p>
        </div>
        <button
          onClick={() => setShowVault(!showVault)}
          className={`p-2 rounded-full transition-colors ${showVault ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
          title="Project Vault"
        >
          <i className="fas fa-vault"></i>
        </button>
      </div>

      <div className="p-6 space-y-8 text-slate-700">
        {showVault && (
          <section className="animate-in fade-in slide-in-from-top-4 duration-300">
            <h2 className="font-bold text-indigo-800 text-sm mb-4 flex items-center gap-2">
              <i className="fas fa-hdd"></i> Project Vault
            </h2>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Saved Garden Frameworks
                  </span>
                  <button
                    onClick={handlePromptSaveGarden}
                    className="text-[10px] text-indigo-600 font-bold hover:underline"
                  >
                    Save Current
                  </button>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {savedGardens.length === 0 && (
                    <p className="text-[10px] text-slate-400 italic">
                      No gardens saved.
                    </p>
                  )}
                  {savedGardens.map((name) => (
                    <button
                      key={name}
                      onClick={() => onLoadGarden(name)}
                      className="w-full text-left p-2 text-xs font-medium text-slate-600 bg-indigo-50/50 rounded hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition-all flex justify-between items-center"
                    >
                      <span>{name}</span>
                      <i className="fas fa-file-import opacity-30"></i>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Saved Planting Plans
                  </span>
                  <button
                    onClick={handlePromptSavePlanting}
                    className="text-[10px] text-indigo-600 font-bold hover:underline"
                  >
                    Save Current
                  </button>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {savedPlantings.length === 0 && (
                    <p className="text-[10px] text-slate-400 italic">
                      No plans saved.
                    </p>
                  )}
                  {savedPlantings.map((name) => (
                    <button
                      key={name}
                      onClick={() => onLoadPlanting(name)}
                      className="w-full text-left p-2 text-xs font-medium text-slate-600 bg-emerald-50/50 rounded hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-all flex justify-between items-center"
                    >
                      <span>{name}</span>
                      <i className="fas fa-leaf opacity-30"></i>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 flex justify-center">
              <button
                onClick={() => setShowVault(false)}
                className="text-[10px] font-bold text-slate-400 uppercase hover:text-slate-600"
              >
                Close Vault
              </button>
            </div>
          </section>
        )}

        {!showVault && (
          <>
            <section>
              <h2 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
                <i className="fas fa-sun text-yellow-500"></i> Sun Exposure
              </h2>
              <div className="grid grid-cols-4 gap-1">
                {(["North", "South", "East", "West"] as SunOrientation[]).map(
                  (dir) => (
                    <button
                      key={dir}
                      onClick={() => onSetSun(dir)}
                      className={`py-2 rounded-md text-[10px] font-bold transition-all border ${
                        sunOrientation === dir
                          ? "bg-yellow-500 border-yellow-600 text-white shadow-sm"
                          : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {dir[0]}
                    </button>
                  ),
                )}
              </div>
            </section>

            <section>
              <h2 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
                <i className="fas fa-sliders text-indigo-500"></i> AI Settings
              </h2>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Provider
                  </label>
                  <select
                    value={aiProvider}
                    onChange={(e) => onChangeAIProvider(e.target.value)}
                    className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    {providerOptions.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Model
                  </label>
                  <input
                    type="text"
                    value={aiModel}
                    onChange={(e) => onChangeAIModel(e.target.value)}
                    placeholder="Optional model override"
                    className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={aiApiKey}
                    onChange={(e) => onChangeAIApiKey(e.target.value)}
                    placeholder="Paste API key (optional)"
                    className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => onTriggerOAuth(aiProvider)}
                    disabled={!oauthEnabled}
                    className={`text-[10px] font-bold px-3 py-2 rounded-lg border transition-all flex items-center gap-2 ${
                      oauthEnabled
                        ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                        : "bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed"
                    }`}
                  >
                    <i className="fas fa-link"></i> Connect OAuth
                  </button>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    Server OAuth
                  </span>
                </div>
              </div>
            </section>

            <section>
              <div className="flex justify-between items-center mb-3">
                <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <i className="fas fa-th-large text-amber-600"></i> Garden Beds
                </h2>
                <button
                  onClick={onAddBed}
                  className="bg-green-600 hover:bg-green-700 text-white w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                >
                  <i className="fas fa-plus text-[10px]"></i>
                </button>
              </div>
              <div className="space-y-2">
                {beds.map((bed) => (
                  <div
                    key={bed.id}
                    onClick={() => onSelectBed(bed.id)}
                    className="flex flex-col bg-white p-3 rounded-xl border border-slate-200 group transition-all hover:border-emerald-500 hover:shadow-md cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900 truncate max-w-[150px]">
                        {bed.name || "Unnamed Bed"}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveBed(bed.id);
                        }}
                        className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                      >
                        <i className="fas fa-trash text-[10px]"></i>
                      </button>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter mt-1">
                      {bed.shape === "circle"
                        ? `Diameter: ${bed.width}"`
                        : `${bed.width}" width × ${bed.height}" height`}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
                <i className="fas fa-leaf text-green-500"></i> Varieties &
                Priority
              </h2>
              <div className="space-y-6">
                {Object.values(VeggieType).map((vType) => {
                  const seed = seeds.find((s) => s.type === vType);
                  const priority = seed?.priority || 0;
                  const selectedCount = seed?.selectedVarieties.length || 0;
                  const isEditing = editingVarieties === vType;

                  return (
                    <div
                      key={vType}
                      className="bg-slate-50 rounded-lg p-3 border border-slate-100 transition-all hover:border-slate-300"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">
                            {VEGGIE_METADATA[vType].icon}
                          </span>
                          <span className="text-xs font-bold text-slate-700">
                            {vType}
                          </span>
                        </div>
                        <button
                          onClick={() =>
                            setEditingVarieties(isEditing ? null : vType)
                          }
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold border transition-colors ${
                            selectedCount > 0
                              ? "bg-green-100 text-green-700 border-green-200"
                              : "bg-slate-100 text-slate-400 border-slate-200"
                          }`}
                        >
                          {selectedCount} Varieties
                        </button>
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="range"
                          min="0"
                          max="5"
                          step="1"
                          value={priority}
                          onChange={(e) =>
                            onUpdateSeed(vType, parseInt(e.target.value))
                          }
                          className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                        />
                        <span className="text-[10px] font-black text-slate-400 w-4">
                          {priority}
                        </span>
                      </div>

                      {isEditing && (
                        <div className="mt-3 pt-3 border-t border-slate-200 space-y-2 animate-in slide-in-from-top-2 duration-200">
                          <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">
                            Select Actual Varieties
                          </p>
                          {SEED_VARIETY_LIBRARY.filter(
                            (v) => v.type === vType,
                          ).map((variety) => {
                            const isSelected = seed?.selectedVarieties.some(
                              (sv) => sv.id === variety.id,
                            );
                            return (
                              <button
                                key={variety.id}
                                onClick={() => toggleVariety(vType, variety)}
                                className={`w-full text-left p-2 rounded border transition-all ${
                                  isSelected
                                    ? "bg-green-50 border-green-300 shadow-sm"
                                    : "bg-white border-slate-100 hover:border-slate-300"
                                }`}
                              >
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-bold text-slate-700">
                                    {variety.name}
                                  </span>
                                  {isSelected && (
                                    <i className="fas fa-check text-green-500 text-[8px]"></i>
                                  )}
                                </div>
                                <p className="text-[8px] text-slate-400 leading-tight mt-0.5">
                                  {variety.description}
                                </p>
                                <div className="flex gap-1 mt-1">
                                  <span className="text-[7px] bg-slate-100 px-1 rounded text-slate-500">
                                    Space: {variety.spacing}"
                                  </span>
                                  <span className="text-[7px] bg-slate-100 px-1 rounded text-slate-500">
                                    Root: {variety.rootDepth}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        <div className="pt-4 sticky bottom-0 bg-white pb-6">
          <button
            onClick={onGenerate}
            disabled={isGenerating || beds.length === 0}
            className={`w-full py-4 rounded-xl font-bold shadow-lg transition-all flex flex-col items-center justify-center gap-1 ${
              isGenerating || beds.length === 0
                ? "bg-slate-100 cursor-not-allowed text-slate-300 border border-slate-200"
                : "bg-green-700 hover:bg-green-800 text-white hover:scale-[1.01]"
            }`}
          >
            {isGenerating ? (
              <div className="flex items-center gap-2">
                <i className="fas fa-brain animate-pulse"></i>
                <span className="text-sm">Analyzing Varieties...</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <i className="fas fa-wand-magic-sparkles"></i>
                  <span className="text-sm">Optimize Layout</span>
                </div>
                <span className="text-[9px] opacity-60 text-white/70">
                  Considers Spacing & Vertical Niches
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
