import { MessageEmbed } from "discord.js";
import Mongoose from "mongoose";
import Creature from "./Creature";

export enum DamageType {
  "Stress" = -1,
  "True", "Physical", "Energy"
}
export enum DamageMethod {
  "Direct", "Melee", "Ranged"
}

export interface DamageSource {
  type: DamageType
  value: number
  shieldReaction?: ShieldReaction
}

export interface DamageGroup {
  sources: DamageSource[]
  from?: string
  to?: string
  method: DamageMethod
  penetration?: {
    lethality?: number
    passthrough?: number
    cutting?: number
  }
  chance: number
  useDodge: boolean
  cause: DamageCause
}

export interface DamageLog {
  type: "damage"

  successful: boolean
  original: DamageGroup
  final: DamageGroup
  
  total_true_damage: number
  total_physical_damage: number
  total_energy_damage: number

  total_shield_damage: number
  total_health_damage: number
  total_injuries: number

  total_damage_mitigated: number
  total_damage_taken: number

  total_stress_applied: number
  total_stress_mitigated: number
}

export enum DamageCause {
  "Other" = -1,
  "Weak_Attack", "Normal_Attack", "Critical_Attack",
  "Ability", "DoT"
}

export enum ShieldReaction {
  "Normal", "Ignore", "Only"
}

export function shieldReactionInfo(type: ShieldReaction): string {
  switch (type) {
    default: return "Undefined";
    case ShieldReaction.Normal: return "";
    case ShieldReaction.Only: return "Only Shield";
    case ShieldReaction.Ignore: return "Ignore Shield"
  }
}

export const DAMAGE_TO_INJURY_RATIO = 0.66;
export function reductionMultiplier(protection: number): number {
  return 100 / (100 + Math.max(0, protection));
}

export async function damageLogEmbed(log: DamageLog, db: typeof Mongoose) {
  const from = log.final.from?.startsWith("creature:") ? await Creature.fetch(log.final.from.split(":")[1], db).catch(() => null) : null;
  const to = log.final.to?.startsWith("creature:") ? await Creature.fetch(log.final.to.split(":")[1], db).catch(() => null) : null;

  const embed = new MessageEmbed();
  embed
    .setTitle("Damage Log")
    .setAuthor({ name: `${from?.displayName ?? log.final.from ?? "Unknown"} >>> ${(to?.displayName ?? log.final.to ?? "Unknown")}`})
    .setColor("RED")
    .addField(
      "Before",
      damageGroupString(log.original),
      true
    );
  
  if (log.successful) {
    embed.addField(
      "After",
      damageGroupString(log.final),
      true
    )
  } else {
    embed.addField(
      "Failed",
      `**${log.final.chance.toFixed(2)}%** Chance`,
      true
    )
  }

  embed.addField(
    "Total",
    `**${log.total_damage_taken}** Damage Taken\n**${log.total_damage_mitigated >= 0 ? `${log.total_damage_mitigated}** Damage Mitigated` : `${-log.total_damage_mitigated}** Damage Added`}\n\n` +
    `**${log.total_shield_damage}** Shield Damage\n**${log.total_health_damage}** Health Damage\n**${log.total_injuries}** Injuries\n\n` +
    `**${log.total_physical_damage}**/**${log.total_energy_damage}**/**${log.total_true_damage}** Physical/Energy/True\n` +
    `Stress **${log.total_stress_applied}** Applied | **${log.total_stress_mitigated}** Mitigated`
  )
 
  return embed;
}

function damageGroupString(group: DamageGroup) {
  return `**${group.chance.toFixed(2)}%** Chance\n**${DamageMethod[group.method]} ${DamageCause[group.cause]}**\n` +
  `*${!group.useDodge ? "Not " : ""}Dodgeable*\n` +
  `Lethality **${group.penetration?.lethality ?? 0}** | **${group.penetration?.passthrough ?? 0}** Passthrough\n**${group.penetration?.cutting ?? 0}** Cutting\n\n` +
  `**Sources**\n` +
  `${function() {
    var str = "";
    for (const source of group.sources) {
      var s_reaction = source.type !== DamageType.Stress ? shieldReactionInfo(source.shieldReaction ?? ShieldReaction.Normal) : null;
      str += `[**${source.value} ${DamageType[source.type]}**${s_reaction ? ` **${s_reaction}**` : ""}]\n`
    }

    return str.trim();;
  }()}`
}



export interface HealSource {
  type: HealType
  value: number
}

export interface HealGroup {
  sources: HealSource[]
  from?: string
  to?: string
}

export enum HealType {
  "Health", "Shield", "Overheal", "ActionPoints", "Injuries", "Stress"
}


export interface HealLog {
  type: "heal"

  original: HealGroup
  final: HealGroup

  health_restored: number
  shields_restored: number
  stress_restored: number
  mana_restored: number
  injuries_restored: number
}

export async function healLogEmbed(log: HealLog, db: typeof Mongoose) {
  const from = log.final.from?.startsWith("creature:") ? await Creature.fetch(log.final.from.split(":")[1], db).catch(() => null) : null;
  const to = log.final.to?.startsWith("creature:") ? await Creature.fetch(log.final.to.split(":")[1], db).catch(() => null) : null;

  const embed = new MessageEmbed();
  embed
    .setTitle("Damage Log")
    .setAuthor({ name: `${from?.displayName ?? log.final.from ?? "Unknown"} >>> ${(to?.displayName ?? log.final.to ?? "Unknown")}` })
    .setColor("GREEN")
    .addField(
      "Before",
      healGroupString(log.original),
      true
    );

  embed.addField(
    "After",
    healGroupString(log.final),
    true
  ).addField(
    "Total",
    `**${log.health_restored}**/**${log.injuries_restored}** Health/Injuries\n` +
    `**${log.shields_restored}** Shields\n` +
    `**${log.mana_restored}** Action Points\n` +
    `**${log.stress_restored}** Intensity\n` 
  )
 
  return embed;
}

function healGroupString(group: HealGroup) {
  return `**Sources**\n` +
  `${function() {
    var str = "";
    for (const source of group.sources) {
      str += `[**${source.value} ${HealType[source.type]}**]\n`
    }

    return str.trim();;
  }()}`
}

export type VitalsLog = DamageLog | HealLog;