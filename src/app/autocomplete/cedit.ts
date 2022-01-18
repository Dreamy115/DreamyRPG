import { ApplicationCommandOptionChoice } from "discord.js";
import { SkillManager, EffectManager, ItemManager, SchematicsManager } from "../..";
import { DisplaySeverity, romanNumeral } from "../../game/ActiveEffects";
import Creature from "../../game/Creature";
import { AutocompleteHandler } from "../autocomplete";
import { autocompleteCreatures } from "./char";
import { getAutocompleteListOfItems } from "./handbook";

export default new AutocompleteHandler(
  "cedit",
  async function (interaction, Bot, db) {
    const focused = interaction.options.getFocused(true);
    const search = RegExp(String(focused.value), "ig");
    const autocomplete: ApplicationCommandOptionChoice[] = []; 

    function fetchChar() {
      return new Promise<Creature|null>((resolve, reject) => {
        resolve(Creature.fetch(interaction.options.getString("cid", false) ?? "", db).catch(() => null))
      })
    }
    switch (focused.name) {
      case "loottable": {
        interaction.respond(await getAutocompleteListOfItems(String(focused.value), "loottables"));
      } break;
      case "cid": {
        interaction.respond(await autocompleteCreatures(search, db))
      } break;
      case "effect_id": {
        interaction.respond(await getAutocompleteListOfItems(String(focused.value), "effects"))
      } break;
      case "schematic_id": {
        interaction.respond(await getAutocompleteListOfItems(String(focused.value), "schematics"))
      } break;
      case "item_id": {
        interaction.respond(await getAutocompleteListOfItems(String(focused.value), "items"))
      } break;
      case "skill_id": {
        const char = await fetchChar();
        if (char) {
          const array: ApplicationCommandOptionChoice[] = [];
          for (const skill of SkillManager.map.values()) {
            if (search.test(skill.$.id) || search.test(skill.$.info.name))
              if (
                (!skill.$.compatibleClasses || (char.$.info.class && skill.$.compatibleClasses.has(char.$.info.class))) &&
                (!skill.$.compatibleSpecies || (char.$.info.species && skill.$.compatibleSpecies.has(char.$.info.species)))
              )
              array.push({
                name: `${skill.$.id} - ${skill?.$.info.name}`,
                value: skill.$.id
              })
            if (array.length >= 25) break;
          }
          interaction.respond(array);
        }
      } break;
      case "effect": {
        const char = await fetchChar();
        if (char) {
          const array: ApplicationCommandOptionChoice[] = [];
          for (const e of char.$.active_effects) {
            const effect = EffectManager.map.get(e.id);
            if (search.test(e.id) || search.test(effect?.$.info.name ?? "") || search.test(String(e.severity)) || search.test(String(e.ticks)))
              array.push({
                name: `${e.id} - ${effect?.$.info.name}${
                  effect?.$.display_severity !== DisplaySeverity.NONE
                  ? (
                    effect?.$.display_severity === DisplaySeverity.ROMAN
                    ? romanNumeral(e.severity)
                    : e.severity
                  ) 
                  : ""} for ${e.ticks} ticks`,
                value: e.id
              })
            if (array.length >= 25) break;
          }
          interaction.respond(array);
        }
      } break;
      case "backpack_item": {
        const char = await fetchChar();
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
      case "unlocked_skill": {
        const char = await fetchChar();
        if (char) {
          const array: ApplicationCommandOptionChoice[] = [];
          for (const i of char.$.items.skills) {
            const item = SkillManager.map.get(i);
            if (search.test(i) || search.test(item?.$.info.name ?? ""))
              array.push({
                name: `${i} - ${item?.$.info.name}`,
                value: i
              })
            if (array.length >= 25) break;
          }
          interaction.respond(array);
        }
      } break;
      case "unlocked_schematic": {
        const char = await fetchChar();
        if (char) {
          const array: ApplicationCommandOptionChoice[] = [];
          for (const i of char.$.items.schematics) {
            const item = SchematicsManager.map.get(i);
            if (search.test(i) || search.test(item?.$.info.name ?? ""))
              array.push({
                name: `${i} - ${item?.$.info.name}`,
                value: i
              })
            if (array.length >= 25) break;
          }
          interaction.respond(array);
        }
      } break;
    }
  }
)