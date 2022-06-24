import { clamp, invLerp, lerp } from "../..";
import { DamageCause, DamageMethod, DamageType, HealType, ShieldReaction } from "../Damage";
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
        hide: () => true,
        preload: (creature) => {
          creature.$.stats.attack_cost.base += 7;
          creature.$.stats.accuracy.base -= 10;
          creature.$.stats.action_points.base += 20;
          creature.$.stats.ap_regen.base += 12;
          creature.$.stats.parry.base += 12;
          creature.$.stats.deflect.base += 8;
          creature.$.stats.tenacity.base += 32;
          creature.$.stats.stress_resistance.base += 20;

          if (creature.active_effects.findIndex((v) => v.id === "vanilla:death") !== -1) creature.$.status.alive = false;

          if (creature.$.vitals.health <= 0) creature.$.status.up = false;
          if (!creature.alive) creature.$.status.up = false;

          if (creature.active_effects.findIndex((v) => v.id === "vanilla:suppressed") !== -1) creature.$.status.abilities = false;
          if (creature.active_effects.findIndex((v) => v.id === "vanilla:dazed") !== -1) creature.$.status.attacks = false;

          creature.$.stats.vamp.modifiers.push({
            type: ModifierType.CAP_MAX,
            value: 80
          });
          creature.$.stats.siphon.modifiers.push({
            type: ModifierType.CAP_MAX,
            value: 80
          });
        },
        afterDamageTaken: async (creature, db, log) => {
          if (log.final.from === "Low-Health Stress" || log.total_damage_taken === 0) return;

          const health = 100 * (creature.$.vitals.health / creature.$.stats.health.value);
          if (health < 50) {
            const lerped = invLerp(50 - health, 0, 50);
            const stress = lerp(lerped, 1, 20);
            const mult_of_health = log.total_health_damage / creature.$.stats.health.value;

            await creature.applyDamage({
              cause: DamageCause.Other,
              chance: 100,
              method: DamageMethod.Direct,
              useDodge: false,
              from: "Low-Health Stress",
              sources: [{
                type: DamageType.Stress,
                value: Math.round(clamp(stress * lerp(mult_of_health, 0.2, 1.5), 1, 60))
              }]
            }, db);
          }
        },
        beforeTick: async (creature, db) => {
          creature.$.vitals.intensity--;

          if (creature.alive) {
            if (creature.$.vitals.injuries >= creature.$.stats.health.value) {
              await creature.applyActiveEffect({
                id: "vanilla:death",
                severity: 1,
                ticks: -1
              }, db, true)
            }
          } else {
            creature.$.vitals.health = 0;
            creature.$.vitals.intensity = 0;
          }

          const intensity_percent = Math.round(100 * Math.max(creature.$.vitals.intensity, 0) / creature.$.stats.mental_strength.value);

          /*if (intensity_percent >= 100) {

          } else */if (intensity_percent >= 75) {
            await creature.applyActiveEffect({
              id: "vanilla:intensity-stressed",
              severity: intensity_percent,
              ticks: -1
            }, db, true);
          } else if (intensity_percent < 75 && intensity_percent > 65) {
            await creature.applyActiveEffect({
              id: "vanilla:intensity-nothing",
              severity: intensity_percent,
              ticks: -1
            }, db, true);
          } else if (intensity_percent <= 65 && intensity_percent >= 35) {
            await creature.applyActiveEffect({
              id: "vanilla:intensity-optimal",
              severity: intensity_percent,
              ticks: -1
            }, db, true);
          } else if (intensity_percent < 35 && intensity_percent > 15) {
            await creature.applyActiveEffect({
              id: "vanilla:intensity-nothing",
              severity: intensity_percent,
              ticks: -1
            }, db, true);
          } else if (intensity_percent <= 15) {
            await creature.applyActiveEffect({
              id: "vanilla:intensity-calm",
              severity: intensity_percent,
              ticks: -1
            }, db, true);
          }
        },
        afterTick: async (creature, db) => {
          if (creature.alive) {
            creature.$.vitals.shield += creature.$.stats.shield_regen.value;
            creature.$.vitals.action_points += creature.$.stats.ap_regen.value;
            creature.$.abilities.ammo = creature.$.stats.ammo.value;
          }
      
          if (creature.deltaHeat >= 0) {
            creature.$.vitals.heat += Math.round(Math.log2(creature.deltaHeat + 1));
          } else {
            creature.$.vitals.heat += Math.round(-Math.log2(-creature.deltaHeat + 1));
          }
      
          creature.vitalsIntegrity();

          if (creature.$.vitals.heat <= 0) {
            await creature.applyActiveEffect({
              id: "vanilla:hypothermia",
              ticks: 1,
              severity: 1
            }, db, true)
          }
      
          if (creature.$.stats.filtering.value < (creature.location?.$.rads ?? 0)) {
            await creature.applyActiveEffect({
              id: "vanilla:filter_fail",
              ticks: 1,
              severity: (creature.location?.$.rads ?? 0) - creature.$.stats.filtering.value
            }, db, true)
          }          
        },
        onFightEnter: async (creature, db) => {
          creature.$.vitals.action_points = 0;
          creature.$.abilities.hand = [];
          creature.$.abilities.stacks = 0;
          creature.reshuffleAbilityDeck();

          await creature.heal({
            sources: [{
              type: HealType.Shield, value: creature.$.stats.shield.value
            }],
            from: "Fight-Enter Regen"
          }, db);
        }
      })
    ])
  }),
  new GameDirective({
    id: "vanilla:decisive",
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