import React, { useEffect, useMemo, useRef, useState } from "react";
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

/**
 * App.tsx
 *
 * GardenCraft main app with an optional "ball mode" easter egg.
 *
 * This file contains the canvas, beds, sprite, and the ball-launch tool that:
 * - toggles with a top-left button (exposed for testing)
 * - while enabled: left-drag to fling a ball (canvas-space), Space or middle-button to pan
 * - on touch: single-finger throw, two-finger pan
 * - one-time HUD hint shown when first enabling ball mode
 * - Escape key exits ball mode; button is blurred after click to avoid accidental Space re-trigger
 *
 * NOTE: This file intentionally keeps thrown ball DOM nodes inside the transformed
 * `.grid-boundary` so they scale and pan with the canvas.
 */

const App: React.FC = () => {
  // --- Basic garden state (unchanged) ---
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
  const [sunAngle, setSunAngleState] = useState(90);
  const [sunEnabled, setSunEnabled] = useState(true);
  const [layouts, setLayouts] = useState<BedLayout[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null);
  const [backgroundTiles, setBackgroundTiles] = useState<
    { id: string; name: string; url: string }[]
  >([]);
  const [backgroundTileId, setBackgroundTileId] = useState("none");
  const [dotColor, setDotColor] = useState("rgba(148, 163, 184, 0.9)");

  const spriteFrames = [
    "/secret/dog-01.png",
    "/secret/dog-02.png",
    "/secret/dog-03.png",
    "/secret/dog-04.png",
  ];
  const spriteTargetHeight = (25 / INCHES_PER_GRID) * GRID_SIZE * 2.2;
  const [spriteScale, setSpriteScale] = useState(1);
  const [spriteState, setSpriteState] = useState({
    x: 0,
    y: 0,
    frame: 0,
    flip: false,
    visible: false,
  });
  const [spriteAngle, setSpriteAngle] = useState(0);
  const spriteAngles = useRef<number[]>([]);
  const spriteTarget = useRef({ x: 0, y: 0, hasTarget: false });
  const spriteLastTime = useRef<number | null>(null);

  // --- Ball easter-egg state & refs ---
  const [ballMode, setBallMode] = useState(false);
  const [isDraggingBall, setIsDraggingBall] = useState(false);
  const [showBallHint, setShowBallHint] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragCurrentRef = useRef<{ x: number; y: number } | null>(null);
  const thrownBallsRef = useRef<
    {
      id: number;
      x: number;
      y: number;
      vx: number;
      vy: number;
      elem: HTMLDivElement;
    }[]
  >([]);
  const ballAnimRaf = useRef<number | null>(null);
  const ballCounterRef = useRef(0);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const touchCountRef = useRef(0);
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number } | null>(
    null,
  );

  // Ball sizing (6" base scaled by factor)
  const BALL_BASE_INCHES = 6;
  const BALL_SCALE = 2.5; // final requested scale
  const BALL_DIAMETER_INCHES = BALL_BASE_INCHES * BALL_SCALE;
  const BALL_DIAMETER_CANVAS =
    (BALL_DIAMETER_INCHES / INCHES_PER_GRID) * GRID_SIZE;

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

  // load tiles (unchanged)
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
      } catch {}
    };
    loadTiles();
    return () => {
      isMounted = false;
    };
  }, []);

  const backgroundTile =
    backgroundTiles.find((tile) => tile.id === backgroundTileId) ??
    backgroundTiles[0];
  const isGrassVibe =
    (backgroundTile?.name || "").toLowerCase() === "grass" ||
    (backgroundTile?.id || "").startsWith("grass");

  const {
    zoom,
    pan,
    isPanning,
    isSpacePressed,
    canvasRef,
    zoomByDelta,
    zoomTo,
    setPan,
    setIsPanning,
    setIsSpacePressed,
    handleWheel,
    handleCanvasMouseDown,
    getCenteredGridPoint,
    centerCanvas,
  } = useCanvasNavigation();

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

  const getViewportBounds = () => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const left = -pan.x / zoom;
    const top = -pan.y / zoom;
    const right = (rect.width - pan.x) / zoom;
    const bottom = (rect.height - pan.y) / zoom;
    return { left, top, right, bottom };
  };

  const pickEdgeTarget = () => {
    const bounds = getViewportBounds();
    if (!bounds) return { x: 0, y: 0 };
    const { left, top, right, bottom } = bounds;
    const inset = 40;
    const offset = 28;
    const edge = Math.floor(Math.random() * 4);
    const rand = (min: number, max: number) =>
      min + Math.random() * Math.max(1, max - min);
    if (edge === 0) {
      return { x: rand(left + inset, right - inset), y: top - offset };
    }
    if (edge === 1) {
      return { x: right + offset, y: rand(top + inset, bottom - inset) };
    }
    if (edge === 2) {
      return { x: rand(left + inset, right - inset), y: bottom + offset };
    }
    return { x: left - offset, y: rand(top + inset, bottom - inset) };
  };

  const {
    catalogLoading,
    catalogError,
    plantMetadata,
    seedVarieties,
    veggieTypes,
  } = usePlantCatalog();

  useSeedInit({ seeds, setSeeds, veggieTypes });

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

  const handleSetSun = (orient: SunOrientation) => {
    setSunOrientation(orient);
    const angleMap: Record<SunOrientation, number> = {
      North: 0,
      East: 90,
      South: 180,
      West: 270,
    };
    setSunAngleState(angleMap[orient]);
  };

  const bedShadow = useMemo(() => {
    if (!sunEnabled) return "none" as const;
    const distance = GRID_SIZE * 1.2;
    const radians = (sunAngle * Math.PI) / 180;
    return {
      dx: -Math.sin(radians) * distance,
      dy: Math.cos(radians) * distance,
    };
  }, [sunAngle, sunEnabled]);

  // Sprite update tick (unchanged from prior working implementation)
  useEffect(() => {
    let raf = 0;
    const tick = (time: number) => {
      if (spriteLastTime.current === null) spriteLastTime.current = time;
      const dt = Math.min(64, time - spriteLastTime.current);
      spriteLastTime.current = time;

      const panDistance = Math.hypot(pan.x, pan.y);
      const visible =
        isGrassVibe && (panDistance > 200 || Math.abs(zoom - 1) > 0.05);

      if (!visible) {
        setSpriteState((prev) => ({ ...prev, visible: false }));
        spriteTarget.current.hasTarget = false;
        raf = requestAnimationFrame(tick);
        return;
      }

      if (!spriteTarget.current.hasTarget) {
        spriteTarget.current = {
          x: 0,
          y: 0,
          hasTarget: true,
          ...(() => {
            // pick an edge target loosely (fallback simple)
            const inset = 40;
            const left = -pan.x / zoom;
            const top = -pan.y / zoom;
            const right = (window.innerWidth - pan.x) / zoom;
            const bottom = (window.innerHeight - pan.y) / zoom;
            return {
              x: Math.max(inset, left + 100),
              y: Math.max(inset, top + 100),
            };
          })(),
        };
      }

      setSpriteState((prev) => {
        let dynamicTarget = false;
        let lastBall: { x: number; y: number; vx: number; vy: number } | null =
          null;

        if (thrownBallsRef.current.length > 0) {
          lastBall = thrownBallsRef.current[thrownBallsRef.current.length - 1];
          const safeMin = spriteTargetHeight * 0.6;
          const safeMax = GRID_PIXEL_SIZE - safeMin;
          spriteTarget.current = {
            x: Math.max(safeMin, Math.min(safeMax, lastBall.x)),
            y: Math.max(safeMin, Math.min(safeMax, lastBall.y)),
            hasTarget: true,
          };
          dynamicTarget = true;
        }

        const target = spriteTarget.current;
        const dx = target.x - prev.x;
        const dy = target.y - prev.y;
        const dist = Math.hypot(dx, dy);

        let speed = 0.08; // canvas px per ms

        if (dynamicTarget && lastBall) {
          const ballScreenSpeed = Math.hypot(lastBall.vx, lastBall.vy); // px/s
          const canvasPxPerMs = ballScreenSpeed / Math.max(0.0001, zoom) / 1000; // canvas px/ms
          speed = Math.max(0.02, Math.min(0.6, canvasPxPerMs));
        }

        const step = Math.min(dist, speed * dt);
        const nx = dist > 1 ? prev.x + (dx / dist) * step : prev.x;
        const ny = dist > 1 ? prev.y + (dy / dist) * step : prev.y;

        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        const normalized = (angle + 360) % 360;
        setSpriteAngle(normalized);

        let frame = 0;
        let flip = false;
        let minDelta = 360;
        const angles = spriteAngles.current.length
          ? spriteAngles.current
          : spriteFrames.map(() => 0);
        angles.forEach((spriteAngle, idx) => {
          const direct = Math.min(
            Math.abs(spriteAngle - normalized),
            360 - Math.abs(spriteAngle - normalized),
          );
          const flippedAngle = (spriteAngle + 180) % 360;
          const flipped = Math.min(
            Math.abs(flippedAngle - normalized),
            360 - Math.abs(flippedAngle - normalized),
          );
          if (direct < minDelta) {
            minDelta = direct;
            frame = idx;
            flip = false;
          }
          if (flipped < minDelta) {
            minDelta = flipped;
            frame = idx;
            flip = true;
          }
        });

        const safeMin = spriteTargetHeight * 0.6;
        const safeMax = GRID_PIXEL_SIZE - safeMin;
        const clampedX = Math.max(safeMin, Math.min(safeMax, nx));
        const clampedY = Math.max(safeMin, Math.min(safeMax, ny));

        if (
          clampedX <= safeMin + 1 ||
          clampedX >= safeMax - 1 ||
          clampedY <= safeMin + 1 ||
          clampedY >= safeMax - 1
        ) {
          spriteTarget.current.hasTarget = false;
        }

        return {
          x: clampedX,
          y: clampedY,
          frame,
          flip,
          visible: true,
        };
      });

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pan.x, pan.y, zoom, isGrassVibe]);

  // Background tile luminance -> dot color (unchanged)
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
        avg > 0.6 ? "rgba(30, 41, 59, 0.7)" : "rgba(241, 245, 249, 0.8)",
      );
    };
    img.onerror = () => {
      setDotColor("rgba(148, 163, 184, 0.9)");
    };
  }, [backgroundTile?.url]);

  // Sprite frames preload (unchanged)
  useEffect(() => {
    let cancelled = false;
    const loadSprites = async () => {
      const images = await Promise.all(
        spriteFrames.map(
          (src) =>
            new Promise<HTMLImageElement>((resolve) => {
              const img = new Image();
              img.src = src;
              img.onload = () => resolve(img);
            }),
        ),
      );
      if (cancelled) return;

      spriteAngles.current = [60, 90, 0, 270];

      const sample = images[0];
      if (sample) {
        const canvas = document.createElement("canvas");
        canvas.width = sample.width;
        canvas.height = sample.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(sample, 0, 0);
        const data = ctx.getImageData(0, 0, sample.width, sample.height).data;
        let minY = sample.height;
        let maxY = 0;
        for (let y = 0; y < sample.height; y++) {
          for (let x = 0; x < sample.width; x++) {
            const idx = (y * sample.width + x) * 4 + 3;
            if (data[idx] > 10) {
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        const contentHeight = Math.max(1, maxY - minY + 1);
        const ratio = contentHeight / sample.height;
        setSpriteScale(ratio > 0 ? 1 / ratio : 1);
      }
    };
    loadSprites();
    return () => {
      cancelled = true;
    };
  }, []);

  // --- Ball tool: DOM creation, animation, and launch logic ---
  const createBallElement = (canvasX: number, canvasY: number, size = 40) => {
    const el = document.createElement("div");
    el.style.position = "absolute";
    el.style.left = `${canvasX - size / 2}px`;
    el.style.top = `${canvasY - size / 2}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.pointerEvents = "none";
    el.style.zIndex = "60";
    el.style.backgroundImage = `url('/secret/ball.png')`;
    el.style.backgroundSize = "cover";
    el.style.backgroundRepeat = "no-repeat";
    el.style.boxShadow = "0 6px 18px rgba(2,6,23,0.2)";
    el.style.borderRadius = "50%";
    el.style.transform = "translateZ(0)";
    return el;
  };

  const animateBalls = (time: number) => {
    if (!thrownBallsRef.current.length) {
      ballAnimRaf.current = null;
      return;
    }
    const now = performance.now();
    const last = (animateBalls as any)._last || now;
    const dtMs = Math.min(48, now - last);
    (animateBalls as any)._last = now;

    const dt = dtMs / 1000;
    const canvasWidth = GRID_PIXEL_SIZE;
    const canvasHeight = GRID_PIXEL_SIZE;
    const damping = 0.8;
    const speedThreshold = 6;

    const bedRects = beds.map((bed) => {
      const left = bed.x * GRID_SIZE;
      const top = bed.y * GRID_SIZE;
      const width = (bed.width / INCHES_PER_GRID) * GRID_SIZE;
      const height = (bed.height / INCHES_PER_GRID) * GRID_SIZE;
      return { left, top, right: left + width, bottom: top + height };
    });

    const ballDiameterCanvas = BALL_DIAMETER_CANVAS;
    const ballRadiusCanvas = BALL_DIAMETER_CANVAS / 2;

    for (let i = thrownBallsRef.current.length - 1; i >= 0; i--) {
      const b = thrownBallsRef.current[i];

      const nextX = b.x + b.vx * dt;
      const nextY = b.y + b.vy * dt;

      const dampFactor = Math.exp(-damping * dt);
      b.vx *= dampFactor;
      b.vy *= dampFactor;

      let collided = false;
      for (const r of bedRects) {
        if (
          nextX + ballRadiusCanvas > r.left &&
          nextX - ballRadiusCanvas < r.right &&
          nextY + ballRadiusCanvas > r.top &&
          nextY - ballRadiusCanvas < r.bottom
        ) {
          collided = true;
          break;
        }
      }

      if (collided) {
        b.vx = 0;
        b.vy = 0;
      } else {
        b.x = nextX;
        b.y = nextY;
      }

      b.elem.style.left = `${b.x - ballRadiusCanvas}px`;
      b.elem.style.top = `${b.y - ballRadiusCanvas}px`;
      b.elem.style.width = `${ballDiameterCanvas}px`;
      b.elem.style.height = `${ballDiameterCanvas}px`;

      const speed = Math.hypot(b.vx, b.vy);

      if (
        b.x < -200 ||
        b.x > canvasWidth + 200 ||
        b.y < -200 ||
        b.y > canvasHeight + 200 ||
        speed < speedThreshold
      ) {
        try {
          b.elem.remove();
        } catch {}
        thrownBallsRef.current.splice(i, 1);
      }
    }

    if (thrownBallsRef.current.length) {
      ballAnimRaf.current = requestAnimationFrame(animateBalls);
    } else {
      ballAnimRaf.current = null;
    }
  };

  const launchBall = (
    startClient: { x: number; y: number },
    endClient: { x: number; y: number },
  ) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const startCanvas = {
      x: (startClient.x - rect.left - pan.x) / zoom,
      y: (startClient.y - rect.top - pan.y) / zoom,
    };
    const endCanvas = {
      x: (endClient.x - rect.left - pan.x) / zoom,
      y: (endClient.y - rect.top - pan.y) / zoom,
    };

    const dxScreen = startClient.x - endClient.x;
    const dyScreen = startClient.y - endClient.y;
    const distScreen = Math.hypot(dxScreen, dyScreen);
    const MIN_DRAG_PX = 8;
    if (distScreen < MIN_DRAG_PX) return;

    const dxCanvas = startCanvas.x - endCanvas.x;
    const dyCanvas = startCanvas.y - endCanvas.y;
    const distCanvas = Math.hypot(dxCanvas, dyCanvas);
    if (distCanvas < 0.0001) return;

    const normCanvasX = dxCanvas / distCanvas;
    const normCanvasY = dyCanvas / distCanvas;

    const maxScreenSpeed = 1500;
    const minScreenSpeed = 200;
    const maxDist = Math.hypot(rect.width, rect.height);
    const scale = Math.min(1, distScreen / maxDist);
    const screenSpeed =
      minScreenSpeed + (maxScreenSpeed - minScreenSpeed) * scale;
    const canvasSpeed = screenSpeed / Math.max(0.0001, zoom);

    const vx = normCanvasX * canvasSpeed;
    const vy = normCanvasY * canvasSpeed;

    const canvasX = endCanvas.x;
    const canvasY = endCanvas.y;

    const id = ++ballCounterRef.current;
    const elem = createBallElement(
      canvasX,
      canvasY,
      Math.round(BALL_DIAMETER_CANVAS),
    );
    const gridBoundary = canvasRef.current?.querySelector(
      ".grid-boundary",
    ) as HTMLElement | null;
    const appendTarget = gridBoundary ?? canvasRef.current;
    appendTarget?.appendChild(elem);

    const ball = { id, x: canvasX, y: canvasY, vx, vy, elem };
    thrownBallsRef.current.push(ball);

    if (ballAnimRaf.current === null) {
      (animateBalls as any)._last = performance.now();
      ballAnimRaf.current = requestAnimationFrame(animateBalls);
    }
  };

  // Ball mouse handlers
  const handleBallMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (isPanning || isSpacePressed) return;
    setIsDraggingBall(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    dragCurrentRef.current = { x: e.clientX, y: e.clientY };
    e.stopPropagation();
    e.preventDefault();
  };

  const handleBallMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingBall) return;
    dragCurrentRef.current = { x: e.clientX, y: e.clientY };
    e.stopPropagation();
    e.preventDefault();
  };

  const handleBallMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingBall) return;
    setIsDraggingBall(false);
    const start = dragStartRef.current;
    const end = dragCurrentRef.current ?? { x: e.clientX, y: e.clientY };
    if (start) launchBall(start, end);
    dragStartRef.current = null;
    dragCurrentRef.current = null;
    e.stopPropagation();
    e.preventDefault();
  };

  // Touch handlers: single-finger throw, multi-finger pan
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!ballMode) return;
    touchCountRef.current = e.touches.length;
    if (e.touches.length > 1 || isSpacePressed) {
      setIsPanning(true);
      return;
    }
    const t = e.touches[0];
    setIsDraggingBall(true);
    dragStartRef.current = { x: t.clientX, y: t.clientY };
    dragCurrentRef.current = { x: t.clientX, y: t.clientY };
    setPointerPos({ x: t.clientX, y: t.clientY });
    e.stopPropagation();
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!ballMode) return;
    touchCountRef.current = e.touches.length;
    if (touchCountRef.current > 1) return;
    if (!isDraggingBall) return;
    const t = e.touches[0];
    dragCurrentRef.current = { x: t.clientX, y: t.clientY };
    setPointerPos({ x: t.clientX, y: t.clientY });
    e.stopPropagation();
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!ballMode) return;
    if (isDraggingBall) {
      setIsDraggingBall(false);
      const start = dragStartRef.current;
      const end =
        dragCurrentRef.current ??
        (e.changedTouches[0] && {
          x: e.changedTouches[0].clientX,
          y: e.changedTouches[0].clientY,
        });
      if (start && end) launchBall(start, end);
      dragStartRef.current = null;
      dragCurrentRef.current = null;
    }
    if (e.touches.length === 0) setIsPanning(false);
    e.stopPropagation();
  };

  // Toggle ball mode (button)
  const toggleBallMode = () => {
    if (!isGrassVibe) return;
    const willEnable = !ballMode;
    setBallMode(willEnable);
    setIsDraggingBall(false);
    dragStartRef.current = null;
    dragCurrentRef.current = null;

    try {
      const key = "garden_craft_ball_hint_shown";
      const alreadyShown = localStorage.getItem(key);
      if (willEnable && !alreadyShown) {
        setShowBallHint(true);
        localStorage.setItem(key, "1");
        setTimeout(() => setShowBallHint(false), 6000);
      }
    } catch {}
  };

  // Cursor class effect (manage ball cursor)
  useEffect(() => {
    const viewport = canvasRef.current;
    if (!viewport) return;
    if (ballMode) viewport.classList.add("ball-cursor-mode");
    else viewport.classList.remove("ball-cursor-mode");
    viewportRef.current = canvasRef.current;
  }, [ballMode, canvasRef]);

  // Escape to exit ball mode and ensure hint on enable (centralized)
  useEffect(() => {
    if (!ballMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setBallMode(false);
        setIsDraggingBall(false);
        dragStartRef.current = null;
        dragCurrentRef.current = null;
        try {
          (document.activeElement as HTMLElement | null)?.blur();
        } catch {}
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ballMode]);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (ballAnimRaf.current) cancelAnimationFrame(ballAnimRaf.current);
      try {
        thrownBallsRef.current.forEach((b) => b.elem.remove());
      } catch {}
      thrownBallsRef.current = [];
    };
  }, []);

  useEffect(() => {
    thrownBallsRef.current.forEach((b) => {
      // keep any existing filters consistent (if needed)
      b.elem.style.filter = "";
    });
  }, []);

  // --- Render ---
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
        onSetSun={handleSetSun}
        sunEnabled={sunEnabled}
        sunAngle={sunAngle}
        onSetSunAngle={setSunAngleState}
        onToggleSun={() => setSunEnabled((p) => !p)}
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
        oauthStatus={oauthStatus}
        oauthChecking={oauthChecking}
      />

      <main className="flex-1 relative flex flex-col overflow-hidden">
        <CatalogStatusBanner
          catalogLoading={catalogLoading}
          catalogError={catalogError}
        />
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
          onMouseDown={(e) => {
            // If requesting pan (Space or middle button) while in ball mode delegate to pan handler
            if (ballMode && (isSpacePressed || e.button === 1)) {
              try {
                (handleCanvasMouseDown as any)(e);
              } catch {}
              return;
            }
            if (ballMode) {
              handleBallMouseDown(e);
            } else {
              try {
                (handleCanvasMouseDown as any)(e);
              } catch {}
            }
          }}
          onMouseMove={(e) => {
            if (ballMode && !isPanning && !isSpacePressed)
              setPointerPos({ x: e.clientX, y: e.clientY });
            if (ballMode && isDraggingBall) handleBallMouseMove(e);
          }}
          onMouseUp={(e) => {
            if (ballMode && isDraggingBall) handleBallMouseUp(e);
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={() => setSelectedBedId(null)}
        >
          <div
            className="absolute origin-top-left transition-transform duration-75 ease-out grid-boundary"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              width: `${GRID_PIXEL_SIZE}px`,
              height: `${GRID_PIXEL_SIZE}px`,
              backgroundImage: backgroundTile?.url
                ? `radial-gradient(${dotColor} 1.5px, transparent 1.5px), url(${backgroundTile.url})`
                : `radial-gradient(${dotColor} 1.5px, transparent 1.5px)`,
              backgroundSize: backgroundTile?.url
                ? `${GRID_SIZE}px ${GRID_SIZE}px, 256px 256px`
                : `${GRID_SIZE}px ${GRID_SIZE}px`,
              backgroundRepeat: backgroundTile?.url
                ? "repeat, repeat"
                : "repeat",
            }}
          >
            <div className="grid-tape">
              <span className="grid-tape__edge grid-tape__edge--top" />
              <span className="grid-tape__edge grid-tape__edge--bottom" />
              <span className="grid-tape__edge grid-tape__edge--left" />
              <span className="grid-tape__edge grid-tape__edge--right" />
            </div>

            {spriteState.visible && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: spriteState.x - (spriteTargetHeight * spriteScale) / 2,
                  top: spriteState.y - (spriteTargetHeight * spriteScale) / 2,
                  width: spriteTargetHeight * spriteScale,
                  height: spriteTargetHeight * spriteScale,
                  transform: `scaleX(${spriteState.flip ? -1 : 1})`,
                  transition: "transform 120ms ease-out",
                  zIndex: 25,
                }}
              >
                <div
                  className="sprite-bob w-full h-full"
                  style={{ filter: "" }}
                >
                  <img
                    src={spriteFrames[spriteState.frame]}
                    alt="Wandering sprite"
                    className="w-full h-full object-contain drop-shadow-md"
                  />
                </div>
              </div>
            )}

            {beds.map((bed) => (
              <GardenBedView
                key={bed.id}
                bed={bed}
                layout={layouts.find((l) => l.bedId === bed.id)}
                veggieMetadata={plantMetadata}
                onDragStart={onBedDragStart}
                isSelected={selectedBedId === bed.id}
                onClick={() => setSelectedBedId(bed.id)}
                bedShadow={bedShadow}
              />
            ))}
          </div>

          {/* Center controls */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white p-2.5 rounded-2xl shadow-2xl border-2 border-slate-300 z-40">
            <button
              onClick={() => zoomByDelta(-0.1)}
              className="w-12 h-12 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-800 transition-colors"
              title="Zoom Out"
            >
              <i className="fas fa-minus"></i>
            </button>
            <div
              className="px-6 min-w-[100px] text-center font-black text-sm text-slate-900 cursor-pointer hover:text-emerald-700"
              onClick={() => {
                zoomTo(1);
                centerCanvas(1);
              }}
              title="Reset View"
            >
              {Math.round(zoom * 100)}%
            </div>
            <button
              onClick={() => zoomByDelta(0.1)}
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
          {/* Exposed secret button for testing */}
          {isGrassVibe && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  try {
                    (e.currentTarget as HTMLButtonElement).blur();
                  } catch {}
                  toggleBallMode();
                }}
                onKeyDown={(e) => {
                  // Prevent Space from toggling the button while ballMode active
                  if (
                    ballMode &&
                    (e.key === " " ||
                      e.key === "Spacebar" ||
                      e.code === "Space")
                  ) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
                title="Toggle Ball Mode"
                aria-pressed={ballMode}
                aria-label="Toggle Ball Mode"
                className="absolute top-4 left-4 w-10 h-10 rounded-md bg-amber-500 text-white z-50 flex items-center justify-center shadow-lg border border-amber-600"
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>
                  {ballMode ? "🎾" : "🐶"}
                </span>
              </button>

              {ballMode && (
                <div className="absolute top-6 left-28 bg-white/90 text-xs px-2 py-1 rounded shadow z-50 pointer-events-none">
                  <div className="font-semibold">Ball mode</div>
                  {showBallHint && (
                    <div className="mt-1 text-[11px] font-normal">
                      Left-drag to fling. Hold{" "}
                      <span className="font-mono">Space</span> or use Middle
                      Mouse to Pan. Two-finger drag to Pan on touch.
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Drag preview */}
          {isDraggingBall && dragStartRef.current && dragCurrentRef.current && (
            <div className="absolute inset-0 pointer-events-none z-50">
              <svg className="w-full h-full">
                <defs>
                  <linearGradient id="g" x1="0" x2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#fb923c" stopOpacity="0.6" />
                  </linearGradient>
                </defs>
                <line
                  x1={
                    dragStartRef.current.x -
                    (canvasRef.current?.getBoundingClientRect().left ?? 0)
                  }
                  y1={
                    dragStartRef.current.y -
                    (canvasRef.current?.getBoundingClientRect().top ?? 0)
                  }
                  x2={
                    dragCurrentRef.current.x -
                    (canvasRef.current?.getBoundingClientRect().left ?? 0)
                  }
                  y2={
                    dragCurrentRef.current.y -
                    (canvasRef.current?.getBoundingClientRect().top ?? 0)
                  }
                  stroke="url(#g)"
                  strokeWidth={3}
                  strokeLinecap="round"
                />
              </svg>

              <div
                style={
                  {
                    position: "absolute",
                    left: `${(dragCurrentRef.current.x - (canvasRef.current?.getBoundingClientRect().left ?? 0) - pan.x) / zoom - BALL_DIAMETER_CANVAS / 2}px`,
                    top: `${(dragCurrentRef.current.y - (canvasRef.current?.getBoundingClientRect().top ?? 0) - pan.y) / zoom - BALL_DIAMETER_CANVAS / 2}px`,
                    width: BALL_DIAMETER_CANVAS,
                    height: BALL_DIAMETER_CANVAS,
                    borderRadius: 999,
                    backgroundImage: "url('/secret/ball.png')",
                    backgroundSize: "cover",
                    transform: "translateZ(0)",
                    pointerEvents: "none",
                  } as React.CSSProperties
                }
              />
            </div>
          )}
        </div>

        <VeggieLegend
          veggieTypes={veggieTypes}
          plantMetadata={plantMetadata}
        />
      </main>

      <style>{`
        #garden-viewport.ball-cursor-mode, #garden-viewport.ball-cursor-mode * {
          cursor: url('/secret/ball.png') 16 16, auto !important;
        }
      `}</style>
    </div>
  );
};

export default App;
