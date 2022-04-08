import fs from "fs";
import path from "path";
import Creature from "./Creature";
import { DamageLog, HealLog, VitalsLog } from "./Damage";
import { LoreReplacer } from "./LoreReplacer";
import Mongoose from "mongoose";

export default class CreatureAbilitiesManager {
  map = new Map<string, CreatureAbility>();
  async load(dir: fs.PathLike) {
    this.map.clear();

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".js")) continue;

      const {default: loadedFile} = await import(path.join(dir.toString(), file));

      if (loadedFile instanceof CreatureAbility) {
        if (loadedFile.$.id)
          this.map.set(loadedFile.$.id, loadedFile);
      } else {
        if (loadedFile instanceof Array) {
          for (const subfile of loadedFile) {
            if (subfile instanceof CreatureAbility) {
              if (subfile.$.id)
                this.map.set(subfile.$.id, subfile);
            }
          }
        }
      }
    }
  }
}

export class CreatureAbility {
  $: {
    id: string
    info: {
      name: string
      lore: string
      lore_replacers: LoreReplacer[]
    }
    type: AbilityType
    min_targets: number // If this is 0, only caster is provided and targets is empty
    max_targets?: number // Min targets must be at least 1 to take effect, and must be more than min targets.
    unique?: Set<string>
    haste?: number
    cost: number
    use: (caster: Creature, db: typeof Mongoose, targets: Creature[], accuracy_mods: number[]) => Promise<AbilityUseLog>
    test: (caster: Creature) => Promise<void> // Resolve if can use, Reject if cannot use currently
  }

  constructor(data: CreatureAbility["$"]) {
    this.$ = data;
  }
}

export enum AbilityType {
  "Other" = -1,
  "Attack", "Heal", "Buff", "Debuff"
}

export interface AbilityUseLog {
  vitalsLogs?: VitalsLog[]
  text: string
  returns?: string[]
}