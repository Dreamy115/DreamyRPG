import { capitalize } from "..";
import Creature, { Attributes, Stats } from "./Creature";


export interface LoreReplacer {
  stat: Stats | Attributes;
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
          ? ` (**${(creature.$.stats[replacer.stat as Stats]?.value * replacer.multiplier) + (replacer.bonus ?? 0)}**)`
          : ""
      )
    );
  }

  return str;
}
