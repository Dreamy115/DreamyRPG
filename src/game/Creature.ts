export default class Creature {
  $: CreatureData

  constructor(data: CreatureDump) {
    this.$ = Creature.parse(data);
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
      info: data.info
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
}