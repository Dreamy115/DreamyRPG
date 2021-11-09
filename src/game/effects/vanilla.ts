import { ActiveEffect } from "../ActiveEffects";
import { DamageCause, DamageMedium, DamageType, ShieldReaction } from "../Damage";

export default [
  new ActiveEffect({
    id: "bleeding",
    consecutive_limit: 5,
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
  })
]