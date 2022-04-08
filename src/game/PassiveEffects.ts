import fs from "fs";
import path from "path";

import Creature, { Attributes, Stats } from "./Creature";
import { LoreReplacer } from "./LoreReplacer";
import { DamageCause, DamageGroup, DamageLog, DamageMethod, HealGroup, HealLog } from "./Damage";
import { Modifier } from "./Stats";
import { CreatureAbility } from "./CreatureAbilities";
import { Fight } from "./Fight";
import Mongoose from "mongoose";

export default class PassiveEffectManager {
  map = new Map<string, PassiveEffect>();
  async load(dir: fs.PathLike) {
    this.map.clear();

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".js")) continue;

      const {default: loadedFile} = await import(path.join(dir.toString(), file));

      if (loadedFile instanceof PassiveEffect) {
        if (loadedFile.$.id)
          this.map.set(loadedFile.$.id, loadedFile);
      } else {
        if (loadedFile instanceof Array) {
          for (const subfile of loadedFile) {
            if (subfile instanceof PassiveEffect) {
              if (subfile.$.id)
                this.map.set(subfile.$.id, subfile);
            }
          }
        }
      }
    }
  }
}

/* Effects!

Signatured (with ID) vs Signatureless Effects (without ID)
Signatured Effects are effects accessible from the effect manager, and are meant to be global
Signatureless Effects are meant to be locally accessible, and are not unique!

unique?: Set<string> - is an optional list of names, signaling uniqueness.
Two effects with overlapping uniques list cannot be loaded on a creature at the same time. Only one will be loaded!

Signatureless Effects CAN have unique lists, and will have priority.
*/
export class PassiveEffect {
  $: {
    id?: string
    info: {
      name: string
      lore: string
      replacers?: LoreReplacer[]
    }
    hide?: (creature?: Creature) => boolean
    unique?: Set<string>
    // preload is called while parsing, BEFORE vitals are loaded.
    preload?: (creature: Creature) => void
    // postload is called while parsing, AFTER vitals are loaded.
    postload?: (creature: Creature) => void
    modifiers?: NamedModifier[]

    beforeDamageTaken?: (creature: Creature, db: typeof Mongoose, damage: DamageGroup) => Promise<void>
    afterDamageTaken?: (creature: Creature, db: typeof Mongoose, log: DamageLog) => Promise<void>
    beforeDamageGiven?: (creature: Creature, db: typeof Mongoose, damage: DamageGroup) => Promise<void>
    afterDamageGiven?: (creature: Creature, db: typeof Mongoose, log: DamageLog) => Promise<void>
    onDodge?: (Creature: Creature, db: typeof Mongoose, log: DamageLog) => Promise<void>
    beforeTick?: (creature: Creature, db: typeof Mongoose) => Promise<void>
    afterTick?: (creature: Creature, db: typeof Mongoose) => Promise<void>

    onBust?: (creature: Creature, db: typeof Mongoose) => Promise<void>
    onAttack?: (creature: Creature, db: typeof Mongoose, log: DamageLog) => Promise<void>
    onAbility?: (creature: Creature, db: typeof Mongoose, ability: CreatureAbility, ult: boolean) => Promise<void>

    beforeGotHealed?: (creature: Creature, db: typeof Mongoose, damage: HealGroup) => Promise<void>
    afterGotHealed?: (creature: Creature, db: typeof Mongoose, damage: HealLog) => Promise<void>
    beforeGiveHealing?: (creature: Creature, db: typeof Mongoose, damage: HealGroup) => Promise<void>
    afterGiveHealing?: (creature: Creature, db: typeof Mongoose, damage: HealLog) => Promise<void>

    onFightExit?: (creature: Creature, db: typeof Mongoose, fight: Fight) => Promise<void>
  }

  constructor(data: PassiveEffect["$"]) {
    this.$ = data;
  }
}

export interface NamedModifier extends Modifier {
  stat: Stats | Attributes
}