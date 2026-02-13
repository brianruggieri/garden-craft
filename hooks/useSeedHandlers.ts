import type { Dispatch, SetStateAction } from "react";
import { SeedVariety, VeggieType, Vegetable } from "../shared/types";

type UseSeedHandlersArgs = {
  setSeeds: Dispatch<SetStateAction<Vegetable[]>>;
};

export const useSeedHandlers = ({ setSeeds }: UseSeedHandlersArgs) => {
  const handleUpdateSeed = (type: VeggieType, priority: number) => {
    setSeeds((prev) =>
      prev.map((s) => (s.type === type ? { ...s, priority } : s)),
    );
  };

  const handleUpdateVarieties = (type: VeggieType, varieties: SeedVariety[]) => {
    setSeeds((prev) =>
      prev.map((s) =>
        s.type === type ? { ...s, selectedVarieties: varieties } : s,
      ),
    );
  };

  return { handleUpdateSeed, handleUpdateVarieties };
};
