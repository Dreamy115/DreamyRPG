import { Client, EmbedFieldData, MessageActionRow, MessageAttachment, MessageButton, MessageEmbed, MessageSelectMenu } from "discord.js";
import { DisplaySeverity, replaceEffectLore, romanNumeral } from "../../game/ActiveEffects.js";
import { Schematic } from "../../game/Crafting.js";
import Creature from "../../game/Creature.js";
import { CreatureAbility, replaceLore } from "../../game/CreatureAbilities.js";
import { reductionMultiplier, DAMAGE_TO_INJURY_RATIO, DamageMethod, DamageType } from "../../game/Damage.js";
import { CombatPosition } from "../../game/Fight.js";
import { AttackData, Item, ItemQualityEmoji } from "../../game/Items.js";
import { cToF } from "../../game/Locations.js";
import { LootTable } from "../../game/LootTables.js";
import { PassiveEffect, PassiveModifier } from "../../game/PassiveEffects.js";
import { CreaturePerk } from "../../game/Perks.js";
import { textStat, ModifierType, TrackableStat } from "../../game/Stats.js";
import { SpeciesManager, ClassManager, capitalize, ItemManager, EffectManager, AbilitiesManager, CONFIG, SchematicsManager, PerkManager, LocationManager, limitString, LootTables, PassivesManager } from "../../index.js";
import { bar_styles, make_bar } from "../Bars.js";
import { ApplicationCommandHandler } from "../commands.js";
import { attributeComponents, ceditMenu } from "../component_commands/cedit.js";
import { abilitiesDescriptor, attackDescriptor, modifierDescriptor, passivesDescriptor, perksDescriptor } from "./handbook.js";

