import { Client, MessageEmbed } from "discord.js";
import mongoose from "mongoose";
import NodeCache from "node-cache";
import { ClassManager, ItemManager, PassivesManager, SpeciesManager } from "../index.js";
import { DamageGroup, DamageLog, DamageMedium, DamageType, DAMAGE_TO_INJURY_RATIO, reductionMultiplier, ShieldReaction } from "./Damage.js";
import { PassiveEffect, PassiveModifier } from "./PassiveEffects.js";
import { ModifierType, textStat, TrackableStat } from "./Stats.js";

export default class Creature {
  static cache: NodeCache = new NodeCache({
    checkperiod: 30,
    stdTTL: 60
  })
  $: CreatureData

  constructor(data: CreatureDump) {
    this.$ = {
      _id: data._id,
      info: {
        display: {
          name: data.info?.display?.name ?? "Unnamed",
          avatar: data.info?.display?.avatar ?? null
        },
        species: data.info?.species ?? "default",
        class: data.info?.class ?? "default",
        npc: data.info?.npc ?? false,
      },
      stats: {
        armor: new TrackableStat(0),
        filter: new TrackableStat(0),
        melee: new TrackableStat(0),
        ranged: new TrackableStat(0),
        health: new TrackableStat(100),
        mana: new TrackableStat(12),
        mana_regen: new TrackableStat(7),
        shield: new TrackableStat(0),
        shield_regen: new TrackableStat(0),
        parry: new TrackableStat(0),
        deflect: new TrackableStat(0),
        tenacity: new TrackableStat(42),
        tech: new TrackableStat(0)
      },
      vitals: {
        health: (data.vitals?.health ?? 1),
        injuries: (data.vitals?.injuries ?? 0),
        mana: (data.vitals?.mana ?? 0),
        shield: (data.vitals?.shield ?? 0)
      },
      items: {
        equipped: data.items?.equipped ?? [],
        backpack: data.items?.backpack ?? [],
        primary_weapon: data.items?.primary_weapon ?? null
      }
    }

    this.checkItemConflicts();

    const passives = this.findPassives();
    // PRELOAD
    for (const passive of passives) {
      passive.$.preload?.(this);
      for (const mod of passive.$.modifiers ?? []) {
        this.applyNamedModifier(mod);
      }
    }

    if (isNaN(this.$.vitals.health)) {
      this.$.vitals.health = 1;
    }
    if (isNaN(this.$.vitals.injuries)) {
      this.$.vitals.injuries = 0;
    }
    if (isNaN(this.$.vitals.mana)) {
      this.$.vitals.mana = 0;
    }
    if (isNaN(this.$.vitals.shield)) {
      this.$.vitals.shield = 0;
    }

    this.$.vitals.health *= this.$.stats.health.value;
    this.$.vitals.injuries *= this.$.stats.health.value;
    this.$.vitals.shield *= this.$.stats.shield.value;
    this.$.vitals.mana *= this.$.stats.mana.value;

    this.vitalsIntegrity();

    // POSTLOAD
    for (const passive of passives) {
      passive.$.postload?.(this);
    }
  }

  vitalsIntegrity() {
    this.$.vitals.injuries = Math.min(Math.max(0, this.$.vitals.injuries), this.$.stats.health.value);
    this.$.vitals.health = Math.min(Math.max(0, this.$.vitals.health), this.$.stats.health.value - this.$.vitals.injuries);
    this.$.vitals.mana = Math.min(Math.max(0, this.$.vitals.mana), this.$.stats.mana.value);
    this.$.vitals.shield = Math.min(Math.max(0, this.$.vitals.shield), this.$.stats.shield.value);
  }

  checkItemConflicts() {
    let utilAmount = 0;
    let weaponAmount = 0;

    let hasOuterClothing = false;
    let hasInnerClothing = false;
    let hasSkinClothing = false;

    for (var i = 0; i < this.$.items.equipped.length; i++) {
      const item = ItemManager.map.get(this.$.items.equipped[i]);
      if (!item) continue;

      switch (item.$.type) {
        case "utility": {
          if (utilAmount >= Creature.MAX_EQUIPPED_UTILITY) {
            this.$.items.backpack.push(this.$.items.equipped.splice(i, 1)[0]);
            i--;
          }
        } break;
        case "weapon": {
          if (weaponAmount >= Creature.MAX_EQUIPPED_WEAPONS) {
            this.$.items.backpack.push(this.$.items.equipped.splice(i, 1)[0]);
            i--;
          }
        } break;
        case "wearable_outer": {
          if (hasOuterClothing) {
            this.$.items.backpack.push(this.$.items.equipped.splice(i, 1)[0]);
            i--;
          }
        } break;
        case "wearable_inner": {
          if (hasInnerClothing) {
            this.$.items.backpack.push(this.$.items.equipped.splice(i, 1)[0]);
            i--;
          }
        } break;
        case "wearable_skin": {
          if (hasSkinClothing) {
            this.$.items.backpack.push(this.$.items.equipped.splice(i, 1)[0]);
            i--;
          }
        } break;
      }
    }
  }

