import { diceRoll } from "./Creature";
import { NamedModifier } from "./PassiveEffects";
import { Modifier, ModifierType } from "./Stats";

export enum ModuleType {
  "Offensive", "Shielding", "Technical", "Reducing"
}

export class ItemStatModule {
  type: ModuleType
  value: number

  constructor(type: ItemStatModule["type"], value: ItemStatModule["value"]) {
    this.type = type;
    this.value = value;
  }

  static generate(): ItemStatModule {
    const types = Object.values(ModuleType).filter(x => !isNaN(Number(x))) as ModuleType[]
    const type = ModuleType[ModuleType[types[diceRoll(types.length) - 1]] as unknown as number] as unknown as ModuleType;
  
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
      ModuleType.Shielding,
      [
        {
          stat: "shield",
          type: ModifierType.ADD_PERCENT,
          value: 0.07
        },
        {
          stat: "plating",
          type: ModifierType.ADD_PERCENT,
          value: 0.05
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
    ],
    [
      ModuleType.Reducing,
      [
        {
          stat: "armor",
          type: ModifierType.ADD_PERCENT,
          value: 0.1
        },
        {
          stat: "dissipate",
          type: ModifierType.ADD_PERCENT,
          value: 0.1
        },
        {
          stat: "plating_effectiveness",
          type: ModifierType.ADD_PERCENT,
          value: 0.07
        }
      ]
    ]
  ])
}


export interface ItemModifierModuleInfo extends Omit<Modifier, "value"> {
  range: [number, number]
}