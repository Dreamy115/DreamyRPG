import { ApplicationCommandOptionChoice } from "discord.js";
import Mongoose from "mongoose";
import { ItemManager, RecipeManager } from "../..";
import Creature from "../../game/Creature";
import { AutocompleteHandler } from "../autocomplete";
import { getAutocompleteListOfItems } from "./handbook";

export default new AutocompleteHandler(
  "char",
  async function(interaction, Bot, db) {
    const focused = interaction.options.getFocused(true);
    const search = new RegExp(String(focused.value), "ig");

    switch (focused.name) {
      case "id": {
        interaction.respond(await autocompleteCreatures(search, db));
      } break;
      case "recipe_id": {
        const creature = await Creature.fetch(interaction.user.id, db, true);

        interaction.respond(function () {
          const array: ApplicationCommandOptionChoice[] = [];

          for (const schem of creature.schematics) {
            const recipe = RecipeManager.map.get(schem);
            if (!recipe) continue;

            const result = ItemManager.map.get(recipe.$.id);

            if (search.test(schem) || search.test(recipe.$.result) || search.test(result?.$.info.name ?? "Unknown")) {
              array.push({
                name: `${recipe.$.id} >> ${result?.$.info.name} (${recipe.$.result})`,
                value: recipe.$.id
              })
            }
          }

          return array;
        }())
      } break;
    }
  }
)

export async function autocompleteCreatures(search: RegExp, db: typeof Mongoose, limit = 10): Promise<ApplicationCommandOptionChoice[]> {
  const array: ApplicationCommandOptionChoice[] = [];

  for await (const creature of db.connection.collection(Creature.COLLECTION_NAME).find(
    { $or: [
      {_id: {"$regex": search}},
      {"info.display.name": {"$regex": search}}
    ]
  }, {limit})) {
    array.push({
      name: `${creature._id} - ${creature?.info?.display?.name ?? "Unknown"}${creature?.info?.npc ? " (NPC) " : ""}`,
      value: creature._id
    })
  }

  return array;
}