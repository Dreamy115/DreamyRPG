import fs from "fs";
import path from "path";

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { PassiveEffect, PassiveModifier } from "./PassiveEffects";
import { DamageGroup, DamageMedium, DamageSource, DamageType } from "./Damage";

export default class ItemsManager {
  map = new Map<string, Item>();
  async load(dir: fs.PathLike) {
    this.map.clear();

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".js")) continue;

      const {default: loadedFile} = await import(path.join(dir.toString(), file));

      if (loadedFile instanceof Item) {
        if (loadedFile.$.id)
          this.map.set(loadedFile.$.id, loadedFile);
      } else {
        if (loadedFile instanceof Array) {
          for (const subfile of loadedFile) {
            if (subfile instanceof Item) {
              if (subfile.$.id)
                this.map.set(subfile.$.id, subfile);
            }
          }
        }
      }
    }
  }
}

export class Item {
  $: WearableItemData | WeaponItemData
  constructor(data: Item["$"]) {
    this.$ = data;
  }
}

export interface BaseItemData {
  id?: string
  info: {
    name: string
    lore: string
  }
  unique?: string[]
}
export interface WearableItemData extends BaseItemData {
  type: "utility" | "wearable_outer" | "wearable_inner" | "wearable_skin"
  passives?: (PassiveEffect | string)[]
  abilities?: string[]
}
export interface WeaponItemData extends BaseItemData {
  type: "weapon"
  passives?: (PassiveEffect | string)[]
  abilities?: string[]
  attack?: AttackSet
}


export interface AttackSet {
  crit: AttackData
  normal: AttackData
  weak: AttackData
}
export interface AttackData {
  modifiers: {
    lethality: number
    defiltering: number
    accuracy: number
  }
  type: DamageMedium
  sources: {
    type: DamageType
    from_skill: number
    flat_bonus: number
  }[]
}