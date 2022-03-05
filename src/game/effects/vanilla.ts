import { ActiveEffect, DisplaySeverity } from "../ActiveEffects";
import Creature from "../Creature";
import { DamageCause, DamageMethod, DamageType, ShieldReaction } from "../Damage";
import { PassiveEffect } from "../PassiveEffects";
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
        method: DamageMethod.Direct,
        useDodge: false,
        sources: [{
          type: DamageType.True,
          value: severity,
          shieldReaction: ShieldReaction.Ignore
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
  }),
  new ActiveEffect({
    id: "suppressed",
    consecutive_limit: 1,
    display_severity: DisplaySeverity.NONE,
    info: {
      name: "Suppressed",
      lore: "This Creature will not be able to use abilities until this expires",
      replacers: []
    }
  }),
  new ActiveEffect({
    id: "dazed",
    consecutive_limit: 1,
    display_severity: DisplaySeverity.NONE,
    info: {
      name: "Dazed",
      lore: "This Creature will not be able to use attacks until this expires",
      replacers: []
    }
  }),
  new ActiveEffect({
    id: "death",
    consecutive_limit: 1,
    display_severity: DisplaySeverity.NONE,
    info: {
      name: "Death",
      lore: "This Creature's story is over...",
      replacers: []
    }
  }),
  new ActiveEffect({
    id: "hypothermia",
    consecutive_limit: 1,
    display_severity: DisplaySeverity.NONE,
    info: {
      name: "Hypothermia",
      lore: "This Creature is freezing! **2.5%** Health True Damage every tick. **-3** DEX, **-3** PER, **-3** STR",
      replacers: []
    },
    preload(creature) {
      creature.$.attributes.DEX.modifiers.push({
        type: ModifierType.ADD,
        value: -3
      });
      creature.$.attributes.PER.modifiers.push({
        type: ModifierType.ADD,
        value: -3
      });
      creature.$.attributes.STR.modifiers.push({
        type: ModifierType.ADD,
        value: -3
      });
    },
    onTick(creature, {ticks, severity}) {
      creature.applyDamage({
        cause: DamageCause.DoT,
        chance: 100,
        method: DamageMethod.Direct,
        sources: [{type: DamageType.True, value: Math.max(1, 0.025 * creature.$.stats.health.value), shieldReaction: ShieldReaction.Ignore}],
        useDodge: false,
        attacker: "Hypothermia",
      })
    }
  }),
  new ActiveEffect({
    id: "filter_fail",
    consecutive_limit: 1,
    display_severity: DisplaySeverity.ROMAN,
    info: {
      name: "Failing Filters",
      lore: "Your air filter is not enough. Chemical Burns: {0} Health True Damage every tick.",
      replacers: [
        {
          multiply: 0.03,
          type: "severity"
        }
      ]
    },
    onTick(creature, {ticks, severity}) {
      creature.applyDamage({
        cause: DamageCause.DoT,
        chance: 100,
        method: DamageMethod.Direct,
        sources: [{type: DamageType.True, value: Math.max(1, severity * 0.03 * creature.$.stats.health.value), shieldReaction: ShieldReaction.Ignore}],
        useDodge: false,
        attacker: "Chemical Burns",
      })
    }
  })
]