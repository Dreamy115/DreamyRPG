import { ApplicationCommandOptionData, MessageActionRow, MessageButton, MessageEmbed } from "discord.js";
import { AbilitiesManager, capitalize, ClassManager, CONFIG, EffectManager, ItemManager, LocationManager, LootTables, PassivesManager, PerkManager, SchematicsManager, SkillManager, SpeciesManager } from "../..";
import { ActiveEffect, DisplaySeverity, romanNumeral } from "../../game/ActiveEffects";
import { CreatureClass } from "../../game/Classes";
import { Schematic } from "../../game/Crafting";
import { CreatureAbility, replaceLore } from "../../game/CreatureAbilities";
import { DamageMethod, DamageType } from "../../game/Damage";
import { AttackData, Item, ItemQualityColor, ItemQualityEmoji } from "../../game/Items";
import { cToF, GameLocation } from "../../game/Locations";
import { LootTable } from "../../game/LootTables";
import { PassiveEffect, PassiveModifier } from "../../game/PassiveEffects";
import { CreaturePerk } from "../../game/Perks";
import { CreatureSkill } from "../../game/Skills";
import { CreatureSpecies } from "../../game/Species";
import { ModifierType } from "../../game/Stats";
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
      name: "Schematics",
      value: "schematics"
    },
    {
      name: "Locations",
      value: "locations"
    },
    {
      name: "Loot Tables",
      value: "loottables"
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
        name: "rulesets",
        description: "The inner workings of the game explained",
        type: "SUB_COMMAND"
      },
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

    if (interaction.options.getSubcommand() === "rulesets") {
      interaction.reply({
        content: "Links here",
        ephemeral: true,
        components: [
          new MessageActionRow().setComponents([
            new MessageButton()
              .setURL(CONFIG.documentation?.link ?? "")
              .setStyle("LINK")
              .setLabel("Documentation")
          ])
        ]
      })
      return;
    }

    let list: Map<string, ManagedItems>;
    let title: string;

    let confidential = false;
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
      case "schematics":
        list = SchematicsManager.map;
        title = "Schematics";
        break;
      case "locations":
        list = LocationManager.map;
        title = "Locations (Confidential)";
        confidential = true;
        break;
      case "loottables":
        list = LootTables.map;
        title = "Loot Tables (Confidential)";
        confidential = true;
        break;
    }
    
    const _defer = await interaction.deferReply({ ephemeral: true });

    if (confidential) {
      const member = await (await Bot.guilds.fetch(CONFIG.guild?.id ?? ""))?.members.fetch(interaction.user).catch(() => undefined)
      if (!member?.roles.cache.has(CONFIG.guild?.gm_role ?? "")) {
        interaction.editReply({
          content: 
            "You cannot access details about Locations.\n" +
            "If you want to know about the Location your character is in, check out `/char info page:location`"
        })
        return;
      }
    }
    
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
          // @ts-expect-error
          embed.description += `\`${item.$.id}\` ${item.$.info.quality !== undefined ? `${ItemQualityEmoji[item.$.info.quality]} `: ""}**${item.$.info.name}**${item.$.type ? ` (${capitalize(item.$.type)})` : "" }\n`
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

        if (item instanceof Schematic) {
          const table = LootTables.map.get(item.$.table);

          if (table) {
            embed
            .setTitle("Recipe")
            .addField(
              "Results",
              function () {
                var str = "";
                for (const p in table.probabilities) {
                  const pool = table.probabilities[p];
                  str += `- Rolls **${table.$.pools[p].min_rolls}**${table.$.pools[p].max_rolls > table.$.pools[p].min_rolls ? `-**${table.$.pools[p].max_rolls}**x` : ""}\n`

                  for (const i of pool) {
                    const item = ItemManager.map.get(i.id);
                    if (!item) continue;

                    str += `**${Math.round(1000 * i.chance) / 10}%** x **${item.displayName}** \`${item.$.id}\`\n`
                  }

                  str += "\n"
                }
                return str;
              }()
            )
          } else {
            embed
            .setTitle("Invalid Recipe")
          }
        } else if (item instanceof LootTable) {
          for (const p in item.$.pools) {
            const pool = item.$.pools[p];
            embed.addField(
              `Pool ${p}`,
              function () {
                var str = `Rolls **${pool.min_rolls}-${pool.max_rolls}**\n`;

                for (const e in pool.entries) {
                  const entry = pool.entries[e];
                  str += `Entry [**${e}**] - **${entry.weight}** Weight\n\`${entry.items.join("`, `")}\`\n\n`;
                }

                return str;
              }()
            )
          }
        } else {
          embed
          // @ts-expect-error
          .setTitle(`${item.$.info.quality ? `${ItemQualityEmoji[item.$.info.quality]} ` : ""}${item.$.info.name}`)
          .setDescription(item.$.info.lore);

          // @ts-expect-error
          if (item.$.info.quality !== undefined) {
            // @ts-expect-error
            embed.setColor(ItemQualityColor[item.$.info.quality]);
          }

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

                  return str.substring(0, str.length - 2);
                }() || "None"
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
                  `${DamageMethod[item.$.attack.type]} Weapon`
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
              case "consumable": {
                embed.addField(
                  "Type",
                  "Consumable"
                )
                
                embed.setDescription(replaceLore(embed.description ?? "", item.$.info.replacers));

                if (item.$.returnItems) {
                  embed.addField(
                    "Return After Use",
                    function (){
                      const array: string[] = [];

                      for (const i of item.$.returnItems) {
                        const ret = ItemManager.map.get(i);
                        
                        array.push(`**${ret?.$.info.name}** \`${i}\``)
                      }

                      return array.join(", ");
                    }()
                  )
                }
              }
            }
            if (item.$.type !== "consumable")
              embed.addFields([
                { 
                  name: "Passives",
                  value: passivesDescriptor(Array.from(item.$.passives?.values() ?? [])) || "None"
                },
                { 
                  name: "Abilities",
                  value: abilitiesDescriptor(Array.from(item.$.abilities?.values() ?? [])) || "None"
                },
                {
                  name: "Perks",
                  value: perksDescriptor(Array.from(item.$.perks?.values() ?? [])) || "None"
                }
              ]);
          } else if (item instanceof CreatureSpecies) {
            embed.description += "\n" + (item.$.playable ? "**✅ Playable**" : "**❎ Unplayable**");
            console.log(item.$.passives)
            embed.addFields([
              { 
                name: "Passives",
                value: passivesDescriptor(Array.from(item.$.passives?.values() ?? [])) || "None"
              },
              { 
                name: "Abilities",
                value: abilitiesDescriptor(Array.from(item.$.abilities?.values() ?? [])) || "None"
              },
              {
                name: "Perks",
                value: perksDescriptor(Array.from(item.$.perks?.values() ?? [])) || "None"
              }
            ]);
          } else if (item instanceof CreatureClass) {
            embed.addFields([
              { 
                name: "Passives",
                value: passivesDescriptor(Array.from(item.$.passives ?? [])) || "None"
              },
              { 
                name: "Abilities",
                value: abilitiesDescriptor(Array.from(item.$.abilities ?? [])) || "None"
              },
              {
                name: "Perks",
                value: perksDescriptor(Array.from(item.$.perks ?? []) || "None")
              }
            ]);

            if (item.$.compatibleSpecies && item.$.compatibleSpecies.size > 0) {
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
              `\n\nHaste **${item.$.haste ?? 1}**\n${item.$.attackLike ? `**Attack-Like** *(Affected by Positioning)*\n` : ""}`
          } else if (item instanceof ActiveEffect) {
            embed.setDescription(function () {
              var str = item.$.info.lore;

              for (const r in item.$.info.replacers) {
                const rep = item.$.info.replacers[r];
                str = str.replaceAll(`{${r}}`, `**${rep.multiply}** x **${capitalize(rep.type)}**`);
              }

              return str;
            }());
            embed.description += `\nMax At Once **${item.$.consecutive_limit}**\n`;
          } else if (item instanceof CreatureSkill) {
            embed.addFields([
              { 
                name: "Passives",
                value: passivesDescriptor(Array.from(item.$.passives?.values() ?? [])) || "None"
              },
              { 
                name: "Abilities",
                value: abilitiesDescriptor(Array.from(item.$.abilities?.values() ?? [])) || "None"
              },
              {
                name: "Perks",
                value: perksDescriptor(Array.from(item.$.perks?.values() ?? [])) || "None"
              }
            ]);

            if (item.$.compatibleSpecies && item.$.compatibleSpecies.size > 0) {
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
            if (item.$.compatibleSpecies && item.$.compatibleSpecies.size > 0) {
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
            if (item.$.compatibleClasses && item.$.compatibleClasses.size > 0) {
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
          } else if (item instanceof Schematic) {
            if (item.$.requirements.perks && item.$.requirements.perks.size > 0)
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
          } else if (item instanceof GameLocation) {
            embed.addField(
              "Flags",
              `**${item.$.temperature}**°C (**${cToF(item.$.temperature)}**°F) Temperature\n` +
              `${item.$.shop !== undefined ? "⬜" : "🔳"} - \`/char shop\` ${item.$.shop !== undefined ? "available" : "unavailable"}\n` + 
              `${item.$.hasEnhancedCrafting ? "⬜" : "🔳"} - ${item.$.hasEnhancedCrafting ? "Enhanced Crafting" : "Limited Crafting"}\n`
            )
    
            if (item.$.area_effects) {
              embed.addField(
                "Area Effects",
                function () {
                  var str = "";
    
                  for (const active_effect of item.$.area_effects) {
                    const effect_data = EffectManager.map.get(active_effect.id);
                    if (!effect_data) continue;
    
                    str += `\`${effect_data.$.id}\` **${effect_data.$.info.name}${function(){
                      switch (effect_data.$.display_severity) {
                        case DisplaySeverity.NONE:
                        default: return "";
                        case DisplaySeverity.ARABIC: return " " + active_effect.severity;
                        case DisplaySeverity.ROMAN: return " " + romanNumeral(active_effect.severity);
                      }
                    }()}**\n`;
                  }
    
                  return str;
                }() || "None"
              )
            }
          }
          // @ts-expect-error
          if (item.$.info?.description)
            embed.addField(
              "Detailed Description",
              // @ts-expect-error
              item.$.info?.description
            )
      }
    }

    interaction.editReply({
      embeds: [embed]
    })
  }
)

