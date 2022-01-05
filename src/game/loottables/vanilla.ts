import { LootTable } from "../LootTables";

export default [
  new LootTable({
    id: "rough_bandage",
    pools: [
      {
        min_rolls: 1,
        max_rolls: 1,
        entries: [
          {
            items: ["rough_bandage"],
            weight: 6
          },
          {
            items: ["mediocre_bandage"],
            weight: 2
          }
        ]
      }
    ]
  }) 
]