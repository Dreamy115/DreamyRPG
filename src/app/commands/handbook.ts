import { ApplicationCommandOptionData, MessageEmbed } from "discord.js";
import { AbilitiesManager, capitalize, ClassManager, EffectManager, ItemManager, PassivesManager, PerkManager, RecipeManager, SkillManager, SpeciesManager } from "../..";
import { ActiveEffect } from "../../game/ActiveEffects";
import { CreatureClass } from "../../game/Classes";
import { CraftingRecipe } from "../../game/Crafting";
import { CreatureAbility, replaceLore } from "../../game/CreatureAbilities";
import { DamageMedium, DamageType } from "../../game/Damage";
import { AttackData, AttackSet, Item } from "../../game/Items";
import { PassiveEffect, PassiveModifier } from "../../game/PassiveEffects";
import { CreaturePerk } from "../../game/Perks";
import { CreatureSkill } from "../../game/Skills";
import { CreatureSpecies } from "../../game/Species";
import { Modifier, ModifierType } from "../../game/Stats";
import { ApplicationCommandHandler } from "../commands";

const ITEMS_PER_PAGE = 25;

const typeOption: ApplicationCommandOptionData = {
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
    },
    {
      name: "Abilities",
      value: "abilities"
    },
    {
      name: "Effects",
      value: "effects"
    },
    {
      name: "Perks",
      value: "perks"
    },
    {
      name: "Skills",
      value: "skills"
    },
    {
      name: "Crafting Recipes",
      value: "recipes"
    }
  ]
}