export default new ApplicationCommandHandler(
  {
    name: "char",
    description: "Character management for players",
    type: "CHAT_INPUT",
    options: [
      {
        name: "rollfor",
        description: "Roll for a stat check",
        type: "SUB_COMMAND",
        options: [
          {
            name: "id",
            description: "Find character by ID",
            type: "STRING",
            autocomplete: true
          },
          {
            name: "bonus",
            description: "Modify the check",
            type: "INTEGER"
          }
        ]
      },
      {
        name: "create",
        description: "Create your character if you don't have one yet",
        type: "SUB_COMMAND"
      },
      {
        name: "info",
        description: "Show character make-up",
        type: "SUB_COMMAND",
        options: [
          {
            name: "page",
            description: "Which kind of information?",
            type: "STRING",
            required: true,
            choices: [
              {
                name: "Stats",
                value: "stats"
              },
              {
                name: "Equipped Items",
                value: "items"
              },
              {
                name: "Backpacked Items",
                value: "backpack"
              },
              {
                name: "Schematics",
                value: "schematics"
              },
              {
                name: "Passives",
                value: "passives"
              },
              {
                name: "Attack",
                value: "attack"
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
                name: "Attributes",
                value: "attributes"
              },
              {
                name: "All Active Modifiers",
                value: "modifiers"
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
                name: "Location",
                value: "location"
              },
              {
                name: "Raw Data (Debug)",
                value: "debug"
              }
            ]
          },
          {
            name: "user",
            description: "Find character by user",
            type: "USER"
          },
          {
            name: "id",
            description: "Find character by ID (For NPCs)",
            type: "STRING",
            autocomplete: true
          }
        ]
      },
      {
        name: "editmenu",
        description: "Editing",
        type: "SUB_COMMAND"
      },
      {
        name: "craft",
        description: "Craft an item",
        type: "SUB_COMMAND",
        options: [
          {
            name: "recipe_id",
            description: "The ID of the recipe to craft",
            autocomplete: true,
            required: true,
            type: "STRING"
          }
        ]
      },
      {
        name: "shop",
        description: "Buy menu!",
        type: "SUB_COMMAND",
        options: [
          {
            name: "page",
            description: "Which page to display?",
            type: "INTEGER"
          }
        ]
      },
      {
        name: "say",
        description: "Say as character",
        type: "SUB_COMMAND",
        options: [
          {
            name: "id",
            description: "Find character by ID",
            type: "STRING",
            autocomplete: true,
            required: true
          },
          {
            name: "message",
            description: "Say something!",
            type: "STRING",
            required: true
          }
        ]
      }
    ]
  },
  async function (interaction, Bot, db) {
    if (!interaction.isCommand()) return;

    switch (interaction.options.getSubcommand(true)) {
      case "rollfor": {
        const [creature,] = await Promise.all([
          Creature.fetch(interaction.options.getString("id", false) ?? interaction.user.id, db).catch(() => null),
          interaction.deferReply({ephemeral: true})
        ]);

        if (!creature) {
          interaction.editReply({
            content: "Invalid creature"
          })
          return;
        }

        interaction.editReply({
          content: `Select a stat (with **${interaction.options.getInteger("bonus", false) ?? 0}** bonus)`,
          components: attributeComponents(creature, "", `rollstat/$ID/$ATTR/${interaction.options.getInteger("bonus", false) ?? 0}`)
        })
      } break;
      case "shop": {
        const [creature,] = await Promise.all([
          Creature.fetch(interaction.user.id, db),
          interaction.deferReply({ephemeral: true})
        ])

        if (!creature.$.info.locked) {
          interaction.editReply({
            content: "Need to lock in before using shops."
          })
          return;
        }

        const location = creature.location;
        if (!location?.shop) {
          interaction.editReply({
            content: "No shop available here."
          })
          return;
        }

        const embed = new MessageEmbed()
          .setTitle(location.shop.$.info.name)
          .setDescription(location.shop.$.info.lore)
          .setFooter(location.shop.$.id)
          .setColor("AQUA")

        const components: MessageActionRow[] = [
          new MessageActionRow().setComponents([
            new MessageSelectMenu()
              .setCustomId(`cedit/${creature.$._id}/edit/buy`)
              .setPlaceholder("Buy something...")
          ])
        ]; 

        for (var i = 25 * Math.abs((interaction.options.getInteger("page", false) ?? 1) - 1); i < 25; i++) {
          // @ts-expect-error
          const content = location.shop.$.content[i];
          if (!content) break;

          switch (content.type) {
            default: continue;
            case "item": {
              const item = ItemManager.map.get(content.id);
              if (!item) continue;
              // @ts-expect-error
              components[0].components[0]?.addOptions({
                label: item.$.info.name,
                value: String(i),
                description: `[${i}] Item`
              })

              embed.addField(
                `[${i}] Item - ${item.displayName} \`${item.$.id}\``,
                `*${item.$.info.lore}*\n\n${function(){
                  var arr: string[] = [];
                  for (const mat in content.cost) {
                    // @ts-expect-error
                    arr.push(`**${content.cost[mat]}** ${capitalize(mat)}`)
                  }

                  return arr.join(", ");
                }()}`
              )
            } break;
            case "service": {
              // @ts-expect-error
              components[0].components[0]?.addOptions({
                label: content.info.name,
                value: String(i),
                description: `[${i}] Service`
              })

              embed.addField(
                `[${i}] Service - ${content.info.name}`,
                `*${content.info.lore}*\n\n${function(){
                  var arr: string[] = [];
                  for (const mat in content.cost) {
                    // @ts-expect-error
                    arr.push(`**${content.cost[mat]}** ${capitalize(mat)}`)
                  }

                  return arr.join(", ");
                }()}`
              )
            }
          }
        }

        components[0].components[0]
          // @ts-expect-error
          .setMaxValues(components[0].components[0].options.length)
          .setMinValues(1)

        interaction.editReply({
          components,
          embeds: [embed]
        })
      } break;
      case "craft": {
        const schem = SchematicsManager.map.get(interaction.options.getString("recipe_id", true));
        if (!schem) return;

        interaction.reply({
          ephemeral: true,
          content: "Please Confirm",
          embeds: [
            new MessageEmbed()
              .setTitle(`${ItemQualityEmoji[schem.$.info.quality]} **${schem.$.info.name}**`)
              .setFooter(schem.$.id)
              .setDescription(schematicDescriptor(schem))
          ],
          components: [
            new MessageActionRow().setComponents([
              new MessageButton()
                .setCustomId(`cedit/${interaction.user.id}/edit/item/craft/${schem.$.id}`)
                .setLabel("Confirm Craft")
                .setStyle("SUCCESS")
            ])
          ]
        })
      } break;
      case "say": {
        const channel = await interaction.guild?.channels.fetch(interaction.channelId);
        if (!channel?.isText() || channel.isThread()) {
          interaction.reply({
            ephemeral: true,
            content: "Channel does not support webhooks"
          });
          return;
        }

        const [creature, member] = await Promise.all([
          Creature.fetch(interaction.options.getString("id", true), db).catch(() => null),
          interaction.guild?.members.fetch(interaction.user).catch(() => null),
          interaction.reply({content: `Awaiting dialogue...`})
        ]);
        
        if (!member) {
          interaction.editReply({
            content: "Dialogue: Invalid guild member. (4s)"
          })
          setTimeout(() => {
            interaction.deleteReply().catch();
          }, 4000)
          return;
        }
        if (!creature) {
          interaction.editReply({
            content: "Dialogue: Invalid character. (4s)"
          })
          setTimeout(() => {
            interaction.deleteReply().catch();
          }, 4000)
          return;
        }

        if (creature.$._id !== interaction.user.id && !member.roles.cache.has(CONFIG.guild?.gm_role ?? "")) {
          interaction.editReply({
            content: "Dialogue: To use someone else's character, you must be a GM (4s)"
          })
          setTimeout(() => {
            interaction.deleteReply().catch();
          }, 4000)
          return;
        }

        const wh = await channel.createWebhook(
          creature.displayName, {
            reason: "DreamyRPG Proxy",
            avatar: creature.$.info.display.avatar
          }
        )

        wh.send({
          content: interaction.options.getString("message", true)
        }).finally(() => {
          interaction.deleteReply();
          wh.delete();
        }).catch(console.error)

      } break;
      case "create": {
        await interaction.deferReply({ ephemeral: true });
        
        const char = await Creature.fetch(interaction.user.id, db, false).catch(() => null);
        console.log(char)
        if (char) {
          interaction.editReply({ content: "Character already exists!" });
          return;
        }

        new Creature({
          _id: interaction.user.id,
          info: {
            npc: false,
            display: {
              name: interaction.user.username,
              avatar: interaction.user.displayAvatarURL({ dynamic: true, size: 64 })
            }
          }
        }).put(db)
          .then(() => interaction.editReply({ content: "Successfully created your character! Use `/char editmenu` to finish 'em up." }))
          .catch((e) => {
            console.error(e);
            interaction.editReply({ content: "Something went wrong..." });
          })
      } break;
      case "info": {
        await interaction.deferReply({});

        const char = await Creature.fetch(interaction.options.getString("id", false)?.split(" ")[0] ?? interaction.options.getUser("user")?.id ?? interaction.user.id, db, false).catch(() => null);
        if (!char) {
          interaction.editReply({
            content: "Not found!"
          });
          return;
        }

        const page = interaction.options.getString("page", true);

        if (page === "location" && char.$.info.npc) {
          const guild = await Bot.guilds.fetch(CONFIG.guild?.id ?? "");
          await guild.roles.fetch();
      
          const member = await guild.members.fetch(interaction.user.id).catch(() => null);
          if (!member || !member.roles.cache.has(CONFIG.guild?.gm_role ?? "")) {
            interaction.editReply({
              content: "Only GMs can access NPC location information"
            })
            return;
          } 
        }

        const info = await infoEmbed(char, Bot, page);

        const components: MessageActionRow[] = [];
        if (info.scrollable)
          components.push(
            new MessageActionRow().setComponents([
              new MessageButton()
                .setCustomId(`charinfoscroll/${char.$._id}/${page}/1`)
                .setStyle("SECONDARY")
                .setLabel("Scroll +")
            ])
          )

        components.push(
          new MessageActionRow().setComponents([
            new MessageButton()
              .setCustomId(`charinfoscroll/${char.$._id}/${page}/0`)
              .setStyle("SECONDARY")
              .setLabel("Refresh")
          ])
        )

        interaction.followUp({
          ephemeral: false,
          embeds: [info.embed],
          components,
          files: info.attachments
        })
      } break;
      case "editmenu": {
        await interaction.deferReply({});

        const char = await Creature.fetch(interaction.user.id, db, false).catch(() => null);
        if (!char) {
          interaction.editReply({
            content: "Not found!"
          });
          return;
        }

        interaction.editReply({
          content: `Editing menu for **${char.displayName}**`,
          components: ceditMenu(char),
        })
      } break;
    }
  }
)