function attackDescriptor(attacks: AttackData[]) {
  var str = "";

  for (const attackdata of attacks) {
    str += `Sources:
    ${function () {
      var str = "";

      for (const source of attackdata.sources) {
        str += `[**${source.flat_bonus} + ${Math.round(100 * source.from_skill) / 100}x ${DamageType[source.type]}**]\n`
      }

      return str;
    }()}
    **${attackdata.modifiers?.accuracy ?? 0}** Accuracy
    **${attackdata.modifiers?.lethality ?? 0}** Lethality
    **${attackdata.modifiers?.defiltering ?? 0}** Defiltering
    **${attackdata.modifiers?.cutting ?? 0}** Cutting\n\n`;
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
        str += `[**L**] ${passive.$.info.name}\n*${passive.$.info.lore}*\n${(passive.$.unique ?? new Set()).size > 0 ? `Unique flags: ${Array.from(passive.$.unique ?? []).join(", ")}\n` : ""}\n${(passive.$.modifiers ?? []).length > 0 ? `**Modifiers**\n${modifierDescriptor(passive.$.modifiers ?? [])}` : ""}`;
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

export type ManagedItems = Item | CreatureClass | CreatureSpecies | PassiveEffect | CreatureAbility | ActiveEffect | CreatureSkill | CreaturePerk | Schematic | GameLocation | LootTable;