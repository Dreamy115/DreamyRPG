import { ApplicationCommandOptionData, ColorResolvable, MessageActionRow, MessageButton, MessageEmbed } from "discord.js";
import { AbilitiesManager, capitalize, CONFIG, Directives, EffectManager, ItemManager, LocationManager, LootTables, PassivesManager, PerkManager, SchematicsManager, SkillManager, SpeciesManager } from "../..";
import { ActiveEffect, DisplaySeverity, romanNumeral } from "../../game/ActiveEffects";
import { Material, Schematic } from "../../game/Crafting";
import Creature from "../../game/Creature";
import { CreatureAbility } from "../../game/CreatureAbilities";
import { replaceLore } from "../../game/LoreReplacer";
import { DamageMethod, DamageType, ShieldReaction, shieldReactionInfo } from "../../game/Damage";
import { GameDirective } from "../../game/GameDirectives";
import { AttackData, Item, ItemQualityColor, ItemQualityEmoji } from "../../game/Items";
import { cToF, GameLocation } from "../../game/Locations";
import { LootTable } from "../../game/LootTables";
import { PassiveEffect, NamedModifier } from "../../game/PassiveEffects";
import { CreaturePerk } from "../../game/Perks";
import { CreatureSkill } from "../../game/Skills";
import { CreatureSpecies } from "../../game/Species";
import { Modifier, ModifierType } from "../../game/Stats";
import { ApplicationCommandHandler } from "../commands";
import { tableDescriptor } from "./char";

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
    },
    {
      name: "Directives",
      value: "directives"
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
        title = "Items (Confidential)";
        confidential = true;
        break;
      case "species":
        list = SpeciesManager.map;
        title = "Species";
        break;
      case "passives":
        list = PassivesManager.map;
        title = "Global Passives";
        break;
      case "abilities":
        list = AbilitiesManager.map;
        title = "Abilities (Confidential)";
        confidential = true;
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
        title = "Schematics (Confidential)";
        confidential = true;
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
      case "directives":
        list = Directives.map;
        title = "All Directives",
        confidential = true;
        break;
    }
    
    await interaction.deferReply({ ephemeral: true });

    const member = await (await Bot.guilds.fetch(CONFIG.guild?.id ?? ""))?.members.fetch(interaction.user).catch(() => undefined);
    const IS_GM = !(!member?.roles.cache.has(CONFIG.guild?.gm_role ?? ""));

    if (confidential && !IS_GM) {
      interaction.editReply({
        content: 
          "You cannot access details about this.\n" +
          "If you want to know about the items in this type that your character has, check out `/char info`"
      })
      return;
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

        for (const _item of array) {
          const item = _item as Item;

          // @ts-ignore
          if (!_item.$.hidden || IS_GM)
            // @ts-ignore
            embed.description += `${_item.$.hidden ? "🔒 " : ""}\`${item.$.id}\` ${item.$?.info.quality !== undefined ? `${ItemQualityEmoji[item.$?.info.quality]} `: ""}**${item.$?.info.name}**${item.$?.type ? ` (${capitalize(item.$?.type)})` : "" }\n`
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

        // @ts-ignore
        if (item.$.hidden && !IS_GM) {
          interaction.editReply({
            content:
              "This item is hidden from Players. You cannot access full info."
          });
          return;
        }
        
        if (item instanceof Schematic) {
          const table = LootTables.map.get(item.$.table);

          if (table) {
            embed
            .setTitle("Recipe")
            .setDescription("From most priority to least")

            for (const [k, pools] of table.$.pools) {
              embed.addField(
                `${k || "Default"}`,
                function () {
                  var str = "";
                  for (const p in LootTable.getProbabilities(pools)) {
                    const pool = LootTable.getProbabilities(pools)[p];
                    str += `- Rolls **${pools[p].min_rolls}**${pools[p].max_rolls > pools[p].min_rolls ? `-**${pools[p].max_rolls}**x` : ""}\n`

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
            }
          } else {
            embed
            .setTitle("Invalid Recipe")
          }
        } else if (item instanceof LootTable) {
          embed.setTitle(`Loot Table ${item.$.id}`)
          if (item.$.note) {
            embed.setDescription(item.$.note);
          }
          for (const [k, pools] of item.$.pools) {
            embed.addField(
              `${k || "Default"}`,
              function () {
                var s = ``;
                for (const p in pools) {
                  const pool = pools[p];

                  s += `- Pool ${p}\n`
                  s += function () {
                    var str = `Rolls **${pool.min_rolls}-${pool.max_rolls}**\n`;
    
                    for (const e in pool.entries) {
                      const entry = pool.entries[e];
                      str += `Entry [**${e}**] - **${entry.weight}** Weight\n\`${entry.items.join("`, `")}\`\n`;
                    }
    
                    return str += "\n";
                  }()
                }
                return s;
              }()
            )
          }
        } else {
          let itm = item as Item;
          embed
          .setTitle(`${itm.$.info.quality ? `${ItemQualityEmoji[itm.$.info.quality]} ` : ""}${itm.$.info.name}`)
          .setDescription(itm.$.info.lore);

          if (itm.$.info.quality !== undefined) {
            embed.setColor(ItemQualityColor[itm.$.info.quality] as ColorResolvable);
          }

          if (item instanceof GameDirective) {
            embed.addFields([
              { 
                name: "Passives",
                value: passivesDescriptor(Array.from(item.$.passives?.values() ?? []), IS_GM) || "None"
              },
            ]);
  
            if (item.$.effects) {
              embed.addField(
                "Global Effects",
                function () {
                  var str = "";
    
                  for (const active_effect of item.$.effects) {
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
          } else if (item instanceof Item) {
            switch (item.$.type) {
              case "wearable": {
                embed.addField(
                  "Type",
                  `**Wearable, ${capitalize(item.$.slot.replaceAll(/_/g, " "))}**`
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

                const table = LootTables.map.get(item.$.returnTable ?? "");

                if (table) {
                  embed.addField(
                    "Return After Use",
                    tableDescriptor(table)
                  )
                }
              }
            }
            if (item.$.type !== "consumable" && item.$.type !== "generic")
              embed.addFields([
                { 
                  name: "Passives",
                  value: passivesDescriptor(Array.from(item.$.passives?.values() ?? []), IS_GM) || "None"
                },
                { 
                  name: "Abilities",
                  value: abilitiesDescriptor(Array.from(item.$.abilities?.values() ?? [])) || "None"
                },
                {
                  name: "Perks",
                  value: perksDescriptor(Array.from(item.$.perks?.values() ?? []), IS_GM) || "None"
                }
              ]);
          } else if (item instanceof CreatureSpecies) {
            embed.description += "\n" + (item.$.playable ? "**✅ Playable**" : "**❎ Unplayable**");
            embed.addFields([
              { 
                name: "Passives",
                value: passivesDescriptor(Array.from(item.$.passives?.values() ?? []), IS_GM) || "None"
              },
              { 
                name: "Abilities",
                value: abilitiesDescriptor(Array.from(item.$.abilities?.values() ?? [])) || "None"
              },
              {
                name: "Perks",
                value: perksDescriptor(Array.from(item.$.perks?.values() ?? []), IS_GM) || "None"
              }
            ]);
          } else if (item instanceof PassiveEffect) {
            embed.addField(
              "Modifiers",
              modifiersDescriptor(item.$.modifiers ?? []) || "None"
            )
          } else if (item instanceof CreatureAbility) {
            embed.description =
              replaceLore(embed.description || "", item.$.info.lore_replacers) +
              `\n\n` +
              `Cost **${item.$.cost}**\n` +
              `Haste **${item.$.haste ?? 1}**\n` +
              `${item.$.attackLike ? `**Attack-Like** *(Affected by Positioning)*\n` : ""}`
          } else if (item instanceof ActiveEffect) {
            embed.setDescription(function () {
              var str = item.$.info.lore;

              for (const r in item.$.info.replacers) {
                const rep = item.$.info.replacers[r];
                str = str.replaceAll(`{${r}}`, `**${rep.multiplier}** x **${capitalize(rep.stat)}**`);
              }

              return str;
            }());
            embed.description += `\nMax At Once **${item.$.consecutive_limit}**\n`;
          } else if (item instanceof CreatureSkill) {
            embed.addFields([
              { 
                name: "Passives",
                value: passivesDescriptor(Array.from(item.$.passives?.values() ?? []), IS_GM) || "None"
              },
              { 
                name: "Abilities",
                value: abilitiesDescriptor(Array.from(item.$.abilities?.values() ?? [])) || "None"
              },
              {
                name: "Perks",
                value: perksDescriptor(Array.from(item.$.perks?.values() ?? []), IS_GM) || "None"
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
                    const material: number = item.$.requirements.materials[mat as Material];

                    if (material !== 0)
                      str += `**${material}** ${capitalize(mat)}\n`;
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

          if ((item.$.info as CreatureSpecies["$"]["info"] | undefined)?.description)
            embed.addField(
              "Detailed Description",
              (item as CreatureSpecies).$.info.description
            )
        }
      }
    }
    interaction.editReply({
      embeds: [embed]
    })
  }
)

export function attackDescriptor(attacks: AttackData[]) {
  var str = "";

  for (const attackdata of attacks) {
    str += `${function () {
      var str = "";

      for (const source of attackdata.sources) {
        var reaction = shieldReactionInfo(source.shieldReaction ?? ShieldReaction.Normal);
        str += `[**${source.flat_bonus} + ${(source.from_skill).toFixed(2)}x ${DamageType[source.type]}**${reaction ? ` **${reaction}**` : ""}]\n`
      }

      return str;
    }()}**${attackdata.modifiers?.accuracy ?? 0}** Accuracy | **${attackdata.modifiers?.lethality ?? 0}** Lethality | **${attackdata.modifiers?.passthrough ?? 0}** Passthrough | **${attackdata.modifiers?.cutting ?? 0}** Cutting\n`;
  }

  return str;
}

export function namedModifierDescriptor(modifier: NamedModifier) {
  return `${modifierDescirptor(modifier)} ${capitalize(modifier.stat.replaceAll(/_/g, " "))}`
}
export function modifierDescirptor(modifier: Modifier) {
  return `**${function() {
    switch (modifier.type) {
      case ModifierType.MULTIPLY: return `${modifier.value.toFixed(2)}x`;
      case ModifierType.ADD_PERCENT: return `${modifier.value >= 0 ? "+" : "-"}${(Math.abs(modifier.value) * 100).toFixed(1)}%`;
      case ModifierType.CAP_MAX: return `${modifier.value.toFixed(0)}^`;
      case ModifierType.ADD: return `${modifier.value >= 0 ? "+" : "-"}${Math.abs(modifier.value).toFixed(1)}`;
    }
  }()}**`
}

export function modifiersDescriptor(modifiers: NamedModifier[], spacer = "\n") {
  var str: string[] = [];
  if (modifiers.length > 0) {
    for (const mod of modifiers) {
      str.push(namedModifierDescriptor(mod));
    }
  }
  return str.join(spacer);
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


export function passivesDescriptor(passives: (string | PassiveEffect)[], show_hidden: boolean, creature?: Creature) {
  var str = "";
  if (passives.length > 0) {
    for (const p of passives) {
      const passive = typeof p === "string" ? PassivesManager.map.get(p) : p;
      if (!passive || (passive.$.hidden && !show_hidden)) continue;

      str += `${typeof p === "string" ? `<\`${passive.$.id}\`>` : "[`local`]"}${passive.$.hidden ? " 🔒" : ""} **${passive.$.info.name}**\n*${replaceLore(passive.$.info.lore, passive.$.info.replacers ?? [], creature)}*\n${(passive.$.unique ?? new Set()).size > 0 ? `Unique flags: ${Array.from(passive.$.unique ?? []).join(", ")}\n` : ""}\n${(passive.$.modifiers ?? []).length > 0 ? `**Modifiers**\n${modifiersDescriptor(passive.$.modifiers ?? [])}` : ""}\n\n`;
    }
    str += "\n";
  }
  return str;
}
export function perksDescriptor(perks: (string | CreaturePerk)[], show_hidden: boolean) {
  var str = "";
  if (perks.length > 0) {
    for (const p of perks) {
      const perk = typeof p === "string" ? PerkManager.map.get(p) : p;
      if (!perk || (perk.$.hidden && !show_hidden)) continue;

      str += `${typeof p === "string" ? `<\`${perk.$.id}\`>` : "[`local`]"}${perk.$.hidden ? " 🔒" : ""} **${perk.$.info.name}**\n*${perk.$.info.lore}*`;
    }
    str += "\n"
  }
  return str;
}

export type ManagedItems = 
  Item | CreatureSpecies | PassiveEffect | CreatureAbility | GameDirective |
  ActiveEffect | CreatureSkill | CreaturePerk | Schematic | GameLocation | LootTable;