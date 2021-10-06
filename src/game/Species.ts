import fs from "fs";
import path from "path";

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default class SpeciesManager {
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

/* NAMING CONVENTION

Set the ID of each species this way: parent/species
Set the defaults in "default", and make others override from it!
Example: default/equine/earth_pony
*/
export class CreatureSpecies {
  $: {
    id: string
    info: {
      name: string
      lore: string
      description: string
    }
    parent: string
  }

  constructor(data: CreatureSpecies["$"]) {
    this.$ = data;
  }
}