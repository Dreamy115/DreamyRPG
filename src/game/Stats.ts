export class TrackableStat {
  base: number
  modifiers: Modifier[]
  get value() {
    let value = this.base;

    const modifierCopy: Modifier[] = new Array().concat(this.modifiers);
    modifierCopy.sort((a, b) => {
      return a.type - b.type; 
    })

    for (const mod of modifierCopy) {
      switch (mod.type) {
        case ModifierType.ADD:
          value += mod.value;
          break;
        case ModifierType.ADD_PERCENT:
          value += mod.value * this.base;
          break;
        case ModifierType.MULTIPLY:
          value *= mod.value;
          break;
        case ModifierType.CAP_MAX:
          value = Math.min(value, mod.value);
          break;
      }
    }

    return value;
  }

  constructor(base: TrackableStat["base"], modifiers: TrackableStat["modifiers"] = []) {
    this.base = base;
    this.modifiers = modifiers;
  }
}

export interface Modifier {
  value: number
  type: ModifierType
}

export enum ModifierType {
  "ADD", "ADD_PERCENT", "MULTIPLY", "CAP_MAX"
}


export function textStat(val: number, max: number) {
  return `**${val}**/**${max}** (**${Math.round(100 * val / max)}%**)`;
} 