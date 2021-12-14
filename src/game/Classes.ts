import fs from "fs";
import path from "path";

import { PassiveEffect } from "./PassiveEffects";
import { CreaturePerk } from "./Perks";

export default class CreatureClassManager {
  map = new Map<string, CreatureClass>();
  async load(dir: fs.PathLike) {
    this.map.clear();

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".js")) continue;

      const {default: loadedFile} = await import(path.join(dir.toString(), file));

      if (loadedFile instanceof CreatureClass) {
        this.map.set(loadedFile.$.id, loadedFile);
      } else {
        if (loadedFile instanceof Array) {
          for (const subfile of loadedFile) {
            if (subfile instanceof CreatureClass) {
              this.map.set(subfile.$.id, subfile);
            }
          }
        }
      }
    }
  }
}

export class CreatureClass {
  $: {
    id: string
    info: {
      name: string
      lore: string
    }
    compatibleSpecies: string[] // Empty means everything
    passives?: (string | PassiveEffect)[]
    abilities?: string[]
    items?: string[]
    perks?: (string | CreaturePerk)[]
  }

  constructor(data: CreatureClass["$"]) {
    this.$ = data;
  }
}