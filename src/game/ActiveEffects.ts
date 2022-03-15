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
      replacers: EffectLoreReplacer[]
    }
    display_severity?: DisplaySeverity
    passives?: Set<PassiveEffect | string>
    consecutive_limit: number
    onApply?: (creature: Creature, {ticks, severity}: AppliedActiveEffect) => void
    onTick?: (creature: Creature, {ticks, severity}: AppliedActiveEffect) => void
    onDelete?: (creature: Creature, {ticks, severity}: AppliedActiveEffect) => void
    preload?: (creature: Creature, {ticks, severity}: AppliedActiveEffect) => void
    postload?: (creature: Creature, {ticks, severity}: AppliedActiveEffect) => void
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

export enum DisplaySeverity {
  "NONE", "ROMAN", "ARABIC"
}

export interface EffectLoreReplacer {
  type: "severity" | "ticks"
  multiply: number
}

export function replaceEffectLore(input: string, replacers: EffectLoreReplacer[], {ticks, severity}: {ticks: number, severity: number}) {
  var str = input;

  for (const r in replacers) {
    const rep = replacers[r];
    str = str.replaceAll(`{${r}}`, String(Number(function() {
      switch (rep.type) {
        default: return 0;
        case "ticks": return ticks;
        case "severity": return severity;
      }
    }()) * rep.multiply));
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