const PER_INDEX_PAGE = 6;
export async function infoEmbed(creature: Creature, Bot: Client, page: string, index = 0): Promise<{embed: MessageEmbed, attachments?: MessageAttachment[], scrollable: boolean}> {
  const embed = new MessageEmbed();

  const owner = await Bot.users.fetch(creature.$._id).catch(() => null);

  let scrollable = false;
  let attachments: MessageAttachment[] = [];
  let total = 0;

  embed
    .setTitle(creature.displayName)
    .setAuthor(creature.$.info.npc ? "NPC" : (owner?.tag ?? "Unknown"))
    .setColor((creature.$.info.locked || creature.$.info.npc) ? "AQUA" : "GREY")
    .setThumbnail(creature.$.info.display.avatar ?? "")

  switch (page) {
    default:
    case "debug": {
      const stringified = JSON.stringify(creature.$, undefined, "  ");
      if (stringified.length > 4096 - 12) {
        embed.setDescription("Too big! Check attachment!");
        attachments.push(new MessageAttachment(Buffer.from(stringified, "utf-8")).setName("info.json"));
      } else {
        embed.setDescription("```json\n" + stringified + "```");
      }
    } break;
    case "stats": {
      const health_injury_proportions = (creature.$.stats.health.value - creature.$.vitals.injuries) / creature.$.stats.health.value;

      let health_length_mod, shield_length_mod;
      if (creature.$.stats.health.value >= creature.$.stats.shield.value) {
        health_length_mod = (creature.$.stats.health.value - creature.$.stats.shield.value) / creature.$.stats.health.value;
      } else {
        health_length_mod = (creature.$.stats.shield.value - creature.$.stats.health.value) / creature.$.stats.shield.value;
      }
      shield_length_mod = 1 - health_length_mod;

      embed.addField(
        "Basic",
        `Race - **${SpeciesManager.map.get(creature.$.info.species ?? "")?.$.info.name ?? "Unknown"}**\n` +  
        `Class - **${ClassManager.map.get(creature.$.info.class ?? "")?.$.info.name ?? "Unknown"}**\n` +
        `Level **${creature.$.experience.level}**`  
      ).addFields([
        {
          name: "Vitals",
          inline: false,
          value: 
          `*(**${creature.$.stats.health.value}** Health - **${creature.$.vitals.injuries}** Injuries)*\n` +
          make_bar(100 * creature.$.vitals.health / (creature.$.stats.health.value - creature.$.vitals.injuries), BAR_STYLE, Math.max(1, health_length_mod * Math.floor(BAR_LENGTH * health_injury_proportions))).str +
          (
            creature.$.vitals.injuries > 0
            ? make_bar(100, "░", Math.max(1, health_length_mod * Math.ceil(BAR_LENGTH - (BAR_LENGTH * health_injury_proportions)))).str
            : ""
          ) +
          ` **Health** **${creature.$.vitals.health}**/**${creature.$.stats.health.value - creature.$.vitals.injuries}** ` + 
          `(**${Math.round(100 * creature.$.vitals.health / creature.$.stats.health.value)}%**)\n` +
          (
            creature.$.stats.shield.value > 0
            ? make_bar(100 * creature.$.vitals.shield / creature.$.stats.shield.value, BAR_STYLE, shield_length_mod * BAR_LENGTH).str +
            ` **Shield** ${textStat(creature.$.vitals.shield, creature.$.stats.shield.value)} ` +
            `**${creature.$.stats.shield_regen.value}**/t`
            : "No **Shield**"
          ) + "\n\n" +
          make_bar(100 *creature.$.vitals.mana / creature.$.stats.mana.value, BAR_STYLE, BAR_LENGTH / 3).str +
          ` **Mana** ${textStat(creature.$.vitals.mana, creature.$.stats.mana.value)} `+
          `**${creature.$.stats.mana_regen.value}**/t\n`
        },
        {
          name: "Offense",
          value: 
            `**${creature.$.stats.accuracy.value}%** Accuracy *(Hit Chance)*\n` +
            `Melee **${creature.$.stats.melee.value}** | **${creature.$.stats.ranged.value}** Ranged *(Attack Power)*\n` +
            `**${creature.$.stats.tech.value}** Tech *(Ability Power)*\n` +
            "\n" +
            `**${creature.$.stats.lethality.value}** Lethality | **${creature.$.stats.defiltering.value}** Defiltering | **${creature.$.stats.cutting.value}** Cutting\n` +
            `*(Reduces effectivenes of enemy **Armor**, **Filter**, and **Tenacity** respectively)*` +
            "\n" +
            `Vamp **${creature.$.stats.vamp.value}%** | **${creature.$.stats.siphon.value}%** Siphon *(Regenerates **health** | **shields** by **%** of damage dealt when dealing **Physical** | **Energy** Damage)*\n` +
            "\n" +
            `**${creature.$.stats.initiative.value}** Initiative` 
        },
        {
          name: "Defense",
          value:
          `**${creature.$.stats.armor.value}** Armor *(**${Math.round(100 * (1 - reductionMultiplier(creature.$.stats.armor.value)))}%** Reduced Physical Damage)*\n` +
          `**${creature.$.stats.filter.value}** Filter *(**${Math.round(100 * (1 - reductionMultiplier(creature.$.stats.filter.value)))}%** Reduced Energy Damage)*\n` +
          `Parry **${creature.$.stats.parry.value}%** | **${creature.$.stats.deflect.value}%** Deflect *(Reduces hit chance from **Melee** | **Ranged**)*\n` +
          "\n" +
          `**${creature.$.stats.tenacity.value}** Tenacity *(Taking **${Math.round(100 * reductionMultiplier(creature.$.stats.tenacity.value) * DAMAGE_TO_INJURY_RATIO)}%** health damage as **Injuries**)*` +
          "\n" +
          `**${creature.$.stats.min_comfortable_temperature.value}**°C (**${cToF(creature.$.stats.min_comfortable_temperature.value)}**°F) Min Comfortable Temperature *(**${creature.deltaHeat}**°C Delta)*`
        }
      ])
    } break;
    case "passives": {
      scrollable = true;

      const passives = creature.passives;
      total = passives.length;

      for (var i = index * PER_INDEX_PAGE; i < passives.length && i < PER_INDEX_PAGE * (index + 1); i++) {
        const passive = passives[i];

        embed.addField(
          `<${i+1}> ${passive.$.info.name}`,
          function() {
            var str = `*${passive.$.info.lore}*`;
            if ((passive.$.modifiers ?? []).length > 0) {
              str += `\n- **Modifiers**\n`;
              for (const mod of passive.$.modifiers ?? []) {
                str += `**`;
                switch (mod.type) {
                  case ModifierType.MULTIPLY: str += `${mod.value}x`; break;
                  case ModifierType.ADD_PERCENT: str += `${mod.value >= 0 ? "+" : "-"}${Math.round(Math.abs(mod.value) * 1000) / 10}%`; break;
                  case ModifierType.CAP_MAX: str += `${mod.value}^`; break;
                  case ModifierType.ADD: str += `${mod.value >= 0 ? "+" : "-"}${Math.abs(mod.value)}`; break;
                }
                str += `** ${capitalize(mod.stat.replaceAll(/_/g, " "))}\n`;
              }
            }
            return str;
          }()
        )  
      }    
    } break;
    case "items": {
      scrollable = true;

      embed.setDescription(
        function(creature: Creature) {
          let utilAmount = 0;
          let clothingAmount = 0;
          let weaponAmount = 0;

          for (const item of creature.items) {
            switch (item.$.type) {
              case "wearable":
                switch (item.$.subtype) {
                  case "clothing":
                    clothingAmount++;
                    break;
                  case "utility":
                    utilAmount++;
                    break;
                }
                break;
              case "weapon":
                weaponAmount++;
                break;
            }
          }

          return `Clothing **${clothingAmount}**/**${Creature.MAX_EQUIPPED_CLOTHING}**
          Weapons **${weaponAmount}**/**${Creature.MAX_EQUIPPED_WEAPONS + 1}**
          Utility **${utilAmount}**/**${Creature.MAX_EQUIPPED_UTILITY}**`;
        }(creature)
      )
      
      const items = creature.items;
      total = creature.items.length;

      for (var i = index * PER_INDEX_PAGE; i < items.length && i < PER_INDEX_PAGE * (index + 1); i++) {
        const item = items[i];

        embed.addField(
          // @ts-expect-error
          `<**${i+1}**> **${item.displayName}** \`${item.$.id}\`\n**${capitalize(item.$.type)}**${item.$.subtype ? `, ${capitalize(item.$.subtype)}` : ""}`,
          describeItem(item, creature) + "\n\n",
          true
        )
      }
      
      embed.addField(
        "Crafting Materials",
        function () {
          var str = "";

          for (const c in creature.$.items.crafting_materials) {
            // @ts-expect-error
            const mat: number = creature.$.items.crafting_materials[c];

            str += `**${mat}** ${capitalize(c)}\n`;
          }

          return str;
        }()
      )
    } break;
    case "backpack": {
      scrollable = true;

      const _items = creature.$.items.backpack;
      const items: Item[] = [];
      for (const i of _items) {
        const item = ItemManager.map.get(i);
        if (item)
          items.push(item);
      }

      if (items.length > total) {
        total = items.length
      }

      for (var i = index * PER_INDEX_PAGE; i < items.length && i < PER_INDEX_PAGE * (index + 1); i++) {
        const item = items[i];

        embed.addField(
          // @ts-expect-error
          `<**${i+1}**> **${item.displayName}** \`${item.$.id}\`\n**${capitalize(item.$.type)}**${item.$.subtype ? `, ${capitalize(item.$.subtype)}` : ""}`,
          describeItem(item, creature) + "\n\n",
          true
        )
      }
    } break;
    case "abilities": {
      scrollable = true;

      embed.addFields(function() {
        const array: EmbedFieldData[] = [];

        const abilities = creature.abilities;
        total = abilities.length;
        for (var i = index * PER_INDEX_PAGE; i < abilities.length && i < PER_INDEX_PAGE * (index + 1); i++) {
          const ability = abilities[i];

          array.push({
            name: `<${i+1}> \`${ability.$.id}\` ${ability.$.info.name}`,
            value: `${replaceLore(ability.$.info.lore, ability.$.info.lore_replacers, creature)}\n\n` +
            `**${ability.$.haste ?? 1}** Haste\n**${ability.$.min_targets}**${ability.$.max_targets ? `to **${ability.$.max_targets}**` : ""} Targets\n` +
            `**${ability.$.cost}** Mana\n` +
            `${ability.$.attackLike ? "**Treated like Attack**" : ""}`
          })
        }

        return array;
      }())
    } break;
    case "attack": {
      function attackInfo(creature: Creature, attacks: AttackData[], type: DamageMethod) {
        var str = "";

        for (const attackdata of attacks) {
          str += `Sources:
          ${function () {
            var str = "";

            for (const source of attackdata.sources) {
              str += `[**${Math.round(source.flat_bonus + (source.from_skill * (type === DamageMethod.Melee ? creature.$.stats.melee.value : creature.$.stats.ranged.value)))} *(${source.flat_bonus} + ${Math.round(100 * source.from_skill) / 100}x)* ${DamageType[source.type]}**]\n`
            }

            return str;
          }()}
          **${(attackdata.modifiers?.accuracy ?? 0) + creature.$.stats.accuracy.value} *(${creature.$.stats.accuracy.value} ${(attackdata.modifiers?.accuracy ?? 0) >= 0 ? "+" : "-"}${Math.abs(attackdata.modifiers?.accuracy ?? 0)})*** Accuracy
          **${attackdata.modifiers?.lethality ?? 0}** Lethality
          **${attackdata.modifiers?.defiltering ?? 0}** Defiltering\n\n`;
        }

        return str;
      }

      const attack = creature.attackSet;
      embed.addFields([
        {
          name: "Position",
          value: `${CombatPosition[attack.type]} - ${DamageMethod[attack.type]}`
        },
        {
          name: "Crit",
          value: attackInfo(creature, attack.crit, attack.type),
          inline: true
        },
        {
          name: "Normal",
          value: attackInfo(creature, attack.normal, attack.type),
          inline: true
        },
        {
          name: "Weak",
          value: attackInfo(creature, attack.weak, attack.type),
          inline: true
        }
      ])
    } break;
    case "effects": {
      scrollable = true;

      const effects = creature.active_effects;
      total = effects.length;
      for (var i = index * PER_INDEX_PAGE; i < effects.length && i < PER_INDEX_PAGE * (index + 1); i++) {
        const effect = effects[i];

        const effectData = EffectManager.map.get(effect.id);
        if (!effectData) continue;
    
        embed.addField(
          `<${i+1}> ${effectData.$.info.name} ${function() {
            switch (effectData.$.display_severity) {
              default: return "";
              case DisplaySeverity.ARABIC: return String(effect.severity);
              case DisplaySeverity.ROMAN: return romanNumeral(effect.severity);
            }
          }()}`,
          `*${replaceEffectLore(effectData.$.info.lore, effectData.$.info.replacers, effect)}*\n\n${effect.ticks === -1 ? "**Location Dependent**" : `for **${effect.ticks}** Ticks`} (\`${effect.id}\`)`
        )
      }

      if (embed.fields.length == 0) {
        embed.setDescription("None");
      }
    } break;
    case "modifiers": {
      embed
      .addField(
        "Bases",
        function() {
          var str = "";

          for (const s in creature.$.stats) {
            // @ts-ignore
            const stat = creature.$.stats[s];
            str += `**${Math.round(stat.base)}** ${capitalize(s.replaceAll(/_/g, " "))}\n`;
          }

          return str;
        }(),
        true
      ).addField(
        "Modifiers",
        function() {
          var str = "";

          const array: PassiveModifier[] = [];
          for (const s in creature.$.stats) {
            // @ts-ignore
            const stat = creature.$.stats[s];
            
            for (const mod of stat.modifiers) {
              array.push({
                stat: s,
                type: mod.type,
                value: mod.value
              });
            }
          }
          for (const a in creature.$.attributes) {
            // @ts-ignore
            const attr = creature.$.attributes[a];
            
            for (const mod of attr.modifiers) {
              array.push({
                stat: a,
                type: mod.type,
                value: mod.value
              });
            }
          }

          for (const mod of array) {
            str += `**`;
            switch (mod.type) {
              case ModifierType.MULTIPLY: str += `${mod.value}x`; break;
              case ModifierType.ADD_PERCENT: str += `${mod.value >= 0 ? "+" : "-"}${Math.round(Math.abs(mod.value) * 1000) / 10}%`; break;
              case ModifierType.CAP_MAX: str += `${mod.value}^`; break;
              case ModifierType.ADD: str += `${mod.value >= 0 ? "+" : "-"}${Math.abs(mod.value)}`; break;
            }
            str += `** ${capitalize(mod.stat.replaceAll(/_/g, " "))}\n`;
          }

          return str;
        }() || "None",
        true
        ).addField(
          "Values",
          function() {
            var str = "";
  
            for (const s in creature.$.stats) {
              // @ts-ignore
              const stat = creature.$.stats[s];
  
              str += `**${Math.round(stat.value)}** ${capitalize(s.replaceAll(/_/g, " "))}\n`;
            }
  
            return str;
          }(),
          true
        )
    } break;
    case "attributes": {
      embed
      .setDescription(`Points used: **${creature.totalAttributePointsUsed}**/${creature.$.experience.level}`)
      .addField(
        "Attributes",
        function () {
          var str = "";

          for (const a in creature.$.attributes) {
            // @ts-expect-error
            const attr = creature.$.attributes[a];
            const attr_bonus = attr.value - attr.base;
            
            // @ts-expect-error
            str += `**${attr.value} ${a}**${attr_bonus !== 0 ? ` [Modifiers] *(**${attr.base}** ${`${(attr_bonus < 0 ? "-" : "+")} ${Math.abs(attr_bonus)}`})*` : ""}\n${Creature.ATTRIBUTE_DESCRIPTIONS[a]}  ${modifierDescriptor(Creature.ATTRIBUTE_MODS[a]).trim().replaceAll("\n", ", ") || ""}\n`
          }

          return str;
        }()
        +
        `\n*All attribute modifiers add to BASE stats, not modify. Descriptions are per-point.*`
      ).addField(
        "Per Level",
        "Regardless of attributes, each Level provides a creature with:\n" +
        modifierDescriptor(Creature.LEVEL_MODS).trim().replaceAll("\n", ", ") +
        "\non base stats."
      )
    } break;
    case "perks": {
      scrollable = true;

      const perks = creature.perks;
      total = perks.length;
      for (var i = index * PER_INDEX_PAGE; i < perks.length && i < PER_INDEX_PAGE * (index + 1); i++) {
        const perk = perks[i]
        embed.addField(
          `<${i+1}> \`${perk.$.id}\` **${perk.$.info.name}**`,
          `${perk.$.info.lore}`
        )
      }
    } break;
    case "skills": {
      scrollable = true;

      const skills = creature.skills;
      total = skills.length;
      for (var i = index * PER_INDEX_PAGE; i < skills.length && i < PER_INDEX_PAGE * (index + 1); i++) {
        const skill = skills[i]
        embed.addField(
          `<${i+1}> \`${skill.$.id}\` **${skill.$.info.name}**`,
          `*${skill.$.info.lore}*\n\n` +
          `**Perks**:${perksDescriptor(Array.from(skill.$.perks ?? []))}\n\n` +
          `**Passives**:${passivesDescriptor(Array.from(skill.$.passives ?? []))}\n\n` +
          `**Abilities**:${abilitiesDescriptor(Array.from(skill.$.abilities ?? []))}\n\n`
        )
      }
    } break;
    case "schematics": {
      scrollable = true;

      embed.setDescription(function() {
        var str = "";

        const schematics = Array.from(creature.schematics);
        for (var i = index * PER_INDEX_PAGE; i < schematics.length && i < PER_INDEX_PAGE * (index + 1); i++) {
          const schem = schematics[i];

          const item = SchematicsManager.map.get(schem);
          if (!item) continue;

          str += `<**${i+1}**> **${item.displayName}** \`${item.$.id}\`\n` + schematicDescriptor(item);
        }

        return str;
      }())
    } break;
    case "location": {
      scrollable = true;

      const location = creature.location;
      if (!location) {
        embed.setDescription("Invalid location; ***v o i d***");
      } else {
        embed.setDescription(`**${location.$.info.name}** \`${location.$.id}\`\n${location.$.info.lore}`)

        embed.addField(
          "Flags",
          `**${location.$.temperature}**°C (**${cToF(location.$.temperature)}**°F) Temperature\n` +
          `${location.$.shop !== undefined ? "⬜" : "🔳"} - \`/char shop\` ${location.$.shop !== undefined ? "available" : "unavailable"}\n` + 
          `${location.$.hasEnhancedCrafting ? "⬜" : "🔳"} - ${location.$.hasEnhancedCrafting ? "Enhanced Crafting" : "Limited Crafting"}\n`
        )

        if (location.$.area_effects) {
          embed.addField(
            "Area Effects",
            function () {
              var str = "";

              total = location.$.area_effects?.length;

              for (var a = index * PER_INDEX_PAGE; a < (index + 1) * PER_INDEX_PAGE && a < location.$.area_effects.length; a++) {
                const active_effect = location.$.area_effects[a];
                const effect_data = EffectManager.map.get(active_effect.id);
                if (!effect_data) continue;

                str += `<**${a}**> \`${effect_data.$.id}\` **${effect_data.$.info.name}${function(){
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
    } break;
  }

  embed.setFooter(
    `ID: ${creature.$._id}${(creature.$.info.locked || creature.$.info.npc) ? "" : " | NOT LOCKED"}` +
    (scrollable
    ? ` | ${(index * PER_INDEX_PAGE) + 1}-${(index + 1) * PER_INDEX_PAGE}/${total}`
    : "")
  )

  return {embed, scrollable, attachments};
}

const BAR_STYLE = bar_styles[0];
const BAR_LENGTH = 20;

export function tableDescriptor(table: LootTable) {
  var str = "";
  for (const p in table.probabilities) {
    const pool = table.probabilities[p];
    str += `- Rolls **${table.$.pools[p].min_rolls}**${table.$.pools[p].max_rolls > table.$.pools[p].min_rolls ? `-**${table.$.pools[p].max_rolls}**` : ""} times\n`

    for (const i of pool) {
      const item = ItemManager.map.get(i.id);
      if (!item) continue;

      str += `**${Math.round(1000 * i.chance) / 10}%** x **${item.displayName}** \`${item.$.id}\`\n`
    }

    str += "\n";
  }
  return str.trim();
}

export function schematicDescriptor(item: Schematic) {
  var str = `*${item.$.info.lore}*\n`;

  const table = LootTables.map.get(item.$.table);
  if (!table) return str;

  str += tableDescriptor(table);
  if (item.$.requirements.perks && item.$.requirements.perks.size > 0) {
    str +=
      "**Required Perks**\n" +
      (function () {
        var str = "";

        for (const p of item.$.requirements.perks) {
          const perk = PerkManager.map.get(p);
          if (!perk) continue;

          str += `\`${perk.$.id}\` **${perk.$.info.name}**\n`;
        }

        return str;
      }() || "Invalid") + "\n"
  }
  if (item.$.requirements.materials) {
    str +=
      "**Materials**\n" +
      function () {
        var str = "";

        for (const mat in item.$.requirements.materials) {
          // @ts-expect-error
          str += `**${item.$.requirements.materials[mat]}** ${capitalize(mat)}, `;
        }

        return str.substring(0, str.length - 2);
      }() + "\n"
  }
  if (item.$.requirements.items && item.$.requirements.items.length > 0) {
    str +=
      "**Item Ingredients**" +
      (function () {
        var str = "";

        for (const i of item.$.requirements.items) {
          const thing = ItemManager.map.get(i);
          if (!thing) continue;

          str += `\`${thing.$.id}\` **${thing.$.info.name}**`;
        }

        return str;
      }() || "Invalid") + "\n" 
  }

  return str.trim();
}

export function describeItem(item: Item, creature?: Creature) {
  var str = "";
  
  let lore = item.$.info.lore
  // @ts-expect-error
  if (item.$.info.replacers) {
    // @ts-expect-error
    lore = replaceLore(lore, item.$.info.replacers, creature);
  }

  str += `*${lore}*\n`;
  
  const scrap: string[] = [];
  if (item.$.scrap) {
    for (const mat in item.$.scrap.materials) {
      // @ts-expect-error
      scrap.push(`**${item.$.scrap.materials[mat]}** ${capitalize(mat)}`)
    }
    str += `\nScraps for: ${scrap.join(", ")}\n`
  }

  if (item.$.type === "consumable") {
    const table = LootTables.map.get(item.$.returnTable ?? "");
    if (table)
      str += `\nAfter Use:\n${tableDescriptor(table)}\n\n`;
  } else {
    if (item.$.perks) {
      const perks: string[] = [];
      for (const p of item.$.perks) {
        let perk: CreaturePerk | undefined;
        if (typeof p === "string") {
          perk = PerkManager.map.get(p)
        } else {
          perk = p;
        }

        if (!perk) continue;
        
        perks.push(perk.$.info.name);
      }

      str += `**Perks**: **${perks.join("**, **")}**\n`;
    }
    if (item.$.passives) {
      const passives: string[] = [];
      for (const p of item.$.passives) {
        let perk: PassiveEffect | undefined;
        if (typeof p === "string") {
          perk = PassivesManager.map.get(p)
        } else {
          perk = p;
        }

        if (!perk) continue;
        
        passives.push(perk.$.info.name);
      }

      str += `**Passives**: **${passives.join("**, **")}**\n`;
    }
    if (item.$.abilities) {
      const abilities: string[] = [];
      for (const p of item.$.abilities) {
        let perk: CreatureAbility | undefined;
        if (typeof p === "string") {
          perk = AbilitiesManager.map.get(p)
        } else {
          perk = p;
        }

        if (!perk) continue;
        
        abilities.push(perk.$.info.name);
      }

      str += `**Abilities**: **${abilities.join("**, **")}**\n`;
    }
    if (item.$.unique) {
      str += `Unique Flags: ${function () {
        var s = "";

        const uniques: string[] = Array.from(item.$.unique);
        for (const u of uniques) {
          s += capitalize(u.replaceAll(/_/gi, " ")) + ", ";
        }
        
        return s.substring(0, s.length - 2);
      }()}`
    }

    switch (item.$.type) {
      case "weapon": {
        str += 
          `\nWeapon Type: **${DamageMethod[item.$.attack.type]}**\n` +
          `- **Crit** Attack\n${attackDescriptor(item.$.attack.crit)}\n` +
          `- **Normal** Attack\n${attackDescriptor(item.$.attack.normal)}\n` +
          `- **Weak** Attack\n${attackDescriptor(item.$.attack.weak)}\n`
      } break;
    }
  }

  return str.trim();
}