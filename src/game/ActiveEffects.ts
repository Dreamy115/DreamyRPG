import fs from "fs";
import path from "path";

import Creature, { CreatureData } from "./Creature";
import { PassiveEffect } from "./PassiveEffects";

export default class ActiveEffectManager {
  map = new Map<string, ActiveEffect>();
  async load(dir: fs.PathLike) {
    this.map.clear();

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".js")) continue;

      const {default: loadedFile} = await import(path.join(dir.toString(), file));

      if (loadedFile instanceof ActiveEffect) {
        this.map.set(loadedFile.$.id, loadedFile);
      } else {
        if (loadedFile instanceof Array) {
          for (const subfile of loadedFile) {
            if (subfile instanceof ActiveEffect) {
              this.map.set(subfile.$.id, subfile);
            }
          }
        }
      }
    }
  }
}

export class ActiveEffect {
  $: {
    id: string
    info: {
      name: string
      lore: string
    }
    passives?: (PassiveEffect | string)[]
    consecutive_limit: number
    onApply?: (creature: Creature, {ticks, severity}: AppliedActiveEffect) => void
    onTick?: (creature: Creature, {ticks, severity}: AppliedActiveEffect) => void
    onExpire?: (creature: Creature, {ticks, severity}: AppliedActiveEffect) => void
    onDelete?: (creature: Creature, {ticks, severity}: AppliedActiveEffect) => void
  }

  constructor(data: ActiveEffect["$"]) {
    this.$ = data;
  }
}

export interface AppliedActiveEffect {
  id: string
  ticks: number
  severity: number
}