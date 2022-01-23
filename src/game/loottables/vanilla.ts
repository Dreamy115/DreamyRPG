import { LootPool, LootTable } from "../LootTables";

export default [
  new LootTable({
    id: "starter_items",
    note: "Use to grant starter items at once",
    pools: new Map<string, LootPool[]>().set("", [
      {
        min_rolls: 1,
        max_rolls: 1,
        entries: [{ weight: 1, items: ["starter_shield"]}]
      },
      {
        min_rolls: 1,
        max_rolls: 1,
        entries: [{ weight: 1, items: ["starter_mask"]}]
      },
      {
        min_rolls: 1,
        max_rolls: 1,
        entries: [{ weight: 1, items: ["starter_backpack"]}]
      },
      {
        min_rolls: 1,
        max_rolls: 1,
        entries: [{ weight: 1, items: ["starter_vest"]}]
      },
      {
        min_rolls: 1,
        max_rolls: 1,
        entries: [{ weight: 1, items: ["starter_jacket"]}]
      },
      {
        min_rolls: 1,
        max_rolls: 1,
        entries: [{ weight: 1, items: ["starter_gloves"]}]
      },
      {
        min_rolls: 1,
        max_rolls: 1,
        entries: [{ weight: 1, items: ["starter_knife"]}]
      },
      {
        min_rolls: 1,
        max_rolls: 1,
        entries: [{ weight: 1, items: ["starter_revolver"]}]
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