import { ApplicationCommandOptionChoice } from "discord.js";
import Mongoose from "mongoose";
import { capitalize, ItemManager, PerkManager, SchematicsManager } from "../..";
import { CraftingMaterials, Material } from "../../game/Crafting";
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
      case "recipient":
      case "id": {
        interaction.respond(await autocompleteCreatures(search, db));
      } break;
      case "backpack_item": {
        const char = await Creature.fetch(interaction.user.id, db, true);
        if (char) {
          const array: ApplicationCommandOptionChoice[] = [];
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
          const array: ApplicationCommandOptionChoice[] = [];

          for (const schem of creature.schematics) {
            const recipe = SchematicsManager.map.get(schem);
            if (!recipe) continue;

            if (
              search.test(schem) || search.test(recipe.$.info.name)
            ) {

              let info = "";

              try {
                if (recipe.$.requirements.enhancedCrafting && !creature.location?.$.hasEnhancedCrafting) throw new Error("Missing Enhanced Crafting");
      
                var perks = creature.perks;
                for (const p of recipe.$.requirements.perks ?? []) {
                  const perk = PerkManager.map.get(p);
                  if (!perk) continue;
      
                  if (!perks.find((v) => v.$.id === perk.$.id)) throw new Error(`Missing Perk`)
                }
                for (const mat in recipe.$.requirements.materials) {
                  const material: number = recipe.$.requirements.materials[mat as Material];

                  if (creature.$.items.crafting_materials[mat as Material] < material) throw new Error(`Need more ${capitalize(mat)}`)
                }
                for (const i of recipe.$.requirements.items ?? []) {
                  const item = ItemManager.map.get(i);
                  if (!item) continue;
      
                  if (!creature.$.items.backpack.find(v => v.id === item.$.id)) throw new Error(`Missing ${item.$.info.name} (${item.$.id})`)
                }
              } catch (e: any) {
                info = `⚠️ [${e.message}] `;
              }

              array.push({
                name: `${info}${recipe.$.info.name} (${recipe.$.id})`,
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
      value: creature._id,
      name: `${creature._id} - ${creature?.info?.display?.name ?? "Unknown"}${creature?.info?.npc ? " (NPC) " : ""}`
    })
  }

  return array;
}