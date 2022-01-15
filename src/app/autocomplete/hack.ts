import { AutocompleteHandler } from "../autocomplete";
import { autocompleteCreatures } from "./char";

export default new AutocompleteHandler(
  "hack",
  async function (interaction, Bot, db) {
    const focused = interaction.options.getFocused(true);
    const search = new RegExp(String(focused.value), "ig");

    switch (focused.name) {
      case "cid": {
        interaction.respond(await autocompleteCreatures(search, db));
      } break;
    }
  }
)