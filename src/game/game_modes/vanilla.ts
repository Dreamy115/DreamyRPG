import { GameDirective } from "../GameDirectives";
import { PassiveEffect } from "../PassiveEffects";
import { ModifierType } from "../Stats";

export default [
  new GameDirective({
    id: "decisive",
    info: {
      name: "Decisive",
      lore: "The Decisive directive requires more quick thinking, with a higher emphasis on Abilities and tactics, and a little bit of luck."
    },
    passives: new Set([
      new PassiveEffect({
        info: {
          name: "Decisive Directive",
          lore: "Passive from the Decisive Directive"
        },
        modifiers: [
          {
            type: ModifierType.MULTIPLY,
            stat: "health",
            value: 0.7
          },
          {
            type: ModifierType.MULTIPLY,
            stat: "tech",
            value: 1.2
          },
          {
            type: ModifierType.MULTIPLY,
            stat: "accuracy",
            value: 0.95
          },
          {
            type: ModifierType.MULTIPLY,
            stat: "parry",
            value: 1.125
          },
          {
            type: ModifierType.MULTIPLY,
            stat: "deflect",
            value: 1.125
          },
          {
            type: ModifierType.MULTIPLY,
            stat: "shield",
            value: 0.7,
          },
          {
            type: ModifierType.MULTIPLY,
            stat: "armor",
            value: 1.2
          },
          {
            type: ModifierType.MULTIPLY,
            stat: "dissipate",
            value: 1.2
          },
          {
            type: ModifierType.MULTIPLY,
            stat: "lethality",
            value: 1.2
          },
          {
            type: ModifierType.MULTIPLY,
            stat: "passthrough",
            value: 1.2
          }
        ]
      })
    ])
  })
]