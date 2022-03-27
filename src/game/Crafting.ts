import fs from "fs";
import path from "path";
import { PerkManager, capitalize, ItemManager } from "..";
import Creature from "./Creature";
import { ItemQuality, ItemQualityEmoji } from "./Items";

export default class CraftingManager {
  map = new Map<string, Schematic>();
  free = new Set<string>();
  async load(dir: fs.PathLike) {
    this.map.clear();

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".js")) continue;

      const {default: loadedFile, free} = await import(path.join(dir.toString(), file));

      if (loadedFile instanceof Schematic) {
        this.map.set(loadedFile.$.id, loadedFile);
      } else {
        if (loadedFile instanceof Array) {
          for (const subfile of loadedFile) {
            if (subfile instanceof Schematic) {
              this.map.set(subfile.$.id, subfile);
            }
          }
        }
      }

      if (free)
        for (const f of Array.from(free)) {
          this.free.add(String(f));
        }
    }
  }
}

/*
* You can import Set<string> or string[] as 'free'
* export const free = new Set(["schematic_id"])
* This makes it so the schematic is given to every Creature
*/

export class Schematic {
  $: {
    id: string
    info: {
      name: string
      lore: string
      quality: ItemQuality
    }
    table: string
    requirements: {
      enhancedCrafting: boolean
      perks?: Set<string>
      items?: string[]
      materials?: CraftingMaterials
    }
    // hides when "items" missing
    upgrade?: boolean
  }
  check(creature: Creature): [true] | [false, string] {
    if (!creature.schematics.has(this.$.id)) throw new Error("Not learned");
    if (this.$.requirements.enhancedCrafting && !creature.location?.$.hasEnhancedCrafting) return [false, "Need Enhanced Crafting"];
      
    var perks = creature.perks;
    for (const p of this.$.requirements.perks ?? []) {
      const perk = PerkManager.map.get(p);
      if (!perk) continue;

      if (!perks.find((v) => v.$.id === perk.$.id)) return [false, `Need ${perk.$.info.name} \`${perk.$.id}\` perk`];
    }
    for (const mat in this.$.requirements.materials) {
      const material: number = this.$.requirements.materials[mat as Material];

      const diff = creature.$.items.crafting_materials[mat as Material] - material;

      if (diff < 0) return [false, `Need ${-diff} ${capitalize(mat)}`];
    }
    for (const i of this.$.requirements.items ?? []) {
      const item = ItemManager.map.get(i);
      if (!item) continue;

      if (!creature.$.items.backpack.find(v => v.id === item.$.id)) return [false, `Need ${item.$.info.name} (${item.$.id})`];
    }
    return [true];
  }

  constructor(data: Schematic["$"]) {
    this.$ = data;
  }

  get displayName() {
    return `${ItemQualityEmoji[this.$.info.quality]} ${this.$.info.name}`;
  }
}

export class CraftingMaterials {
  metal: number
  fabric: number
  plastic: number
  cells: number
  biomaterial: number

  constructor(data: {[key: string]: number}) {
    this.metal = data.metal ?? 0;
    this.fabric = data.fabric ?? 0;
    this.plastic = data.plastic ?? 0;
    this.cells = data.cells ?? 0;
    this.biomaterial = data.biomaterial ?? 0;
  }
}

export type Material =
  "metal" |
  "fabric" |
  "plastic" |
  "cells" |
  "biomaterial"