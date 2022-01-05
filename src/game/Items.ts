import fs from "fs";
import path from "path";

import { PassiveEffect } from "./PassiveEffects";
import { DamageMethod, DamageType } from "./Damage";
import { CreaturePerk } from "./Perks";
import Creature from "./Creature";
import { AbilityUseLog, LoreReplacer } from "./CreatureAbilities";
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
  id: string
  info: {
    name: string
    lore: string
    quality: ItemQuality
  }
  scrap?: {
    materials?: CraftingMaterials
  }
}

interface PassiveItemData extends BaseItemData {
  passives?: Set<PassiveEffect|string>
  abilities?: Set<string>
  perks?: Set<(string | CreaturePerk)>
  unique?: Set<string>
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
  info: {
    name: string
    lore: string
    replacers: LoreReplacer[],
    quality: ItemQuality
  }
  onUse: (creature: Creature) => Promise<AbilityUseLog>
  returnItems?: string[]
}


export interface AttackSet {
  crit: AttackData[]
  normal: AttackData[]
  weak: AttackData[]
  type: DamageMethod
}
export interface AttackData {
  modifiers?: {
    lethality?: number
    defiltering?: number
    accuracy?: number
    cutting?: number
  }
  sources: {
    type: DamageType
    from_skill: number
    flat_bonus: number
  }[]
}

export enum ItemQuality {
  "Common",
  "Uncommon",
  "Rare",
  "Enhanced",
  "Legendary",
  "Prototype"
}
export const ItemQualityEmoji = [
  "⚪",
  "🟢",
  "🔵",
  "🟣",
  "🟠",
  "🔴",
]
export const ItemQualityColor = [
  "#EEEEEE",
  "#4AE052",
  "#4AB1E0",
  "#B14AE0",
  "#F5CA31",
  "#FC392B"
]