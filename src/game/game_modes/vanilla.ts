import Creature from "../Creature";
import { GameDirective } from "../GameDirectives";
import { PassiveEffect } from "../PassiveEffects";
import { ModifierType } from "../Stats";

export default [
  new GameDirective({
    id: "vanilla",
    info: {
      name: "Vanilla Logic",
      lore: "This Directive adds default logic such as Death at max injuries. Do not disable unless you know what you're doing!"
    },
    passives: new Set([
      new PassiveEffect({
        info: {
          name: "Vanilla Logic",
          lore: "Bundled DreamyRPG vanilla logic is acting upon this Creature"
        },
        hidden: true,
        beforeTick: (creature) => {
          if (creature.$.vitals.heat <= 0) {
            creature.applyActiveEffect({
              id: "hypothermia",
              ticks: 1,
              severity: 1
            }, true)
          }
      
          if (creature.$.stats.filtering.value < (creature.location?.$.rads ?? 0)) {
            creature.applyActiveEffect({
              id: "filter_fail",
              ticks: 1,
              severity: (creature.location?.$.rads ?? 0) - creature.$.stats.filtering.value
            }, true)
          }

          if (creature.alive) {
            if (creature.$.vitals.injuries >= creature.$.stats.health.value) {
              creature.applyActiveEffect({
                id: "death",
                severity: 1,
                ticks: -1
              }, true)
            }
          } else {
            creature.$.vitals.health = 0;
            creature.$.vitals.stress = 0;
          }

          const stress_diff = creature.$.stats.mental_strength.value - creature.$.vitals.stress;

          if (stress_diff <= 0) {
            creature.applyActiveEffect({
              id: "stress",
              severity: 3,
              ticks: 1
            }, true)
          } else if (stress_diff <= 35) {
            creature.applyActiveEffect({
              id: "stress",
              severity: 2,
              ticks: 1
            }, true)
          } else if (stress_diff <= 50) {
            // TODO implement mental breaks
            creature.applyActiveEffect({
              id: "stress",
              severity: 1,
              ticks: 1
            }, true)
          }
        }
      })
    ])
  }),
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