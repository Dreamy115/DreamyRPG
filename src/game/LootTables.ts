import fs from "fs";
import path from "path";
import { diceRoll } from "./Creature";

export default class LootTableManager {
  map = new Map<string, LootTable>();
  async load(dir: fs.PathLike) {
    this.map.clear();

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".js")) continue;

      const {default: loadedFile} = await import(path.join(dir.toString(), file));

      if (loadedFile instanceof LootTable) {
        this.map.set(loadedFile.$.id, loadedFile);
      } else {
        if (loadedFile instanceof Array) {
          for (const subfile of loadedFile) {
            if (subfile instanceof LootTable) {
              this.map.set(subfile.$.id, subfile);
            }
          }
        }
      }
    }
  }
}

export class LootTable {
  $: {
    id: string
    note?: string // Note for GMs to differenciate
    pools: Map<string,LootPool[]> // Mapping PERK IDs to loot pools
  }

  constructor(data: LootTable["$"]) {
    this.$ = data;
  }

  static getProbabilities(pools: LootPool[]) {
    const array: {id: string, chance: number}[][] = [];
    for (const pool of pools) {
      const items: {id: string, chance: number}[] = [];
      
      let totalweight: number = 0;
      for (const entry of pool.entries) {
        totalweight += entry.weight;
      }
      for (const entry of pool.entries) {
        for (const item of entry.items) {
          if (item !== "")
            items.push({
              id: item,
              chance: entry.weight / totalweight
            });
        }
      }
      array.push(items);
    }
    return array;
  }

  static generate(pools: LootPool[]) {
    const items: string[] = [];
    
    for (const pool of pools) {
      const rolls = pool.max_rolls > pool.min_rolls
      ? pool.min_rolls + (diceRoll(pool.max_rolls + 1 - pool.min_rolls) - 1)
      : pool.min_rolls;

      let totalweights: number[] = [];
      for (const entry of pool.entries) {
        totalweights.push(entry.weight);
      }

      for (var i = 0; i < rolls; i++) {
        const roll = diceRoll(totalweights.reduce((p, v) => p += v)) - 1;

        var e = 0;
        for (e = 0; e < pool.entries.length; e++) {
          let target = 0;
          for (var w = 0; w <= e; w++) {
            target += totalweights[w];
          }

          if (roll < target) break;
        }

        const selected = pool.entries[e];

        items.push(...selected.items);
      }
    }
    
    return items;
  }

  getHighestFromPerks(perks: Set<string>): LootPool[] {
    for (const [key, pools] of this.$.pools) {
      if (perks.has(key)) return pools;
    }
    // @ts-expect-error
    return this.$.pools.get("");
  }
}

export interface LootPool {
  min_rolls: number
  max_rolls: number
  entries: {
    weight: number
    items: string[]
  }[]
}