import fs from "fs";
import path from "path";

export default class CraftingManager {
  map = new Map<string, CraftingRecipe>();
  async load(dir: fs.PathLike) {
    this.map.clear();

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".js")) continue;

      const {default: loadedFile} = await import(path.join(dir.toString(), file));

      if (loadedFile instanceof CraftingRecipe) {
        this.map.set(loadedFile.$.id, loadedFile);
      } else {
        if (loadedFile instanceof Array) {
          for (const subfile of loadedFile) {
            if (subfile instanceof CraftingRecipe) {
              this.map.set(subfile.$.id, subfile);
            }
          }
        }
      }
    }
  }
}

export class CraftingRecipe {
  $: {
    id: string
    result: string
    requirements: {
      perks?: string[]
      items?: string[]
      materials?: {
        scrap?: number
        parts?: number
        cells?: number
        cores?: number
      }
    }
  }

  constructor(data: CraftingRecipe["$"]) {
    this.$ = data;
  }
}