import fs from "fs";
import path from "path";
import { Directives, SETTINGS } from "..";
import { LocationEffect } from "./Locations";
import { PassiveEffect } from "./PassiveEffects";

export default class DirectiveManager {
  map = new Map<string, GameDirective>();
  async load(dir: fs.PathLike) {
    this.map.clear();

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".js")) continue;

      const {default: loadedFile} = await import(path.join(dir.toString(), file));

      if (loadedFile instanceof GameDirective) {
        this.map.set(loadedFile.$.id, loadedFile);
      } else {
        if (loadedFile instanceof Array) {
          for (const subfile of loadedFile) {
            if (subfile instanceof GameDirective) {
              this.map.set(subfile.$.id, subfile);
            }
          }
        }
      }
    }
  }
}

export class GameDirective {
  static get enabled(): Set<GameDirective> {
    const set = new Set<GameDirective>();

    for (const gd of SETTINGS?.$?.directives ?? new Set<string>()) {
      const directive = Directives.map.get(gd);
      if (directive)
        set.add(directive);
    }

    return set;
  }

  $: {
    id: string
    info: {
      name: string
      lore: string
    }
    passives?: Set<(PassiveEffect | string)> 
    perks?: Set<string>
    abilities?: Set<string>
    effects?: LocationEffect[]
  }

  constructor(data: GameDirective["$"]) {
    this.$ = data;
  }
}