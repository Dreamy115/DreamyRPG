import fs from "fs";
import path from "path";
import { capitalize } from "..";
import Creature, { Stats } from "./Creature";
import { DamageLog } from "./Damage";

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
    attackLike: boolean // Should this ability have Positioned Accuracy Modifiers like attacks?
    min_targets: number // If this is 0, only caster is provided and targets is empty
    max_targets?: number // Min targets must be at least 1 to take effect, and must be more than min targets.
    unique?: Set<string>
    haste?: number
    cost: number
    use: (caster: Creature, targets: Creature[], accuracy_mods: number[]) => Promise<AbilityUseLog>
    test: (caster: Creature) => Promise<void> // Resolve if can use, Reject if cannot use currently
  }

  constructor(data: CreatureAbility["$"]) {
    this.$ = data;
  }
}

export interface LoreReplacer {
  stat: string
  bonus?: number
  multiplier: number
}

export function replaceLore(input: string, replacers: LoreReplacer[], creature?: Creature): string {
  let str = input;

  for (const r in replacers) {
    const replacer = replacers[r];

    str = str.replaceAll(
      `{${r}}`,
      `${(100 * replacer.multiplier).toFixed(1)}% ${replacer.bonus ? ((replacer.bonus > 0 ? "+" : "-") + Math.abs(replacer.bonus)) : ""} ${capitalize(replacer.stat.replaceAll(/_/g, " "))}` +
      (
        creature
        ? ` (${(creature.$.stats[replacer.stat as Stats]?.value * replacer.multiplier) + (replacer.bonus ?? 0)}) `
        : ""
      )
    );
  }

  return str;
}

export interface AbilityUseLog {
  damageLogs?: DamageLog[]
  text: string
  returns?: string[]
}