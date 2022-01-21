import fs from "fs";
import path from "path";

import { PassiveEffect } from "./PassiveEffects";
import { DamageMethod, DamageType } from "./Damage";
import { CreaturePerk } from "./Perks";
import Creature from "./Creature";
import { AbilityUseLog, LoreReplacer } from "./CreatureAbilities";
import { CraftingMaterials } from "./Crafting";
import { ItemManager } from "..";
import { ItemModule } from "./Modules";

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
  $: WearableItemData | WeaponItemData | ConsumableItemData | GenericItemData | UltimateWearableItemData
  constructor(data: Item["$"]) {
    this.$ = data;
  }

  get displayName() {
    return `${ItemQualityEmoji[this.$.info.quality]} ${this.$.info.name}`;
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
}
export interface WearableItemData extends PassiveItemData {
  type: "wearable"
  slot: Exclude<ItemSlot, "ultimate">
}
export interface UltimateWearableItemData extends PassiveItemData {
  type: "wearable"
  slot: "ultimate"
  ultimate: string
}
export interface WeaponItemData extends PassiveItemData {
  type: "weapon"
  base_damage: number
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
  returnTable?: string
}

export interface GenericItemData extends BaseItemData {
  type: "generic"
}

export interface AttackSet {
  crit: AttackData[]
  normal: AttackData[]
  weak: AttackData[]
  type: Exclude<DamageMethod, DamageMethod.Direct>
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

export type ItemSlot = 
  "shield" | "jacket" | "backpack" | 
  "headgear" | "vest" | "utility" |
  "gloves" | "nanites" | "ultimate"
export const SlotDescriptions: Record<ItemSlot, string> = {
  backpack: "A bag to keep your stuff in.",
  headgear: "Something to protect your noggin.",
  jacket: "Tired of the cold? Put on one of these!",
  vest: "Protection for your torso.",
  gloves: "Don't get frostbite! Put something on your paws.",
  shield: "Fends off stray bullets. Those aimed at you as well.",
  utility: "Want more stuff to do? Try this.",
  nanites: "Enhance your body.",
  ultimate: "Unleash your superpower!",
}
Object.freeze(SlotDescriptions);

export function createItem(itemdata: Item|string): InventoryItem {
  let data: Item;
  if (itemdata instanceof Item) {
    data = itemdata;
  } else {
    const _data = ItemManager.map.get(itemdata);
    if (!_data) throw new Error("Invalid item");
    data = _data;
  }

  switch (data.$.type) {
    case "consumable":
    case "generic":
    default:
      return {
        id: data.$.id
      }
    case "wearable": {
      var _: WearableInventoryItem = {
        id: data.$.id,
        module: ItemModule.generate()
      }
      return _;
    }
  }
}


interface BaseInventoryItem {
  id: string
}

export interface EquippableInventoryItem extends BaseInventoryItem {
}

export interface WearableInventoryItem extends EquippableInventoryItem {
  module: ItemModule
}
export interface WeaponInventoryItem extends EquippableInventoryItem {

}

export type InventoryItem = EquippableInventoryItem | BaseInventoryItem;