export default new ApplicationCommandHandler(
  {
    name: "handbook",
    description: "All your info in one place",
    type: "CHAT_INPUT",
    options: [
      {
        name: "list",
        description: "List pages of items",
        type: "SUB_COMMAND",
        options: [
          typeOption,
          {
            name: "page",
            description: "Use in case there's too many items to display at once",
            type: "INTEGER"
          }
        ]
      },
      {
        name: "item",
        description: "A Single item",
        type: "SUB_COMMAND",
        options: [
          typeOption,
          {
            name: "id",
            description: "The ID of the item (Not name!)",
            type: "STRING",
            required: true,
            autocomplete: true
          }
        ]
      }
    ]
  },
  async function (interaction, Bot, db) {
    if (!interaction.isCommand()) return;

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
      case "abilities":
        list = AbilitiesManager.map;
        title = "Abilities";
        break;
      case "effects":
        list = EffectManager.map;
        title = "Effects";
        break;
      case "perks":
        list = PerkManager.map;
        title = "Perks";
        break;
      case "skills":
        list = SkillManager.map;
        title = "Skills";
        break;
      case "recipes":
        list = RecipeManager.map;
        title = "Crafting Recipes";
    }

    const _defer = interaction.deferReply({ ephemeral: true });
    
    const embed = new MessageEmbed()
    .setColor("AQUA")

    switch (interaction.options.getSubcommand()) {
      case "list": {
        const array = Array.from(list.values());
        let page = Number(interaction.options.getInteger("page"));
        if (isNaN(page) || page < 1) {
          page = 1;
        }
        
        embed
        .setTitle(title)
        .setFooter(`Page ${page}/${Math.floor(array.length / ITEMS_PER_PAGE) + 1}`)
        .setDescription("");

        for (const item of array) {
          if (item instanceof CraftingRecipe) {
            const result = ItemManager.map.get(item.$.result);
            embed.description += `\`${item.$.id}\` **${result?.$.info.name}** (\`${result?.$.id}\`)\n`;
          } else {
            // @ts-expect-error
            embed.description += `\`${item.$.id}\` **${item.$.info.name}**${item.$.type ? ` (${capitalize(item.$.type)})` : "" }\n`
          }
        }
      } break;
      case "item": {
        const item = list.get(interaction.options.getString("id", true));
        if (!item) {
          interaction.reply({
            ephemeral: true,
            content: "No such entry"
          })
          return;
        }

        if (item instanceof CraftingRecipe) {
          const thing = ItemManager.map.get(item.$.result);
          if (thing) {
            embed
            .setTitle("A recipe for " + thing.$.info.name)
            .setDescription(`*For more info on the item check the result item:* \`${thing.$.id}\``)
          } else {
            embed
            .setTitle("Invalid Recipe")
          }
        } else {
          embed
          .setTitle(item.$.info.name)
          .setDescription(item.$.info.lore);
            // @ts-expect-error
            if ((item.$.unique ?? []).length > 0) {
              embed.addField(
                "Unique Flags",
                function() {
                  var str = "";
                  // @ts-expect-error
                  for (const u of item.$.unique) {
                    str += `${capitalize(u.replaceAll(/_/g, " "))}, `;
                  }

                  return str.substr(0, str.length - 2);
                }()
              )
            }
          }

          if (item instanceof Item) {
            switch (item.$.type) {
              case "wearable": {
                embed.addField(
                  "Type",
                  `**Wearable, ${capitalize(item.$.subtype.replaceAll(/_/g, " "))}**`
                )
              } break;
              case "weapon": {
                embed
                .addField(
                  "Type",
                  "Weapon"
                ).addFields([
                  {
                    name: "Crit",
                    value: attackDescriptor(item.$.attack.crit),
                    inline: true
                  },
                  {
                    name: "Normal",
                    value: attackDescriptor(item.$.attack.normal),
                    inline: true
                  },
                  {
                    name: "Weak",
                    value: attackDescriptor(item.$.attack.weak),
                    inline: true
                  }
                ])
              } break;
            }
            embed.addFields([
              { 
                name: "Passives",
                // @ts-expect-error
                value: passivesDescriptor(item.$.passives ?? []) || "None"
              },
              { 
                name: "Abilities",
                // @ts-expect-error
                value: abilitiesDescriptor(item.$.abilities ?? []) || "None"
              },
              {
                name: "Perks",
                // @ts-expect-error
                value: perksDescriptor((item.$.perks ?? []) || "None")
              }
            ]);
          } else if (item instanceof CreatureSpecies) {
            embed.description += "\n" + (item.$.playable ? "**✅ Playable**" : "**❎ Unplayable**");
            embed.addFields([
              { 
                name: "Passives",
                value: passivesDescriptor(item.$.passives ?? []) || "None"
              },
              { 
                name: "Abilities",
                value: abilitiesDescriptor(item.$.abilities ?? []) || "None"
              },
              {
                name: "Perks",
                value: perksDescriptor(item.$.perks ?? []) || "None"
              }
            ]);
          } else if (item instanceof CreatureClass) {
            embed.addFields([
              { 
                name: "Passives",
                value: passivesDescriptor(item.$.passives ?? []) || "None"
              },
              { 
                name: "Abilities",
                value: abilitiesDescriptor(item.$.abilities ?? []) || "None"
              },
              {
                name: "Perks",
                value: perksDescriptor((item.$.perks ?? []) || "None")
              }
            ]);

            if (item.$.compatibleSpecies && item.$.compatibleSpecies.length > 0) {
              const species: string[] = [];
              for (const r of item.$.compatibleSpecies) {
                const race = SpeciesManager.map.get(r);
                if (!race) continue;

                species.push(race.$.info.name);
              }

              embed.addField(
                "Compatible Species",
                species.join(", ")
              )
            }
          } else if (item instanceof PassiveEffect) {
            embed.addField(
              "Modifiers",
              modifierDescriptor(item.$.modifiers ?? []) || "None"
            )
          } else if (item instanceof CreatureAbility) {
            embed.description =
              replaceLore(embed.description ?? "", item.$.info.lore_replacers) +
              `\n\nHaste **${item.$.haste ?? 1}**\n`
          } else if (item instanceof ActiveEffect) {
            embed.description += `\nMax At Once **${item.$.consecutive_limit}**\n`;
          } else if (item instanceof CreatureSkill) {
            embed.addFields([
              { 
                name: "Passives",
                value: passivesDescriptor(item.$.passives ?? []) || "None"
              },
              { 
                name: "Abilities",
                value: abilitiesDescriptor(item.$.abilities ?? []) || "None"
              },
              {
                name: "Perks",
                value: perksDescriptor(item.$.perks ?? []) || "None"
              }
            ]);

            if (item.$.compatibleSpecies && item.$.compatibleSpecies.length > 0) {
              const species: string[] = [];
              for (const r of item.$.compatibleSpecies) {
                const race = SpeciesManager.map.get(r);
                if (!race) continue;

                species.push(race.$.info.name);
              }

              embed.addField(
                "Compatible Species",
                species.join(", ")
              )
            }
          } else if (item instanceof CreaturePerk) {
            if (item.$.compatibleSpecies && item.$.compatibleSpecies.length > 0) {
              const species: string[] = [];
              for (const r of item.$.compatibleSpecies) {
                const race = SpeciesManager.map.get(r);
                if (!race) continue;

                species.push(race.$.info.name);
              }

              embed.addField(
                "Compatible Species",
                species.join(", ")
              )
            }
            if (item.$.compatibleClasses && item.$.compatibleClasses.length > 0) {
              const classes: string[] = [];
              for (const c of item.$.compatibleClasses) {
                const kit = ClassManager.map.get(c);
                if (!kit) continue;

                classes.push(kit.$.info.name);
              }

              embed.addField(
                "Compatible Classes",
                classes.join(", ")
              )
            }
          } else if (item instanceof CraftingRecipe) {
            if (item.$.requirements.perks && item.$.requirements.perks.length > 0)
              embed.addField(
                "Required Perks",
                function () {
                  var str = "";

                  for (const p of item.$.requirements.perks) {
                    const perk = PerkManager.map.get(p);
                    if (!perk) continue;

                    str += `\`${perk.$.id}\` **${perk.$.info.name}**\n`;
                  }

                  return str;
                }() || "Invalid"
              )

            if (item.$.requirements.materials)
              embed.addField(
                "Materials",
                function () {
                  var str = "";

                  for (const mat in item.$.requirements.materials) {
                    // @ts-expect-error
                    str += `**${item.$.requirements.materials[mat]}** ${capitalize(mat)}\n`;
                  }

                  return str;
                }()
              )
            
            if (item.$.requirements.items && item.$.requirements.items.length > 0)
              embed.addField(
                "Item Ingredients",
                function () {
                  var str = "";

                  for (const i of item.$.requirements.items) {
                    const thing = ItemManager.map.get(i);
                    if (!thing) continue;

                    str += `\`${thing.$.id}\` **${thing.$.info.name}**`;
                  }

                  return str;
                }() || "Invalid"
              )
          }
      }
    }

    await _defer;
    interaction.editReply({
      embeds: [embed]
    })
  }
)

