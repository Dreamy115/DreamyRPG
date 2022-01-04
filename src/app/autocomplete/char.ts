import { ApplicationCommandOptionChoice } from "discord.js";
import Mongoose from "mongoose";
import { ItemManager, RecipeManager } from "../..";
import Creature from "../../game/Creature";
import { Item } from "../../game/Items";
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

            const results: Item[] = [];
            const names: string[] = [];
            for (const res of recipe.$.results) {
              const result = ItemManager.map.get(res);
              if (!result) continue;

              results.push(result);
              names.push(result.$.info.name)
            }

            if (
              search.test(schem) ||
              function() {
                for (const result of results) {
                  if (search.test(result.$.info.name) || search.test(result.$.id)) return true;
                }

                return false;
              }()
            ) {
              array.push({
                name: `${recipe.$.id} >> ${names.join(", ")} (${recipe.$.results.join(", ")})`,
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