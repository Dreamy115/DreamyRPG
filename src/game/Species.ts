import fs from "fs";
import path from "path";

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { PassiveEffect } from "./PassiveEffects";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default class CreatureSpeciesManager {
  map = new Map<string, CreatureSpecies>();
  async load(dir: fs.PathLike) {
    this.map.clear();

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".js")) continue;

      const {default: loadedFile} = await import(path.join(dir.toString(), file));

      if (loadedFile instanceof CreatureSpecies) {
        this.map.set(loadedFile.$.id, loadedFile);
      } else {
        if (loadedFile instanceof Array) {
          for (const subfile of loadedFile) {
            if (subfile instanceof CreatureSpecies) {
              this.map.set(subfile.$.id, subfile);
            }
          }
        }
      }
    }
  }
}

export class CreatureSpecies {
  $: {
    id: string
    info: {
      name: string
      lore: string
      description: string
    }
    playable: boolean
    passives?: (string | PassiveEffect)[]
  }

  constructor(data: CreatureSpecies["$"]) {
    this.$ = data;
  }
}