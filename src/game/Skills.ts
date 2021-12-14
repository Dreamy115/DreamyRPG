import fs from "fs";
import path from "path";
import { PassiveEffect } from "./PassiveEffects";
import { CreaturePerk } from "./Perks";

export default class CreatureSkillManager {
  map = new Map<string, CreatureSkill>();
  async load(dir: fs.PathLike) {
    this.map.clear();

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".js")) continue;

      const {default: loadedFile} = await import(path.join(dir.toString(), file));

      if (loadedFile instanceof CreatureSkill) {
        this.map.set(loadedFile.$.id, loadedFile);
      } else {
        if (loadedFile instanceof Array) {
          for (const subfile of loadedFile) {
            if (subfile instanceof CreatureSkill) {
              this.map.set(subfile.$.id, subfile);
            }
          }
        }
      }
    }
  }
}

export class CreatureSkill {
  $: {
    id: string
    info: {
      name: string
      lore: string
    }
    compatibleSpecies?: string[]
    compatibleClasses?: string[]
    passives?: (string | PassiveEffect)[]
    abilities?: string[]
    perks?: (string | CreaturePerk)[]
    unique?: string[]
  }

  constructor(data: CreatureSkill["$"]) {
    this.$ = data;
  }
}