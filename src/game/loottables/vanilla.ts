import { LootPool, LootTable } from "../LootTables";

export default [
  new LootTable({
    id: "vanilla:example_items",
    note: "Use to grant starter items at once",
    pools: new Map<string, LootPool[]>().set("", [
      {
        min_rolls: 1,
        max_rolls: 1,
        entries: [{ weight: 1, items: ["vanilla:example_shield"]}]
      },
      {
        min_rolls: 1,
        max_rolls: 1,
        entries: [{ weight: 1, items: ["vanilla:example_mask"]}]
      },
      {
        min_rolls: 1,
        max_rolls: 1,
        entries: [{ weight: 1, items: ["vanilla:example_backpack"]}]
      },
      {
        min_rolls: 1,
        max_rolls: 1,
        entries: [{ weight: 1, items: ["vanilla:example_vest"]}]
      },
      {
        min_rolls: 1,
        max_rolls: 1,
        entries: [{ weight: 1, items: ["vanilla:example_jacket"]}]
      },
      {
        min_rolls: 1,
        max_rolls: 1,
        entries: [{ weight: 1, items: ["vanilla:example_gloves"]}]
      },
      {
        min_rolls: 1,
        max_rolls: 1,
        entries: [{ weight: 1, items: ["vanilla:example_knife"]}]
      },
      {
        min_rolls: 1,
        max_rolls: 1,
        entries: [{ weight: 1, items: ["vanilla:example_pistol"]}]
      }
    ])
  }),
  new LootTable({
    id: "vanilla:rough_bandage",
    note: "Sample bandage drop",
    pools: new Map() 
    .set("ws:medic", [
      {
        min_rolls: 1,
        max_rolls: 1,
        entries: [
          {
            items: ["vanilla:rough_bandage"],
            weight: 5
          },
          {
            items: ["vanilla:mediocre_bandage"],
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
            items: ["vanilla:rough_bandage"],
            weight: 6
          },
          {
            items: ["vanilla:mediocre_bandage"],
            weight: 2
          }
        ]
      }
    ])
  }) 
]