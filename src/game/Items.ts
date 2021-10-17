import fs from "fs";
import path from "path";

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { PassiveEffect, PassiveModifier } from "./PassiveEffects";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default class ItemsManager {
  map = new Map<string, Item>();
  async load(dir: fs.PathLike) {
    this.map.clear();

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".js")) continue;

      const {default: loadedFile} = await import(path.join(dir.toString(), file));

      if (loadedFile instanceof Item) {
        if (loadedFile.$.id)
          this.map.set(loadedFile.$.id, loadedFile);
      } else {
        if (loadedFile instanceof Array) {
          for (const subfile of loadedFile) {
            if (subfile instanceof Item) {
              if (subfile.$.id)
                this.map.set(subfile.$.id, subfile);
            }
          }
        }
      }
    }
  }
}

export class Item {
  $: {
    id?: string
    info: {
      name: string
      lore: string
    }
    unique?: string[]
    type: "weapon" | "utility" | "wearable_outer" | "wearable_inner" | "wearable_skin"

    passives?: (PassiveEffect | string)[]
    abilities?: string[]
  }

  constructor(data: Item["$"]) {
    this.$ = data;
  }
}