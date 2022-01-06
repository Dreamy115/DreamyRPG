import { HealType } from "../Creature";
import { Shop } from "../Shops";

export default [
  new Shop({
    id: "default",
    info: {
      name: "Default's",
      lore: "What are you doing here? You shouldn't be here. But enjoy your stay, I guess."
    },
    content: [
      {
        cost: {
          biomaterial: 0,
          cells: 1,
          fabric: 30,
          metal: 0,
          plastic: 0
        },
        type: "service",
        onBuy: async (creature) => {
          creature.heal(60, HealType.Injuries);
          creature.heal(60, HealType.Health);

          return {
            text: "Healed for **60** Injuries and Health"
          }
        },
        info: {
          name: "Patch-Up",
          lore: "I'll patch you up for 60. Just need some of your fabric and a small work fee."
        }
      },
      {
        cost: {
          biomaterial: 0,
          cells: 0,
          fabric: 15,
          metal: 0,
          plastic: 0
        },
        type: "item",
        id: "rough_bandage"
      },
      {
        cost: {
          biomaterial: 0,
          cells: 3,
          fabric: 0,
          metal: 0,
          plastic: 0
        },
        type: "schematic",
        id: "rough_bandage"
      }
    ]
  })
]