import { MessageEmbed } from "discord.js";
import Creature from "./Creature";

export enum DamageType {
  "True", "Physical", "Energy"
}
export enum DamageMethod {
  "Direct", "Melee", "Ranged"
}

export interface DamageSource {
  type: DamageType
  value: number
}

export interface DamageGroup {
  sources: DamageSource[]
  attacker?: Creature | string
  victim?: Creature
  method: DamageMethod
  penetration?: {
    lethality?: number
    passthrough?: number
    cutting?: number
  }
  chance: number
  useDodge: boolean
  shieldReaction: ShieldReaction
  cause: DamageCause
}

export interface DamageLog {
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
}

export enum DamageCause {
  "Other" = -1,
  "Weak_Attack", "Normal_Attack", "Critical_Attack",
  "Ability", "DoT"
}

export enum ShieldReaction {
  "Normal", "Ignore", "Only"
}

export const DAMAGE_TO_INJURY_RATIO = 0.66;
export function reductionMultiplier(protection: number): number {
  return 100 / (100 + Math.max(0, protection));
}

export function damageLogEmbed(log: DamageLog) {
  const embed = new MessageEmbed();
  console.log(log.final.attacker)
  embed
    .setTitle("Damage Log")
    .setAuthor(`${(log.final?.attacker as (undefined | Creature))?.$?.info.display.name ?? log.final.attacker ?? "Unknown"} >>> ${(log.final.victim?.displayName ?? "Unknown")}`)
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
      `**${log.final.chance}%** Chance`,
      true
    )
  }

  embed.addField(
    "Total",
    `**${log.total_damage_taken}** Damage Taken\n**${log.total_damage_mitigated}** Damage Mitigated\n\n` +
    `**${log.total_shield_damage}** Shield Damage\n**${log.total_health_damage}** Health Damage\n**${log.total_injuries}** Injuries\n\n` +
    `**${log.total_physical_damage}**/**${log.total_energy_damage}**/**${log.total_true_damage}** Physical/Energy/True`
  )
 
  return embed;
}

function damageGroupString(group: DamageGroup) {
  return `**${group.chance}%** Chance\n**${DamageMethod[group.method]} ${DamageCause[group.cause]}**, Shield reaction: **${ShieldReaction[group.shieldReaction]}**\n` +
  `*${!group.useDodge ? "Not " : ""}Dodgeable*\n` +
  `Lethality **${group.penetration?.lethality ?? 0}** | **${group.penetration?.passthrough ?? 0}** Passthrough | **${group.penetration?.cutting ?? 0}** Cutting\n\n` +
  `**Sources**\n` +
  `${function() {
    var str = "";
    for (const source of group.sources) {
      str += `[**${source.value} ${DamageType[source.type]}**]\n`
    }

    return str.trim();;
  }()}`
}