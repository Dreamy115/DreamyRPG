import { CreatureAbility } from "../CreatureAbilities";
import { DamageCause, DamageMedium, DamageType, ShieldReaction } from "../Damage";

export default [
  new CreatureAbility({
    id: "debug_ability",
    info: {
      name: "Debug Ability",
      lore: "Apply **{0}** as **Direct Energy Damage** to target",
      lore_replacers: [
        {
          multiplier: 0.5,
          bonus: 2,
          stat: "tech"
        }
      ]
    },
    min_targets: 1,
    haste: 2,
    cost: 6,
    use: async function (caster, targets) {
      const log = targets[0].applyDamage({
        cause: DamageCause.Ability,
        chance: 100,
        medium: DamageMedium.Direct,
        penetration: {
          defiltering: 0,
          lethality: 0
        },
        shieldReaction: ShieldReaction.Normal,
        useDodge: true,
        attacker: caster,
        victim: targets[0],
        sources: [{
          type: DamageType.Energy,
          value: (0.5 * caster.$.stats.tech.value) + 2
        }]
      });
      return {
        text: log.successful
        ? `**${caster.displayName}** dealt **${log.total_damage_taken}** damage to **${targets[0].displayName}** with ***Debug Ability***!`
        : `**${caster.displayName}** failed ***Debug Ability*** on **${targets[0].displayName}**!`,
        damageLogs: [log]
      }
    }
  })
]