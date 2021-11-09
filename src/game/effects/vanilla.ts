import { ActiveEffect, DisplaySeverity } from "../ActiveEffects";
import Creature from "../Creature";
import { DamageCause, DamageMedium, DamageType, ShieldReaction } from "../Damage";
import { ModifierType } from "../Stats";

export default [
  new ActiveEffect({
    id: "bleeding",
    consecutive_limit: 5,
    display_severity: DisplaySeverity.ROMAN,
    info: {
      name: "Bleeding",
      lore: "Receive **1 Direct True Damage** on **Health** for each point of Severity until expired"
    },
    onTick: (creature, {ticks, severity}) => {
      creature.applyDamage({
        cause: DamageCause.DoT,
        chance: 100,
        medium: DamageMedium.Direct,
        penetration: {
          defiltering: 0,
          lethality: 0
        },
        shieldReaction: ShieldReaction.Ignore,
        useDodge: false,
        sources: [{
          type: DamageType.True,
          value: severity
        }]
      })
    }
  }),
  new ActiveEffect({
    id: "emp",
    consecutive_limit: 1,
    display_severity: DisplaySeverity.NONE,
    info: {
      name: "EMP",
      lore: "This Creature will not be able to regenerate shields until this expires"
    },
    preload: (creature) => {
      creature.$.stats.shield_regen.modifiers.push({
        type: ModifierType.CAP_MAX,
        value: 0
      })
    },
    onDelete: (creature) => {
      const index = creature.$.stats.shield_regen.modifiers.findIndex((v) => v.type === ModifierType.CAP_MAX && v.value === 0);
      if (index != -1)
        creature.$.stats.shield_regen.modifiers.splice(index,1);
    },
    onTick: (creature, {ticks}) => {
      if (ticks <= 0) {
        const index = creature.$.stats.shield_regen.modifiers.findIndex((v) => v.type === ModifierType.CAP_MAX && v.value === 0);
        if (index != -1)
          creature.$.stats.shield_regen.modifiers.splice(index,1);
      }
    }
  })
]