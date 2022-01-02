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
      lore: "Receive {0} **Direct True Damage** on **Health**",
      replacers: [
        {
          type: "severity",
          multiply: 1
        }
      ]
    },
    onTick: (creature, {ticks, severity}) => {
      creature.applyDamage({
        cause: DamageCause.DoT,
        chance: 100,
        medium: DamageMedium.Direct,
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
      lore: "This Creature will not be able to regenerate shields until this expires",
      replacers: []
    },
    preload: (creature) => {
      creature.$.stats.shield_regen.modifiers.push({
        type: ModifierType.CAP_MAX,
        value: 0
      })
    }
  })
]