import NodeCache from "node-cache";
import { CONFIG, shuffle } from "..";
import Mongoose from "mongoose";
import { InteractionReplyOptions, MessageEmbed, MessagePayload, SnowflakeUtil } from "discord.js";
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


  async constructQueue(db: typeof Mongoose) {
    this.$.queue = [];
    for (const party of this.$.parties) {
      this.$.queue = this.$.queue.concat(party);
    }

    const queue: Creature[] = [];
    for await (const id of this.$.queue) {
      const creature = await Creature.fetch(id, db).catch(() => null);

      if (creature)
        queue.push(creature);
    }

    this.$.queue.sort((a, b) => {
      const creature_a = queue.find((v) => v.$._id === a);
      const creature_b = queue.find((v) => v.$._id === b);

      // @ts-expect-error
      return creature_b.$.stats.speed.value - creature_a.$.stats.speed.value + (Math.random() - 0.5);
    })

    if (this.$.queue.length < 2) throw new Error("Not enough fight participants");
  }

  async advanceTurn(db: typeof Mongoose) {
    if (this.$.queue.length === 0)
      await this.constructQueue(db);

    let creature: null | Creature = null;
    while (creature === null) {
      creature = await Creature.fetch(this.$.queue.shift() ?? "", db);
      if (this.$.queue.length === 0) break;
    }

    if (!creature) throw new Error("Not enough characters in a fight or they are invalid");
  }

  async checkWinningParty(db: typeof Mongoose): Promise<number> {
    let ableToFight: boolean[] = [];
    let p: number;
    for (p = 0; p < this.$.parties.length; p++) {
      const party = this.$.parties[p];
      
      for (const cid of party) {
        const creature = await Creature.fetch(cid, db);

        if (creature.isAbleToFight()) {
          ableToFight[p] = true;
          break;
        }
      }
      if (!ableToFight[p]) ableToFight[p] = false;
    }

    var able = 0;
    for (var a of ableToFight) {
      if (a) able++;
    }

    if (able <= 1) {
      return ableToFight.findIndex(b => b);
    }
    return -1;
  }

  async announceTurn(db: typeof Mongoose): Promise<InteractionReplyOptions> {
    const embed = new MessageEmbed();


    return {
      embeds: [embed],
    }
  }

  static async fetch(id: string, db: typeof Mongoose, cache = true): Promise<Fight> {
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
  async put(db: typeof Mongoose) {
    try {
      // @ts-expect-error
      await db.connection.collection("Fights").insertOne(this.dump());
    } catch {
      await db.connection.collection("Fights").replaceOne({_id: this.$._id}, this.$);
    }
  }
  async delete(db: typeof Mongoose) {
    Fight.cache.del(this.$._id);
    return db.connection.collection("Fights").deleteOne({_id: this.$._id});
  }
}