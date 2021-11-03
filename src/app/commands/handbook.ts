import { MessageEmbed } from "discord.js";
import { AbilitiesManager, capitalize, ClassManager, ItemManager, PassivesManager, SpeciesManager } from "../..";
import { Ability } from "../../game/Abilities";
import { CreatureClass } from "../../game/Classes";
import { Item } from "../../game/Items";
import { PassiveEffect, PassiveModifier } from "../../game/PassiveEffects";
import { CreatureSpecies } from "../../game/Species";
import { Modifier, ModifierType } from "../../game/Stats";
import { ApplicationCommand } from "../commands";

const ITEMS_PER_PAGE = 10;

export default new ApplicationCommand(
  {
    name: "handbook",
    description: "All your info in one place",
    type: "CHAT_INPUT",
    options: [
      {
        name: "type",
        type: "STRING",
        description: "Which items?",
        required: true,
        choices: [
          {
            name: "Items",
            value: "items"
          },
          {
            name: "Species",
            value: "species"
          },
          {
            name: "Classes",
            value: "classes"
          },
          {
            name: "Global Passives",
            value: "passives"
          }
        ]
      },
      {
        name: "page",
        description: "Use in case there's too many items to display at once",
        type: "INTEGER"
      }
    ]
  },
  async function (interaction, Bot, db) {
    let list: Map<string, ManagedItems>;
    let title: string;
    switch (interaction.options.getString("type")) {
      default: return;
      case "items":
        list = ItemManager.map;
        title = "Items";
        break;
      case "species":
        list = SpeciesManager.map;
        title = "Species";
        break;
      case "classes":
        list = ClassManager.map;
        title = "Classes";
        break;
      case "passives":
        list = PassivesManager.map;
        title = "Global Passives";
        break;
    }

    const _defer = interaction.deferReply({ ephemeral: true });

    let page = Number(interaction.options.getString("page"));
    if (isNaN(page) || page < 1) {
      page = 1;
    }

    const array = Array.from(list.values());

    const embed = new MessageEmbed()
      .setTitle(title)
      .setColor("AQUA")
      .setFooter(`Page ${page}/${Math.floor(array.length / ITEMS_PER_PAGE) + 1}`)

    for (const item of array) {
      embed.addField(
        `${item.$.info.name} \`${item.$.id ?? ""}\``,
        `*${item.$.info.lore}*\n\n` + function() {
          var str = "";

          if (item instanceof Item) {
            str += passivesDescriptor(item.$.passives ?? []);
            str += abilitiesDescriptor(item.$.abilities ?? [])
          } else if (item instanceof CreatureSpecies) {
            str += passivesDescriptor(item.$.passives ?? []);
            str += abilitiesDescriptor(item.$.abilities ?? []);
          } else if (item instanceof CreatureClass) {
            str += passivesDescriptor(item.$.passives ?? []);
            str += abilitiesDescriptor(item.$.abilities ?? [])
            if (item.$.incompatibleSpecies && item.$.incompatibleSpecies.length > 0) {
              const species: string[] = [];
              for (const r of item.$.incompatibleSpecies) {
                const race = SpeciesManager.map.get(r);
                if (!race) continue;

                species.push(race.$.info.name);
              }

              str += `Incompatible species: ${species}\n`;
            }
          } else if (item instanceof PassiveEffect) {
            str += modifierDescriptor(item.$.modifiers ?? []);
          }

          return str;
        }()
      )
    }

    await _defer;
    interaction.editReply({
      embeds: [embed]
    })
  }
)

function modifierDescriptor(modifiers: PassiveModifier[]) {
  var str = "";
  if (modifiers.length > 0) {
    str += "**Modifiers**\n";
    for (const mod of modifiers) {
      str += `**`;
      switch (mod.type) {
        case ModifierType.MULTIPLY: str += `${mod.value}x`; break;
        case ModifierType.ADD_PERCENT: str += `${mod.value >= 0 ? "+" : "-"}${Math.round(Math.abs(mod.value) * 1000) / 10}%`; break;
        case ModifierType.CAP_MAX: str += `${mod.value}^`; break;
        case ModifierType.ADD_PERCENT: str += `${mod.value >= 0 ? "+" : "-"}${Math.abs(mod.value)}`; break;
      }
      str += `** ${capitalize(mod.stat.replaceAll(/_/g, " "))}\n`;
    }
    str += "\n"
  }
  return str;
}

function abilitiesDescriptor(abilities: string[]) {
  var str = "";
  if (abilities.length > 0) {
    str += "**Abilities**\n";
    for (const ab of abilities) {
      const ability = AbilitiesManager.map.get(ab);
      if (!ability) continue;

      str += `${ability.$.info.name} \`${ability.$.id}\``;
    }
    str += "\n"
  }
  return str;
}


function passivesDescriptor(passives: (string | PassiveEffect)[]) {
  var str = "";
  if (passives.length > 0) {
    str += "**Passives**\n";
    for (const passive of passives) {
      if (typeof passive === "string") {
        str += `[**G**] ${PassivesManager.map.get(passive)?.$.info.name}\`${passive}\``;
      } else {
        str += `[**L**] ${passive.$.info.name}\n*${passive.$.info.lore}*\n${(passive.$.unique ?? []).length > 0 ? `Unique flags: ${passive.$.unique?.join(", ")}\n` : ""}\n${modifierDescriptor(passive.$.modifiers ?? [])}`;
      }
    }
    str += "\n"
  }
  return str;
}

type ManagedItems = Item | CreatureClass | CreatureSpecies | PassiveEffect;