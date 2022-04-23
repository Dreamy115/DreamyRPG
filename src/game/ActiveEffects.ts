import fs from "fs";
import Mongoose from "mongoose";
import path from "path";
import { capitalize } from "..";
import Creature, { Attributes, Stats } from "./Creature";
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
      replacers?: EffectLoreReplacer[]
    }
    type: EffectType
    hide?: (creature?: Creature, active?: AppliedActiveEffect) => boolean
    display_severity?: DisplaySeverity
    passives?: Set<PassiveEffect | string>
    consecutive_limit: number
    stacking?: EffectStacking
    conflicts_with?: Set<string>
    onApply?: (creature: Creature, db: typeof Mongoose, {ticks, severity}: AppliedActiveEffect, vars: ActiveEffect["$"]["vars"]) => Promise<void>
    onTick?: (creature: Creature, db: typeof Mongoose, {ticks, severity}: AppliedActiveEffect, vars: ActiveEffect["$"]["vars"]) => Promise<void>
    onDelete?: (creature: Creature, db: typeof Mongoose, {ticks, severity}: AppliedActiveEffect, vars: ActiveEffect["$"]["vars"]) => Promise<void>
    preload?: (creature: Creature, {ticks, severity}: AppliedActiveEffect) => void
    postload?: (creature: Creature, {ticks, severity}: AppliedActiveEffect) => void
    vars?: Record<string, number>
  }

  getDisplayName(active?: Omit<Omit<AppliedActiveEffect, "ticks">, "id">) {
    return `${EffectTypeEmoji[this.$.type]}${this.$.info.name}${
      active && this.$.display_severity !== DisplaySeverity.NONE
      ? " " + (
        this.$.display_severity === DisplaySeverity.ROMAN
        ? romanNumeral(active.severity)
        : active.severity.toFixed(0)
      )
      : ""
    }`
  }

  constructor(data: ActiveEffect["$"]) {
    this.$ = data;
  }
}

export interface AppliedActiveEffect {
  id: string
  ticks: number
  severity: number
  vars?: Record<string, number>
}

export enum DisplaySeverity {
  "NONE", "ROMAN", "ARABIC"
}
export enum EffectStacking {
  "None", "Duration", "Severity", "Both"
}

export enum EffectType {
  "Other" = -1,
  "Buff", "Debuff", "Ability", "Wound"
}
export enum EffectTypeEmoji {
  "" = -1,
  "⏫", "🔽", "🔷", "🩸"
}

export interface EffectLoreReplacer {
  stat: "severity" | "ticks" | Stats | Attributes
  multiplier: number
  bonus?: number
}

export function replaceEffectLore(input: string, replacers: EffectLoreReplacer[], {ticks, severity}: {ticks: number, severity: number}, creature?: Creature, format = false) {
  var str = input;

  for (const r in replacers) {
    const replacer = replacers[r];
    if (replacer.stat === "severity" || replacer.stat === "ticks") {
      str = str.replaceAll(`{${r}}`, `${format ? "**": ""}${(replacer.bonus ?? 0) + Number(function() {
        switch (replacer.stat) {
          default: return 0;
          case "ticks": return ticks;
          case "severity": return severity;
        }
      }() * replacer.multiplier)}${format ? "**": ""}`)
    } else {
      str = str.replaceAll(
        `{${r}}`,
        `**${replacer.multiplier !== 1 ? `${(100 * replacer.multiplier).toFixed(1)}% ` : ""}${replacer.bonus ? ((replacer.bonus > 0 ? "+" : "-") + Math.abs(replacer.bonus)) : ""} ${capitalize(replacer.stat.replaceAll(/_/g, " "))}**` +
        (
          creature
            ? ` (**${(((creature.$.stats[replacer.stat as Stats] ?? creature.$.attributes[replacer.stat as Attributes])?.value * replacer.multiplier) + (replacer.bonus ?? 0)).toFixed(1)}**)`
            : ""
        )
      );
    }
  }

  return str;
}

export function romanNumeral(number: number): string {
  number = Math.round(number);
  if (number == 0) return "0";

  var str = "";
  if (number < 0) {
    str += "-";
    number = Math.abs(number);
  }


  while (number > 0) {
    str += "I";
    number--;
  }

  return str
    .replaceAll(/IIIII/g, "V")
    .replaceAll(/VV/g, "X")
    .replaceAll(/IIII/g, "IV")
    .replaceAll(/VIV/g, "IX")
    .replaceAll(/XXXXX/g, "L")
    .replaceAll(/LL/g, "C")
    .replaceAll(/XXXX/g, "XL")
    .replaceAll(/LXL/g, "XC")
    .replaceAll(/CCCCC/g, "D")
    .replaceAll(/DD/g, "M")
    .replaceAll(/CCCC/g, "CD")
    .replaceAll(/DCD/g, "CM")
}