import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction, MouseEvent as ReactMouseEvent } from "react";
import { GardenBed } from "../shared/types";
import { GRID_SIZE } from "../constants";

type Pan = { x: number; y: number };

type BedDragArgs = {
  beds: GardenBed[];
  setBeds: Dispatch<SetStateAction<GardenBed[]>>;
  pan: Pan;
  zoom: number;
  isPanning: boolean;
  setPan: Dispatch<SetStateAction<Pan>>;
  isSpacePressed: boolean;
  setSelectedBedId: Dispatch<SetStateAction<string | null>>;
  setIsPanning: Dispatch<SetStateAction<boolean>>;
};

export const useBedDrag = ({
  beds,
  setBeds,
  pan,
  zoom,
  isPanning,
  setPan,
  isSpacePressed,
  setSelectedBedId,
  setIsPanning,
}: BedDragArgs) => {
  const [isDraggingBed, setIsDraggingBed] = useState(false);
  const [draggedBedId, setDraggedBedId] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const onBedDragStart = (e: ReactMouseEvent, id: string) => {
    if (isSpacePressed) return;
    const bed = beds.find((b) => b.id === id);
    if (!bed) return;
    setIsDraggingBed(true);
    setDraggedBedId(id);
    setSelectedBedId(id);

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragOffset.current = {
      x: (e.clientX - rect.left) / (GRID_SIZE * zoom),
      y: (e.clientY - rect.top) / (GRID_SIZE * zoom),
    };
    e.stopPropagation();
  };

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isPanning) {
        setPan((prev) => ({
          x: prev.x + e.movementX,
          y: prev.y + e.movementY,
        }));
        return;
      }

      if (!isDraggingBed || !draggedBedId) return;
      const gridContainer = document.getElementById("garden-viewport");
      if (!gridContainer) return;

      const rect = gridContainer.getBoundingClientRect();
      const rawX =
        (e.clientX - rect.left - pan.x) / (GRID_SIZE * zoom) -
        dragOffset.current.x;
      const rawY =
        (e.clientY - rect.top - pan.y) / (GRID_SIZE * zoom) -
        dragOffset.current.y;

      const x = Math.max(0, Math.round(rawX));
      const y = Math.max(0, Math.round(rawY));

      setBeds((prev) =>
        prev.map((b) => (b.id === draggedBedId ? { ...b, x, y } : b)),
      );
    },
    [isDraggingBed, draggedBedId, isPanning, pan, zoom, setBeds, setPan],
  );

  const onMouseUp = useCallback(() => {
    setIsDraggingBed(false);
    setDraggedBedId(null);
    setIsPanning(false);
  }, [setIsPanning]);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  return {
    isDraggingBed,
    draggedBedId,
    onBedDragStart,
  };
};
