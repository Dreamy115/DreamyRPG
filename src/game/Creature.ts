import { PassiveModifier } from "./PassiveEffects";
import { TrackableStat } from "./Stats";

export default class Creature {
  $: CreatureData

  constructor(data: CreatureDump) {
    this.$ = Creature.parse(data);
  }


  applyNamedModifier(mod: PassiveModifier) {
    // @ts-ignore
    this.$.stats[mod.stat].modifiers.push({type: mod.type, value: mod.value})
  }

  /**
   * Converts database-storeable data into in-memory data
   * 
   * @param data Stored data dump
   * @returns Live in-memory creature data
   */
  static parse(data: CreatureDump): CreatureData {
    let live: CreatureData = {
      _id: data._id,
      info: {
        display: {
          name: data.info?.display?.name ?? "Unnamed",
          avatar: data.info?.display?.name ?? null
        },
        species: data.info?.species ?? "default",
        class: data.info?.class ?? "default"
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
        tech: new TrackableStat(0)
      },
      vitals: {
        health: (data.vitals?.health ?? 1),
        injuries: (data.vitals?.injuries ?? 0),
        mana: (data.vitals?.mana ?? 0),
        shield: (data.vitals?.shield ?? 1)
      }
    }



    return live;
  }
  /**
   * Converts live in-memory ready creature data into storeable data
   * 
   * @param data Live data
   * @returns Storeable data dump
   */
  static dump(data: CreatureData): CreatureDump {
    let dump: CreatureDump = {
      _id: data._id,
      info: data.info,
      vitals: {
        health: data.vitals.health / data.stats.health.value,
        injuries: data.vitals.health / data.stats.health.value,
        mana: data.vitals.mana / data.vitals.mana,
        shield: data.vitals.shield / data.stats.shield.value
      }
    }

    return dump;
  }
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
    class: string
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
    tech: TrackableStat
  }
  vitals: {
    health: number
    mana: number
    shield: number
    injuries: number
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
  }
  vitals?: {
    health?: number
    mana?: number
    shield?: number
    injuries?: number
  }
  items?: {

  }
}