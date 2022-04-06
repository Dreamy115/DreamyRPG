import { Client, MessageEmbed } from "discord.js";
import mongoose from "mongoose";
import NodeCache from "node-cache";
import { bar_styles } from "../app/Bars.js";
import { AbilitiesManager, capitalize, clamp, CONFIG, db, EffectManager, ItemManager, LocationManager, PassivesManager, PerkManager, rotateLine, SchematicsManager, shuffle, SkillManager, SpeciesManager } from "../index.js";
import { AppliedActiveEffect, EffectStacking } from "./ActiveEffects.js";
import { CraftingMaterials, Material } from "./Crafting.js";
import { CreatureAbility } from "./CreatureAbilities.js";
import { DamageCause, DamageGroup, DamageLog, DamageMethod as DamageMethod, DamageType, DAMAGE_TO_INJURY_RATIO, reductionMultiplier, ShieldReaction } from "./Damage.js";
import { Fight } from "./Fight.js";
import { GameDirective } from "./GameDirectives.js";
import { AttackData, AttackSet, Item, ItemSlot, InventoryItem, EquippableInventoryItem, WeaponInventoryItem, WearableInventoryItem, NormalWearableItemData, SlotDescriptions, MaskWearableItemData, WeaponItemData, ShieldWearableItemData, VestWearableItemData, JacketWearableItemData, BackpackWearableItemData, GlovesWearableItemData, ConsumableItemData, GenericItemData } from "./Items.js";
import { ItemStatModule, ModuleType } from "./Modules.js";
import { PassiveEffect, NamedModifier } from "./PassiveEffects.js";
import { CreaturePerk } from "./Perks.js";
import { CreatureSkill } from "./Skills.js";
import { Modifier, ModifierType, textStat, TrackableStat } from "./Stats.js";

export default class Creature {
  static cache: NodeCache = new NodeCache({
    checkperiod: CONFIG?.cache?.creatureCheckPeriod ?? 120,
    stdTTL: CONFIG?.cache?.creatureTTL ?? 90
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
        npc: data.info?.npc ?? false,
      },
      stats: {
        ult_stack_target: new TrackableStat(0),
        attack_cost: new TrackableStat(8),
        accuracy: new TrackableStat(90),
        armor: new TrackableStat(0),
        lethality: new TrackableStat(0),
        passthrough: new TrackableStat(0),
        cutting: new TrackableStat(0),
        dissipate: new TrackableStat(0),
        melee: new TrackableStat(100),
        ranged: new TrackableStat(100),
        damage: new TrackableStat(15),
        health: new TrackableStat(100),
        mana: new TrackableStat(30),
        mana_regen: new TrackableStat(10),
        shield: new TrackableStat(0),
        shield_regen: new TrackableStat(0),
        parry: new TrackableStat(10),
        deflect: new TrackableStat(5),
        tenacity: new TrackableStat(32),
        tech: new TrackableStat(0),
        vamp: new TrackableStat(0),
        siphon: new TrackableStat(0),
        initiative: new TrackableStat(10),
        min_comfortable_temperature: new TrackableStat(0),
        heat_capacity: new TrackableStat(100),
        filtering: new TrackableStat(0),
        stress_resistance: new TrackableStat(0),
        mental_strength: new TrackableStat(Creature.INTENSITY_CAPACITY)
      },
      attributes: {
        STR: new TrackableStat(data.attributes?.STR ?? 0),
        FOR: new TrackableStat(data.attributes?.FOR ?? 0),
        REJ: new TrackableStat(data.attributes?.REJ ?? 0),
        PER: new TrackableStat(data.attributes?.PER ?? 0),
        INT: new TrackableStat(data.attributes?.INT ?? 0),
        DEX: new TrackableStat(data.attributes?.DEX ?? 0),
        CHA: new TrackableStat(data.attributes?.CHA ?? 0),
        MND: new TrackableStat(data.attributes?.MND ?? 0)
      },
      experience: {
        level: Math.max(data.experience?.level ?? 1, 1)
      },
      vitals: {
        health: (data.vitals?.health ?? 1),
        injuries: (data.vitals?.injuries ?? 0),
        mana: (data.vitals?.mana ?? 0),
        shield: (data.vitals?.shield ?? 0),
        heat: (data.vitals?.heat ?? 1),
        intensity: (data.vitals?.intensity ?? 0)
      },
      items: {
        slotted: {} as Record<ItemSlot, undefined>,
        weapons: data.items?.weapons ?? [],
        backpack: data.items?.backpack ?? [],
        primary_weapon: data.items?.primary_weapon ?? null,
        skills: new Set(data.items?.skills ?? []),
        schematics: new Set(data.items?.schematics ?? []),
        crafting_materials: function () {
          return new CraftingMaterials(data.items?.crafting_materials ?? {})
        }()
      },
      abilities: {
        ult_stacks: data.abilities?.ult_stacks ?? 0,
        deck: data.abilities?.deck ?? [],
        hand: data.abilities?.hand ?? [],
        stacks: data.abilities?.stacks ?? 0
      },
      status: {
        abilities: true,
        attacks: true,
        up: true,
        alive: true
      },
      sim_message: data.sim_message ?? null,
      active_effects: data.active_effects ?? [],
      vars: data.vars ?? {}
    }

