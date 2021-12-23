import { ApplicationCommandOptionChoice } from "discord.js";
import Mongoose from "mongoose";
import Creature from "../../game/Creature";
import { AutocompleteHandler } from "../autocomplete";
import { getAutocompleteListOfItems } from "./handbook";

export default new AutocompleteHandler(
  "char",
  async function(interaction, Bot, db) {
    const focused = interaction.options.getFocused(true);

    switch (focused.name) {
      case "id": {
        interaction.respond(await autocompleteCreatures(new RegExp(String(focused.value), "ig"), db));
      } break;
      case "recipe_id": {
        interaction.respond(await getAutocompleteListOfItems(String(interaction.options.getFocused(true).value), "recipes"))
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