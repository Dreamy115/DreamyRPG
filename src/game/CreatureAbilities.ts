import { ColorResolvable, MessageEmbed } from "discord.js";
import fs from "fs";
import Mongoose from "mongoose";
import path from "path";
import Creature from "./Creature";
import { VitalsLog } from "./Damage";
import { ItemQuality, ItemQualityColor, ItemQualityEmoji } from "./Items";
import { LoreReplacer, replaceLore } from "./LoreReplacer";

export default class CreatureAbilitiesManager {
  map = new Map<string, CreatureAbility>();
  async load(dir: fs.PathLike) {
    this.map.clear();

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".js")) continue;

      const {default: loadedFile} = await import(path.join(dir.toString(), file));

      if (loadedFile instanceof CreatureAbility) {
        if (loadedFile.$.id)
          this.map.set(loadedFile.$.id, loadedFile);
      } else {
        if (loadedFile instanceof Array) {
          for (const subfile of loadedFile) {
            if (subfile instanceof CreatureAbility) {
              if (subfile.$.id)
                this.map.set(subfile.$.id, subfile);
            }
          }
        }
      }
    }
  }
}

export class CreatureAbility {
  $: {
    id: string
    info: {
      name: string
      lore: string
      replacers?: LoreReplacer[]
      quality: ItemQuality
      role: AbilityRole
    }
    type: AbilityType
    min_targets: number // If this is 0, only caster is provided and targets is empty
    max_targets?: number // Min targets must be at least 1 to take effect, and must be more than min targets.
    unique?: Set<string>
    haste?: number
    cost: number
    use: (caster: Creature, db: typeof Mongoose, targets: Creature[], accuracy_mods: number[]) => Promise<AbilityUseLog>
    test?: (caster: Creature) => Promise<void> // Resolve if can use, Reject if cannot use currently
  }

  get displayName() {
    return `${ItemQualityEmoji[this.$.info.quality]}${this.$.info.name}`;
  }
  constructor(data: CreatureAbility["$"]) {
    this.$ = data;
  }
  describeEmbed(creature?: Creature) {
    return new MessageEmbed()
    .setTitle(this.$.info.name)
    .setColor(ItemQualityColor[this.$.info.quality] as ColorResolvable)
    .setDescription(
      replaceLore(this.$.info.lore, this.$.info.replacers ?? [], creature) +
      `\n\n` +
      `Cost **${this.$.cost}**\n` +
      `Haste **${this.$.haste ?? 1}**\n` +
      `Type **${AbilityType[this.$.type]}** / **${AbilityRole[this.$.info.role]}**`
    )
  }
}

export enum AbilityType {
  "Other" = -1,
  "Attack", "Heal", "Buff", "Debuff"
}

export interface AbilityUseLog {
  vitalsLogs?: VitalsLog[]
  text: string
  returns?: string[]
}


export enum AbilityRole {
  "Duelist", "Motivator", "Controller", "Tank"
}