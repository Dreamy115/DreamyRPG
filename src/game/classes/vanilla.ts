import { CreatureClass } from "../Classes";

export default [
  new CreatureClass({
    id: "nothing",
    compatibleSpecies: new Set(),
    info: {
      name: "Nothing",
      lore: "Placeholder. Gives nothing."
    },
    abilities: new Set(),
    passives: new Set()
  })
]