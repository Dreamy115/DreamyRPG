import { LootTable } from "../LootTables";

export default [
  new LootTable({
    id: "rough_bandage",
    note: "Sample bandage drop",
    pools: new Map() 
    .set("medic", [
      {
        min_rolls: 1,
        max_rolls: 1,
        entries: [
          {
            items: ["rough_bandage"],
            weight: 5
          },
          {
            items: ["mediocre_bandage"],
            weight: 3
          }
        ]
      }
    ])
    .set("", [
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
    ])
  }) 
]