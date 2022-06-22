import { diceRoll } from "./Creature";
import { ItemQuality } from "./Items";
import { NamedModifier } from "./PassiveEffects";
import { Modifier, ModifierType } from "./Stats";

export enum ModuleType {
  "Offensive", "Defensive", "Technical", "Accelerating"
}
export const ModuleTypeEmoji: Record<ModuleType, string> = {
  "0": "♦️",
  "1": "♥️", 
  "2": "♠️",
  "3": "♣️"
}

export abstract class ItemStatModule {
  static generate(): ModuleType {
    return Number(ModuleType[ModuleType[diceRoll(Object.values(ModuleType).filter(x => !isNaN(Number(x))).length) - 1] as unknown as ModuleType])
  }

  static getModifiers(module: ModuleType, amount: number = 1): NamedModifier[] {
    const mods: NamedModifier[] = [];

    for (const {stat, type, value} of ItemStatModule.MODIFIERS.get(module) ?? []) {
      mods.push({
        stat,
        type,
        value: value * amount
      })
    }

    return mods;
  }
  static readonly MIN_GEN_VALUE = 0.25;
  static readonly MAX_GEN_VALUE = 0.85;


  static readonly MODIFIERS = new Map<ModuleType, NamedModifier[]>([
    [
      ModuleType.Offensive,
      [
        {
          stat: "damage",
          type: ModifierType.ADD_PERCENT,
          value: 0.15
        },
        {
          stat: "accuracy",
          type: ModifierType.ADD_PERCENT,
          value: 0.02
        }
      ]
    ],
    [
      ModuleType.Defensive,
      [
        {
          stat: "armor",
          type: ModifierType.ADD_PERCENT,
          value: 0.06
        },
        {
          stat: "dissipate",
          type: ModifierType.ADD_PERCENT,
          value: 0.06
        }
      ]
    ],
    [
      ModuleType.Technical,
      [
        {
          stat: "tech",
          type: ModifierType.ADD_PERCENT,
          value: 0.2
        },
        {
          stat: "ap_regen",
          type: ModifierType.ADD,
          value: 1
        },
      ]
    ],
    [
      ModuleType.Accelerating,
      [
        {
          stat: "parry",
          type: ModifierType.ADD_PERCENT,
          value: 0.125
        },
        {
          stat: "deflect",
          type: ModifierType.ADD_PERCENT,
          value: 0.125
        },
        {
          stat: "initiative",
          type: ModifierType.ADD,
          value: 1
        }
      ]
    ]
  ])
}


export interface ItemModifierModuleInfo extends Omit<Modifier, "value"> {
  range: [number, number]
}