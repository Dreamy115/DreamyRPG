import { PassiveEffect } from "../PassiveEffects";
import { ModifierType } from "../Stats";

export default [
  new PassiveEffect({
    id: "unicorn_horn",
    info: {
      name: "Unicorn Horn",
      lore: "That horn works as a great amplifier!"
    },
    modifiers: [
      {
        stat: "tech",
        type: ModifierType.MULTIPLY,
        value: 1.2
      },
      {
        stat: "filter",
        type: ModifierType.MULTIPLY,
        value: 1.15
      }
    ]
  }),
  new PassiveEffect({
    id: "blood_thirst",
    info: {
      name: "Blood Thirst",
      lore: "Lifesteal bonus"
    },
    modifiers: [
      {
        stat: "vamp",
        type: ModifierType.MULTIPLY,
        value: 1.25
      }
    ]
  }),
  new PassiveEffect({
    id: "deertek_infused",
    info: {
      name: "Deertek Infused",
      lore: "Various bloodstream enhancements brought to you from the other land"
    },
    modifiers: [
      {
        stat: "tech",
        type: ModifierType.MULTIPLY,
        value: 1.2
      },
      {
        stat: "siphon",
        type: ModifierType.ADD,
        value: 10
      },
      {
        stat: "siphon",
        type: ModifierType.MULTIPLY,
        value: 1.25
      },
      {
        stat: "mana_regen",
        type: ModifierType.MULTIPLY,
        value: 1.15
      }
    ]
  })
]