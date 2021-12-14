import fs from "fs";
import path from "path";

export default class CreaturePerkManager {
  map = new Map<string, CreaturePerk>();
  async load(dir: fs.PathLike) {
    this.map.clear();

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".js")) continue;

      const {default: loadedFile} = await import(path.join(dir.toString(), file));

      if (loadedFile instanceof CreaturePerk) {
        this.map.set(loadedFile.$.id, loadedFile);
      } else {
        if (loadedFile instanceof Array) {
          for (const subfile of loadedFile) {
            if (subfile instanceof CreaturePerk) {
              this.map.set(subfile.$.id, subfile);
            }
          }
        }
      }
    }
  }
}

export class CreaturePerk {
  $: {
    id: string
    info: {
      name: string
      lore: string
    }
    compatibleSpecies?: string[]
    compatibleClasses?: string[]
  }

  constructor(data: CreaturePerk["$"]) {
    this.$ = data;
  }
}