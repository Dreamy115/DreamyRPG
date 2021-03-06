import fs from "fs";
import Mongoose from "mongoose";
import path from "path";
import { ItemManager, lerp } from "..";
import { CraftingMaterials } from "./Crafting";
import Creature, { Attributes, diceRoll, Stats } from "./Creature";
import { AbilityUseLog } from "./CreatureAbilities";
import { DamageMethod, DamageType, ShieldReaction } from "./Damage";
import { LoreReplacer } from "./LoreReplacer";
import { ItemModifierModuleInfo, ItemStatModule, ModuleType } from "./Modules";
import { NamedModifier, PassiveEffect } from "./PassiveEffects";
import { CreaturePerk } from "./Perks";


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

export type SpecializedWearableData =
  UltimateWearableItemData | MaskWearableItemData | ShieldWearableItemData |
  JacketWearableItemData | VestWearableItemData | GlovesWearableItemData | 
  BackpackWearableItemData
export class Item {
  $: NormalWearableItemData | WeaponItemData | ConsumableItemData | GenericItemData | SpecializedWearableData
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
  modifier_module?: {
    choose: number,
    mods: Map<Stats | Attributes, ItemModifierModuleInfo>
  }
  fixed_stat_module?: ModuleType
  recalibrate_cost?: CraftingMaterials
  optimize_step?: number
  optimize_cost?: CraftingMaterials
}
export interface NormalWearableItemData extends PassiveItemData {
  type: "wearable"
  slot: Exclude<ItemSlot, "ultimate" | "mask" | "shield" | "jacket" | "vest" | "gloves" | "backpack">
}
export type WearableItemData = Omit<NormalWearableItemData, "slot">
export const DEFAULT_ITEM_OPT_STEP = 0.2;
export interface UltimateWearableItemData extends WearableItemData {
  slot: "ultimate"
  ultimate: string
}
export interface MaskWearableItemData extends WearableItemData {
  slot: "mask"
  base_filtering: number
}
export interface ShieldWearableItemData extends WearableItemData {
  slot: "shield"
  base_shield: number
  base_regen: number
}
export interface JacketWearableItemData extends WearableItemData {
  slot: "jacket"
  base_insulation: number
  base_heat_capacity: number
}
export interface VestWearableItemData extends WearableItemData {
  slot: "vest"
  base_armor: number
  base_dissipate: number
}
export interface GlovesWearableItemData extends WearableItemData {
  slot: "gloves"
  base_tech: number
  base_ap: number
  base_ap_regen: number
}
export interface BackpackWearableItemData extends WearableItemData {
  slot: "backpack"
  base_parry: number
  base_deflect: number
}

export interface WeaponItemData extends PassiveItemData {
  type: "weapon"
  ammo: number
  base_damage: number
  base_tech: number
  attack: AttackSet
  category: WeaponCategory
}
export enum WeaponCategory {
  "sword", "axe", "knife", "spear", "blunt",
  "bow", "pistol", "rifle", "shotgun", "throwable"
}

export interface ConsumableItemData extends BaseItemData {
  type: "consumable"
  info: {
    name: string
    lore: string
    replacers: LoreReplacer[],
    quality: ItemQuality
  }
  abilities?: Set<string>
  onUse?: (creature: Creature, db: typeof Mongoose) => Promise<AbilityUseLog>
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
    passthrough?: number
    accuracy?: number
    cutting?: number
    piercing?: number
  }
  sources: {
    type: DamageType
    from_skill: number
    flat_bonus: number
    shieldReaction?: ShieldReaction
  }[]
}

export enum ItemQuality {
  "Poor",
  "Common",
  "Uncommon",
  "Rare",
  "Enhanced",
  "Legendary",
  "Prototype"
}
export const ItemQualityEmoji = [
  "????",
  "???",
  "????",
  "????",
  "????",
  "????",
  "????",
]
export const ItemQualityColor = [
  "#754423",
  "#EEEEEE",
  "#4AE052",
  "#4AB1E0",
  "#B14AE0",
  "#F5CA31",
  "#FC392B"
]

export type ItemSlot = 
  "shield" | "jacket" | "backpack" | 
  "mask" | "vest" | "utility" |
  "gloves" | "nanites" | "ultimate"
export const SlotDescriptions: Record<ItemSlot, string> = {
  backpack: "A bag to keep your stuff in.",
  mask: "Something to protect your lungs.",
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

  const invi: InventoryItem = {
    id: data.$.id
  }

  switch (data.$.type) {
    default: return invi;
    case "wearable": {
      (invi as WearableInventoryItem).stat_module = data.$.fixed_stat_module ?? ItemStatModule.generate();
    } break;
    case "weapon":
  }

  if (data.$.modifier_module) {
    (invi as EquippableInventoryItem).modifier_modules = [];
    const entries = Array.from(data.$.modifier_module.mods.entries());
    for (var i = 0; i < data.$.modifier_module.choose; i++) {
      const [stat, chosen] = entries[diceRoll(entries.length) - 1];

      (invi as EquippableInventoryItem).modifier_modules?.push({
        stat: stat,
        type: chosen.type,
        value: lerp(Math.random(), chosen.range[0], chosen.range[1])
      })
    }
  }

  return invi;
}


interface BaseInventoryItem {
  id: string
}

export interface EquippableInventoryItem extends BaseInventoryItem {
  modifier_modules?: NamedModifier[]
}

export interface WearableInventoryItem extends EquippableInventoryItem {
  stat_module: ModuleType
}
export interface WeaponInventoryItem extends EquippableInventoryItem {

}

export type InventoryItem = WearableInventoryItem | EquippableInventoryItem | BaseInventoryItem;
