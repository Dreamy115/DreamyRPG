import NodeCache from "node-cache";
import { AbilitiesManager, CONFIG, limitString, shuffle } from "..";
import Mongoose from "mongoose";
import { Client, EmbedFieldData, InteractionReplyOptions, MessageActionRow, MessageButton, MessageEmbed, MessagePayload, MessageSelectMenu, MessageSelectOptionData, SnowflakeUtil, User } from "discord.js";
import Creature, { HealType } from "./Creature";
import { textStat } from "./Stats";

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
      parties: data.parties ?? [],
      queue: data.queue ?? []
    }
  }

  async prepare(db: typeof Mongoose) {
    for (var p = 0; p < this.$.parties.length; p++) {
      const party = this.$.parties[p];
      
      for (var c = 0; c < party.length; c++) {
        const creature = await Creature.fetch(party[c], db).catch(() => null);
        if (!creature) {
          this.$.parties[p].splice(c, 1);
          if (this.$.parties[p].length == 0)
            this.$.parties.splice(p, 1)
            if (this.$.parties.length <= 1)
              throw new Error("Not enough valid parties for fight to start")
          continue;
        }

        creature.$.vitals.shield = creature.$.stats.shield.value;
        creature.$.vitals.mana = 0;
        creature.$.abilities.hand = [];

        creature.put(db);
      }
    }
  }

  async constructQueue(db: typeof Mongoose) {
    this.$.queue = [];
    for (const party of this.$.parties) {
      for (const c of party) {
        this.$.queue.push(c);
      }
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

      if (!creature_a || !creature_b) return 0;

      return creature_b.$.stats.initiative.value - creature_a.$.stats.initiative.value + (Math.random() - 0.5);
    })

    if (this.$.queue.length < 2) throw new Error("Not enough fight participants");
  }

  async advanceTurn(db: typeof Mongoose) {
    this.$.queue.shift()
    if (this.$.queue.length === 0)
      await this.constructQueue(db);

    let creature: null | Creature = null;
    while (creature === null) {
      creature = await Creature.fetch(this.$.queue[0] ?? "", db).catch(() => null);
      if (this.$.queue.length === 0) break;
    }

    if (!creature) throw new Error("Not enough characters in a fight or they are invalid");

    creature.tick();

    creature.drawAbilityCard();
    if (creature.$.abilities.hand.length < Creature.MIN_HAND_AMOUNT) {
      creature.drawAbilityCard();
    }

    await creature.put(db);
  }

  async checkWinningParty(db: typeof Mongoose): Promise<number> {
    let ableToFight: boolean[] = [];
    let p: number;
    for (p = 0; p < this.$.parties.length; p++) {
      const party = this.$.parties[p];
      
      for (const cid of party) {
        const creature = await Creature.fetch(cid, db).catch(() => null);

        if (creature?.isAbleToFight()) {
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

  async announceEnd(db: typeof Mongoose, Bot: Client): Promise<InteractionReplyOptions> {
    return {
      embeds: [
        new MessageEmbed()
          .setColor("AQUA")
          .setFooter(this.$._id)
          .setTitle("Fight has ended")
      ]
    }
  }

  async announceTurn(db: typeof Mongoose, Bot: Client): Promise<InteractionReplyOptions> {
    const embed = new MessageEmbed();

    const creature = await Creature.fetch(this.$.queue[0], db).catch(() => null);
    if (!creature) return { content: "Invalid turn" }

    const owner: null | User = await Bot.users.fetch(creature.$._id).catch(() => null);

    embed
      .setAuthor(`${!creature.$.info.npc ? owner?.username ?? "Unknown" : "NPC"}`)
      .setTitle(`${creature.$.info.display.name}'s turn!`)
      .setColor("AQUA")
      .setFooter(`Fight ID: ${this.$._id} | Creature ID: ${creature.$._id}`)
      .addFields(await async function(fight: Fight){
        var fields: EmbedFieldData[] = [];

        for (const p in fight.$.parties) {
          fields.push({
            name: `Party ${p}`,
            inline: true,
            value: await async function (){
              var str = "";

              for await (const c of fight.$.parties[p]) {
                const char = await Creature.fetch(c, db).catch(() => null);
                if (!char) continue;

                str += `**${char.$.info.display.name}**\nHealth **${creature.$.vitals.health}**/**${creature.$.stats.health.value - creature.$.vitals.injuries}** (**${Math.round(100 * creature.$.vitals.health / creature.$.stats.health.value)}%**)\nShield ` + (creature.$.stats.shield.value > 0 ? `${textStat(creature.$.vitals.shield, creature.$.stats.shield.value)} **${creature.$.stats.shield_regen.value}**/t` : "No **Shield**") + "\n"
              }

              return str;
            }()
          })
        }        

        return fields;
      }(this))
      .addField(
        "Up Next this Round",
        await async function (fight: Fight){
          var str = "";

          for (var i = 1; i < fight.$.queue.length; i++) {
            const char = await Creature.fetch(fight.$.queue[i], db).catch(() => null);
            if (!char) continue;

            str += `\`${char.$._id}\` ${char.$.info.display.name}${char.$.info.npc ? " (NPC)" : ""}\n`;
          }

          return str;
        }(this) || "---"
      )

    return {
      embeds: [embed],
      content: `${owner ?? `<@&${CONFIG.guild?.gm_role}>`}`,
      components: await this.getComponents(db)
    }
  }

  async getComponents(db: typeof Mongoose): Promise<MessageActionRow[]> {
    const components: MessageActionRow[] = [
      new MessageActionRow().setComponents([
        new MessageButton()
          .setCustomId(`fight/${this.$._id}/attack`)
          .setLabel("Attack")
          .setStyle("PRIMARY"),
        new MessageButton()
          .setCustomId(`cedit/${this.$.queue[0]}/edit/weapon_switch`)
          .setLabel("Switch Weapons")
          .setStyle("SECONDARY"),
        new MessageButton()
          .setCustomId(`fight/${this.$._id}/endturn`)
          .setLabel("End Turn")
          .setStyle("DANGER")
      ]),
      new MessageActionRow().setComponents([
        new MessageSelectMenu()
          .setCustomId(`fight/${this.$._id}/ability`)
          .setPlaceholder("Use Ability")
          .setOptions(await async function (fight: Fight) {
            const array: MessageSelectOptionData[] = [];

            const creature = await Creature.fetch(fight.$.queue[0], db).catch(() => null);
            if (creature) for (const a of creature.$.abilities.hand) {
              const ability = AbilitiesManager.map.get(a);
              if (!ability) continue;

              array.push({
                label: ability.$.info.name,
                value: ability.$.id,
                description: limitString(ability.$.info.lore, 100)
              })
            }

            if (array.length == 0)
              array.push({
                label: "No abilities in hand",
                value: "null"
              })

            return array;
          }(this))
      ])
    ];

    return components;
  }

  static async fetch(id: string, db: typeof Mongoose, cache = true): Promise<Fight> {
    if (cache) {
      if (this.cache.has(id)) {
        // @ts-expect-error
        return this.cache.get(id);
      }
    }

    const data = await db.connection.collection(Fight.COLLECTION_NAME).findOne({_id: id});
    if (!data) throw new Error("Not found");
    return new Fight(data);
  }
  async put(db: typeof Mongoose) {
    Fight.cache.set(this.$._id, this);

    try {
      // @ts-expect-error
      await db.connection.collection(Fight.COLLECTION_NAME).insertOne(this.$);
    } catch {
      await db.connection.collection(Fight.COLLECTION_NAME).replaceOne({_id: this.$._id}, this.$);
    }
  }
  async delete(db: typeof Mongoose) {
    Fight.cache.del(this.$._id);
    return db.connection.collection(Fight.COLLECTION_NAME).deleteOne({_id: this.$._id});
  }

  static readonly COLLECTION_NAME = "Fights";
}