import { GameLocation } from "../Locations";

export default [
  new GameLocation({
    id: "default",
    info: {
      name: "Default Location",
      lore: "As a GM, you should already move your creatures elsewhere and make your own."
    },
    hasEnhancedCrafting: true,
    shop: "default",
    temperature: 21,
    rads: 0
  })
]