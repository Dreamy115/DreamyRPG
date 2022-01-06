import fs from "fs";
import path from "path";
import { ItemQuality, ItemQualityEmoji } from "./Items";

export default class CraftingManager {
  map = new Map<string, Schematic>();
  free = new Set<string>();
  async load(dir: fs.PathLike) {
    this.map.clear();

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".js")) continue;

      const {default: loadedFile, free} = await import(path.join(dir.toString(), file));

      if (loadedFile instanceof Schematic) {
        this.map.set(loadedFile.$.id, loadedFile);
      } else {
        if (loadedFile instanceof Array) {
          for (const subfile of loadedFile) {
            if (subfile instanceof Schematic) {
              this.map.set(subfile.$.id, subfile);
            }
          }
        }
      }

      if (free instanceof Schematic) {
        this.map.set(free.$.id, free);
        this.free.add(free.$.id);
      } else {
        if (free instanceof Array) {
          for (const subfile of free) {
            if (subfile instanceof Schematic) {
              this.map.set(subfile.$.id, subfile);
              this.free.add(subfile.$.id);
            }
          }
        }
      }
    }
  }
}

/*
* Schematics can also be imported as "free" 
* export const free
* These will be given to all Creatures
*/

export class Schematic {
  $: {
    id: string
    info: {
      name: string
      lore: string
      quality: ItemQuality
    }
    table: string
    requirements: {
      enhancedCrafting: boolean
      perks?: Set<string>
      items?: string[]
      materials?: CraftingMaterials
    }
  }

  constructor(data: Schematic["$"]) {
    this.$ = data;
  }

  get displayName() {
    return `${ItemQualityEmoji[this.$.info.quality]} ${this.$.info.name}`;
  }
}

export class CraftingMaterials {
  metal: number
  fabric: number
  plastic: number
  cells: number
  biomaterial: number

  constructor(data: {[key: string]: number}) {
    this.metal = data.metal ?? 0;
    this.fabric = data.fabric ?? 0;
    this.plastic = data.plastic ?? 0;
    this.cells = data.cells ?? 0;
    this.biomaterial = data.biomaterial ?? 0;
  }
}