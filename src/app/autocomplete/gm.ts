import { ApplicationCommandOptionChoice } from "discord.js";
import { Fight } from "../../game/Fight";
import { AutocompleteHandler } from "../autocomplete";

export default new AutocompleteHandler(
  "gm",
  async function (interaction, Bot, db) {
    const focused = interaction.options.getFocused(true);
    const search = RegExp(String(focused.value), "ig");
    const autocomplete: ApplicationCommandOptionChoice[] = []; 

    switch (interaction.options.getSubcommandGroup(false) ?? interaction.options.getSubcommand(false)) {
      case "fight": {
        switch (focused.name) {
          case "id": {
            for await (const fight_data of db.connection.collection(Fight.COLLECTION_NAME).find({ "_id": { $regex: search }})) {
              const fight = new Fight(fight_data);

              if (autocomplete.length > 20) break;

              autocomplete.push({
                name: `${fight.$._id} - ${fight.$.parties.length} Parties`,
                value: fight.$._id
              })
            }

            interaction.respond(autocomplete);
          } break;
        }
      } break;
    }
  }
)