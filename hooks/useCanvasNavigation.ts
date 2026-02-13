import { useEffect, useRef, useState } from "react";
import type { MouseEvent, WheelEvent } from "react";
import { GRID_SIZE } from "../constants";

type Pan = { x: number; y: number };

export const useCanvasNavigation = () => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

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

  const handleWheel = (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = -e.deltaY;
      const factor = Math.pow(1.1, delta / 100);
      setZoom((prev) => Math.min(Math.max(prev * factor, 0.1), 5));
    } else if (!isSpacePressed) {
      setPan((prev) => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
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
    setPan,
    setIsPanning,
    setIsSpacePressed,
    handleWheel,
    handleCanvasMouseDown,
    getCenteredGridPoint,
  };
};
