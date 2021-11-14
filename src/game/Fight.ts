import NodeCache from "node-cache";
import { CONFIG, shuffle } from "..";
import mongoose from "mongoose";
import { SnowflakeUtil } from "discord.js";
import Creature from "./Creature";

export class Fight {
  static cache = new NodeCache({
    stdTTL: CONFIG?.cache?.fightTTL ?? 120,
    checkperiod: CONFIG?.cache?.fightCheckPeriod ?? 120
  })
  $: {
    _id: string
    queue: string[]
    parties: string[][]
  }
  
  constructor(data: {
    _id?: string,
    queue?: string[]
    parties?: string[][]
  }) {
    this.$ = {
      _id: data._id ?? SnowflakeUtil.generate(),
      parties: [],
      queue: []
    }
  }


  async constructQueue(db: typeof mongoose) {
    this.$.queue = [];
    for (const party of this.$.parties) {
      this.$.queue = this.$.queue.concat(party);
    }

    const queue: Creature[] = [];
    for await (const id of this.$.queue) {
      queue.push(await Creature.fetch(id, db));
    }

    this.$.queue.sort((a, b) => {
      const creature_a = queue.find((v) => v.$._id === a);
      const creature_b = queue.find((v) => v.$._id === b);

      // @ts-expect-error
      return creature_a.$.stats.speed.value - creature_b.$.stats.speed.value + (Math.random() - 0.5);
    })
  }

  static async fetch(id: string, db: typeof mongoose, cache = true): Promise<Fight> {
    if (cache) {
      if (this.cache.has(id)) {
        // @ts-expect-error
        return this.cache.get(id);
      }
    }

    const data = await db.connection.collection("Fights").findOne({_id: id});
    if (!data) throw new Error("Not found");
    return new Fight(data);
  }
  async put(db: typeof mongoose) {
    try {
      // @ts-expect-error
      await db.connection.collection("Fights").insertOne(this.dump());
    } catch {
      await db.connection.collection("Fights").replaceOne({_id: this.$._id}, this.$);
    }
  }
  async delete(db: typeof mongoose) {
    Fight.cache.del(this.$._id);
    return db.connection.collection("Fights").deleteOne({_id: this.$._id});
  }
}