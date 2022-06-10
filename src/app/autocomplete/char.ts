import { ApplicationCommandOptionChoiceData } from "discord.js";
import Mongoose from "mongoose";
import { ItemManager, SchematicsManager } from "../..";
import { CraftingCheckError } from "../../game/Crafting";
import Creature from "../../game/Creature";
import { AutocompleteHandler } from "../autocomplete";

export default new AutocompleteHandler(
  "char",
  async function(interaction, Bot, db) {
    const focused = interaction.options.getFocused(true);
    const search = new RegExp(String(focused.value), "ig");

    switch (focused.name) {
      case "recipient":
      case "id": {
        interaction.respond(await autocompleteCreatures(search, db));
      } break;
      case "backpack_item": {
        const char = await Creature.fetch(interaction.user.id, db, true);
        if (char) {
          const array: ApplicationCommandOptionChoiceData[] = [];
          for (const i of char.$.items.backpack) {
            const item = ItemManager.map.get(i.id);
            if (search.test(i.id) || search.test(item?.$.info.name ?? ""))
              array.push({
                name: `${i.id} - ${item?.$.info.name}`,
                value: i.id
              })
            if (array.length >= 25) break;
          }
          interaction.respond(array);
        }
      } break;
      case "recipe_id": {
        const creature = await Creature.fetch(interaction.user.id, db, true);

        interaction.respond(function () {
          const array: ApplicationCommandOptionChoiceData[] = [];

          for (const schem of creature.schematics) {
            const recipe = SchematicsManager.map.get(schem);
            if (!recipe) continue;

            if (
              search.test(schem) || search.test(recipe.$.info.name)
            ) {

              let info: null | string = null;

              let error: CraftingCheckError | -1 = -1;
              try {
                var e = recipe.check(creature);
                if (!e[0]) {
                  error = e[2];
                  throw new Error(e[1]);
                }
              } catch (e: any) {
                info = `⚠️ [${e.message}] `;
              }

              if (!(error === CraftingCheckError.Item && recipe.$.upgrade))
                array.push({
                  name: `${info ?? ""}${recipe.$.info.name} (${recipe.$.id})`,
                  value: recipe.$.id
                });
            }
          }

          return array;
        }())
      } break;
    }
  }
)

export async function autocompleteCreatures(search: RegExp, db: typeof Mongoose, limit = 10): Promise<ApplicationCommandOptionChoiceData[]> {
  const array: ApplicationCommandOptionChoiceData[] = [];

  for await (const creature of db.connection.collection(Creature.COLLECTION_NAME).find(
    { $or: [
      {_id: {"$regex": search}},
      {"info.display.name": {"$regex": search}}
    ]
  }, {limit})) {
    array.push({
      value: String(creature._id),
      name: `${creature._id} - ${creature?.info?.display?.name ?? "Unknown"}${creature?.info?.npc ? " (NPC) " : ""}`
    })
  }

  return array;
}