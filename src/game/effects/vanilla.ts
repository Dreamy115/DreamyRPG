import { invLerp, lerp } from "../..";
import { ActiveEffect, DisplaySeverity, EffectType } from "../ActiveEffects";
import { DamageCause, DamageMethod, DamageType, ShieldReaction } from "../Damage";
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
          stat: "severity",
          multiplier: 1
        }
      ]
    },
    type: EffectType.Wound,
    onTick: async (creature, db, {ticks, severity}) => {
      await creature.applyDamage({
        cause: DamageCause.DoT,
        chance: 100,
        method: DamageMethod.Direct,
        useDodge: false,
        sources: [{
          type: DamageType.True,
          value: severity,
          shieldReaction: ShieldReaction.Ignore
        }]
      }, db)
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
    },
    type: EffectType.Debuff
  }),
  new ActiveEffect({
    id: "suppressed",
    consecutive_limit: 1,
    display_severity: DisplaySeverity.NONE,
    info: {
      name: "Suppressed",
      lore: "This Creature will not be able to use abilities until this expires",
      replacers: []
    },
    preload: (creature) => {
      creature.$.status.abilities = false;
    },
    type: EffectType.Debuff
  }),
  new ActiveEffect({
    id: "dazed",
    consecutive_limit: 1,
    display_severity: DisplaySeverity.NONE,
    info: {
      name: "Dazed",
      lore: "This Creature will not be able to use attacks until this expires",
      replacers: []
    },
    preload: (creature) => {
      creature.$.status.attacks = false;
    },
    type: EffectType.Debuff
  }),
  new ActiveEffect({
    id: "death",
    consecutive_limit: 1,
    display_severity: DisplaySeverity.NONE,
    info: {
      name: "Death",
      lore: "This Creature's story is over...",
      replacers: []
    },
    preload: (creature) => {
      creature.$.status.alive = false;
    },
    type: EffectType.Other
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
    async onTick(creature, db, {ticks, severity}) {
      await creature.applyDamage({
        cause: DamageCause.DoT,
        chance: 100,
        method: DamageMethod.Direct,
        sources: [{type: DamageType.True, value: Math.max(1, 0.025 * creature.$.stats.health.value), shieldReaction: ShieldReaction.Ignore}],
        useDodge: false,
        from: "Hypothermia",
      }, db)
    },
    type: EffectType.Wound
  }),
  new ActiveEffect({
    id: "filter_fail",
    consecutive_limit: 1,
    display_severity: DisplaySeverity.ROMAN,
    info: {
      name: "Failing Filters",
      lore: "Your air filter is not enough. Chemical Burns: {0}% Health True Damage every tick.",
      replacers: [
        {
          multiplier: 3,
          stat: "severity"
        }
      ]
    },
    async onTick(creature, db, {ticks, severity}) {
      await creature.applyDamage({
        cause: DamageCause.DoT,
        chance: 100,
        method: DamageMethod.Direct,
        penetration: {cutting: 999},
        sources: [{type: DamageType.True, value: Math.max(1, severity * 0.03 * creature.$.stats.health.value), shieldReaction: ShieldReaction.Ignore}],
        useDodge: false,
        from: "Chemical Burns",
      }, db)
    },
    type: EffectType.Wound
  }),
  new ActiveEffect({
    id: "intensity-stressed",
    consecutive_limit: 1,
    display_severity: DisplaySeverity.ARABIC,
    info: {
      name: "Stressed",
      lore: "This Creature is stressed and isn't at their peak performance. Decreased **INT**, **PER**, and **CHA**",
      replacers: []
    },
    conflicts_with: new Set(["intensity-optimal", "intensity-bored", "intensity-nothing"]),
    preload: (creature, {severity}) => {
      let lerped = invLerp(severity, 75, 100);

      creature.$.attributes.INT.modifiers.push({
        type: ModifierType.ADD,
        value: -lerp(lerped, 3, 1)
      });
      creature.$.attributes.PER.modifiers.push({
        type: ModifierType.MULTIPLY,
        value: -lerp(lerped, 4, 1)
      });
      creature.$.attributes.CHA.modifiers.push({
        type: ModifierType.ADD,
        value: -lerp(lerped, 6, 1)
      });
    },
    type: EffectType.Debuff
  }),
  new ActiveEffect({
    id: "intensity-optimal",
    consecutive_limit: 1,
    display_severity: DisplaySeverity.ARABIC,
    info: {
      name: "Adrenaline",
      lore: "This Creature is experiencing optimal intensity. Increased **DEX**, **PER**, and **Initiative**",
      replacers: []
    },
    conflicts_with: new Set(["intensity-bored", "intensity-stressed", "intensity-nothing"]),
    preload: (creature, {severity}) => {
      creature.$.attributes.DEX.modifiers.push({
        type: ModifierType.ADD,
        value: 1
      });
      creature.$.attributes.PER.modifiers.push({
        type: ModifierType.ADD,
        value: 1
      });
      creature.$.stats.initiative.modifiers.push({
        type: ModifierType.MULTIPLY,
        value: 1.2
      });
    },
    type: EffectType.Buff
  }),
  new ActiveEffect({
    id: "intensity-calm",
    consecutive_limit: 1,
    display_severity: DisplaySeverity.ARABIC,
    info: {
      name: "Calm",
      lore: "This Creature is calm. Reduced **Dodge**, and **Initiative**. **+1 MND**",
      replacers: []
    },
    conflicts_with: new Set(["intensity-optimal", "intensity-stressed", "intensity-nothing"]),
    preload: (creature, {severity}) => {
      let lerped = invLerp(severity, 0, 15);

      creature.$.attributes.MND.modifiers.push({
        type: ModifierType.ADD,
        value: -1
      });
      creature.$.stats.parry.modifiers.push({
        type: ModifierType.MULTIPLY,
        value: lerp(lerped, 0.75, 1)
      });
      creature.$.stats.deflect.modifiers.push({
        type: ModifierType.MULTIPLY,
        value: lerp(lerped, 0.75, 1)
      });
      creature.$.stats.initiative.modifiers.push({
        type: ModifierType.ADD,
        value: lerp(lerped, -3, -1)
      });
    },
    type: EffectType.Debuff
  }),
  new ActiveEffect({
    id: "intensity-nothing",
    consecutive_limit: 1,
    display_severity: DisplaySeverity.ARABIC,
    info: {
      name: "Intensity",
      lore: "The intensity isn't currently affecting anything.",
      replacers: []
    },
    conflicts_with: new Set(["intensity-bored", "intensity-stressed", "intensity-optimal"]),
    type: EffectType.Other
  })
]