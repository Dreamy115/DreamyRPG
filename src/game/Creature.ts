import { Client, MessageEmbed } from "discord.js";
import mongoose from "mongoose";
import NodeCache from "node-cache";
import { AbilitiesManager, capitalize, ClassManager, CONFIG, EffectManager, ItemManager, PassivesManager, SpeciesManager } from "../index.js";
import { Ability } from "./Abilities.js";
import { AppliedActiveEffect } from "./ActiveEffects.js";
import { DamageCause, DamageGroup, DamageLog, DamageMedium, DamageType, DAMAGE_TO_INJURY_RATIO, reductionMultiplier, ShieldReaction } from "./Damage.js";
import { AttackData, AttackSet } from "./Items.js";
import { PassiveEffect, PassiveModifier } from "./PassiveEffects.js";
import { ModifierType, textStat, TrackableStat } from "./Stats.js";

export default class Creature {
  static cache: NodeCache = new NodeCache({
    checkperiod: CONFIG.cache?.creatureCheckPeriod ?? 120,
    stdTTL: CONFIG.cache?.creatureTTL ?? 90
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
        mana: new TrackableStat(15),
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
      abilities: {
        deck: data.abilities?.deck ?? [],
        hand: data.abilities?.hand ?? [],
        stacks: (data.abilities?.stacks ?? 0) % Creature.ATTACK_MAX_STACKS
      },
      active_effects: data.active_effects ?? [],
      vars: data.vars ?? {}
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
    for (const effect of this.$.active_effects) {
      const effectData = EffectManager.map.get(effect.id);
      if (!effectData) continue;
      
      effectData.$.preload?.(this, effect);
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
    for (const effect of this.$.active_effects) {
      const effectData = EffectManager.map.get(effect.id);
      if (!effectData) continue;
      
      effectData.$.postload?.(this, effect);
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
    let clothingAmount = 0;
    let weaponAmount = 0;

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
        case "wearable": {
          switch (item.$.subtype) {
            case "clothing": {
              if (clothingAmount >= Creature.MAX_EQUIPPED_CLOTHING) {
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

  findAbilities(): Ability[] {
    const abilities: Ability[] = [];

    const species = SpeciesManager.map.get(this.$.info.species);
    if (species) {
      globalOrLocalPusher(abilities, species.$.abilities ?? [], AbilitiesManager);
    }

    const kit = ClassManager.map.get(this.$.info.class ?? "");
    if (kit) {
      globalOrLocalPusher(abilities, kit.$.abilities ?? [], AbilitiesManager);
    } 


    for (const useditem of this.getAllItemIDs()) {
      const item = ItemManager.map.get(useditem); 
      if (!item) continue;

      globalOrLocalPusher(abilities, item.$.abilities ?? [], AbilitiesManager);
    }

    const uniques: string[] = [];
    for (var i = 0; i < abilities.length; i++) {
      const passive = abilities[i];
      for (const u of passive.$.unique ?? []) {
        if (uniques.includes(u)) {
          abilities.splice(i, 1);
          i--;
          break;
        } else {
          uniques.push(u);
        }
      }
    }

    return abilities;
  }

  findPassives(): PassiveEffect[] {
    const passives: PassiveEffect[] = [];

    const species = SpeciesManager.map.get(this.$.info.species);
    if (species) {
      globalOrLocalPusher(passives, species.$.passives ?? [], PassivesManager);
    }

    const kit = ClassManager.map.get(this.$.info.class ?? "");
    if (kit) {
      globalOrLocalPusher(passives, kit.$.passives ?? [], PassivesManager);
    } 


    for (const useditem of this.getAllItemIDs()) {
      const item = ItemManager.map.get(useditem); 
      if (!item) continue;

      globalOrLocalPusher(passives, item.$.passives ?? [], PassivesManager);
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

  applyActiveEffect(effect: AppliedActiveEffect, override_existing = false): boolean {
    let effectData = EffectManager.map.get(effect.id);
    if (!effectData) return false;

    let count = 0;
    if (effectData.$.consecutive_limit > 0)
      for (const e of this.$.active_effects) {
        if (e.id === effect.id) count++;
      }

    if (effectData.$.consecutive_limit > 0 && count > effectData.$.consecutive_limit) {
      if (override_existing) {
        this.$.active_effects[this.$.active_effects.findIndex((v) => v.id === effect.id)] = effect;
      } else return false;
    } else {
      this.$.active_effects.push(effect);
    }

    effectData.$.onApply?.(this, effect);

    return true;
  }
  clearActiveEffect(id: string, type: "expire" | "delete"): boolean {
    const index = this.$.active_effects.findIndex((v) => v.id === id);
    if (index === -1) return false;

    const effect = this.$.active_effects.splice(index, 1)[0];
    const effectData = EffectManager.map.get(effect.id);

    switch (type) {
      case "delete": {
        effectData?.$.onDelete?.(this, effect);
      } break;
      case "expire": {
        effect.ticks = 0;
        effectData?.$.onTick?.(this, effect);
      } break;
    }

    return true;
  }
  clearAllEffects(type: "expire" | "delete") {
    for (const effect of this.$.active_effects) {
      this.clearActiveEffect(effect.id, type);
    }
  }

  tickEffects() {
    for (const effect of this.$.active_effects) {
      const effectData = EffectManager.map.get(effect.id);
      if (!effectData) {
        this.clearActiveEffect(effect.id, "delete");
        continue;
      }

      if (--effect.ticks <= 0) {
        this.clearActiveEffect(effect.id, "expire");
      } else {
        effectData.$.onTick?.(this, effect);
      }
    }
  }

  tickVitals() {
    this.$.vitals.shield += this.$.stats.shield_regen.value;
    this.$.vitals.mana += this.$.stats.mana_regen.value;

    this.vitalsIntegrity();
  }

  tick() {
    this.tickEffects();
    this.tickVitals();
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
      abilities: this.$.abilities,
      active_effects: this.$.active_effects,
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

    const data = await db.connection.collection("Creatures").findOne({_id: id});
    if (!data) throw new Error("Not found");

    // @ts-expect-error
    return new Creature(data);
  }
  async put(db: typeof mongoose) {
    try {
      // @ts-expect-error
      await db.connection.collection("Creatures").insertOne(this.dump());
    } catch {
      await db.connection.collection("Creatures").replaceOne({_id: this.$._id}, this.dump());
    }
  }
  async delete(db: typeof mongoose) {
    Creature.cache.del(this.$._id);
    return db.connection.collection("Creatures").deleteOne({_id: this.$._id});
  }

  static readonly MAX_EQUIPPED_WEAPONS = 2;
  static readonly MAX_EQUIPPED_UTILITY = 3;
  static readonly MAX_EQUIPPED_CLOTHING = 3;

  static readonly ATTACK_MAX_STACKS = 12;
  static readonly ATTACK_STACK_DIE_SIZE = 6;

  // -----NNNWWWC
  static readonly ATTACK_VALUES = [
    null, null, null, null, null, DamageCause.Normal_Attack,
    DamageCause.Normal_Attack, DamageCause.Normal_Attack, DamageCause.Weak_Attack, DamageCause.Weak_Attack, DamageCause.Weak_Attack, DamageCause.Critical_Attack
  ]
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
  abilities: {
    deck: string[]
    hand: string[]
    stacks: number
  }
  active_effects: AppliedActiveEffect[]
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
  abilities?: {
    deck?: string[]
    hand?: string[]
    stacks?: number
  }
  active_effects?: AppliedActiveEffect[]
  vars?: {[key: string]: number}
}

export enum HealType {
  "Health", "Shield", "Overheal", "Mana", "Injuries"
}

function globalOrLocalPusher<T>(array: T[], input: (T | string)[], manager: any) {
  for (const p of input) {
    if (typeof p === "string") {
      const item = manager.map.get(p);
      if (item)
        array.push(item);
    } else {
      array.push(p);
    }
  }
}

export function diceRoll(size = 6): number {
  return Math.floor(Math.random() * size) + 1;
}