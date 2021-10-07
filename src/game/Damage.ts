import Creature from "./Creature";

export enum DamageType {
  "True", "Physical", "Energy"
}
export enum DamageMedium {
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
  medium: DamageMedium
  penetration: {
    armor: number
    filter: number
  }
  chance: number
  useDodge: boolean
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