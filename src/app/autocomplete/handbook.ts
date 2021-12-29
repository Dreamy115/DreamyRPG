import { ApplicationCommandOptionChoice, Interaction } from "discord.js";
import { ItemManager, SpeciesManager, ClassManager, PassivesManager, AbilitiesManager, EffectManager, PerkManager, SkillManager, RecipeManager, LocationManager } from "../..";
import ActiveEffectManager, { ActiveEffect } from "../../game/ActiveEffects";
import CreatureClassManager, { CreatureClass } from "../../game/Classes";
import { CraftingRecipe } from "../../game/Crafting";
import CreatureAbilitiesManager, { CreatureAbility } from "../../game/CreatureAbilities";
import ItemsManager, { Item } from "../../game/Items";
import PassiveEffectManager from "../../game/PassiveEffects";
import CreatureSpeciesManager, { CreatureSpecies } from "../../game/Species";
import { AutocompleteHandler } from "../autocomplete";

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
    case "recipes":
      list = RecipeManager.map;
      break;
    case "locations":
      list = LocationManager.map;
      break;
  }

  const keys = Array.from(list.keys());
  // @ts-expect-error
  const values: (ManagedItems[]) = Array.from(list.values());
  const input_regex = RegExp(value, "i");

  let choices: ApplicationCommandOptionChoice[] = []; 
  if (values[0] instanceof CraftingRecipe) {
    for (var i = 0; choices.length < MAX_RESULTS && i < keys.length; i++) {
      const item = values[i];
      if (!item) continue;
  
      if (input_regex.test(item.$.id) || input_regex.test(item.$.info.name)) {
        const result = ItemManager.map.get(item.$.result);
        if (!result) continue;

        choices.push({
          name: `${item.$.id} - ${result.$.info.name} (${result.$.id})`,
          value: item.$.id
        })
      }
    }
  } else {
    for (var i = 0; choices.length < MAX_RESULTS && i < keys.length; i++) {
      const item = values[i];
      if (!item) continue;

      if (input_regex.test(item.$.id) || input_regex.test(item.$.info.name)) 
        choices.push({
          name: `${item.$.info.name} (${item.$.id})`,
          value: item.$.id
        })
    }
  }

  return choices;
}

const MAX_RESULTS = 25;