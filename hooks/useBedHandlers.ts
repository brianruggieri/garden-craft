import type { Dispatch, SetStateAction } from "react";
import { BedShape, GardenBed } from "../shared/types";

type UseBedHandlersArgs = {
  beds: GardenBed[];
  setBeds: Dispatch<SetStateAction<GardenBed[]>>;
  selectedBedId: string | null;
  setSelectedBedId: Dispatch<SetStateAction<string | null>>;
};

export const useBedHandlers = ({
  beds,
  setBeds,
  selectedBedId,
  setSelectedBedId,
}: UseBedHandlersArgs) => {
  const handleRemoveBed = (id: string) => {
    setBeds((prev) => prev.filter((b) => b.id !== id));
    if (selectedBedId === id) setSelectedBedId(null);
  };

  const updateSelectedBed = (updater: (bed: GardenBed) => GardenBed) => {
    if (!selectedBedId) return;
    setBeds((prev) =>
      prev.map((b) => (b.id === selectedBedId ? updater(b) : b)),
    );
  };

  const handleUpdateBedName = (value: string) => {
    updateSelectedBed((bed) => ({ ...bed, name: value }));
  };

  const handleUpdateBedShape = (value: BedShape) => {
    updateSelectedBed((bed) => ({
      ...bed,
      shape: value,
      height: value === "circle" ? bed.width : bed.height,
    }));
  };

  const handleUpdateBedWidth = (value: number) => {
    updateSelectedBed((bed) => ({
      ...bed,
      width: value,
      height: bed.shape === "circle" ? value : bed.height,
    }));
  };

  const handleUpdateBedHeight = (value: number) => {
    updateSelectedBed((bed) => ({ ...bed, height: value }));
  };

  const selectedBed = beds.find((b) => b.id === selectedBedId);

  return {
    selectedBed,
    handleRemoveBed,
    handleUpdateBedName,
    handleUpdateBedShape,
    handleUpdateBedWidth,
    handleUpdateBedHeight,
  };
};
