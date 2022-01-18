import { ApplicationCommandOptionChoice } from "discord.js";
import { GameDirective } from "../../game/GameDirectives";
import { AutocompleteHandler } from "../autocomplete";
import { getAutocompleteListOfItems } from "./handbook";

export default new AutocompleteHandler(
  "directive",
  async function (interaction, Bot, db) {
    const focused = interaction.options.getFocused(true);
    const search = RegExp(String(focused.value), "ig");
    const autocomplete: ApplicationCommandOptionChoice[] = []; 

    switch (focused.name) {
      case "directive": {
        switch (interaction.options.getSubcommand(false)) {
          default: {
            interaction.respond(await getAutocompleteListOfItems(String(focused.value), "directives"))
          } break;
          case "enable": {
            autocomplete.push(...await getAutocompleteListOfItems(String(focused.value), "directives"));
            for (const gd of GameDirective.enabled) {
              const index = autocomplete.findIndex(v => v.value === gd.$.id);
              if (index !== -1)
                autocomplete.splice(index, 1);
            }
          } break;
          case "disable": {
            for (const gd of GameDirective.enabled) {
              autocomplete.push({
                name: gd.$.info.name,
                value: gd.$.id
              })
            }
          } break;
        }
      } break;
    }
    interaction.respond(autocomplete);
  }
)