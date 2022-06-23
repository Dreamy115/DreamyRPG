import { CraftingMaterials } from "../Crafting";
import { DamageMethod, DamageType, HealType } from "../Damage";
import { Item, ItemQuality, WeaponCategory } from "../Items";

export default [
  new Item({
    id: "vanilla:example_shield",
    info: {
      name: "Basic Shield",
      lore: "A basic, used shield primer. Will stop a ping-pong ball thrown in your face but don't expect too much.",
      quality: ItemQuality.Poor
    },
    type: "wearable",
    slot: "shield",
    base_shield: 20,
    base_regen: 5
  }),
  new Item({
    id: "vanilla:example_mask",
    info: {
      name: "Basic Mask",
      lore: "It's capable of filtering out bigger particles. That's what the point of the mask is.",
      quality: ItemQuality.Poor
    },
    type: "wearable",
    slot: "mask",
    base_filtering: 1
  }),
  new Item({
    id: "vanilla:example_jacket",
    info: {
      name: "Rag Jacket",
      lore: "Something to put over yourself to stop the wind.",
      quality: ItemQuality.Poor
    },
    type: "wearable",
    slot: "jacket",
    base_heat_capacity: 0,
    base_insulation: 15
  }),
  new Item({
    id: "vanilla:example_vest",
    info: {
      name: "Scrap Vest",
      lore: "A bunch of scrap taped together for protection.. Eeeeh good enough?",
      quality: ItemQuality.Poor
    },
    type: "wearable",
    slot: "vest",
    base_armor: 2,
    base_dissipate: 1
  }),
  new Item({
    id: "vanilla:example_backpack",
    info: {
      name: "Rag-Pack",
      lore: "Introducing the Rag-Pack, it holds things! -uh... That's everything? Where's the rest of the script? Is this thing still on?",
      quality: ItemQuality.Poor
    },
    type: "wearable",
    slot: "backpack",
    base_deflect: 0,
    base_parry: 1
  }),
  new Item({
    id: "vanilla:example_gloves",
    info: {
      name: "Used Bike Gloves",
      lore: "Something to put your pawsies into, not much.",
      quality: ItemQuality.Poor
    },
    type: "wearable",
    slot: "gloves",
    base_ap: 0,
    base_ap_regen: 0,
    base_tech: 1,
  }),
  new Item({
    id: "vanilla:example_knife",
    type: "weapon",
    info: {
      name: "Kitchen Knife",
      lore: "You found this laying around! You can make use of it!",
      quality: ItemQuality.Poor
    },
    category: WeaponCategory.knife,
    base_damage: 2,
    base_tech: 0,
    ammo: 1,
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
    id: "vanilla:example_pistol",
    type: "weapon",
    info: {
      name: "P258",
      lore: "It's a pistol. Hope it still works.",
      quality: ItemQuality.Poor
    },
    category: WeaponCategory.pistol,
    base_damage: 2,
    base_tech: 0,
    ammo: 1,
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
    id: "vanilla:rough_bandage",
    type: "consumable",
    info: {
      name: "Makeshift Bandage",
      lore: "A bandage to stop **Bleeding** and heal {0} Injuries",
      quality: ItemQuality.Poor,
      replacers: [
        {
          stat: "tech",
          multiplier: 0.05,
          bonus: 10
        }
      ]
    },
    onUse: async (creature, db) => {
      await creature.clearActiveEffect("vanilla:bleeding", "delete", db);

      const amount = 10 + (creature.$.stats.tech.value * 0.05);

      await creature.heal({
        from: "Rough Bandage",
        sources: [{value: amount, type: HealType.Injuries}]
      }, db);
      await creature.heal({
        from: "Rough Bandage",
        sources: [{value: amount, type: HealType.Health}]
      }, db);

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
    id: "vanilla:mediocre_bandage",
    type: "consumable",
    info: {
      name: "Makeshift Bandage",
      lore: "A bandage to stop **Bleeding** and heal {0} Injuries",
      quality: ItemQuality.Common,
      replacers: [
        {
          stat: "tech",
          multiplier: 0.075,
          bonus: 15
        }
      ]
    },
    onUse: async (creature, db) => {
      await creature.clearActiveEffect("vanilla:bleeding", "delete", db);

      const amount = 15 + (creature.$.stats.tech.value * 0.075);

      await creature.heal({
        from: "Mediocre Bandage",
        sources: [{value: amount, type: HealType.Injuries}]
      }, db);
      await creature.heal({
        from: "Mediocre Bandage",
        sources: [{value: amount, type: HealType.Health}]
      }, db);

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