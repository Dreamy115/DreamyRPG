import { ApplicationCommandOptionChoiceData } from "discord.js";
import { Fight } from "../../game/Fight";
import { AutocompleteHandler } from "../autocomplete";
import { autocompleteCreatures } from "./char";
import { getAutocompleteListOfItems } from "./handbook";

export default new AutocompleteHandler(
  "gm",
  async function (interaction, Bot, db) {
    const focused = interaction.options.getFocused(true);
    const search = RegExp(String(focused.value), "ig");
    const autocomplete: ApplicationCommandOptionChoiceData[] = []; 
    
    switch (interaction.options.getSubcommandGroup(false) ?? interaction.options.getSubcommand(false)) {
      case "fight": {
        switch (focused.name) {
          case "id": {
            for await (const fight_data of db.connection.collection(Fight.COLLECTION_NAME).find({ "_id": { $regex: search }})) {
              // @ts-ignore
              const fight = new Fight(fight_data);

              if (autocomplete.length > 20) break;

              autocomplete.push({
                name: `${fight.$._id} - ${fight.$.parties.length} Parties, Round ${fight.$.round}`,
                value: fight.$._id
              })
            }

            interaction.respond(autocomplete);
          } break;
        }
      } break;
      case "cmove": {
        switch (focused.name) {
          case "location_id": {
            interaction.respond(await getAutocompleteListOfItems(String(focused.value), "locations"))
          } break;
          case "creature_id": {
            interaction.respond(await autocompleteCreatures(search, db))
          } break;
        }
      } break;
      case "cclone": {
        switch (focused.name) {
          case "old_id": {
            interaction.respond(await autocompleteCreatures(search, db))
          } break;
        }
      } break;
    }
  }
)