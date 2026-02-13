import { useEffect, useRef, useState } from "react";
import type { MouseEvent, WheelEvent } from "react";
import { GRID_PIXEL_SIZE, GRID_SIZE } from "../constants";

type Pan = { x: number; y: number };

export const useCanvasNavigation = () => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<Pan>(pan);
  const zoomRef = useRef(zoom);

  const getCenteredPan = (zoomValue: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const scaledWidth = GRID_PIXEL_SIZE * zoomValue;
    const scaledHeight = GRID_PIXEL_SIZE * zoomValue;
    return {
      x: (rect.width - scaledWidth) / 2,
      y: (rect.height - scaledHeight) / 2,
    };
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") setIsSpacePressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setIsSpacePressed(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    setPan(getCenteredPan(zoom));
  }, []);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const clampPan = (panValue: Pan, zoomValue: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return panValue;
    const scaledWidth = GRID_PIXEL_SIZE * zoomValue;
    const scaledHeight = GRID_PIXEL_SIZE * zoomValue;

    const next = { ...panValue };

    if (scaledWidth <= rect.width) {
      next.x = (rect.width - scaledWidth) / 2;
    } else {
      const minX = rect.width - scaledWidth;
      next.x = Math.min(0, Math.max(minX, next.x));
    }

    if (scaledHeight <= rect.height) {
      next.y = (rect.height - scaledHeight) / 2;
    } else {
      const minY = rect.height - scaledHeight;
      next.y = Math.min(0, Math.max(minY, next.y));
    }

    return next;
  };

  const clampZoom = (zoomValue: number) =>
    Math.min(Math.max(zoomValue, 0.1), 5);

  const zoomAroundVisibleGridCenter = (nextZoom: number, prevZoom: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const prevPan = panRef.current;
    const viewLeft = -prevPan.x / prevZoom;
    const viewTop = -prevPan.y / prevZoom;
    const viewRight = (rect.width - prevPan.x) / prevZoom;
    const viewBottom = (rect.height - prevPan.y) / prevZoom;

    const visibleLeft = Math.max(0, viewLeft);
    const visibleTop = Math.max(0, viewTop);
    const visibleRight = Math.min(GRID_PIXEL_SIZE, viewRight);
    const visibleBottom = Math.min(GRID_PIXEL_SIZE, viewBottom);

    const worldX = (visibleLeft + visibleRight) / 2;
    const worldY = (visibleTop + visibleBottom) / 2;

    const centerScreenX = worldX * prevZoom + prevPan.x;
    const centerScreenY = worldY * prevZoom + prevPan.y;

    const nextPan = {
      x: centerScreenX - worldX * nextZoom,
      y: centerScreenY - worldY * nextZoom,
    };

    setPan(clampPan(nextPan, nextZoom));
  };

  useEffect(() => {
    setPan((prev) => clampPan(prev, zoom));
  }, [zoom]);

  const handleWheel = (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = -e.deltaY;
      const factor = Math.pow(1.1, delta / 100);
      const prevZoom = zoomRef.current;
      const nextZoom = clampZoom(prevZoom * factor);
      zoomAroundVisibleGridCenter(nextZoom, prevZoom);
      setZoom(nextZoom);
    } else if (!isSpacePressed) {
      setPan((prev) =>
        clampPan(
          { x: prev.x - e.deltaX, y: prev.y - e.deltaY },
          zoom,
        ),
      );
    }
  };

  const handleCanvasMouseDown = (e: MouseEvent) => {
    if (isSpacePressed || e.button === 1) {
      setIsPanning(true);
      e.preventDefault();
    }
  };

  const getCenteredGridPoint = (panValue: Pan, zoomValue: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const centerX = rect ? (rect.width / 2 - panValue.x) / zoomValue / GRID_SIZE : 10;
    const centerY = rect ? (rect.height / 2 - panValue.y) / zoomValue / GRID_SIZE : 10;
    return { centerX, centerY };
  };

  return {
    zoom,
    pan,
    isPanning,
    isSpacePressed,
    canvasRef,
    zoomByDelta: (delta: number) => {
      const prevZoom = zoomRef.current;
      const nextZoom = clampZoom(prevZoom + delta);
      zoomAroundVisibleGridCenter(nextZoom, prevZoom);
      setZoom(nextZoom);
    },
    zoomTo: (value: number) => {
      const prevZoom = zoomRef.current;
      const nextZoom = clampZoom(value);
      zoomAroundVisibleGridCenter(nextZoom, prevZoom);
      setZoom(nextZoom);
    },
    setPan: (next: Pan | ((prev: Pan) => Pan)) =>
      setPan((prev) => clampPan(typeof next === "function" ? next(prev) : next, zoom)),
    setIsPanning,
    setIsSpacePressed,
    handleWheel,
    handleCanvasMouseDown,
    getCenteredGridPoint,
    centerCanvas: (zoomValue?: number) =>
      setPan(getCenteredPan(zoomValue ?? zoom)),
  };
};
