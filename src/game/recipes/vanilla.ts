import { CraftingRecipe } from "../Crafting";

export default [
  new CraftingRecipe({
    id: "rough_bandage",
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
    results: ["rough_bandage"]
  })
]