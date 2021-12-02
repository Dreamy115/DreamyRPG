import { CreatureAbility } from "../CreatureAbilities";

export default [
  new CreatureAbility({
    id: "debug_ability",
    info: {
      name: "Debug Ability",
      lore: "Apply **{0}** as **Energy Damage** to target",
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
    use: async function (caster, targets) {
      
    }
  })
]