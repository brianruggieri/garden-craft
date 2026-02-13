import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Vegetable, VeggieType } from "../shared/types";

type SeedInitArgs = {
  seeds: Vegetable[];
  setSeeds: Dispatch<SetStateAction<Vegetable[]>>;
  veggieTypes: VeggieType[];
};

export const useSeedInit = ({ seeds, setSeeds, veggieTypes }: SeedInitArgs) => {
  const didInitSeeds = useRef(false);

  useEffect(() => {
    if (didInitSeeds.current) return;
    if (seeds.length > 0) {
      didInitSeeds.current = true;
      return;
    }
    if (veggieTypes.length > 0) {
      setSeeds(
        veggieTypes.map((type) => ({
          type,
          priority: 3,
          selectedVarieties: [],
        })),
      );
      didInitSeeds.current = true;
    }
  }, [seeds.length, setSeeds, veggieTypes]);
};
