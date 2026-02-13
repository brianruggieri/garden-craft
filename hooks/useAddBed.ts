import type { Dispatch, SetStateAction } from "react";
import { GardenBed } from "../shared/types";

type Pan = { x: number; y: number };

type AddBedArgs = {
  setBeds: Dispatch<SetStateAction<GardenBed[]>>;
  getCenteredGridPoint: (pan: Pan, zoom: number) => {
    centerX: number;
    centerY: number;
  };
  pan: Pan;
  zoom: number;
};

export const useAddBed = ({
  setBeds,
  getCenteredGridPoint,
  pan,
  zoom,
}: AddBedArgs) => {
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

  return { handleAddBed };
};
