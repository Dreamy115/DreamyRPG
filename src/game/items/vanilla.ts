import { CraftingMaterials } from "../Crafting";
import { HealType } from "../Creature";
import { DamageMethod, DamageType } from "../Damage";
import { Item, ItemQuality, WeaponCategory } from "../Items";
import { PassiveEffect } from "../PassiveEffects";

export default [
  new Item({
    id: "example_shield",
    info: {
      name: "Basic Shield",
      lore: "A basic, used shield primer. Will stop a ping-pong ball thrown in your face but don't expect too much.",
      quality: ItemQuality.Common
    },
    type: "wearable",
    slot: "shield",
    base_shield: 16,
    base_regen: 4
  }),
  new Item({
    id: "example_mask",
    info: {
      name: "Basic Mask",
      lore: "It's capable of filtering out bigger particles. That's what the point of the mask is.",
      quality: ItemQuality.Common
    },
    type: "wearable",
    slot: "mask",
    base_filtering: 1
  }),
  new Item({
    id: "example_jacket",
    info: {
      name: "Rag Jacket",
      lore: "Something to put over yourself to stop the wind.",
      quality: ItemQuality.Common
    },
    type: "wearable",
    slot: "jacket",
    base_heat_capacity: 0,
    base_insulation: -15
  }),
  new Item({
    id: "example_vest",
    info: {
      name: "Scrap Vest",
      lore: "A bunch of scrap taped together for protection.. Eeeeh good enough?",
      quality: ItemQuality.Common
    },
    type: "wearable",
    slot: "vest",
    base_armor: 2,
    base_dissipate: 1,
  }),
  new Item({
    id: "example_backpack",
    info: {
      name: "Rag-Pack",
      lore: "Introducing the Rag-Pack, it holds things! -uh... That's everything? Where's the rest of the script? Is this thing still on?",
      quality: ItemQuality.Common
    },
    type: "wearable",
    slot: "backpack",
    base_deflect: 0,
    base_parry: 1
  }),
  new Item({
    id: "example_gloves",
    info: {
      name: "Used Bike Gloves",
      lore: "Something to put your pawsies into, not much.",
      quality: ItemQuality.Common
    },
    type: "wearable",
    slot: "gloves",
    base_mana: 0,
    base_mana_regen: 0,
    base_tech: 1,
  }),
  new Item({
    id: "example_knife",
    type: "weapon",
    info: {
      name: "Kitchen Knife",
      lore: "You found this laying around! You can make use of it!",
      quality: ItemQuality.Common
    },
    category: WeaponCategory.knife,
    base_damage: 1,
    attack: {
      type: DamageMethod.Melee,
      weak: [
        {
          modifiers: {
            accuracy: -5,
            passthrough: 0,
            lethality: 0
          },
          sources: [
            {
              flat_bonus: 0,
              from_skill: 0.6,
              type: DamageType.Physical
            }
          ]
        }
      ],
      normal: [
        {
          modifiers: {
            accuracy: 0,
            passthrough: 0,
            lethality: 0
          },
          sources: [
            {
              flat_bonus: 1,
              from_skill: 1,
              type: DamageType.Physical
            }
          ]
        }
      ],
      crit: [
        {
          modifiers: {
            accuracy: 10,
            passthrough: 0,
            lethality: 2
          },
          sources: [
            {
              flat_bonus: 4,
              from_skill: 1.5,
              type: DamageType.Physical
            }
          ]
        }
      ]
    }
  }),
  new Item({
    id: "example_pistol",
    type: "weapon",
    info: {
      name: "P258",
      lore: "It's a pistol. Hope it still works.",
      quality: ItemQuality.Common
    },
    category: WeaponCategory.pistol,
    base_damage: 1,
    attack: {
      type: DamageMethod.Ranged,
      weak: [
        {
          modifiers: {
            accuracy: -5,
            passthrough: 0,
            lethality: 0
          },
          sources: [
            {
              flat_bonus: 0,
              from_skill: 0.6,
              type: DamageType.Physical
            }
          ]
        }
      ],
      normal: [
        {
          modifiers: {
            accuracy: 0,
            passthrough: 0,
            lethality: 0
          },
          sources: [
            {
              flat_bonus: 1,
              from_skill: 1,
              type: DamageType.Physical
            }
          ]
        }
      ],
      crit: [
        {
          modifiers: {
            accuracy: 10,
            passthrough: 0,
            lethality: 2
          },
          sources: [
            {
              flat_bonus: 4,
              from_skill: 1.5,
              type: DamageType.Physical
            }
          ]
        }
      ]
    }
  }),
  new Item({
    id: "rough_bandage",
    type: "consumable",
    info: {
      name: "Makeshift Bandage",
      lore: "A bandage to stop **Bleeding** and heal {0} Injuries",
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
      lore: "A bandage to stop **Bleeding** and heal {0} Injuries",
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