    function fixModule(item: WearableInventoryItem | InventoryItem) {
      const module: ItemStatModule | undefined = (item as WearableInventoryItem | undefined)?.stat_module;

      if (module)
      (item as WearableInventoryItem).stat_module = new ItemStatModule(module.type ?? -1, module.value ?? 0);
    }

    for (const _i in data.items?.slotted) {
      const i = _i as ItemSlot;
      this.$.items.slotted[i] = data?.items?.slotted[i];

      const item = this.$.items.slotted[i];
      if (item)
        fixModule(item);
    }

    for (const i of this.$.items.backpack) {
      fixModule(i);
    }

    this.checkItemConflicts();
    // PRELOAD

    const slottedItems = {} as Record<ItemSlot, Item | null>;
    for (const _slot in SlotDescriptions) {
      const slot = _slot as ItemSlot;

      slottedItems[slot] = ItemManager.map.get(this.$.items.slotted[slot]?.id ?? "") ?? null;
    }

    // ADDING ITEM BASES
    this.$.stats.ult_stack_target.base = this.ultimate?.$.cost ?? 0;
    
    this.$.stats.damage.base += (ItemManager.map.get(this.$.items.primary_weapon?.id ?? "")?.$ as WeaponItemData).base_damage ?? 0;
    
    this.$.stats.filtering.base += (slottedItems.mask?.$ as MaskWearableItemData).base_filtering ?? 0;

    this.$.stats.shield.base += (slottedItems.shield?.$ as ShieldWearableItemData).base_shield ?? 0;
    this.$.stats.shield_regen.base += (slottedItems.shield?.$ as ShieldWearableItemData).base_regen ?? 0;

    this.$.stats.armor.base += (slottedItems.vest?.$ as VestWearableItemData).base_armor ?? 0;
    this.$.stats.dissipate.base += (slottedItems.vest?.$ as VestWearableItemData).base_dissipate ?? 0;

    this.$.stats.min_comfortable_temperature.base += (slottedItems.jacket?.$ as JacketWearableItemData).base_insulation ?? 0;
    this.$.stats.heat_capacity.base += (slottedItems.jacket?.$ as JacketWearableItemData).base_heat_capacity ?? 0;
    
    this.$.stats.parry.base += (slottedItems.backpack?.$ as BackpackWearableItemData).base_parry ?? 0;
    this.$.stats.deflect.base += (slottedItems.backpack?.$ as BackpackWearableItemData).base_deflect ?? 0;
    
    this.$.stats.mana.base += (slottedItems.gloves?.$ as GlovesWearableItemData).base_mana ?? 0;
    this.$.stats.mana_regen.base += (slottedItems.gloves?.$ as GlovesWearableItemData).base_mana_regen ?? 0;
    this.$.stats.tech.base += (slottedItems.gloves?.$ as GlovesWearableItemData).base_tech ?? 0;

    // Modules
    for (const [type, mods] of this.getModuleCumulativeModifiers()) {
      for (const mod of mods)
        this.applyNamedModifier(mod)
    }
    for (const _slot in this.$.items.slotted) {
      const slot = _slot as ItemSlot;
      const item = this.$.items.slotted[slot] as WearableInventoryItem | null | undefined;

      for (const mod of item?.modifier_modules ?? []) {
        this.applyNamedModifier(mod);
      }
    }
    for (const weapon of [this.$.items.primary_weapon, ...this.$.items.weapons]) {
      if (!weapon) continue;

      for (const mod of weapon.modifier_modules ?? []) {
        this.applyNamedModifier(mod);
      }
    }
    
