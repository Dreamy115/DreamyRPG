import { capitalize } from "..";
import Creature, { Attributes, Stats } from "./Creature";
import { ModuleType } from "./Modules";


export interface LoreReplacer {
  stat: Stats | Attributes | "offensive_module" | "defensive_module" | "technical_module" | "accelerating_module";
  bonus?: number;
  multiplier: number;
}

export function replaceLore(input: string, replacers: LoreReplacer[], creature?: Creature): string {
  let str = input;

  for (const r in replacers) {
    const replacer = replacers[r];

    str = str.replaceAll(
      `{${r}}`,
      `**${replacer.multiplier !== 1 ? `${(100 * replacer.multiplier).toFixed(1)}% ` : ""}${replacer.bonus ? ((replacer.bonus > 0 ? "+" : "-") + Math.abs(replacer.bonus)) : ""} ${capitalize(replacer.stat.replaceAll(/_/g, " "))}**` +
      (
        creature
          ? ` (**${((
            (
              (creature.$.stats[replacer.stat as Stats] ?? creature.$.attributes[replacer.stat as Attributes])?.value ?? 
              (creature.stat_modules.get(
                capitalize(replacer.stat.substring(0, replacer.stat.length - "_module".length)) as unknown as ModuleType) ?? 0
              ) * replacer.multiplier
            )
            ) + (replacer.bonus ?? 0)).toFixed(1)}**`
          : ""
      )
    );
  }

  return str;
}
