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
      // @ts-expect-error
      const recipe: CraftingRecipe = values[i];
      if (!recipe) continue;
  
      const results: Item[] = [];
      const names: string[] = [];
      for (const res of recipe.$.results) {
        const result = ItemManager.map.get(res);
        if (!result) continue;

        results.push(result);
        names.push(result.$.info.name)
      }

      if (
        input_regex.test(recipe.$.id) ||
        function() {
          for (const result of results) {
            if (input_regex.test(result.$.info.name) || input_regex.test(result.$.id)) return true;
          }

          return false;
        }()
      ) {
        choices.push({
          name: `${recipe.$.id} >> ${names.join(", ")} (${recipe.$.results.join(", ")})`,
          value: recipe.$.id
        })
      }
    }
  } else {
    for (var i = 0; choices.length < MAX_RESULTS && i < keys.length; i++) {
      // @ts-expect-error
      const item: Exclude<ManagedItems, CraftingRecipe> = values[i];
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