    const passives = this.passives;
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
    for (const _a in this.$.attributes) {
      const a = _a as Attributes; 
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
    if (isNaN(this.$.vitals.intensity)) {
      this.$.vitals.intensity = 0;
    }
    
    this.$.vitals.health *= this.$.stats.health.value;
    this.$.vitals.injuries *= this.$.stats.health.value;
    this.$.vitals.shield *= this.$.stats.shield.value;
    this.$.vitals.mana *= this.$.stats.mana.value;
    this.$.vitals.heat *= this.$.stats.heat_capacity.value;
    this.$.vitals.intensity *= this.$.stats.mental_strength.value;

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

  applyModifiersToBaseStats(list: NamedModifier[], amount: number) {
    for (const mod of list) {
      const stat: TrackableStat = this.$.stats[mod.stat as Stats];
      switch (mod.type) {
        case ModifierType.ADD:
        case ModifierType.ADD_AFTER:
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

  get stat_modules(): Map<ModuleType, ItemStatModule[]> {
    const map = new Map<ModuleType, ItemStatModule[]>();
    for (const _item of this.inventoryItems) {
      const item = _item as WearableInventoryItem;
      if (item?.stat_module) {    
        map.set(item.stat_module.type, [...(map.get(item.stat_module.type) ?? []), item.stat_module]);
      }
    }
    return map;
  }
  getModuleCumulativeModifiers(): Map<ModuleType, NamedModifier[]> {
    const map = new Map<ModuleType, NamedModifier[]>();

    for (const [type, modules] of this.stat_modules) {
      let cumval = 0;
      for (const module of modules) {
        cumval += module.value;
      }
      const module = new ItemStatModule(type, cumval);
      map.set(type, module.modifiers);
    }

    return map;
  }


  get defaultAttackSet(): AttackSet {
    return {
      type: DamageMethod.Melee,
      normal: [{
        modifiers: {
          accuracy: 0,
          passthrough: 0,
          lethality: 0
        },
        sources: [{
          type: DamageType.Physical,
          flat_bonus: 0,
          from_skill: 1
        }],
      }],
      crit: [{
        modifiers: {
          accuracy: 0,
          passthrough: 0,
          lethality: 0
        },
        sources: [{
          type: DamageType.Physical,
          flat_bonus: 0,
          from_skill: 1.25
        }],
      }],
      weak: [{
        modifiers: {
          accuracy: 0,
          passthrough: 0,
          lethality: 0
        },
        sources: [{
          type: DamageType.Physical,
          flat_bonus: 0,
          from_skill: 0.3
        }],
      }]
    }
  }
  get attackSet(): AttackSet {
    if (!this.$.items.primary_weapon)
      return this.defaultAttackSet;
    
    const weapon = ItemManager.map.get(this.$.items.primary_weapon.id);
    if (weapon?.$.type !== "weapon")
      return this.defaultAttackSet;
    
    return weapon.$.attack ?? this.defaultAttackSet;
  }
  getFinalDamage(method: Exclude<DamageMethod, DamageMethod.Direct>) {
    let stat = (method === DamageMethod.Melee
    ? this.$.stats.melee
    : this.$.stats.ranged
    ).value

    return (this.$.stats.damage.value * rotateLine(stat / 100, Creature.PROFICIENCY_DAMAGE_SCALE, 1))
  }

  vitalsIntegrity() {
    this.$.vitals.injuries = Math.round(clamp(this.$.vitals.injuries, 0, this.$.stats.health.value));
    this.$.vitals.health = Math.round(clamp(this.$.vitals.health, 0, this.$.stats.health.value - this.$.vitals.injuries));
    this.$.vitals.mana = Math.round(clamp(this.$.vitals.mana, 0, this.$.stats.mana.value));
    this.$.vitals.shield = Math.round(clamp(this.$.vitals.shield, 0, this.$.stats.shield.value));
    this.$.vitals.heat = Math.round(clamp(this.$.vitals.heat, 0, this.$.stats.heat_capacity.value));
    this.$.vitals.intensity = Math.round(clamp(this.$.vitals.intensity, 0, this.$.stats.mental_strength.value));

    if (isNaN(this.$.vitals.shield))
      this.$.vitals.shield = 0;

    if (isNaN(this.$.vitals.health))
      this.$.vitals.health = 1;

    if (isNaN(this.$.vitals.injuries))
      this.$.vitals.injuries = 0;

    if (isNaN(this.$.vitals.mana))
      this.$.vitals.mana = 0;

    if (isNaN(this.$.vitals.intensity))
      this.$.vitals.intensity = 0;
  }

  checkItemConflicts() {
    if (this.$.items.primary_weapon && ItemManager.map.get(this.$.items.primary_weapon.id)?.$.type !== "weapon") {
      this.$.items.backpack.push(this.$.items.primary_weapon);
      this.$.items.primary_weapon = null;
    }

    for (var i = 0; i < this.$.items.weapons.length; i++) {
      if (this.$.items.weapons.length > Creature.MAX_EQUIPPED_WEAPONS || ItemManager.map.get(this.$.items.weapons[i]?.id)?.$.type !== "weapon") {
        this.$.items.backpack.push(this.$.items.weapons.splice(i, 1)[0]);
        i--;
      }  
    }

    for (const _slot in this.$.items.slotted) {
      const slot = _slot as ItemSlot;
      const item = ItemManager.map.get(this.$.items.slotted[slot]?.id ?? "");
      if (item?.$.type !== "wearable" || item.$.slot !== slot) {
        const slotted = this.$.items.slotted[slot];
        if (slotted)
          this.$.items.backpack.push(slotted);
        this.$.items.slotted[slot] = null;
      }
    }

    this.$.items.backpack = this.$.items.backpack.filter(v => v);
  }

  wipeItems() {
    this.$.items = {
      backpack: [],
      crafting_materials: new CraftingMaterials({}),
      weapons: [],
      slotted: {} as Record<ItemSlot, undefined>,
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

  get ultimate(): CreatureAbility | null {
    const item = this.$.items.slotted.ultimate;
    const itemdata = ItemManager.map.get(item?.id ?? "");
    if (!item || !itemdata) return null;

    if (itemdata.$.type !== "wearable" || itemdata.$.slot !== "ultimate") return null;
    const ability = AbilitiesManager.map.get(itemdata.$.ultimate);

    return ability ?? null;
  }

  get abilities(): CreatureAbility[] {
    const abilities: CreatureAbility[] = [];

    const species = SpeciesManager.map.get(this.$.info.species);
    if (species) {
      globalOrLocalPusherArray(abilities, Array.from(species.$.abilities?.values() ?? []), AbilitiesManager);
    }

    for (const item of this.itemsData) {
      globalOrLocalPusherArray(abilities, Array.from((item.$ as Exclude<typeof item.$, GenericItemData | ConsumableItemData>).abilities?.values() ?? []), AbilitiesManager);
    }

    for (const stored of this.$.items.backpack) {
      const item = ItemManager.map.get(stored.id);
      if (!item || item.$.type !== "consumable") continue;

      globalOrLocalPusherArray(abilities, Array.from(item.$.abilities?.values() ?? []), AbilitiesManager);
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
    const passives = new Set<PassiveEffect>();

    // GLOBAL from Directives
    for (const directive of GameDirective.enabled) {
      globalOrLocalPusherSet(passives, directive.$.passives ?? new Set(), PassivesManager);
    }

    const species = SpeciesManager.map.get(this.$.info.species);
    if (species) {
      globalOrLocalPusherSet(passives, species.$.passives ?? new Set(), PassivesManager);
    }

    for (const item of this.itemsData) {
      globalOrLocalPusherSet(passives, (item.$ as Exclude<typeof item.$, GenericItemData | ConsumableItemData>).passives ?? new Set(), PassivesManager);
    }

    for (const a of this.active_effects) {
      const effect = EffectManager.map.get(a.id);
      if (!effect) continue;

      globalOrLocalPusherSet(passives, effect.$.passives ?? new Set(), PassivesManager);
    }

    const uniques = new Set<string>();
    for (const passive of passives) {
      for (const u of passive.$.unique ?? []) {
        if (uniques.has(u)) {
          passives.delete(passive);
          break;
        } else {
          uniques.add(u);
        }
      }
    }

    return [...passives];
  }

  get itemsData(): Item[] {
    const items: Item[] = [];

    const ids = this.inventoryItems;
    for (const i of ids) {
      const item = ItemManager.map.get(i.id);
      if (!item) continue;

      items.push(item);
    }

    return items;
  }
  get inventoryItems(): InventoryItem[] {
    const array: InventoryItem[] = new Array().concat(this.$.items.primary_weapon, this.$.items.weapons, function(creature: Creature) {
      const arr: InventoryItem[] = [];

      for (const slot in creature.$.items.slotted) {
        const slotted = creature.$.items.slotted[slot as ItemSlot];
        if (slotted)
          arr.push(slotted);
      }

      return arr;
    }(this));
    for (var i = 0; i < array.length; i++) {
      if (array[i]) continue;

      array.splice(i, 1);
      i--;
    }

    return array;
  }
  

  applyNamedModifier(mod: NamedModifier) {
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
      total_true_damage: 0,
      total_stress_applied: 0,
      total_stress_mitigated: 0
    }

    group.victim = original.victim;
    group.attacker = original.attacker;

    log.final.victim = this;
    log.original.victim = this;

    for (const passive of this.passives) {
      passive.$.beforeDamageTaken?.(this, group);
    }
    if (group.attacker instanceof Creature) {
      for (const passive of group.attacker.passives) {
        passive.$.beforeDamageGiven?.(group.attacker, group);
      }
    }

    if (group.useDodge) {
      group.chance -= group.method === DamageMethod.Direct ? 0 : group.method === DamageMethod.Melee ? this.$.stats.parry.value : this.$.stats.deflect.value;
    }

    log.successful = (Math.floor(Math.random() * 100) + 1) <= group.chance;
    if (!log.successful) {
      for (const s of group.sources) {
        if (s.type !== DamageType.Stress)
          log.total_damage_mitigated += s.value;
      }
      for (const passive of this.passives)
        passive.$.onDodge?.(this, log);
    } else {
      for (const source of group.sources) {
        if (source.type === DamageType.Stress) {
          source.value *= Math.round(reductionMultiplier(this.$.stats.stress_resistance.value));

          log.total_stress_applied += source.value;
          this.$.vitals.intensity += source.value;
        } else {
          switch (source.type) {
            case DamageType.Physical: {
              log.total_damage_mitigated += Math.round(source.value * (1 - reductionMultiplier(this.$.stats.armor.value - (group.penetration?.lethality ?? 0))));
              source.value *= reductionMultiplier(this.$.stats.armor.value - (group.penetration?.lethality ?? 0));
            } break;
            case DamageType.Energy: {
              log.total_damage_mitigated += Math.round(source.value * (1 - reductionMultiplier(this.$.stats.dissipate.value - (group.penetration?.passthrough ?? 0))));
              source.value *= reductionMultiplier(this.$.stats.dissipate.value - (group.penetration?.passthrough ?? 0));
            } break;
          }
          source.value = Math.round(source.value);

          switch (source.shieldReaction) {
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
            case DamageType.True: {
              log.total_true_damage += source.value;
            } break;
            case DamageType.Physical: {
              log.total_physical_damage += source.value;
            } break;
            case DamageType.Energy: {
              log.total_energy_damage += source.value;
            } break;
          }
        }
      }

      for (const passive of this.passives) {
        passive.$.afterDamageTaken?.(this, log);
      }

      if (group.attacker instanceof Creature) {
        group.attacker.heal(Math.round(log.total_physical_damage * group.attacker.$.stats.vamp.value / 100), HealType.Health);
        group.attacker.heal(Math.round(log.total_energy_damage * group.attacker.$.stats.siphon.value / 100), HealType.Shield);
  
        for (const passive of group.attacker.passives) {
          passive.$.afterDamageGiven?.(group.attacker, log);
        }
      }
    }
    
    this.vitalsIntegrity();

    return log;
  }

  heal(amount: number, type: HealType) {
    for (const passive of this.passives) {
      passive.$.beforeHeal?.(this);
    }

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
      case HealType.Stress: {
        this.$.vitals.intensity -= amount;
      } break;
    }

    this.vitalsIntegrity();

    for (const passive of this.passives) {
      passive.$.afterHeal?.(this);
    }
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

    const global_effects: AppliedActiveEffect[] = [];
    for (const directive of GameDirective.enabled) {
      for (const e of directive.$.effects ?? []) {
        location_effects.push({
          id: e.id,
          severity: e.severity,
          ticks: -1
        });
      }
    }

    const effects = [...global_effects, ...this.$.active_effects, ...location_effects]

    return effects;
  }

  applyActiveEffect(effect: AppliedActiveEffect, override_existing = false): boolean {
    let effectData = EffectManager.map.get(effect.id);
    if (!effectData) return false;

    let count = 0;
    if (effectData.$.consecutive_limit > 0)
      for (const e of this.active_effects) {
        if (e.id === effect.id) count++;
      }

    let conflicting: number = -1;
    for (const e of this.active_effects) {
      const e_data = EffectManager.map.get(e.id);
      if (!e_data) continue;

      if (effectData.$.id !== e_data.$.id && (effectData.$.conflicts_with?.has(e_data.$.id) || e_data.$.conflicts_with?.has(effectData.$.id))) {
        conflicting = this.$.active_effects.findIndex(a => e.id === a.id);
      }
      if (conflicting !== -1) break;
    }

    if (conflicting !== -1 || (effectData.$.consecutive_limit > 0 && count >= effectData.$.consecutive_limit)) {
      const index = this.$.active_effects.findIndex((v) => v.id === effect.id);
      const existing = this.$.active_effects[index];

      if (conflicting === -1 && (effectData.$.stacking ?? EffectStacking.None) !== EffectStacking.None) {
        switch (effectData.$.stacking) {
          case EffectStacking.Duration: {
            existing.ticks += Math.max(0, effect.ticks);
          } break;
          case EffectStacking.Severity: {
            existing.severity += effect.severity;
            existing.ticks = Math.max(effect.ticks);
          } break;
          case EffectStacking.Both: {
            existing.ticks += Math.max(0, effect.ticks);
            existing.severity += effect.severity;
            existing.ticks = Math.max(effect.ticks);
          } break;
        }
      } else {
        if (override_existing) {
          if (index !== -1)
            this.$.active_effects[index] = effect;
          if (conflicting !== -1)
            this.$.active_effects[conflicting] = effect;
        } else return false;
      }
    } else {
      this.$.active_effects.push(effect);
    }

    effectData.$.onApply?.(this, effect);
    
    if (effectData.$.preload || effectData.$.postload || effectData.$.passives)
      this.reload();
      
    return true;
  }
  clearActiveEffect(id: string, type: "expire" | "delete"): boolean {
    const index = this.$.active_effects.findIndex((v) => v.id === id);
    if (index === -1) {
      const effect = this.active_effects.find((v) => v.id === id);
      if (!effect) return false;

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

      this.reload();
      return true;
    }

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
      if (--effect.ticks === 0) {
        this.clearActiveEffect(effect.id, "expire");
      } else {
        if (effect.ticks < 0) effect.ticks = -1;
        effectData.$.onTick?.(this, effect);
      }
    }
  }

  tick() {
    for (const passive of this.passives) {
      passive.$.beforeTick?.(this);
    }
    
    this.tickEffects();
      
    for (const passive of this.passives)
      passive.$.afterTick?.(this);
  }

  get canUseAttacks(): boolean {
    if (!this.isAbleToFight) return false;

    return this.$.status.attacks;
  }
  get canUseAbilities(): boolean {
    if (!this.isAbleToFight) return false;
    
    return this.$.status.abilities;
  }
  get isAbleToFight(): boolean {
    if (!this.alive) return false;

    return this.$.status.up;
  }
  get alive(): boolean {
    return this.$.status.alive;
  }
  async getFightID(db: typeof mongoose): Promise<string | null> {
    for await (const document of db.connection.collection(Fight.COLLECTION_NAME).find()) {
      const fight = new Fight(document);

      if (fight.creatures.has(this.$._id))
        return fight.$._id;
    }
    return null;
  }

  clearAttributes() {
    for (const a in this.$.attributes) {
      this.$.attributes[a as Attributes].base = 0;
    }
  }

  get totalAttributePointsUsed(): number {
    let num = 0;

    for (const a in this.$.attributes) {
      num += this.$.attributes[a as Attributes]?.base ?? 0;
    }

    return num;
  }


  get perks(): CreaturePerk[] {
    const perks = new Set<CreaturePerk>();

    // GLOBAL from Directives
    for (const directive of GameDirective.enabled) {
      globalOrLocalPusherSet(perks, directive.$.perks ?? new Set(), PerkManager);
    }

    const race = SpeciesManager.map.get(this.$.info.species);
    globalOrLocalPusherSet(perks, race?.$.perks ?? new Set(), PerkManager);

    for (const skill of this.skills) {
      globalOrLocalPusherSet(perks, skill.$.perks ?? new Set(), PerkManager);
    }

    const items = this.itemsData;
    for (const item of items) {
      globalOrLocalPusherSet(perks, (item.$ as Exclude<typeof item.$, GenericItemData | ConsumableItemData>).perks ?? new Set(), PerkManager)
    }

    return [...perks];
  }

  get perkIDs() {
    const set = new Set<string>();
    for (const perk of this.perks) {
      set.add(perk.$.id)
    }
    return set;
  }

  get skills(): CreatureSkill[] {
    const set = new Set<CreatureSkill>();
    
    for (const s of this.$.items.skills) {
      const skill = SkillManager.map.get(s);
      if (skill)
        set.add(skill);
    }

    const uniques = new Set<string>();
    for (const skill of set) {
      if (!skill.$.unique || skill.$.unique.size === 0) continue;

      for (const u of skill.$.unique) {
        if (uniques.has(u)) {
          set.delete(skill);
          break;
        } else {
          uniques.add(u);
        }
      }
    }

    return [...set];
  }

  get location() {
    return LocationManager.map.get(this.$.info.location);
  }

  get schematics() {
    return new Set([...SchematicsManager.free, ...(this.species?.$.schematics ?? []), ...this.$.items.schematics])
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
        shield: this.$.vitals.shield / this.$.stats.shield.value,
        heat: this.$.vitals.heat / this.$.stats.heat_capacity.value,
        intensity: this.$.vitals.intensity / this.$.stats.mental_strength.value
      },
      attributes: {} as Record<Attributes, undefined>,
      experience: this.$.experience,
      items: {
        backpack: this.$.items.backpack,
        crafting_materials: this.$.items.crafting_materials as Record<Material, number>,
        slotted: this.$.items.slotted,
        weapons: this.$.items.weapons,
        primary_weapon: this.$.items.primary_weapon,
        schematics: [...this.$.items.schematics],
        skills: [...this.$.items.skills]
      },
      abilities: this.$.abilities,
      active_effects: this.$.active_effects,
      sim_message: this.$.sim_message,
      vars: this.$.vars
    }

    for (const _a in this.$.attributes) {
      const a = _a as Attributes;
      const attr: TrackableStat = this.$.attributes[a];

      (dump.attributes as Exclude<CreatureDump["attributes"], undefined>)[a] = attr.base;
    }

    return dump;
  }

  get deltaHeat() {
    return (this.location?.$.temperature ?? 0) - this.$.stats.min_comfortable_temperature.value;
  }

  static async fetch(id: string, db: typeof mongoose, cache = true): Promise<Creature> {
    if (cache) {
      if (this.cache.has(id)) {
        return new Creature((this.cache.get(id) as Creature).dump());
      }
    }

    const data = await db.connection.collection(Creature.COLLECTION_NAME).findOne({_id: id}) as CreatureDump;
    if (!data) throw new Error("Not found");

    const char = new Creature(data);
    Creature.cache.set(char.$._id, char);
    return char;
  }
  async put(db: typeof mongoose) {
    Creature.cache.set(this.$._id, this);
    try {
      await db.connection.collection(Creature.COLLECTION_NAME).insertOne(this.dump() as unknown as Document);
    } catch {
      await db.connection.collection(Creature.COLLECTION_NAME).replaceOne({_id: this.$._id}, this.dump());
    }
  }
  async delete(db: typeof mongoose) {
    Creature.cache.del(this.$._id);
    return db.connection.collection(Creature.COLLECTION_NAME).deleteOne({_id: this.$._id});
  }

  reload() {
    this.$ = new Creature(this.dump()).$;
  }

  static readonly BAR_STYLES = {
    Health: ["<:h_0:961326242689347674>", "<:h_75:961326242697736282>", "<:h_50:961326242706116648>", "<:h_25:961326242710290532>", "<:h_100:961326242689343518>"],
    Injuries: ["<:inj:961328087289708604>"],
    Shield: ["<:s_0:961328715869061121>", "<:s_25:961328716078800936>", "<:s_50:961328716133318746>", "<:s_75:961328716150108271>", "<:s_100:961328716116549632>"],
    Mana: ["<:m_0:961380795119960104>", "<:m_25:961380795136753714>", "<:m_50:961380795233239050>", "<:m_75:961380795208065034>", "<:m_100:961380795203870741>"],
    Heat: bar_styles[3]
  }

  static readonly ABILITY_DISCARD_COST = 2;

  static readonly MAX_EQUIPPED_WEAPONS = 2;
  static readonly COMBAT_WEAPON_SWITCH_MULT = 0.2;
  get combat_switch_cost() {
    return Math.max(1, Math.round((this.$.stats.attack_cost.value ?? 0) * Creature.COMBAT_WEAPON_SWITCH_MULT))
  }

  static readonly INTENSITY_CAPACITY = 100;
  
  static readonly PROFICIENCY_ACCURACY_SCALE = 0.5
  static readonly PROFICIENCY_DAMAGE_SCALE = 1;

  static readonly ATTACK_MAX_STACKS = 12;
  static readonly ATTACK_STACK_DIE_SIZE = 6;

  static readonly MIN_HAND_AMOUNT = 3;
  static readonly MAX_HAND_AMOUNT = 6;

  static readonly ATTACK_VALUES = [
    undefined, null, null, null, null, null, DamageCause.Normal_Attack,
    DamageCause.Weak_Attack, DamageCause.Weak_Attack, DamageCause.Weak_Attack, DamageCause.Normal_Attack, DamageCause.Normal_Attack, DamageCause.Critical_Attack
  ]

  static readonly LEVEL_MODS: NamedModifier[] = [
    {
      type: ModifierType.ADD_PERCENT,
      value: 0.15,
      stat: "damage"
    },
    {
      type: ModifierType.ADD_PERCENT,
      value: 0.075,
      stat: "health"
    },
    {
      type: ModifierType.ADD_PERCENT,
      value: 0.075,
      stat: "shield_regen"
    },
    {
      type: ModifierType.ADD_PERCENT,
      value: 0.085,
      stat: "shield"
    },
    {
      type: ModifierType.ADD_PERCENT,
      value: 0.14,
      stat: "tech"
    },
    {
      type: ModifierType.ADD,
      value: 0.1,
      stat: "mana_regen"
    },
    {
      type: ModifierType.ADD,
      value: 0.5,
      stat: "mana"
    },
    {
      type: ModifierType.ADD,
      value: 1,
      stat: "stress_resistance"
    }
  ]
  static readonly ATTRIBUTE_MODS: {[key: string]: NamedModifier[]} = {
    STR: [
      {
        type: ModifierType.ADD_PERCENT,
        value: 0.1,
        stat: "melee"
      },
      {
        type: ModifierType.ADD_PERCENT,
        value: 0.12,
        stat: "tenacity"
      },
      {
        type: ModifierType.ADD_PERCENT,
        value: 0.1,
        stat: "parry"
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
        value: 0.06,
        stat: "dissipate"
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
        value: 5,
        stat: "lethality"
      },
      {
        type: ModifierType.ADD,
        value: 5,
        stat: "passthrough"
      }
    ],
    INT: [
      {
        type: ModifierType.ADD,
        value: 1,
        stat: "tech"
      },
      {
        type: ModifierType.ADD_PERCENT,
        value: 0.185,
        stat: "tech"
      },
      {
        type: ModifierType.ADD_PERCENT,
        value: 0.1,
        stat: "mana"
      },
      {
        type: ModifierType.ADD_PERCENT,
        value: 0.035,
        stat: "shield"
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
        value: 0.06,
        stat: "parry"
      },
      {
        type: ModifierType.ADD_PERCENT,
        value: 0.1,
        stat: "ranged"
      }
    ],
    CHA: [

    ],
    MND: [
      {
        type: ModifierType.ADD_PERCENT,
        value: 0.1,
        stat: "stress_resistance"
      }
    ]
  }
  static readonly ATTRIBUTE_DESCRIPTIONS = {
    STR: "Physical Strength and brute force.",
    FOR: "Fortitude, resilience, and physical resistance.",
    REJ: "Rejuvenation, the quickness of regaining ground.",
    PER: "Perception, all 6 senses. Know your enemy, and their weak points.",
    INT: "Intelligence, crafting, technological swiftness.",
    DEX: "Dexterity, agility, light as a feather.",
    CHA: "Charisma, looks, and wits. Negotiation skills.",
    MND: "Mind, mental conditioning, key to keeping your cool."
  }
  static readonly ATTRIBUTE_MAX = 8;

  static readonly ID_REGEX = /^([A-Za-z0-9]|[_-]){3,96}$/;
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
    npc: boolean
  }
  stats: Record<Stats, TrackableStat>
  attributes: Record<Attributes, TrackableStat>
  experience: {
    level: number
  }
  vitals: Record<Vitals, number>
  items: {
    primary_weapon: WeaponInventoryItem | null
    backpack: InventoryItem[]
    weapons: WeaponInventoryItem[]
    slotted: Record<ItemSlot, WearableInventoryItem | null | undefined>
    skills: Set<string>
    schematics: Set<string>
    crafting_materials: CraftingMaterials
  }
  abilities: {
    ult_stacks: number
    deck: string[]
    hand: string[]
    stacks: number
  }
  status: {
    abilities: boolean
    attacks: boolean
    up: boolean
    alive: boolean
  }
  sim_message: string | null
  active_effects: AppliedActiveEffect[]
  vars: Record<string, number | undefined>
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
    npc?: boolean
  }
  vitals?: Record<Vitals, undefined | number>
  attributes?: Record<Attributes, undefined | number>
  experience?: {
    level?: number
  }
  items?: {
    primary_weapon?: WeaponInventoryItem | null
    backpack?: InventoryItem[]
    weapons?: WeaponInventoryItem[]
    slotted?: Record<ItemSlot, WearableInventoryItem | null | undefined>
    skills?: string[]
    schematics?: string[]
    crafting_materials?: {[key: string]: number}
  }
  abilities?: {
    ult_stacks?: number
    deck?: string[]
    hand?: string[]
    stacks?: number
  }
  sim_message?: string | null
  active_effects?: AppliedActiveEffect[]
  vars?: Record<string, number | undefined>
}

