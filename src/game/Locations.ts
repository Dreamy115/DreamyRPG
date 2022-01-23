import fs from "fs";
import path from "path";
import { ShopManager } from "..";

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
    rads: number
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

export function cToF(celsius: number) {
  return celsius * 1.8 + 32
}
export function fToC(fahrenheit: number) {
  return (fahrenheit - 32) / 1.8
}