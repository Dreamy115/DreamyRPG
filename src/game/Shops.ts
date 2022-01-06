import fs from "fs";
import path from "path";
import { AppliedActiveEffect } from "./ActiveEffects";
import { CraftingMaterials } from "./Crafting";
import Creature from "./Creature";
import { AbilityUseLog } from "./CreatureAbilities";

export default class LocationShopsManager {
  map = new Map<string, Shop>();
  async load(dir: fs.PathLike) {
    this.map.clear();

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".js")) continue;

      const {default: loadedFile} = await import(path.join(dir.toString(), file));

      if (loadedFile instanceof Shop) {
        this.map.set(loadedFile.$.id, loadedFile);
      } else {
        if (loadedFile instanceof Array) {
          for (const subfile of loadedFile) {
            if (subfile instanceof Shop) {
              this.map.set(subfile.$.id, subfile);
            }
          }
        }
      }
    }
  }
}

export class Shop {
  $: {
    id: string
    info: {
      name: string
      lore: string
    }
    content?: ShopContent[]
  }

  constructor(data: Shop["$"]) {
    this.$ = data;
  }
}

export type ShopContent = ShopContentItem | ShopContentService | ShopContentSchematic; 
interface ShopContentBase {
  cost: CraftingMaterials
}
interface ShopContentItem extends ShopContentBase {
  type: "item"
  id: string
}
interface ShopContentSchematic extends ShopContentBase {
  type: "schematic"
  id: string
}
interface ShopContentService extends ShopContentBase {
  type: "service"
  info: {
    name: string
    lore: string
  }
  onBuy: (creature: Creature) => Promise<AbilityUseLog>
}