import { diceRoll } from "./Creature";
import { NamedModifier } from "./PassiveEffects";
import { Modifier, ModifierType } from "./Stats";

export enum ModuleType {
  "Offensive", "Defensive", "Technical"
}

export class ItemStatModule {
  type: ModuleType
  value: number

  constructor(type: ItemStatModule["type"], value: ItemStatModule["value"]) {
    this.type = type;
    this.value = value;
  }

  static generate(): ItemStatModule {
    // @ts-expect-error
    const type: ModuleType = ModuleType[ModuleType[diceRoll(Object.values(ModuleType).filter(x => !isNaN(Number(x))).length) - 1]];
  
    return new ItemStatModule(
      type,
      (Math.random() * (ItemStatModule.MAX_GEN_VALUE - ItemStatModule.MIN_GEN_VALUE)) + ItemStatModule.MIN_GEN_VALUE
    )
  }

  get modifiers(): NamedModifier[] {
    const mods: NamedModifier[] = [];

    for (const {stat, type, value} of ItemStatModule.MODIFIERS.get(this.type) ?? []) {
      mods.push({
        stat,
        type,
        value: value * this.value
      })
    }

    return mods;
  }
  static readonly MIN_GEN_VALUE = 0.2;
  static readonly MAX_GEN_VALUE = 0.8;


  static readonly MODIFIERS = new Map<ModuleType, NamedModifier[]>([
    [
      ModuleType.Offensive,
      [
        {
          stat: "damage",
          type: ModifierType.ADD_PERCENT,
          value: 0.2
        }
      ]
    ],
    [
      ModuleType.Defensive,
      [
        {
          stat: "shield",
          type: ModifierType.ADD_PERCENT,
          value: 0.1
        },
        {
          stat: "armor",
          type: ModifierType.ADD_PERCENT,
          value: 0.15
        },
        {
          stat: "dissipate",
          type: ModifierType.ADD_PERCENT,
          value: 0.15
        }
      ]
    ],
    [
      ModuleType.Technical,
      [
        {
          stat: "tech",
          type: ModifierType.ADD_PERCENT,
          value: 0.25
        }
      ]
    ]
  ])
}


export interface ItemModifierModuleInfo extends Omit<Modifier, "value"> {
  range: [number, number]
}