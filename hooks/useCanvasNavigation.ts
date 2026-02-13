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

  useEffect(() => {
    setPan((prev) => clampPan(prev, zoom));
  }, [zoom]);

  const handleWheel = (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = -e.deltaY;
      const factor = Math.pow(1.1, delta / 100);
      setZoom((prev) => Math.min(Math.max(prev * factor, 0.1), 5));
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
    setZoom,
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
