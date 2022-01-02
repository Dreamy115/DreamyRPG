import { Client, MessageEmbed } from "discord.js";
import mongoose from "mongoose";
import NodeCache from "node-cache";
import { AbilitiesManager, capitalize, ClassManager, CONFIG, EffectManager, ItemManager, LocationManager, PassivesManager, PerkManager, shuffle, SkillManager, SpeciesManager } from "../index.js";
import { AppliedActiveEffect } from "./ActiveEffects.js";
import { CraftingMaterials } from "./Crafting.js";
import { CreatureAbility } from "./CreatureAbilities.js";
import { DamageCause, DamageGroup, DamageLog, DamageMedium as DamageMethod, DamageType, DAMAGE_TO_INJURY_RATIO, reductionMultiplier, ShieldReaction } from "./Damage.js";
import { AttackData, AttackSet, Item } from "./Items.js";
import { PassiveEffect, PassiveModifier } from "./PassiveEffects.js";
import { CreaturePerk } from "./Perks.js";
import { CreatureSkill } from "./Skills.js";
import { Modifier, ModifierType, textStat, TrackableStat } from "./Stats.js";

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
        location: data.info?.location ?? "default",
        locked: data.info?.locked ?? false,
        species: data.info?.species ?? "default",
        class: data.info?.class ?? "default",
        npc: data.info?.npc ?? false,
      },
      stats: {
        attack_cost: new TrackableStat(6),
        accuracy: new TrackableStat(95),
        armor: new TrackableStat(24),
        lethality: new TrackableStat(0),
        defiltering: new TrackableStat(0),
        cutting: new TrackableStat(0),
        filter: new TrackableStat(16),
        melee: new TrackableStat(14),
        ranged: new TrackableStat(14),
        health: new TrackableStat(100),
        mana: new TrackableStat(25),
        mana_regen: new TrackableStat(10),
        shield: new TrackableStat(1),
        shield_regen: new TrackableStat(1),
        parry: new TrackableStat(10),
        deflect: new TrackableStat(5),
        tenacity: new TrackableStat(42),
        tech: new TrackableStat(0),
        vamp: new TrackableStat(0),
        siphon: new TrackableStat(0),
        initiative: new TrackableStat(10),
        insulation: new TrackableStat(0)
      },
      attributes: {
        STR: new TrackableStat(data.attributes?.STR ?? 0),
        FOR: new TrackableStat(data.attributes?.FOR ?? 0),
        REJ: new TrackableStat(data.attributes?.REJ ?? 0),
        PER: new TrackableStat(data.attributes?.PER ?? 0),
        INT: new TrackableStat(data.attributes?.INT ?? 0),
        DEX: new TrackableStat(data.attributes?.DEX ?? 0),
        CHA: new TrackableStat( data.attributes?.CHA ?? 0)
      },
      experience: {
        level: Math.max(data.experience?.level ?? 1, 1)
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
        primary_weapon: data.items?.primary_weapon ?? null,
        skills: new Set(data.items?.skills ?? []),
        schematics: new Set(data.items?.schematics ?? []),
        crafting_materials: function () {
          return new CraftingMaterials(data.items?.crafting_materials ?? {})
        }()
      },
      abilities: {
        deck: data.abilities?.deck ?? [],
        hand: data.abilities?.hand ?? [],
        stacks: data.abilities?.stacks ?? 0
      },
      active_effects: data.active_effects ?? [],
      vars: data.vars ?? {}
    }

    this.checkItemConflicts();

    const passives = this.passives;
    // PRELOAD
    for (const passive of passives) {
      passive.$.preload?.(this);
      for (const mod of passive.$.modifiers ?? []) {
        this.applyNamedModifier(mod);
      }
    }
    for (const effect of this.active_effects) {
      const effectData = EffectManager.map.get(effect.id);
      if (!effectData) continue;
      
      effectData.$.preload?.(this, effect);
    }
    
    this.applyModifiersToBaseStats(Creature.LEVEL_MODS, this.$.experience.level - 1);
    for (const a in this.$.attributes) {
      // @ts-expect-error
      this.applyModifiersToBaseStats(Creature.ATTRIBUTE_MODS[a], Math.round(this.$.attributes[a].value));
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
    for (const effect of this.active_effects) {
      const effectData = EffectManager.map.get(effect.id);
      if (!effectData) continue;
      
      effectData.$.postload?.(this, effect);
    }

    this.vitalsIntegrity();
  }

  applyModifiersToBaseStats(list: PassiveModifier[], amount: number) {
    for (const mod of list) {
      // @ts-expect-error
      const stat: TrackableStat = this.$.stats[mod.stat];
      switch (mod.type) {
        case ModifierType.ADD:
        default:
          stat.base += mod.value * amount;
          break;
        case ModifierType.ADD_PERCENT:
          stat.base += mod.value * stat.base * amount;
          break;
        case ModifierType.MULTIPLY:
          stat.base *= Math.pow(mod.value, amount);
      }
    }
  }

  get id() {
    return this.$._id;
  }
  get displayName() {
    return this.$.info.display.name;
  }
  get class() {
    return ClassManager.map.get(this.$.info.class ?? "");
  }


  get defaultAttackSet(): AttackSet {
    return {
      type: DamageMethod.Melee,
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

    if (isNaN(this.$.vitals.shield))
      this.$.vitals.shield = 0;

    if (isNaN(this.$.vitals.health))
      this.$.vitals.health = 1;

    if (isNaN(this.$.vitals.injuries))
      this.$.vitals.injuries = 0;

    if (isNaN(this.$.vitals.mana))
      this.$.vitals.mana = 0;

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

        // @ts-expect-error
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

  wipeItems() {
    this.$.items = {
      backpack: [],
      crafting_materials: new CraftingMaterials({}),
      equipped: [],
      primary_weapon: null,
      skills: new Set(),
      schematics: new Set()
    }
  }

  drawAbilityCard(): CreatureAbility | null {
    if (this.$.abilities.hand.length >= Creature.MAX_HAND_AMOUNT) return null;

    var shuffled = false;
    var ability: CreatureAbility | undefined = undefined;
    while (!ability) {
      const id = this.$.abilities.deck.shift();
      if (id) {
        ability = AbilitiesManager.map.get(id);
      } else {
        if (!shuffled) {
          this.reshuffleAbilityDeck();
          shuffled = true;
        } else {
          break;
        }
      }
    }

    if (ability)
      this.$.abilities.hand.push(ability.$.id)
    return ability ?? null;
  }

  reshuffleAbilityDeck() {
    this.$.abilities.deck = [];
    for (const ability of this.abilities) {
      this.$.abilities.deck.push(ability.$.id);
    }
    shuffle(this.$.abilities.deck);
  }

  get abilities(): CreatureAbility[] {
    const abilities: CreatureAbility[] = [];

    const species = SpeciesManager.map.get(this.$.info.species);
    if (species) {
      globalOrLocalPusher(abilities, species.$.abilities ?? [], AbilitiesManager);
    }

    const kit = ClassManager.map.get(this.$.info.class ?? "");
    if (kit) {
      globalOrLocalPusher(abilities, kit.$.abilities ?? [], AbilitiesManager);
    } 


    for (const item of this.items) {
      // @ts-expect-error
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

    return [... new Set(abilities)];
  }

  get passives(): PassiveEffect[] {
    const passives: PassiveEffect[] = [];

    const species = SpeciesManager.map.get(this.$.info.species);
    if (species) {
      globalOrLocalPusher(passives, species.$.passives ?? [], PassivesManager);
    }

    const kit = ClassManager.map.get(this.$.info.class ?? "");
    if (kit) {
      globalOrLocalPusher(passives, kit.$.passives ?? [], PassivesManager);
    } 


    for (const item of this.items) {
      // @ts-expect-error
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

    return [...new Set(passives)];
  }

  get items(): Item[] {
    const items: Item[] = [];

    const ids = this.itemIDs;
    for (const i of ids) {
      const item = ItemManager.map.get(i);
      if (!item) continue;

      items.push(item);
    }

    return items;
  }
  get itemIDs(): string[] {
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
    let stat = this.$.stats[mod.stat] ?? this.$.attributes[mod.stat];
    if (stat) {
      stat.modifiers.push({type: mod.type, value: mod.value});
      return true;
    }
    return false;
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

    for (const passive of this.passives) {
      passive.$.beforeDamageTaken?.(this);
    }
    if (group.attacker instanceof Creature) {
      for (const passive of group.attacker.passives) {
        passive.$.beforeDamageGiven?.(group.attacker);
      }
    }

    if (group.useDodge) {
      group.chance -= group.medium === DamageMethod.Direct ? 0 : group.medium === DamageMethod.Melee ? this.$.stats.parry.value : this.$.stats.deflect.value;
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
            log.total_damage_mitigated += Math.round(source.value * (1 - reductionMultiplier(this.$.stats.armor.value - (group.penetration?.lethality ?? 0))));
            source.value *= reductionMultiplier(this.$.stats.armor.value - (group.penetration?.lethality ?? 0));
          } break;
          case DamageType.Energy: {
            log.total_damage_mitigated += Math.round(source.value * (1 - reductionMultiplier(this.$.stats.filter.value - (group.penetration?.defiltering ?? 0))));
            source.value *= reductionMultiplier(this.$.stats.filter.value - (group.penetration?.defiltering ?? 0));
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

            const injuries = Math.round(reductionMultiplier(this.$.stats.tenacity.value - (group.penetration?.cutting ?? 0)) * DAMAGE_TO_INJURY_RATIO * Math.min(0, this.$.vitals.shield));;
            this.$.vitals.injuries -= injuries;
            log.total_injuries -= injuries;

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

            log.total_injuries += Math.round(source.value * DAMAGE_TO_INJURY_RATIO * reductionMultiplier(this.$.stats.tenacity.value - (group.penetration?.cutting ?? 0)));
            this.$.vitals.injuries -= Math.round(source.value * DAMAGE_TO_INJURY_RATIO * reductionMultiplier(this.$.stats.tenacity.value - (group.penetration?.cutting ?? 0)));

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
    
    for (const passive of this.passives) {
      passive.$.afterDamageTaken?.(this);
    }
    if (group.attacker instanceof Creature) {
      group.attacker.heal(Math.round(log.total_physical_damage * group.attacker.$.stats.vamp.value / 100), HealType.Health);
      group.attacker.heal(Math.round(log.total_energy_damage * group.attacker.$.stats.siphon.value / 100), HealType.Shield);

      for (const passive of group.attacker.passives) {
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

  get active_effects() {
    const location_effects: AppliedActiveEffect[] = [];
    for (const e of this.location?.$.area_effects ?? []) {
      location_effects.push({
        id: e.id,
        severity: e.severity,
        ticks: -1
      });
    }

    return this.$.active_effects.concat(location_effects);
  }

  applyActiveEffect(effect: AppliedActiveEffect, override_existing = false): boolean {
    let effectData = EffectManager.map.get(effect.id);
    if (!effectData) return false;

    let count = 0;
    if (effectData.$.consecutive_limit > 0)
      for (const e of this.active_effects) {
        if (e.id === effect.id) count++;
      }

    if (effectData.$.consecutive_limit > 0 && count > effectData.$.consecutive_limit) {
      if (override_existing) {
        this.active_effects[this.active_effects.findIndex((v) => v.id === effect.id)] = effect;
      } else return false;
    } else {
      this.active_effects.push(effect);
    }

    effectData.$.onApply?.(this, effect);

    return true;
  }
  clearActiveEffect(id: string, type: "expire" | "delete"): boolean {
    const index = this.active_effects.findIndex((v) => v.id === id);
    if (index === -1) return false;

    const effect = this.active_effects.splice(index, 1)[0];
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
    for (const effect of this.active_effects) {
      this.clearActiveEffect(effect.id, type);
    }
  }

  tickEffects() {
    for (const effect of this.active_effects) {
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

  get isAbleToFight(): boolean {
    if (this.$.vitals.health <= 0) return false;

    return true;
  }


  clearAttributes() {
    for (const a in this.$.attributes) {
      // @ts-expect-error
      this.$.attributes[a].base = 0;
    }
  }

  get totalAttributePointsUsed(): number {
    let num = 0;

    for (const a in this.$.attributes) {
      // @ts-expect-error
      num += this.$.attributes[a]?.base ?? 0;
    }

    return num;
  }


  get perks(): CreaturePerk[] {
    const perks: CreaturePerk[] = [];

    const race = SpeciesManager.map.get(this.$.info.species);
    globalOrLocalPusher(perks, race?.$.perks ?? [], PerkManager);

    const kit = ClassManager.map.get(this.$.info.class ?? "");
    globalOrLocalPusher(perks, kit?.$.perks ?? [], PerkManager);
    
    for (const skill of this.skills) {
      globalOrLocalPusher(perks, skill.$.perks ?? [], PerkManager);
    }

    const items = this.items;
    for (const item of items) {
      // @ts-expect-error
      globalOrLocalPusher(perks, item.$.perks ?? [], PerkManager)
    }

    return [...new Set(perks)];
  }

  get skills(): CreatureSkill[] {
    const array: CreatureSkill[] = [];
    
    for (const s of this.$.items.skills) {
      const skill = SkillManager.map.get(s);
      if (skill)
        array.push(skill);
    }

    const uniques: string[] = [];
    for (var s = 0; s < array.length; s++) {
      const skill = array[s];
      if (!skill.$.unique || skill.$.unique.length === 0) continue;

      for (const u of skill.$.unique) {
        if (uniques.includes(u)) {
          array.splice(s, 1);
          s--;
          break;
        } else {
          uniques.push(u);
        }
      }
    }

    return [...new Set(array)];
  }

  get location() {
    return LocationManager.map.get(this.$.info.location);
  }

  get schematics() {
    return new Set([...(this.species?.$.schematics ?? []), ...(this.itemClass?.$.schematics ?? []), ...this.$.items.schematics])
  }

  get itemClass () {
    return ClassManager.map.get(this.$.info.class ?? "")
  }
  get species() {
    return SpeciesManager.map.get(this.$.info.species)
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
      attributes: {},
      experience: this.$.experience,
      items: {
        backpack: this.$.items.backpack,
        // @ts-expect-error
        crafting_materials: this.$.items.crafting_materials,
        equipped: this.$.items.equipped,
        primary_weapon: this.$.items.primary_weapon,
        schematics: [...this.$.items.schematics],
        skills: [...this.$.items.skills]
      },
      abilities: this.$.abilities,
      active_effects: this.$.active_effects,
      vars: this.$.vars
    }

    for (const a in this.$.attributes) {
      // @ts-expect-error
      const attr: TrackableStat = this.$.attributes[a];

      // @ts-expect-error
      dump.attributes[a] = attr.base;
    }

    return dump;
  }

  get deltaHeat() {
    return (this.location?.$.temperature ?? 0) + this.$.stats.insulation.value;
  }

  static async fetch(id: string, db: typeof mongoose, cache = true): Promise<Creature> {
    if (cache) {
      if (this.cache.has(id)) {
        // @ts-expect-error
        return this.cache.get(id);
      }
    }

    const data = await db.connection.collection(Creature.COLLECTION_NAME).findOne({_id: id});
    if (!data) throw new Error("Not found");

    // @ts-expect-error
    return new Creature(data);
  }
  async put(db: typeof mongoose) {
    try {
      // @ts-expect-error
      await db.connection.collection(Creature.COLLECTION_NAME).insertOne(this.dump());
    } catch {
      await db.connection.collection(Creature.COLLECTION_NAME).replaceOne({_id: this.$._id}, this.dump());
    }
  }
  async delete(db: typeof mongoose) {
    Creature.cache.del(this.$._id);
    return db.connection.collection(Creature.COLLECTION_NAME).deleteOne({_id: this.$._id});
  }

  static readonly MAX_EQUIPPED_WEAPONS = 2;
  static readonly MAX_EQUIPPED_UTILITY = 4;
  static readonly MAX_EQUIPPED_CLOTHING = 3;

  static readonly ATTACK_MAX_STACKS = 12;
  static readonly ATTACK_STACK_DIE_SIZE = 6;

  static readonly MIN_HAND_AMOUNT = 3;
  static readonly MAX_HAND_AMOUNT = 6;

  // -----NNNWWWC
  static readonly ATTACK_VALUES = [
    undefined, null, null, null, null, null, DamageCause.Weak_Attack,
    DamageCause.Weak_Attack, DamageCause.Weak_Attack, DamageCause.Normal_Attack, DamageCause.Normal_Attack, DamageCause.Normal_Attack, DamageCause.Critical_Attack
  ]

  static readonly LEVEL_MODS: PassiveModifier[] = [
    {
      type: ModifierType.ADD_PERCENT,
      value: 0.15,
      stat: "melee"
    },
    {
      type: ModifierType.ADD_PERCENT,
      value: 0.15,
      stat: "ranged"
    },
    {
      type: ModifierType.ADD_PERCENT,
      value: 0.1,
      stat: "armor"
    },
    {
      type: ModifierType.ADD_PERCENT,
      value: 0.1,
      stat: "filter"
    },
    {
      type: ModifierType.ADD_PERCENT,
      value: 0.05,
      stat: "health"
    },
    {
      type: ModifierType.ADD_PERCENT,
      value: 0.01,
      stat: "mana"
    },
    {
      type: ModifierType.ADD_PERCENT,
      value: 0.0075,
      stat: "mana_regen"
    },
    {
      type: ModifierType.ADD_PERCENT,
      value: 0.05,
      stat: "shield_regen"
    },
    {
      type: ModifierType.ADD_PERCENT,
      value: 0.08,
      stat: "shield"
    },
    {
      type: ModifierType.ADD_PERCENT,
      value: 0.05,
      stat: "accuracy"
    },
    {
      type: ModifierType.ADD_PERCENT,
      value: 0.1,
      stat: "parry"
    },
    {
      type: ModifierType.ADD_PERCENT,
      value: 0.1,
      stat: "deflect"
    },
    {
      type: ModifierType.ADD_PERCENT,
      value: 0.135,
      stat: "tech"
    }
  ]
  static readonly ATTRIBUTE_MODS: {[key: string]: PassiveModifier[]} = {
    STR: [
      {
        type: ModifierType.ADD_PERCENT,
        value: 0.1,
        stat: "melee"
      },
      {
        type: ModifierType.ADD_PERCENT,
        value: 0.1,
        stat: "ranged"
      }
    ],
    FOR: [
      {
        type: ModifierType.ADD_PERCENT,
        value: 0.07,
        stat: "armor"
      },
      {
        type: ModifierType.ADD_PERCENT,
        value: 0.065,
        stat: "filter"
      },
      {
        type: ModifierType.ADD_PERCENT,
        value: 0.1,
        stat: "health"
      }
    ],
    REJ: [
      {
        type: ModifierType.ADD_PERCENT,
        value: 0.15,
        stat: "mana_regen"
      },
      {
        type: ModifierType.ADD_PERCENT,
        value: 0.1,
        stat: "shield_regen"
      },
      {
        type: ModifierType.ADD_PERCENT,
        value: 0.12,
        stat: "tenacity"
      }
    ],
    PER: [
      {
        type: ModifierType.ADD_PERCENT,
        value: 0.04,
        stat: "accuracy"
      },
      {
        type: ModifierType.ADD,
        value: 1,
        stat: "initiative"
      }
    ],
    INT: [
      {
        type: ModifierType.ADD_PERCENT,
        value: 0.25,
        stat: "tech"
      },
      {
        type: ModifierType.ADD_PERCENT,
        value: 0.12,
        stat: "mana"
      }
    ],
    DEX: [
      {
        type: ModifierType.ADD_PERCENT,
        value: 0.18,
        stat: "deflect"
      },
      {
        type: ModifierType.ADD_PERCENT,
        value: 0.15,
        stat: "parry"
      }
    ],
    CHA: [

    ]
  }
  static readonly ATTRIBUTE_DESCRIPTIONS = {
    STR: "Physical Strength and brute force.",
    FOR: "Fortitude, resilience, and physical resistance.",
    REJ: "Rejuvenation, the quickness of regaining ground.",
    PER: "Perception, all 6 senses. Know your enemy.",
    INT: "Intelligence, crafting, technological swiftness.",
    DEX: "Dexterity, agility, light as a feather.",
    CHA: "Charisma, looks, and wits. Negotiation skills."
  }
  static readonly ATTRIBUTE_MAX = 8;

  static readonly ID_REGEX = /^([A-Za-z0-9]|[_-]){3,96}$/
  static readonly ID_REGEX_ERR_MSG = "Invalid ID. Must be between **3**-**96** in length, and contain only **A-Z**, **a-z**, **0-9** and **\_**, **-** characters.";

  static readonly COLLECTION_NAME = "Creatures";
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
    location: string
    locked: boolean
    species: string
    class?: string
    npc: boolean
  }
  stats: {
    accuracy: TrackableStat
    armor: TrackableStat
    filter: TrackableStat
    lethality: TrackableStat
    defiltering: TrackableStat
    cutting: TrackableStat
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
    initiative: TrackableStat
    insulation: TrackableStat
    attack_cost: TrackableStat
  }
  attributes: {
    STR: TrackableStat
    FOR: TrackableStat
    REJ: TrackableStat
    PER: TrackableStat
    INT: TrackableStat
    DEX: TrackableStat
    CHA: TrackableStat
  }
  experience: {
    level: number
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
    skills: Set<string>
    schematics: Set<string>
    crafting_materials: CraftingMaterials
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
    location?: string
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
  attributes?: {
    STR?: number
    FOR?: number
    REJ?: number
    PER?: number
    INT?: number
    DEX?: number
    CHA?: number
  }
  experience?: {
    level?: number
  }
  items?: {
    primary_weapon?: string | null
    backpack?: string[]
    equipped?: string[]
    skills?: string[]
    schematics?: string[]
    crafting_materials?: {[key: string]: number}
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