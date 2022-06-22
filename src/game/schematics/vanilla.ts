import { Schematic } from "../Crafting";
import { ItemQuality } from "../Items";

export default [
  new Schematic({
    id: "vanilla:rough_bandage",
    info: {
      name: "Makeshift Bandage",
      lore: "A schematic for you to craft a basic bandage",
      quality: ItemQuality.Poor
    },
    requirements: {
      enhancedCrafting: true,
      materials: {
        biomaterial: 0,
        cells: 0,
        fabric: 20,
        metal: 0,
        plastic: 0
      }
    },
    table: "vanilla:rough_bandage"
  })
]