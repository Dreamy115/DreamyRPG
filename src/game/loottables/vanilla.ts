import { LootPool, LootTable } from "../LootTables";

export default [
  new LootTable({
    id: "example_items",
    note: "Use to grant starter items at once",
    pools: new Map<string, LootPool[]>().set("", [
      {
        min_rolls: 1,
        max_rolls: 1,
        entries: [{ weight: 1, items: ["example_shield"]}]
      },
      {
        min_rolls: 1,
        max_rolls: 1,
        entries: [{ weight: 1, items: ["example_mask"]}]
      },
      {
        min_rolls: 1,
        max_rolls: 1,
        entries: [{ weight: 1, items: ["example_backpack"]}]
      },
      {
        min_rolls: 1,
        max_rolls: 1,
        entries: [{ weight: 1, items: ["example_vest"]}]
      },
      {
        min_rolls: 1,
        max_rolls: 1,
        entries: [{ weight: 1, items: ["example_jacket"]}]
      },
      {
        min_rolls: 1,
        max_rolls: 1,
        entries: [{ weight: 1, items: ["example_gloves"]}]
      },
      {
        min_rolls: 1,
        max_rolls: 1,
        entries: [{ weight: 1, items: ["example_knife"]}]
      },
      {
        min_rolls: 1,
        max_rolls: 1,
        entries: [{ weight: 1, items: ["example_revolver"]}]
      }
    ])
  }),
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