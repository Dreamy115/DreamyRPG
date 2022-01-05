import fs from "fs";
import path from "path";
import { ItemQuality, ItemQualityEmoji } from "./Items";

export default class CraftingManager {
  map = new Map<string, Schematic>();
  async load(dir: fs.PathLike) {
    this.map.clear();

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".js")) continue;

      const {default: loadedFile} = await import(path.join(dir.toString(), file));

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
    }
  }
}

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