  findPassives(): PassiveEffect[] {
    const passives: PassiveEffect[] = [];

    function globalOrLocalPusher(array: PassiveEffect[], input: (PassiveEffect | string)[]) {
      for (const p of input) {
        if (typeof p === "string") {
          const passive = PassivesManager.map.get(p);
          if (passive)
            array.push(passive);
        } else {
          array.push(p);
        }
      }
    }

    const species = SpeciesManager.map.get(this.$.info.species);
    if (species) {
      globalOrLocalPusher(passives, species.$.passives ?? []);
    }

    const kit = ClassManager.map.get(this.$.info.class ?? "");
    if (kit) {
      globalOrLocalPusher(passives, kit.$.passives ?? []);
    } 


    for (const useditem of this.getAllItemIDs()) {
      const item = ItemManager.map.get(useditem); 
      if (!item) continue;

      globalOrLocalPusher(passives, item.$.passives ?? []);
    }

    return passives;
  }

  getAllItemIDs(): string[] {
    const array = new Array().concat(this.$.items.primary_weapon, this.$.items.equipped);
    for (var i = 0; i < array.length; i++) {
      if (array[i]) continue;

      array.splice(i, 1);
      i--;
    }

    return array;
  }

  applyNamedModifier(mod: PassiveModifier) {
    // @ts-ignore
    return this.$.stats[mod.stat].modifiers.push({type: mod.type, value: mod.value});
  }

  applyDamage(original: DamageGroup): DamageLog {
    const group: DamageGroup = JSON.parse(JSON.stringify(original));

    const log: DamageLog = {
      original,
      final: group,
      successful: true,
      total_damage_mitigated: 0,
      total_damage_taken: 0,
      total_energy_damage: 0,
      total_health_damage: 0,
      total_injuries: 0,
      total_physical_damage: 0,
      total_shield_damage: 0,
      total_true_damage: 0
    }

    for (const passive of this.findPassives()) {
      passive.$.beforeDamageTaken?.(this);
    }
    if (group.attacker instanceof Creature) {
      for (const passive of group.attacker.findPassives()) {
        passive.$.beforeDamageGiven?.(group.attacker);
      }
    }

    if (group.useDodge) {
      group.chance -= group.medium === DamageMedium.Direct ? 0 : group.medium === DamageMedium.Melee ? this.$.stats.parry.value : this.$.stats.deflect.value;
    }


    log.successful = (Math.floor(Math.random() * 100) + 1) <= group.chance;
    if (!log.successful) {
      for (const s of group.sources) {
        log.total_damage_mitigated += s.value;
      }
    } else {
      for (const source of group.sources) {
        switch (source.type) {
          case DamageType.Physical: {
            log.total_damage_mitigated += source.value * (1 - reductionMultiplier(this.$.stats.armor.value - group.penetration.lethality));
            source.value *= reductionMultiplier(this.$.stats.armor.value - group.penetration.lethality);
          } break;
          case DamageType.Energy: {
            log.total_damage_mitigated += source.value * (1 - reductionMultiplier(this.$.stats.filter.value - group.penetration.defiltering));
            source.value *= reductionMultiplier(this.$.stats.filter.value - group.penetration.defiltering);
          } break;
        }

        switch (group.shieldReaction) {
          case ShieldReaction.Normal:
          default: {
            log.total_shield_damage += source.value;
            this.$.vitals.shield -= source.value;

            log.total_shield_damage += Math.min(0, this.$.vitals.shield);
            log.total_health_damage -= Math.min(0, this.$.vitals.shield);
            this.$.vitals.health += Math.min(0, this.$.vitals.shield);

            this.$.vitals.injuries -= reductionMultiplier(this.$.stats.tenacity.value) * DAMAGE_TO_INJURY_RATIO * Math.min(0, this.$.vitals.shield);
            log.total_injuries -= reductionMultiplier(this.$.stats.tenacity.value) * DAMAGE_TO_INJURY_RATIO * Math.min(0, this.$.vitals.shield);

            this.$.vitals.injuries -= Math.min(0, this.$.vitals.health);
            log.total_injuries -= Math.min(0, this.$.vitals.health);

            this.$.vitals.shield = Math.max(this.$.vitals.shield, 0);

            this.$.vitals.health = Math.max(0, this.$.vitals.health);
          } break;
          case ShieldReaction.Only: {
            log.total_shield_damage += source.value;
            this.$.vitals.shield -= source.value;

            log.total_shield_damage += Math.min(0, this.$.vitals.shield);

            log.total_damage_mitigated -= Math.min(0, this.$.vitals.shield);
            switch (source.type) {
              case DamageType.True:
              default: {
                log.total_true_damage += Math.min(0, this.$.vitals.shield);
              } break;
              case DamageType.Physical: {
                log.total_physical_damage += Math.min(0, this.$.vitals.shield);
              } break;
              case DamageType.Energy: {
                log.total_energy_damage += Math.min(0, this.$.vitals.shield);
              }
            }

            this.$.vitals.shield = Math.max(this.$.vitals.shield, 0);
          } break;
          case ShieldReaction.Ignore: {
            log.total_health_damage += source.value;
            this.$.vitals.health -= source.value;

            log.total_injuries += source.value * DAMAGE_TO_INJURY_RATIO * reductionMultiplier(this.$.stats.tenacity.value);
            this.$.vitals.injuries -= source.value * DAMAGE_TO_INJURY_RATIO * reductionMultiplier(this.$.stats.tenacity.value);

            this.$.vitals.injuries -= Math.min(0, this.$.vitals.health);
            log.total_injuries -= Math.min(0, this.$.vitals.health);

            this.$.vitals.health = Math.max(0, this.$.vitals.health);
          } break;
        }

        switch (source.type) {
          case DamageType.True:
          default: {
            log.total_true_damage += source.value;
          } break;
          case DamageType.Physical: {
            log.total_physical_damage += source.value;
          } break;
          case DamageType.Energy: {
            log.total_energy_damage += source.value;
          }
        }
      }
    }

    
    for (const passive of this.findPassives()) {
      passive.$.afterDamageTaken?.(this);
    }
    if (group.attacker instanceof Creature) {
      for (const passive of group.attacker.findPassives()) {
        passive.$.afterDamageGiven?.(group.attacker);
      }
    }

    return log;
  }


