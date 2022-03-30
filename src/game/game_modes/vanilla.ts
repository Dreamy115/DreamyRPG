import { clamp, invLerp, lerp } from "../..";
import Creature from "../Creature";
import { DamageCause, DamageMethod, DamageType, ShieldReaction } from "../Damage";
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
        afterDamageTaken: (creature, log) => {
          if (log.final.attacker === "Low-Health Stress") return;

          const health = 100 * (creature.$.vitals.health / creature.$.stats.health.value);
          if (health < 50) {
            const lerped = invLerp(50 - health, 0, 50);
            const stress = lerp(lerped, 1, 20);
            const mult_of_health = log.total_health_damage / creature.$.stats.health.value;

            creature.applyDamage({
              cause: DamageCause.Other,
              chance: 100,
              method: DamageMethod.Direct,
              useDodge: false,
              attacker: "Low-Health Stress",
              sources: [{
                type: DamageType.Stress,
                value: clamp(stress * lerp(mult_of_health, 0.2, 1.5), 1, 60),
                shieldReaction: ShieldReaction.Normal 
              }]
            });
          }
        },
        beforeTick: (creature) => {
          creature.$.vitals.intensity--;

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
            creature.$.vitals.intensity = 0;
          }

          const intensity_percent = Math.round(100 * Math.max(creature.$.vitals.intensity, 0) / creature.$.stats.mental_strength.value);

          /*if (intensity_percent >= 100) {

          } else */if (intensity_percent >= 75) {
            creature.applyActiveEffect({
              id: "intensity-stressed",
              severity: intensity_percent,
              ticks: -1
            }, true);
          } else if (intensity_percent < 75 && intensity_percent > 65) {
            creature.applyActiveEffect({
              id: "intensity-nothing",
              severity: intensity_percent,
              ticks: -1
            }, true);
          } else if (intensity_percent <= 65 && intensity_percent >= 35) {
            creature.applyActiveEffect({
              id: "intensity-optimal",
              severity: intensity_percent,
              ticks: -1
            }, true);
          } else if (intensity_percent < 35 && intensity_percent > 15) {
            creature.applyActiveEffect({
              id: "intensity-nothing",
              severity: intensity_percent,
              ticks: -1
            }, true);
          } else if (intensity_percent <= 15) {
            creature.applyActiveEffect({
              id: "intensity-bored",
              severity: intensity_percent,
              ticks: -1
            }, true);
          }
        },
        afterTick: (creature) => {
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