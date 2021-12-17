import { CraftingRecipe } from "../Crafting";

export default [
  new CraftingRecipe({
    id: "recipe1",
    requirements: {
      materials: {
        scrap: 100
      }
    },
    result: "starter_revolver"
  })
]