  async infoEmbed(Bot: Client): Promise<MessageEmbed> {
    const embed = new MessageEmbed();

    const owner = await Bot.users.fetch(this.$._id).catch(() => null);

    embed
      .setTitle(this.$.info.display.name)
      .setAuthor(this.$.info.npc ? "NPC" : (owner?.tag ?? "Unknown"))
      .setColor("BLUE")
      .setThumbnail(this.$.info.display.avatar ?? "")
      .addFields([
        {
          name: "Vitals",
          inline: false,
          value: 
          `**Health** **${this.$.vitals.health}**/**${this.$.stats.health.value - this.$.vitals.injuries}** (**${Math.round(100 * this.$.vitals.health / this.$.stats.health.value)}%**)  *(**${this.$.stats.health.value}** Health - **${this.$.vitals.injuries}** Injuries)*\n` +
          (this.$.stats.shield.value > 0 ? `**Shield** ${textStat(this.$.vitals.shield, this.$.stats.shield.value)} **${this.$.stats.shield_regen.value}**/t` : "No **Shield**") + "\n" +
          `**Mana** ${textStat(this.$.vitals.mana, this.$.stats.mana.value)} **${this.$.stats.mana_regen.value}**/t\n`
        }
      ])

    return embed;
  }


  dump(): CreatureDump {
    let dump: CreatureDump = {
      _id: this.$._id,
      info: this.$.info,
      vitals: {
        health: this.$.vitals.health / this.$.stats.health.value,
        injuries: this.$.vitals.injuries / this.$.stats.health.value,
        mana: this.$.vitals.mana / this.$.stats.mana.value,
        shield: this.$.vitals.shield / this.$.stats.shield.value
      },
      items: this.$.items
    }

    return dump;
  }

  static async fetch(id: string, db: typeof mongoose, cache = true): Promise<Creature> {
    if (cache) {
      if (this.cache.has(id)) {
        // @ts-expect-error
        return this.cache.get(id);
      }
    }

    const data = await db.connection.collection("Characters").findOne({_id: id});
    if (!data) throw new Error("Not found");

    // @ts-expect-error
    return new Creature(data);
  }
  async put(db: typeof mongoose) {
    try {
      // @ts-expect-error
      await db.connection.collection("Characters").insertOne(this.dump());
    } catch {
      await db.connection.collection("Characters").replaceOne({_id: this.$._id}, this.dump());
    }
  }
  async delete(db: typeof mongoose) {
    Creature.cache.del(this.$._id);
    return db.connection.collection("Characters").deleteOne({_id: this.$._id});
  }

  static readonly MAX_EQUIPPED_WEAPONS = 2;
  static readonly MAX_EQUIPPED_UTILITY = 3;
}

/**
 * Data kept in memory
 */
export interface CreatureData {
  _id: string
  info: {
    display: {
      name: string
      avatar: string | null
    }
    species: string
    class?: string
    npc: boolean
  }
  stats: {
    armor: TrackableStat
    filter: TrackableStat
    melee: TrackableStat
    ranged: TrackableStat
    health: TrackableStat
    mana: TrackableStat
    mana_regen: TrackableStat
    shield: TrackableStat
    shield_regen: TrackableStat
    parry: TrackableStat
    deflect: TrackableStat
    tenacity: TrackableStat
    tech: TrackableStat
  }
  vitals: {
    health: number
    mana: number
    shield: number
    injuries: number
  }
  items: {
    primary_weapon: string | null
    backpack: string[]
    equipped: string[]
  }
}
/**
 * Data kept in database
 */
export interface CreatureDump {
  _id: string
  info?: {
    display?: {
      name?: string
      avatar?: string | null
    }
    species?: string
    class?: string
    npc?: boolean
  }
  vitals?: {
    health?: number
    mana?: number
    shield?: number
    injuries?: number
  }
  items?: {
    primary_weapon?: string | null
    backpack?: string[]
    equipped?: string[]
  }
}