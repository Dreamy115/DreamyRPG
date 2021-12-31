import fs from "fs";
import path from "path";
import { ShopManager } from "..";
import { AppliedActiveEffect } from "./ActiveEffects";
import { CraftingMaterials } from "./Crafting";
import Creature from "./Creature";

export default class GameLocationManager {
  map = new Map<string, GameLocation>();
  async load(dir: fs.PathLike) {
    this.map.clear();

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".js")) continue;

      const {default: loadedFile} = await import(path.join(dir.toString(), file));

      if (loadedFile instanceof GameLocation) {
        this.map.set(loadedFile.$.id, loadedFile);
      } else {
        if (loadedFile instanceof Array) {
          for (const subfile of loadedFile) {
            if (subfile instanceof GameLocation) {
              this.map.set(subfile.$.id, subfile);
            }
          }
        }
      }
    }
  }
}

export class GameLocation {
  $: {
    id: string
    info: {
      name: string
      lore: string
    }
    shop?: string
    area_effects?: LocationEffect[]
    hasEnhancedCrafting: boolean
    temperature: number
  }

  constructor(data: GameLocation["$"]) {
    this.$ = data;
  }

  get shop() {
    return ShopManager.map.get(this.$.shop ?? "")
  }
}

export interface LocationEffect {
  id: string
  severity: number
}

export function deltaHeatInfo(delta: number) {
  // @ts-expect-error
  const nums: deltaHeat[] = Object.values(deltaHeat).filter(x => !isNaN(x)).sort((a, b) => a - b);
  if (delta > nums[nums.length - 1]) return deltaHeat[nums[nums.length - 1]];
  if (delta < nums[0]) return deltaHeat[nums[0]];
  return deltaHeat[delta];
}
export enum deltaHeat {
  "Warm" = 1,
  "Liveable" = 0,
  "Chilly" = -1,
  "Cold" = -2,
  "Freezing" = -3,
  "Extreme" = -4
}