function attackDescriptor(attacks: AttackData[]) {
  var str = "";

  for (const attackdata of attacks) {
    str += `- ${attackdata.type === DamageMedium.Melee ? "Melee" : "Ranged"}
    Sources:
    ${function () {
      var str = "";

      for (const source of attackdata.sources) {
        str += `[**${source.flat_bonus} + ${Math.round(100 * source.from_skill) / 100}x ${DamageType[source.type]}**]\n`
      }

      return str;
    }()}
    **${attackdata.modifiers.accuracy}** Accuracy
    **${attackdata.modifiers.lethality}** Lethality
    **${attackdata.modifiers.defiltering}** Defiltering\n\n`;
  }

  return str;
}

export function modifierDescriptor(modifiers: PassiveModifier[]) {
  var str = "";
  if (modifiers.length > 0) {
    for (const mod of modifiers) {
      str += `**`;
      switch (mod.type) {
        case ModifierType.MULTIPLY: str += `${mod.value}x`; break;
        case ModifierType.ADD_PERCENT: str += `${mod.value >= 0 ? "+" : "-"}${Math.round(Math.abs(mod.value) * 1000) / 10}%`; break;
        case ModifierType.CAP_MAX: str += `${mod.value}^`; break;
        case ModifierType.ADD: str += `${mod.value >= 0 ? "+" : "-"}${Math.abs(mod.value)}`; break;
      }
      str += `** ${capitalize(mod.stat.replaceAll(/_/g, " "))}\n`;
    }
    str += "\n"
  }
  return str;
}

export function abilitiesDescriptor(abilities: string[]) {
  var str = "";
  if (abilities.length > 0) {
    for (const ab of abilities) {
      const ability = AbilitiesManager.map.get(ab);
      if (!ability) continue;

      str += `${ability.$.info.name} \`${ability.$.id}\``;
    }
    str += "\n"
  }
  return str;
}


export function passivesDescriptor(passives: (string | PassiveEffect)[]) {
  var str = "";
  if (passives.length > 0) {
    for (const passive of passives) {
      if (typeof passive === "string") {
        str += `[**G**] ${PassivesManager.map.get(passive)?.$.info.name} \`${passive}\`\n`;
      } else {
        str += `[**L**] ${passive.$.info.name}\n*${passive.$.info.lore}*\n${(passive.$.unique ?? []).length > 0 ? `Unique flags: ${passive.$.unique?.join(", ")}\n` : ""}\n${(passive.$.modifiers ?? []).length > 0 ? `**Modifiers**\n${modifierDescriptor(passive.$.modifiers ?? [])}` : ""}`;
      }
    }
    str += "\n"
  }
  return str;
}
export function perksDescriptor(perks: (string | CreaturePerk)[]) {
  var str = "";
  if (perks.length > 0) {
    for (const perk of perks) {
      if (typeof perk === "string") {
        str += `[**G**] ${PassivesManager.map.get(perk)?.$.info.name} \`${perk}\`\n`;
      } else {
        str += `[**L**] ${perk.$.info.name}\n*${perk.$.info.lore}*\n`;
      }
    }
    str += "\n"
  }
  return str;
}

export type ManagedItems = Item | CreatureClass | CreatureSpecies | PassiveEffect | CreatureAbility | ActiveEffect | CreatureSkill | CreaturePerk | CraftingRecipe;