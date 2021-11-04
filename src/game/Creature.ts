import { Client, MessageEmbed } from "discord.js";
import mongoose from "mongoose";
import NodeCache from "node-cache";
import { capitalize, ClassManager, ItemManager, PassivesManager, SpeciesManager } from "../index.js";
import { DamageGroup, DamageLog, DamageMedium, DamageType, DAMAGE_TO_INJURY_RATIO, reductionMultiplier, ShieldReaction } from "./Damage.js";
import { AttackData, AttackSet, Item } from "./Items.js";
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
        locked: false,
        species: data.info?.species ?? "default",
        class: data.info?.class ?? "default",
        npc: data.info?.npc ?? false,
      },
      stats: {
        accuracy: new TrackableStat(85),
        armor: new TrackableStat(24),
        filter: new TrackableStat(16),
        melee: new TrackableStat(12),
        ranged: new TrackableStat(12),
        health: new TrackableStat(100),
        mana: new TrackableStat(12),
        mana_regen: new TrackableStat(7),
        shield: new TrackableStat(0),
        shield_regen: new TrackableStat(0),
        parry: new TrackableStat(5),
        deflect: new TrackableStat(2),
        tenacity: new TrackableStat(42),
        tech: new TrackableStat(0),
        vamp: new TrackableStat(0),
        siphon: new TrackableStat(0)
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
      },
      vars: data.vars ?? {}
    }

    // CAPPING
    this.$.stats.vamp.modifiers.push({
      type: ModifierType.CAP_MAX,
      value: 80
    });
    this.$.stats.siphon.modifiers.push({
      type: ModifierType.CAP_MAX,
      value: 80
    });
    //

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

  get defaultAttackSet(): AttackSet {
    return {
      normal: [{
        modifiers: {
          accuracy: 0,
          defiltering: 0,
          lethality: 0
        },
        sources: [{
          type: DamageType.Physical,
          flat_bonus: 7,
          from_skill: 0.5
        }],
        type: DamageMedium.Melee
      }],
      crit: [{
        modifiers: {
          accuracy: 0,
          defiltering: 0,
          lethality: 0
        },
        sources: [{
          type: DamageType.Physical,
          flat_bonus: 8,
          from_skill: 0.75
        }],
        type: DamageMedium.Melee
      }],
      weak: [{
        modifiers: {
          accuracy: 0,
          defiltering: 0,
          lethality: 0
        },
        sources: [{
          type: DamageType.Physical,
          flat_bonus: 3,
          from_skill: 0.3
        }],
        type: DamageMedium.Melee
      }]
    }
  }
  get attackSet(): AttackSet {
    if (!this.$.items.primary_weapon)
      return this.defaultAttackSet;
    
    const weapon = ItemManager.map.get(this.$.items.primary_weapon);
    if (weapon?.$.type !== "weapon")
      return this.defaultAttackSet;
    
    return weapon.$.attack ?? this.defaultAttackSet;
  }

  vitalsIntegrity() {
    this.$.vitals.injuries = Math.round(Math.min(Math.max(0, this.$.vitals.injuries), this.$.stats.health.value));
    this.$.vitals.health = Math.round(Math.min(Math.max(0, this.$.vitals.health), this.$.stats.health.value - this.$.vitals.injuries));
    this.$.vitals.mana = Math.round(Math.min(Math.max(0, this.$.vitals.mana), this.$.stats.mana.value));
    this.$.vitals.shield = Math.round(Math.min(Math.max(0, this.$.vitals.shield), this.$.stats.shield.value));
  }

  checkItemConflicts() {
    let utilAmount = 0;
    let weaponAmount = 0;

    let hasInnerClothing = false;
    let hasOuterClothing = false;

    const uniques: string[] = [];
    if (this.$.items.primary_weapon && ItemManager.map.get(this.$.items.primary_weapon)?.$.type !== "weapon") {
      this.$.items.backpack.push(this.$.items.primary_weapon);
      this.$.items.primary_weapon = null;
    }

    for (var i = 0; i < this.$.items.equipped.length; i++) {
      const item = ItemManager.map.get(this.$.items.equipped[i]);
      if (!item) continue;

        for (const u of item.$.unique ?? []) {
          if (uniques.includes(u)) {
            this.$.items.backpack.push(this.$.items.equipped.splice(i, 1)[0]);
            i--;
            break;
          } else {
            uniques.push(u);
          }
        }

      switch (item.$.type) {
        case "clothing": {
          switch (item.$.subtype) {
            case "inner_layer": {
              if (hasInnerClothing) {
                this.$.items.backpack.push(this.$.items.equipped.splice(i, 1)[0]);
                i--;
              }
            } break;
            case "outer_layer": {
              if (hasOuterClothing) {
                this.$.items.backpack.push(this.$.items.equipped.splice(i, 1)[0]);
                i--;
              }
            } break;
            case "utility": {
              if (utilAmount >= Creature.MAX_EQUIPPED_UTILITY) {
                this.$.items.backpack.push(this.$.items.equipped.splice(i, 1)[0]);
                i--;
              }
            }
          }
        } break;
        case "weapon": {
          if (weaponAmount >= Creature.MAX_EQUIPPED_WEAPONS) {
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

    const uniques: string[] = [];
    for (var i = 0; i < passives.length; i++) {
      const passive = passives[i];
      for (const u of passive.$.unique ?? []) {
        if (uniques.includes(u)) {
          passives.splice(i, 1);
          i--;
          break;
        } else {
          uniques.push(u);
        }
      }
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

    log.final.victim = this;

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
            log.total_damage_mitigated += Math.round(source.value * (1 - reductionMultiplier(this.$.stats.armor.value - group.penetration.lethality)));
            source.value *= reductionMultiplier(this.$.stats.armor.value - group.penetration.lethality);
          } break;
          case DamageType.Energy: {
            log.total_damage_mitigated += Math.round(source.value * (1 - reductionMultiplier(this.$.stats.filter.value - group.penetration.defiltering)));
            source.value *= reductionMultiplier(this.$.stats.filter.value - group.penetration.defiltering);
          } break;
        }
        source.value = Math.round(source.value);

        switch (group.shieldReaction) {
          case ShieldReaction.Normal:
          default: {
            log.total_shield_damage += source.value;
            this.$.vitals.shield -= source.value;

            log.total_shield_damage += Math.min(0, this.$.vitals.shield);
            log.total_health_damage -= Math.min(0, this.$.vitals.shield);
            this.$.vitals.health += Math.min(0, this.$.vitals.shield);

            this.$.vitals.injuries -= Math.round(reductionMultiplier(this.$.stats.tenacity.value) * DAMAGE_TO_INJURY_RATIO * Math.min(0, this.$.vitals.shield));
            log.total_injuries -= Math.round(reductionMultiplier(this.$.stats.tenacity.value) * DAMAGE_TO_INJURY_RATIO * Math.min(0, this.$.vitals.shield));

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

            log.total_injuries += Math.round(source.value * DAMAGE_TO_INJURY_RATIO * reductionMultiplier(this.$.stats.tenacity.value));
            this.$.vitals.injuries -= Math.round(source.value * DAMAGE_TO_INJURY_RATIO * reductionMultiplier(this.$.stats.tenacity.value));

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
        log.total_damage_taken += source.value;
      }
    }
    
    for (const passive of this.findPassives()) {
      passive.$.afterDamageTaken?.(this);
    }
    if (group.attacker instanceof Creature) {
      group.attacker.heal(Math.round(log.total_physical_damage * group.attacker.$.stats.vamp.value / 100), HealType.Health);
      group.attacker.heal(Math.round(log.total_energy_damage * group.attacker.$.stats.siphon.value / 100), HealType.Shield);

      for (const passive of group.attacker.findPassives()) {
        passive.$.afterDamageGiven?.(group.attacker);
      }
    }

    this.vitalsIntegrity();

    return log;
  }

  heal(amount: number, type: HealType) {
    switch (type) {
      case HealType.Health: {
        this.$.vitals.health += amount;
      } break;
      case HealType.Shield: {
        this.$.vitals.shield += amount;
      } break;
      case HealType.Overheal: {
        this.$.vitals.health += amount;
        this.$.vitals.shield += Math.max(this.$.vitals.health - this.$.stats.health.value, 0);
      } break;
      case HealType.Mana: {
        this.$.vitals.mana += amount;
      } break;
      case HealType.Injuries: {
        this.$.vitals.injuries -= amount;
      } break;
    }

    this.vitalsIntegrity();
  }

  async infoEmbed(Bot: Client, page: string): Promise<MessageEmbed> {
    const embed = new MessageEmbed();

    const owner = await Bot.users.fetch(this.$._id).catch(() => null);

    embed
      .setTitle(this.$.info.display.name)
      .setAuthor(this.$.info.npc ? "NPC" : (owner?.tag ?? "Unknown"))
      .setColor("BLUE")
      .setThumbnail(this.$.info.display.avatar ?? "")

    switch (page) {
      default:
      case "stats": {
        embed.addField(
          "Basic",
          `Race - **${SpeciesManager.map.get(this.$.info.species ?? "")?.$.info.name ?? "Unknown"}**\n` +  
          `Class - **${ClassManager.map.get(this.$.info.class ?? "")?.$.info.name ?? "Unknown"}**`  
        ).addFields([
          {
            name: "Vitals",
            inline: false,
            value: 
            `**Health** **${this.$.vitals.health}**/**${this.$.stats.health.value - this.$.vitals.injuries}** (**${Math.round(100 * this.$.vitals.health / this.$.stats.health.value)}%**)  *(**${this.$.stats.health.value}** Health - **${this.$.vitals.injuries}** Injuries)*\n` +
            (this.$.stats.shield.value > 0 ? `**Shield** ${textStat(this.$.vitals.shield, this.$.stats.shield.value)} **${this.$.stats.shield_regen.value}**/t` : "No **Shield**") + "\n" +
            `**Mana** ${textStat(this.$.vitals.mana, this.$.stats.mana.value)} **${this.$.stats.mana_regen.value}**/t\n`
          },
          {
            name: "Offense",
            value: 
              `**${this.$.stats.accuracy.value}%** Accuracy *(Hit Chance)*\n` +
              `Melee **${this.$.stats.melee.value}** | **${this.$.stats.ranged.value}** Ranged *(Attack Power)*\n` +
              "\n" +
              `Vamp **${this.$.stats.vamp.value}%** | **${this.$.stats.siphon.value}%** Siphon *(Regenerates **health** | **shields** by **%** of damage dealt when dealing **physical** | **energy** damage)*\n` +
              "\n" +
              `**${this.$.stats.tech.value}** Tech *(Ability Power)*` 
          },
          {
            name: "Defense",
            value:
            `**${this.$.stats.armor.value}** Armor *(**${Math.round(100 * (1 - reductionMultiplier(this.$.stats.armor.value)))}%** Reduced Physical Damage)*\n` +
            `**${this.$.stats.filter.value}** Filter *(**${Math.round(100 * (1 - reductionMultiplier(this.$.stats.filter.value)))}%** Reduced Energy Damage)*\n` +
            "\n" +
            `**${this.$.stats.tenacity.value}** Tenacity *(Taking **${Math.round(100 * reductionMultiplier(this.$.stats.tenacity.value) * DAMAGE_TO_INJURY_RATIO)}%** health damage as **Injuries**)*` +
            "\n" +
            `Parry **${this.$.stats.parry.value}%** | **${this.$.stats.deflect.value}%** Deflect *(Reduces hit chance from **Melee** | **Ranged**)*\n`
          }
        ])
      } break;
      case "passives": {
        const passives = this.findPassives();

        for (var i = 0; i < passives.length && i < 20; i++) {
          const passive = passives[i];

          embed.addField(
            `${passive.$.info.name}`,
            function() {
              var str = `*${passive.$.info.lore}*`;
              if ((passive.$.modifiers ?? []).length > 0) {
                str += `\n- **Modifiers**\n`;
                for (const mod of passive.$.modifiers ?? []) {
                  str += `**`;
                  switch (mod.type) {
                    case ModifierType.MULTIPLY: str += `${mod.value}x`; break;
                    case ModifierType.ADD_PERCENT: str += `${mod.value >= 0 ? "+" : "-"}${Math.round(Math.abs(mod.value) * 1000) / 10}%`; break;
                    case ModifierType.CAP_MAX: str += `${mod.value}^`; break;
                    case ModifierType.ADD_PERCENT: str += `${mod.value >= 0 ? "+" : "-"}${Math.abs(mod.value)}`; break;
                  }
                  str += `** ${capitalize(mod.stat.replaceAll(/_/g, " "))}\n`;
                }
              }
              return str;
            }()
          )  
        }    
      } break;
      case "attack": {
        function attackInfo(creature: Creature, attacks: AttackData[]) {
          var str = "";

          for (const attackdata of attacks) {
            str += `- ${attackdata.type === DamageMedium.Melee ? "Melee" : "Ranged"}
            Sources:
            ${function () {
              var str = "";

              for (const source of attackdata.sources) {
                str += `[**${Math.round(source.flat_bonus + (source.from_skill * (attackdata.type === DamageMedium.Melee ? creature.$.stats.melee.value : creature.$.stats.ranged.value)))} *(${source.flat_bonus} + ${Math.round(100 * source.from_skill) / 100}x)* ${DamageType[source.type]}**]\n`
              }

              return str;
            }()}
            **${attackdata.modifiers.accuracy + creature.$.stats.accuracy.value} *(${creature.$.stats.accuracy.value} ${attackdata.modifiers.accuracy >= 0 ? "+" : "-"}${Math.abs(attackdata.modifiers.accuracy)})*** Accuracy
            **${attackdata.modifiers.lethality}** Lethality
            **${attackdata.modifiers.defiltering}** Defiltering`;
          }

          return str;
        }

        const attack = this.attackSet;
        embed.addFields([
          {
            name: "Crit",
            value: attackInfo(this, attack.crit),
            inline: true
          },
          {
            name: "Normal",
            value: attackInfo(this, attack.normal),
            inline: true
          },
          {
            name: "Weak",
            value: attackInfo(this, attack.weak),
            inline: true
          }
        ])
      }
    }

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
      items: this.$.items,
      vars: this.$.vars
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
    locked: boolean
    species: string
    class?: string
    npc: boolean
  }
  stats: {
    accuracy: TrackableStat
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
    vamp: TrackableStat
    siphon: TrackableStat
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
  vars: {[key: string]: number}
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
    locked?: boolean
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
  vars?: {[key: string]: number}
}

export enum HealType {
  "Health", "Shield", "Overheal", "Mana", "Injuries"
}