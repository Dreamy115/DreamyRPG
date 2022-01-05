import { CraftingMaterials } from "../Crafting";
import { HealType } from "../Creature";
import { DamageMethod, DamageType } from "../Damage";
import { Item, ItemQuality } from "../Items";
import { PassiveEffect } from "../PassiveEffects";

export default [
  new Item({
    id: "starter_shield",
    info: {
      name: "Starter Shield",
      lore: "A basic, used shield primer. Will stop a ping-pong ball thrown in your face but don't expect too much.",
      quality: ItemQuality.Common
    },
    type: "wearable",
    subtype: "utility",
    unique: new Set(["shield"]),
    passives: new Set([
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
    ])
  }),
  new Item({
    id: "starter_knife",
    type: "weapon",
    info: {
      name: "Kitchen Knife",
      lore: "You found this laying around! You can make use of it!",
      quality: ItemQuality.Common
    },
    attack: {
      type: DamageMethod.Melee,
      weak: [
        {
          modifiers: {
            accuracy: -5,
            defiltering: 0,
            lethality: 0
          },
          sources: [
            {
              flat_bonus: 12,
              from_skill: 0.1,
              type: DamageType.Physical
            }
          ]
        }
      ],
      normal: [
        {
          modifiers: {
            accuracy: 0,
            defiltering: 0,
            lethality: 0
          },
          sources: [
            {
              flat_bonus: 22,
              from_skill: 0.1,
              type: DamageType.Physical
            }
          ]
        }
      ],
      crit: [
        {
          modifiers: {
            accuracy: 10,
            defiltering: 0,
            lethality: 2
          },
          sources: [
            {
              flat_bonus: 32,
              from_skill: 0.1,
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
      lore: "Nothing special. This outdated revolver still uses .45 ACP.\n**Revolver Perk** - Damage group count increases with attack stability!",
      quality: ItemQuality.Common
    },
    attack: {
      type: DamageMethod.Ranged,
      weak: [
        { 
          modifiers: {
            accuracy: -5,
            defiltering: 0,
            lethality: 1
          },
          sources: [{
            flat_bonus: 11,
            from_skill: 0.1,
            type: DamageType.Physical
          }]
        }
      ], 
      normal: [
        {
          modifiers: {
            accuracy: -5,
            defiltering: 0,
            lethality: 2
          },
          sources: [{
            flat_bonus: 11,
            from_skill: 0.05,
            type: DamageType.Physical
          }]
        },
        {
          modifiers: {
            accuracy: -5,
            defiltering: 0,
            lethality: 2
          },
          sources: [{
            flat_bonus: 11,
            from_skill: 0.05,
            type: DamageType.Physical
          }]
        }
      ],
      crit: [
        {
          modifiers: {
            accuracy: -5,
            defiltering: 0,
            lethality: 3
          },
          sources: [{
            flat_bonus: 11,
            from_skill: 0.03,
            type: DamageType.Physical
          }]
        },
        {
          modifiers: {
            accuracy: -5,
            defiltering: 0,
            lethality: 3
          },
          sources: [{
            flat_bonus: 11,
            from_skill: 0.03,
            type: DamageType.Physical
          }]
        },
        {
          modifiers: {
            accuracy: -5,
            defiltering: 0,
            lethality: 3
          },
          sources: [{
            flat_bonus: 11,
            from_skill: 0.03,
            type: DamageType.Physical
          }]
        }
      ]
    }
  }),
  new Item({
    id: "rough_bandage",
    type: "consumable",
    info: {
      name: "Makeshift Bandage",
      lore: "A bandage to stop **Bleeding** and heal **{0}** Injuries",
      quality: ItemQuality.Common,
      replacers: [
        {
          stat: "tech",
          multiplier: 0.05,
          bonus: 10
        }
      ]
    },
    onUse: async (creature) => {
      creature.clearActiveEffect("bleeding", "delete");

      const amount = 10 + (creature.$.stats.tech.value * 0.05);

      creature.heal(amount, HealType.Injuries);
      creature.heal(amount, HealType.Health);

      return {
        text: `**${creature.displayName}** used a Bandage; healed **${amount}** Injuries and stopped bleeding, if any.`
      }
    },
    scrap: {
      materials: new CraftingMaterials({
        metal: 0,
        fabric: 8,
        biomaterial: 0,
        cells: 0,
        plastic: 0
      })
    }
  }),
  new Item({
    id: "mediocre_bandage",
    type: "consumable",
    info: {
      name: "Makeshift Bandage",
      lore: "A bandage to stop **Bleeding** and heal **{0}** Injuries",
      quality: ItemQuality.Uncommon,
      replacers: [
        {
          stat: "tech",
          multiplier: 0.075,
          bonus: 15
        }
      ]
    },
    onUse: async (creature) => {
      creature.clearActiveEffect("bleeding", "delete");

      const amount = 15 + (creature.$.stats.tech.value * 0.075);

      creature.heal(amount, HealType.Injuries);
      creature.heal(amount, HealType.Health);

      return {
        text: `**${creature.displayName}** used a Bandage; healed **${amount}** Injuries and stopped bleeding, if any.`
      }
    },
    scrap: {
      materials: new CraftingMaterials({
        metal: 0,
        fabric: 10,
        biomaterial: 0,
        cells: 0,
        plastic: 0
      })
    }
  })
]