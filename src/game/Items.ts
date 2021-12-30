import fs from "fs";
import path from "path";

import { PassiveEffect } from "./PassiveEffects";
import { DamageMedium, DamageType } from "./Damage";
import { CreaturePerk } from "./Perks";
import Creature from "./Creature";
import { AbilityUseLog } from "./CreatureAbilities";
import { CraftingMaterials } from "./Crafting";

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
  $: WearableItemData | WeaponItemData | ConsumableItemData
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
  scrap?: {
    materials?: CraftingMaterials
  }
}

interface PassiveItemData extends BaseItemData {
  passives?: (PassiveEffect | string)[]
  abilities?: string[]
  perks?: (string | CreaturePerk)[]
  unique?: string[]
}
export interface WearableItemData extends PassiveItemData {
  type: "wearable"
  subtype: "utility" | "clothing"
}
export interface WeaponItemData extends PassiveItemData {
  type: "weapon"
  attack: AttackSet
}

export interface ConsumableItemData extends BaseItemData {
  type: "consumable"
  onUse: (creature: Creature) => Promise<AbilityUseLog>
  returnItems?: string[]
}


export interface AttackSet {
  crit: AttackData[]
  normal: AttackData[]
  weak: AttackData[]
  type: DamageMedium
}
export interface AttackData {
  modifiers?: {
    lethality?: number
    defiltering?: number
    accuracy?: number
    severing?: number
  }
  sources: {
    type: DamageType
    from_skill: number
    flat_bonus: number
  }[]
}