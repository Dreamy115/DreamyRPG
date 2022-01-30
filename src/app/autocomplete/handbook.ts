import { ApplicationCommandOptionChoice, Interaction } from "discord.js";
import { ItemManager, SpeciesManager, ClassManager, PassivesManager, AbilitiesManager, EffectManager, PerkManager, SkillManager, SchematicsManager, LocationManager, LootTables, Directives } from "../..";
import ActiveEffectManager, { ActiveEffect } from "../../game/ActiveEffects";
import CreatureClassManager, { CreatureClass } from "../../game/Classes";
import { Schematic } from "../../game/Crafting";
import CreatureAbilitiesManager, { CreatureAbility } from "../../game/CreatureAbilities";
import ItemsManager, { Item } from "../../game/Items";
import { LootTable } from "../../game/LootTables";
import PassiveEffectManager from "../../game/PassiveEffects";
import CreatureSpeciesManager, { CreatureSpecies } from "../../game/Species";
import { AutocompleteHandler } from "../autocomplete";
import { ManagedItems } from "../commands/handbook";

export default new AutocompleteHandler(
  "handbook",
  async function(interaction, Bot, db) {
    interaction.respond(await getAutocompleteListOfItems(String(interaction.options.getFocused(true).value), interaction.options.getString("type", true)))    
  }
)

export async function getAutocompleteListOfItems(value: string, type: string): Promise<ApplicationCommandOptionChoice[]> {
  var list;
  switch (type) {
    default: return [];
    case "items":
      list = ItemManager.map;
      break;
    case "species":
      list = SpeciesManager.map;
      break;
    case "classes":
      list = ClassManager.map;
      break;
    case "passives":
      list = PassivesManager.map;
      break;
    case "abilities":
      list = AbilitiesManager.map;
      break;
    case "effects":
      list = EffectManager.map;
      break;
    case "perks":
      list = PerkManager.map;
      break;
    case "skills":
      list = SkillManager.map;
      break;
    case "schematics":
      list = SchematicsManager.map;
      break;
    case "locations":
      list = LocationManager.map;
      break;
    case "loottables":
      list = LootTables.map;
      break;
    case "directives": {
      list = Directives.map;
      break;
    }
  }

  const keys = Array.from(list.keys());
  const values: (ManagedItems[]) = Array.from(list.values() as Iterable<ManagedItems>);
  const input_regex = RegExp(value, "i");

  let choices: ApplicationCommandOptionChoice[] = []; 
  if (values[0] instanceof LootTable) {
    for (var i = 0; choices.length < MAX_RESULTS && i < keys.length; i++) {
      const item = values[i] as LootTable;
      if (!item) continue;

      if (input_regex.test(item.$.id ?? "")) { 
        choices.push({
          name: `${item.$.id} - ${item.$.note}`,
          value: item.$.id ?? "null"
        })
      }
    }
  } else {
    for (var i = 0; choices.length < MAX_RESULTS && i < keys.length; i++) {
      const item = values[i] as Exclude<Exclude<ManagedItems, Schematic>, LootTable>;
      if (!item) continue;

      if (input_regex.test(item.$.id ?? "") || input_regex.test(item.$.info.name)) 
        choices.push({
          name: `${item.$.info.name} (${item.$.id})`,
          value: item.$.id ?? "null"
        })
    }
  }

  return choices;
}

const MAX_RESULTS = 25;