export enum HealType {
  "Health", "Shield", "Overheal", "Mana", "Injuries", "Stress"
}

function globalOrLocalPusherArray<T>(array: T[], input: (T | string)[], manager: any) {
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
function globalOrLocalPusherSet<T>(array: Set<T>, input: Set<T | string>, manager: any) {
  for (const p of input) {
    if (typeof p === "string") {
      const item = manager.map.get(p);
      if (item)
        array.add(item);
    } else {
      array.add(p);
    }
  }
}

export function diceRoll(size = 6): number {
  return Math.floor(Math.random() * size) + 1;
}

export type Attributes = "STR" | "FOR" | "REJ" | "PER" | "INT" | "DEX" | "CHA" | "MND";

export type Vitals = "health" | "mana" | "shield" | "injuries" | "heat" | "intensity";

export type Stats = 
  "accuracy" | "armor" | "dissipate" | "lethality" | "passthrough" | "cutting" | "melee" | "damage" | "ranged" |
  "health" | "mana" | "mana_regen" | "shield" | "shield_regen" | "parry" | "deflect" | "tenacity" | "filtering" |
  "tech" | "vamp" | "siphon" | "initiative" | "min_comfortable_temperature" | "heat_capacity" | "attack_cost" |
  "ult_stack_target" | "stress_resistance" | "mental_strength";