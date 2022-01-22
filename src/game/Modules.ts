import { diceRoll } from "./Creature";
import { NamedModifier } from "./PassiveEffects";
import { ModifierType } from "./Stats";

export enum ModuleType {
  "Offensive", "Defensive", "Technical"
}

export class ItemModule {
  type: ModuleType
  value: number

  constructor(type: ItemModule["type"], value: ItemModule["value"]) {
    this.type = type;
    this.value = value;
  }

  static generate(): ItemModule {
    // @ts-expect-error
    const type: ModuleType = ModuleType[ModuleType[diceRoll(Object.values(ModuleType).filter(x => !isNaN(Number(x))).length) - 1]];
  
    return new ItemModule(
      type,
      (Math.random() * (ItemModule.MAX_GEN_VALUE - ItemModule.MIN_GEN_VALUE)) + ItemModule.MIN_GEN_VALUE
    )
  }

  get modifiers(): NamedModifier[] {
    const mods: NamedModifier[] = [];

    for (const {stat, type, value} of ItemModule.MODIFIERS.get(this.type) ?? []) {
      mods.push({
        stat,
        type,
        value: value * this.value
      })
    }

    return mods;
  }
  static readonly MIN_GEN_VALUE = 0.2;
  static readonly MAX_GEN_VALUE = 1;


  static readonly MODIFIERS = new Map<ModuleType, NamedModifier[]>([
    [
      ModuleType.Offensive,
      [
        {
          stat: "damage",
          type: ModifierType.ADD_PERCENT,
          value: 0.125
        }
      ]
    ],
    [
      ModuleType.Defensive,
      [
        {
          stat: "shield",
          type: ModifierType.ADD_PERCENT,
          value: 0.05
        },
        {
          stat: "armor",
          type: ModifierType.ADD_PERCENT,
          value: 0.1
        },
        {
          stat: "filter",
          type: ModifierType.ADD_PERCENT,
          value: 0.1
        }
      ]
    ],
    [
      ModuleType.Technical,
      [
        {
          stat: "tech",
          type: ModifierType.ADD_PERCENT,
          value: 0.15
        }
      ]
    ]
  ])
}