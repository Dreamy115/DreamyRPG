import { DamageMedium, DamageType } from "../Damage";
import { Item } from "../Items";
import { PassiveEffect } from "../PassiveEffects";

export default [
  new Item({
    id: "starter_shield",
    info: {
      name: "Starter Shield",
      lore: "A basic, used shield primer. Will stop a ping-pong ball thrown in your face but don't expect too much."
    },
    type: "clothing",
    subtype: "utility",
    unique: ["shield"],
    passives: [
      new PassiveEffect({
        info: {
          name: "Shield Primer",
          lore: `Base Shield **20 SP** **4**/t`
        },
        preload: function (creature) {
          creature.$.stats.shield.base += 20;
          creature.$.stats.shield_regen.base += 4;
        }
      })
    ]
  }),
  new Item({
    id: "starter_knife",
    type: "weapon",
    info: {
      name: "Kitchen Knife",
      lore: "You found this laying around! You can make use of it!"
    },
    attack: {
      weak: [
        {
          type: DamageMedium.Melee,
          modifiers: {
            accuracy: -5,
            defiltering: 0,
            lethality: 0
          },
          sources: [
            {
              flat_bonus: 1,
              from_skill: 0.6,
              type: DamageType.Physical
            }
          ]
        }
      ],
      normal: [
        {
          type: DamageMedium.Melee,
          modifiers: {
            accuracy: 0,
            defiltering: 0,
            lethality: 0
          },
          sources: [
            {
              flat_bonus: 3,
              from_skill: 0.7,
              type: DamageType.Physical
            }
          ]
        }
      ],
      crit: [
        {
          type: DamageMedium.Melee,
          modifiers: {
            accuracy: 10,
            defiltering: 0,
            lethality: 2
          },
          sources: [
            {
              flat_bonus: 6,
              from_skill: 0.75,
              type: DamageType.Physical
            }
          ]
        }
      ]
    }
  }),
  new Item({
    id: "starter_revolver",
    type: "weapon",
    info: {
      name: "R340 Revolver",
      lore: "Nothing special. This outdated revolver still uses .45 ACP.\n**Revolver Perk** - Damage group count increases with attack stability!"
    },
    attack: {
      weak: [
        {
          type: DamageMedium.Ranged,
          modifiers: {
            accuracy: -5,
            defiltering: 0,
            lethality: 1
          },
          sources: [{
            flat_bonus: 1,
            from_skill: 0.3,
            type: DamageType.Physical
          }]
        }
      ], 
      normal: [
        {
          type: DamageMedium.Ranged,
          modifiers: {
            accuracy: -5,
            defiltering: 0,
            lethality: 2
          },
          sources: [{
            flat_bonus: 1,
            from_skill: 0.3,
            type: DamageType.Physical
          }]
        },
        {
          type: DamageMedium.Ranged,
          modifiers: {
            accuracy: -5,
            defiltering: 0,
            lethality: 2
          },
          sources: [{
            flat_bonus: 1,
            from_skill: 0.3,
            type: DamageType.Physical
          }]
        }
      ],
      crit: [
        {
          type: DamageMedium.Ranged,
          modifiers: {
            accuracy: -5,
            defiltering: 0,
            lethality: 3
          },
          sources: [{
            flat_bonus: 1,
            from_skill: 0.3,
            type: DamageType.Physical
          }]
        },
        {
          type: DamageMedium.Ranged,
          modifiers: {
            accuracy: -5,
            defiltering: 0,
            lethality: 3
          },
          sources: [{
            flat_bonus: 1,
            from_skill: 0.3,
            type: DamageType.Physical
          }]
        },
        {
          type: DamageMedium.Ranged,
          modifiers: {
            accuracy: -5,
            defiltering: 0,
            lethality: 3
          },
          sources: [{
            flat_bonus: 1,
            from_skill: 0.3,
            type: DamageType.Physical
          }]
        }
      ]
    }
  })
]