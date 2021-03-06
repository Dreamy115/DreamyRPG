import { Client, EmbedFieldData, InteractionReplyOptions, MessageActionRow, MessageButton, MessageEditOptions, MessageEmbed, MessageOptions, MessageSelectMenu, MessageSelectOptionData, SnowflakeUtil, User } from "discord.js";
import Mongoose, { ObjectId } from "mongoose";
import NodeCache from "node-cache";
import { AbilitiesManager, CONFIG, EffectManager, ItemManager, limitString, removeMarkdown } from "..";
import { make_bar } from "../app/Bars";
import Creature from "./Creature";
import { DamageMethod } from "./Damage";
import { ItemQualityEmoji, WeaponItemData } from "./Items";
import { replaceLore } from "./LoreReplacer";
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
    round: number
  }
  
  constructor(data: {
    _id?: ObjectId | string,
    queue?: string[]
    parties?: string[][]
    round?: number
  }) {
    this.$ = {
      _id: data._id as string || SnowflakeUtil.generate(),
      parties: data.parties ?? [],
      queue: data.queue ?? [],
      round: data.round ?? 1
    }
  }

  get creatures(): Set<string> {
    const set = new Set<string>();
    for (const p of this.$.parties) {
      for (const c of p) {
        set.add(c);
      }
    }
    return set;
  }

  async prepare(db: typeof Mongoose) {
    const saving: Promise<any>[] = [];
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

        for (const passive of creature.passives)
          await passive.$.onFightEnter?.(creature, db, this);

        saving.push(creature.put(db));
      }
    }
    return Promise.all(saving);
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
    if (this.$.queue.length === 0) {
      await this.constructQueue(db);
      this.$.round++;
    }

    let creature: null | Creature = null;
    while (creature === null) {
      creature = await Creature.fetch(this.$.queue[0] ?? "", db).catch(() => null);
      if (this.$.queue.length === 0) break;
    }

    if (!creature) throw new Error("Not enough characters in a fight or they are invalid");

    await creature.tick(db);

    let ab = creature.drawAbilityCard();
    while (ab !== null && creature.$.abilities.hand.length < Creature.MIN_HAND_AMOUNT) {
      ab = creature.drawAbilityCard();
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

        if (creature?.isAbleToFight) {
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
      const index = ableToFight.findIndex(b => b);
      if (index === -1) return -2;
      return index;
    }
    return -1;
  }

  async announceEnd(db: typeof Mongoose, Bot: Client): Promise<InteractionReplyOptions> {
    return {
      embeds: [
        new MessageEmbed()
          .setColor("AQUA")
          .setFooter({ text: this.$._id})
          .setTitle("Fight has ended")
      ]
    }
  }

  async announceTurn(db: typeof Mongoose, Bot: Client) {
    const embeds = [new MessageEmbed()];

    const creature = await Creature.fetch(this.$.queue[0], db).catch(() => null);
    if (!creature) return { content: "Invalid turn" }

    const owner: null | User = await Bot.users.fetch(creature.$._id).catch(() => null);

    const combatants = await this.getCombatantInfo(db);

    const fields: EmbedFieldData[] = [];
    for (const p in this.$.parties) {
      for (const c of this.$.parties[p]) {
        var str = "";

        const char = await Creature.fetch(c, db).catch(() => null);
        if (!char) continue;

        const injury_ratio = char.$.vitals.injuries / char.$.stats.health.value;

        const weapon = ItemManager.map.get(char.$.items.primary_weapon?.id ?? "");

        str += 
          `*(**${char.$.stats.health.value}** Health - **${char.$.vitals.injuries}** Injuries)*\n` +
          (
            char.$.stats.shield.value > 0
            ? (make_bar(100 * char.$.vitals.shield / char.$.stats.shield.value, Creature.BAR_STYLES.Shield, Math.max(1, Math.floor(char.$.stats.shield.value / BAR_LENGTH))).str || "") +
            ` **Shield** ${textStat(char.$.vitals.shield, char.$.stats.shield.value)} `
            : "No **Shield** "
          ) + `**${char.$.stats.shield_regen.value}**/t\n` +
          (make_bar(100 * char.$.vitals.health / (char.$.stats.health.value - char.$.vitals.injuries), Creature.BAR_STYLES.Health, Math.max(1, (1 - injury_ratio) * Math.floor(char.$.stats.health.value / BAR_LENGTH))).str || "") +
          (
            char.$.vitals.injuries > 0
            ? make_bar(100, Creature.BAR_STYLES.Injuries, Math.max(1, injury_ratio * Math.floor(char.$.stats.health.value / BAR_LENGTH))).str
            : ""
          ) +
          ` **Health** **${char.$.vitals.health}**/**${char.$.stats.health.value - char.$.vitals.injuries}** ` + 
          `(**${Math.round(100 * char.$.vitals.health / char.$.stats.health.value)}%**)\n` +
          make_bar(100 *char.$.vitals.action_points / char.$.stats.action_points.value, Creature.BAR_STYLES.ActionPoints, char.$.stats.action_points.value / char.$.stats.attack_cost.value).str +
          ` **Action Points** ${textStat(char.$.vitals.action_points, char.$.stats.action_points.value)} `+
          `**${char.$.stats.ap_regen.value}**/t\n` +
          (
            weapon
            ? `${weapon.displayName} -> **${char.getFinalDamage((weapon.$ as WeaponItemData).attack.type).toFixed(1)}**`
            : `Unarmed -> **${char.getFinalDamage(DamageMethod.Melee).toFixed(1)}**`
          ) + ` [**${char.$.stats.ammo.value}** Attacks]` + "\n" +
          (function() {
            const arr: string[] = [];
            for (const active of char.active_effects) {
              const effect = EffectManager.map.get(active.id);
              if (!effect || effect.$.hide?.(char)) continue;

              arr.push(`${effect.getDisplayName(active)} **${active.ticks !== -1 ? ` *(${active.ticks}t)*` : ""}`.trim())
            }
            if (arr.length > 0)
              return `**${arr.join(", **")}`
          }() || "") + "\n"

        fields.push({
          name: `<${p}> **${char.displayName}** (${CombatPosition[combatants.get(char.$._id)?.position ?? 0]})`,
          inline: true,
          value: str
        });

      }
    }        

    embeds[0]
      .setAuthor({ name: `${!creature.$.info.npc ? owner?.username ?? "Unknown" : "NPC"}`, iconURL: creature.$.info.npc ? undefined : owner?.displayAvatarURL({dynamic: true, size: 32}) })
      .setTitle(`${creature.displayName}'s turn! (Round ${this.$.round})`)
      .setColor("AQUA")
      .setFooter({ text: `Fight ID: ${this.$._id} | Creature ID: ${creature.$._id}` })
    
    var j = 0;
    while (fields.length > 0) {
      if (!embeds[j])
        embeds[j] = new MessageEmbed().setColor("AQUA");

      for (var i = 0; i < 9; i++) {
        const data = fields.shift();
        if (!data) break;

        embeds[j].addFields(data);
      }
      j++
    }

    embeds.push(
      new MessageEmbed()
      .setColor("AQUA")
      .setDescription(
        "Up Next this Round\n" +
        await async function (fight: Fight){
          var str = "";
  
          for (var i = 1; i < fight.$.queue.length; i++) {
            const char = await Creature.fetch(fight.$.queue[i], db).catch(() => null);
            if (!char) continue;
  
            str += `\`${char.$._id}\` ${char.displayName}${char.$.info.npc ? " (NPC)" : ""}\n`;
          }
  
          return str;
        }(this) || "---"
      )
    );

    return {
      embeds,
      content: `${owner ?? `<@&${CONFIG.guild?.gm_role}>`}${creature.isAbleToFight ? "" : "(Down!)"}`,
      components: await this.getComponents(db)
    }
  }

  async getComponents(db: typeof Mongoose): Promise<MessageActionRow[]> {
    const creature = await Creature.fetch(this.$.queue[0], db).catch(() => null);

    const components: MessageActionRow[] = [
      new MessageActionRow().setComponents([
        new MessageButton()
          .setCustomId(`fight/${this.$._id}/attack`)
          .setLabel(`Attack (${creature?.$.stats.attack_cost.value} AP)[${creature?.$.abilities.ammo}]`)
          .setStyle("PRIMARY")
          .setDisabled(!(creature?.canUseAttacks && creature?.$.abilities.ammo >= 1)),
        new MessageButton()
          .setCustomId(`fight/${this.$._id}/weapon_switch`)
          .setLabel(`Switch Weapons (${creature?.combat_switch_cost} AP)`)
          .setStyle("SECONDARY"),
        new MessageButton()
          .setCustomId(`fight/${this.$._id}/endturn`)
          .setLabel("End Turn")
          .setStyle("DANGER")
      ]),
      new MessageActionRow().setComponents([
        new MessageSelectMenu()
          .setCustomId(`fight/${this.$._id}/ability`)
          .setPlaceholder(`Use Ability (${creature?.$.abilities.hand.length ?? 0}/${Creature.MAX_HAND_AMOUNT})`)
          .setDisabled(!creature?.canUseAbilities)
          .setOptions(await async function () {
            const array: MessageSelectOptionData[] = [];

            if (creature) for (const a of creature.$.abilities.hand) {
              const ability = AbilitiesManager.map.get(a);
              if (!ability) continue;

              const index = array.findIndex((v) => v.value === ability.$.id)
              if (index === -1) {
                const test: void | Error = await ability.$.test?.(creature).catch(e => typeof e === "string" ? new Error(e) : e);
                array.push({
                  label: `${ability.$.info.name} (${ability.$.cost} AP) []`,
                  emoji: (test instanceof Error ? "??????" : ItemQualityEmoji[ability.$.info.quality]),
                  value: ability.$.id,
                  description: limitString(
                    test instanceof Error
                    ? test.message
                    : removeMarkdown(replaceLore(ability.$.info.lore, ability.$.info.replacers ?? [])),
                  100)
                })
                continue;
              } else {
                array[index].label += "[]";
              }
            }

            if (array.length == 0)
              array.push({
                label: "No abilities in hand",
                value: "null"
              })

            return array;
          }())
      ]),
      new MessageActionRow().setComponents([
        new MessageSelectMenu()
          .setCustomId(`fight/${this.$._id}/ability_discard`)
          .setPlaceholder(`Discard Ability [2 AP] (${creature?.$.abilities.hand.length ?? 0}/${Creature.MAX_HAND_AMOUNT})`)
          .setOptions(await async function () {
            const array: MessageSelectOptionData[] = [];

            if (creature) for (const a of creature.$.abilities.hand) {
              const ability = AbilitiesManager.map.get(a);
              if (!ability) continue;

              const index = array.findIndex((v) => v.value === ability.$.id)
              if (index === -1) {
                const test: void | Error = await ability.$.test?.(creature).catch(e => typeof e === "string" ? new Error(e) : e);
                array.push({
                  label: `${ability.$.info.name} (${ability.$.cost} AP) []`,
                  emoji: (test instanceof Error ? "??????" : ItemQualityEmoji[ability.$.info.quality]),
                  value: ability.$.id,
                  description: limitString(
                    test instanceof Error
                    ? test.message
                    : removeMarkdown(replaceLore(ability.$.info.lore, ability.$.info.replacers ?? [])),
                  100)
                })
                continue;

              } else {
                array[index].label += "[]";
              }
            }

            if (array.length == 0)
              array.push({
                label: "No abilities in hand",
                value: "null"
              })

            return array;
          }())
      ]),
      new MessageActionRow().setComponents([
        new MessageButton()
          .setCustomId(`cedit/${creature?.$._id}/edit/item/use`)
          .setLabel("Consume Item")
          .setStyle("PRIMARY"),
        new MessageButton()
          .setCustomId(`fight/${this.$._id}/ult`)
          .setLabel(`${creature?.ultimate ? `Use Ultimate (${creature.$.abilities.ult_stacks}/${creature.$.stats.ult_stack_target.value})` : "No Ultimate"}`)
          .setDisabled(!(creature?.ultimate && creature.$.abilities.ult_stacks >= creature.$.stats.ult_stack_target.value))
          .setStyle("PRIMARY"),
        new MessageButton()
          .setCustomId(`fight/${this.$._id}/refresh`)
          .setLabel("Refresh")
          .setStyle("SECONDARY")
      ]),
      new MessageActionRow().setComponents([
        new MessageSelectMenu()
          .setCustomId(`checkstats`)
          .setPlaceholder("/char info stats")
          .setOptions(await async function (fight: Fight) {
            const arr: MessageSelectOptionData[] = [];
            for (const p in fight.$.parties) {
              const party = fight.$.parties[p];
              for (const cid of party) {
                const char = await Creature.fetch(cid, db).catch(() => null);
                if (!char) continue;
        
                arr.push({
                  label: `${char.displayName} - Party ${p}`,
                  value: char.$._id,
                  description: `(${char.$._id === creature?.$._id ? "You" : (char.$.info.npc ? "NPC" : "Player")})`
                });
              }
            }

            return arr;
          }(this))
      ])
    ];

    return components;
  }

  async getCombatantInfo(db: typeof Mongoose) {
    const combatants: Map<string, Combatant> = new Map<string, Combatant>();
    for (const party of this.$.parties) {

      const creatures: Promise<Creature>[] = [];
      for (const c of party) {
        creatures.push(Creature.fetch(c, db))
      }
      for await (const creature of creatures) {
        combatants.set(
          creature.$._id, {
          position: (
            party.length > 1
            ? creature.attackSet.type
            : CombatPosition["No Position"]
          ) as CombatPosition,
          down: !creature.isAbleToFight
        })
      }

      // I have no idea how else to do this so I'm doing it the hard way
      const usedTypes: Set<CombatPosition> = new Set();
      for await (const creature of creatures) {
        const combatant = combatants.get(creature.$._id);
        if (!combatant || combatant.down) continue;
        
        usedTypes.add(combatant.position);
      }
      if (usedTypes.size < 2) 
        for await (const creature of creatures) {
          combatants.set(
            creature.$._id, {
              position: 0,
              down: !creature.isAbleToFight
            }
          )
        }
    }
    return combatants;
  }

  static async fetch(id: string, db: typeof Mongoose, cache = true): Promise<Fight> {
    if (cache) {
      if (this.cache.has(id)) {
        return this.cache.get(id) as Fight;
      }
    }

    const data = await db.connection.collection(Fight.COLLECTION_NAME).findOne({_id: id});
    if (!data) throw new Error("Not found");
    // @ts-ignore
    return new Fight(data);
  }
  async put(db: typeof Mongoose) {
    Fight.cache.set(this.$._id, this);

    try {
      await db.connection.collection(Fight.COLLECTION_NAME).insertOne(this.$ as unknown as Document);
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

export enum CombatPosition {
  "No Position", "Frontline", "Support"
}

export interface Combatant {
  position: CombatPosition
  down: boolean
}

const BAR_LENGTH = 10 * 2;