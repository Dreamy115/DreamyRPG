import { ApplicationCommandOptionChoice } from "discord.js";
import { EffectManager, ItemManager, SkillManager } from "../..";
import { DisplaySeverity, romanNumeral } from "../../game/ActiveEffects";
import Creature from "../../game/Creature";
import { Fight } from "../../game/Fight";
import { AutocompleteHandler } from "../autocomplete";
import { autocompleteCreatures } from "./char";
import { getAutocompleteListOfItems } from "./handbook";

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
      case "cedit_normal":
      case "cedit_gm": 
      case "ceditmenu": {
        function fetchChar() {
          return new Promise<Creature|null>((resolve, reject) => {
            resolve(Creature.fetch(interaction.options.getString("cid", false) ?? "", db).catch(() => null))
          })
        }
        switch (focused.name) {
          case "cid": {
            interaction.respond(await autocompleteCreatures(search, db))
          } break;
          case "effect_id": {
            interaction.respond(await getAutocompleteListOfItems(String(focused.value), "effects"))
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
                const item = ItemManager.map.get(i);
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
        }
      } break;
    }
  }
)