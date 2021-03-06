import { ApplicationCommandOptionChoiceData, Client, EmbedFieldData, MessageActionRow, MessageAttachment, MessageButton, MessageEmbed, MessageSelectMenu } from "discord.js";
import Mongoose from "mongoose";
import { replaceEffectLore } from "../../game/ActiveEffects.js";
import { Material, Schematic } from "../../game/Crafting.js";
import Creature, { Attributes, diceRoll, Stats } from "../../game/Creature.js";
import { AbilityRole, AbilityType, CreatureAbility } from "../../game/CreatureAbilities.js";
import { damageLogEmbed, DamageMethod, DamageType, DAMAGE_TO_INJURY_RATIO, healLogEmbed, reductionMultiplier } from "../../game/Damage.js";
import { CombatPosition } from "../../game/Fight.js";
import { AttackData, ConsumableItemData, EquippableInventoryItem, InventoryItem, Item, ItemQualityEmoji, ItemSlot, SlotDescriptions, SpecializedWearableData, WeaponCategory, WeaponItemData, WearableInventoryItem, WearableItemData } from "../../game/Items.js";
import { cToF } from "../../game/Locations.js";
import { LootTable } from "../../game/LootTables.js";
import { replaceLore } from "../../game/LoreReplacer";
import { ItemStatModule, ModuleType, ModuleTypeEmoji } from "../../game/Modules.js";
import { NamedModifier, PassiveEffect } from "../../game/PassiveEffects.js";
import { CreaturePerk } from "../../game/Perks.js";
import { ModifierType, textStat, TrackableStat } from "../../game/Stats.js";
import { AbilitiesManager, capitalize, CONFIG, EffectManager, invLerp, ItemManager, LootTables, PassivesManager, PerkManager, rotateLine, SchematicsManager, SpeciesManager } from "../../index.js";
import { make_bar } from "../Bars.js";
import { ApplicationCommandHandler } from "../commands.js";
import { ceditMenu, consumeMenu, scrapMenu } from "../component_commands/cedit.js";
import { attackDescriptor, modifiersDescriptor, namedModifierDescriptor, passivesDescriptor } from "./handbook.js";

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
            autocomplete: true,
            required: true
          },
          {
            name: "difficulty",
            description: "The difficulty. Usual ranges 3-20 from Trivial to Impossible",
            type: "INTEGER",
            required: true
          },
          {
            name: "attribute",
            description: "Which attribute to roll for?",
            type: "STRING",
            required: true,
            choices: function () {
              const array: ApplicationCommandOptionChoiceData[] = [];

              for (const attr in new Creature({_id: ""}).$.attributes) {
                array.push({
                  name: attr,
                  value: attr
                })
              }

              return array;
            }()
          },
          {
            name: "bonus",
            description: "Modify the check value",
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
        name: "give",
        description: "Give an item from your backpack",
        type: "SUB_COMMAND",
        options: [
          {
            name: "backpack_item",
            description: "The item you want to hand over",
            type: "STRING",
            required: true,
            autocomplete: true
          },
          {
            name: "recipient",
            description: "The person to give it to (Must be PC)",
            type: "STRING",
            required: true,
            autocomplete: true
          }
        ]
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
                name: "Ultimate",
                value: "ultimate"
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
                name: "Module Breakdown",
                value: "modules"
              },
              {
                name: "Health History",
                value: "vitalsHistory"
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
        name: "scrap_item",
        description: "Scrap an item",
        type: "SUB_COMMAND"
      },
      {
        name: "consume_item",
        description: "Consume an item",
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

    const guild = await Bot.guilds.fetch(CONFIG.guild?.id ?? "");

    await guild.roles.fetch();
    
    const member = await guild.members.fetch(interaction.user.id).catch(() => null);
    let IS_GM = true;
    if (!member || !member.roles.cache.has(CONFIG.guild?.gm_role ?? "")) {
      IS_GM = false;
    } 

    switch (interaction.options.getSubcommand(true)) {
      case "scrap_item": {
        const [creature] = await Promise.all([
          Creature.fetch(interaction.user.id, db).catch(() => null),
          interaction.deferReply({ephemeral: true})
        ]);

        if (!creature) {
          interaction.editReply({
            content: "Must own a Creature!"
          })
          return;
        }

        await scrapMenu(interaction, creature, db, IS_GM)
        return
      } break;
      case "consume_item": {
        const [creature,] = await Promise.all([
          Creature.fetch(interaction.user.id, db).catch(() => null),
          interaction.deferReply({ephemeral: true})
        ]);

        if (!creature) {
          interaction.editReply({
            content: "Must own a Creature!"
          })
          return;
        }

        consumeMenu(interaction, creature);
        return;
      } break;
      case "rollfor": {
        const [creature,] = await Promise.all([
          Creature.fetch(interaction.options.getString("id", false) ?? interaction.user.id, db).catch(() => null),
          interaction.deferReply({ephemeral: false})
        ]);

        if (!creature) {
          interaction.editReply({
            content: "Invalid creature"
          }).finally(() => setTimeout(() => {
            interaction.deleteReply();
          }, 5000))
          return;
        }

        const diff = interaction.options.getInteger("difficulty", true);
        const bonus = interaction.options.getInteger("bonus", false) ?? 0;
        const attr_name = interaction.options.getString("attribute", true) as Attributes;

        const attr: TrackableStat = creature.$.attributes[attr_name];

        const rolls: number[] = [];
        for (var i = 0; i < DICE_ROLL_AMOUNT; i++) {
          rolls.push(diceRoll(DICE_ROLL_SIDES));
        }
  
        const score = rolls.reduce((p,v) => p += v) + attr.value + bonus;

        interaction.editReply({
          content:
            `**${attr_name}** Check: ***${rollResult(score - diff)}***\n` +
            `**${score}** of **${diff}** *(**${rolls.join("**, **")}**)*\n` +
            `**${attr.value < 0 ? "-" : "+"}${Math.abs(attr.value)}** Attribute\n` +
            `**${bonus < 0 ? "-" : "+"}${Math.abs(bonus)}** Bonus\n` +
            `as **${creature.displayName}**`
        })
      } break;
      case "give": {
        const [creature, target] = await Promise.all([
          Creature.fetch(interaction.user.id, db),
          Creature.fetch(interaction.options.getString("recipient", true), db).catch(() => null),
          interaction.deferReply({ephemeral: true})
        ])

        if (!creature.alive) {
          interaction.editReply({
            content: "You're dead..."
          })
          return;
        }

        if (!creature.$.info.locked) {
          interaction.editReply({
            content: "Need to lock in before giving items."
          })
          return;
        }

        if (!target) {
          interaction.editReply({
            content: "Invalid creature."
          })
          return;
        }
        if (target?.$.info.npc || target?.location?.$.id !== creature.location?.$.id) {
          interaction.editReply({
            content: "You must be in the same location."
          })
          return;
        }

        if (target.$._id === creature.$._id) {
          interaction.editReply({
            content: "Cannot give items to yourself!"
          });
          return;
        }

        const index = creature.$.items.backpack.findIndex(v => v.id === interaction.options.getString("backpack_item", true));
        const item = creature.$.items.backpack.splice(index, 1)[0];
        if (index === -1 || !item) {
          interaction.editReply({
            content: "Item not in backpack!"
          })
          return;
        }
        const itemdata = ItemManager.map.get(item.id);
        if (!itemdata) {
          creature.$.items.backpack.push(item);
          interaction.editReply({
            content: "Invalid item!"
          })
          return;
        }

        target.$.items.backpack.push(item);

        await Promise.all([
          creature.put(db),
          target.put(db)
        ])

        await interaction.editReply({
          content: "Transfer complete!"
        });
        interaction.followUp({
          ephemeral: false,
          content: `<@${creature?.$._id}> gave <@${target?.$._id}> **${itemdata.displayName}**!`
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
          .setColor("AQUA")

        const components: MessageActionRow[] = [
          new MessageActionRow().setComponents([
            new MessageSelectMenu()
              .setCustomId(`cedit/${creature.$._id}/edit/buy`)
              .setPlaceholder("Buy something...")
          ])
        ]; 

        let start_index = 25 * Math.abs((interaction.options.getInteger("page", false) ?? 1) - 1);

        const select = components[0].components[0] as MessageSelectMenu | undefined;

        var i = 0;
        if (location.shop.$.content)
        for (i = start_index; i < 25; i++) {
          const content = location.shop.$.content[i];
          if (!content) break;

          function cost() {
            var arr: string[] = [];
            for (const mat in content.cost) {
              const material: number = content.cost[mat as Material];

              if (material !== 0)
                arr.push(`**${material}** ${capitalize(mat)}`)
            }

            return arr.join(", ");
          }

          switch (content.type) {
            default: continue;
            case "item": {
              const item = ItemManager.map.get(content.id);
              if (!item) continue;
              select?.addOptions({
                label: item.$.info.name,
                value: String(i),
                description: `[${i}] Item`
              })

              embed.addField(
                `[${i}] Item - ${item.displayName} \`${item.$.id}\``,
                `*${
                    (item.$ as ConsumableItemData).info.replacers
                    ? replaceLore(item.$.info.lore, (item.$ as ConsumableItemData).info.replacers, creature)
                    : item.$.info.lore}*\n\n${cost()
                  }`
              )
            } break;
            case "service": {
              select?.addOptions({
                label: content.info.name,
                value: String(i),
                description: `[${i}] Service`
              })

              embed.addField(
                `[${i}] Service - ${content.info.name}`,
                `*${content.info.lore}*\n\n${cost()}`
              )
            } break;
            case "schematic": {
              const schem = SchematicsManager.map.get(content.id);
              if (!schem) continue;
              select?.addOptions({
                label: schem.$.info.name,
                value: String(i),
                description: `[${i}] Schematic`
              })
              
              embed.addField(
                `[${i}] Schematic - ${schem.displayName} \`${schem.$.id}\``,
                `${schematicDescriptor(schem, creature.perkIDs)}\n\nCost: ${cost()}`
              )
            } break;
          }
        }

        embed.setFooter({ text: `${location.shop.$.id} | ${start_index + 1}-${i}/${location.shop.$.content?.length ?? 0}`})

        select
          ?.setMaxValues(select.options.length)
          .setMinValues(1)

        interaction.editReply({
          components,
          embeds: [embed]
        })
      } break;
      case "craft": {
        const schem = SchematicsManager.map.get(interaction.options.getString("recipe_id", true));
        if (!schem) return;

        const [creature,] = await Promise.all([
          Creature.fetch(interaction.user.id, db).catch(() => null),
          interaction.deferReply({ephemeral: true})
        ]);

        interaction.editReply({
          content: "Please Confirm",
          embeds: [
            new MessageEmbed()
              .setTitle(`${ItemQualityEmoji[schem.$.info.quality]} **${schem.$.info.name}**`)
              .setFooter({text: schem.$.id })
              .setDescription(schematicDescriptor(schem, creature?.perkIDs))
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
        await interaction.deferReply({ephemeral: false});

        const char = await Creature.fetch(interaction.options.getString("id", false)?.split(" ")[0] ?? interaction.options.getUser("user")?.id ?? interaction.user.id, db, false).catch(() => null);
        if (!char) {
          interaction.editReply({
            content: "Not found!"
          });
          return;
        }

        const page = interaction.options.getString("page", true);

        if (char.$.info.npc) {
          const guild = await Bot.guilds.fetch(CONFIG.guild?.id ?? "");
          await guild.roles.fetch();
      
          const member = await guild.members.fetch(interaction.user.id).catch(() => null);
          
          if (!member || !member.roles.cache.has(CONFIG.guild?.gm_role ?? "")) { 
            if ((await Creature.fetch(interaction.user.id, db, true)).location?.$.id !== char.location?.$.id) {
              interaction.editReply({
                content: "You must be in the same location as the NPC to view their info"
              });
              return;
            } else if (
              page === "location" || page === "schematics" ||
              page === "backpack" || page === "debug"
            ) {
              interaction.editReply({
                content: "Only GMs can access this kind of information"
              });
              return;
            }
          }
        }

        const info = await infoEmbed(char, Bot, db, page);

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

        await interaction.followUp({
          ephemeral: false,
          embeds: info.embeds,
          components,
          files: info.attachments
        });
        if (IS_GM && info.gm_embeds[0].fields.length > 0 || info.gm_embeds[0].description) 
          interaction.followUp({
            ephemeral: true,
            content: "PSST! Gm Only info found!",
            embeds: info.gm_embeds
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

const PER_INDEX_PAGE = 10;
export async function infoEmbed(creature: Creature, Bot: Client, db: typeof Mongoose, page: string, index = 0): Promise<{gm_embeds: MessageEmbed[], embeds: MessageEmbed[], attachments?: MessageAttachment[], scrollable: boolean}> {
  const embeds = [new MessageEmbed()];
  // ALIAS
  const embed = embeds[0];

  const gm_embeds = [new MessageEmbed()];
  // ALIAS
  const gm_embed = gm_embeds[0]

  const owner = await Bot.users.fetch(creature.$._id).catch(() => null);

  let scrollable = false;
  let attachments: MessageAttachment[] = [];
  let total = 0;

  const color = (creature.$.info.locked || creature.$.info.npc) ? "AQUA" : "GREY";

  embed
    .setTitle(creature.displayName)
    .setAuthor({ name: `${creature.$.info.npc ? "NPC" : (owner?.tag ?? "Unknown")}` })
    .setColor(color)
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
      const modules = creature.stat_modules;

      const injury_ratio = creature.$.vitals.injuries / creature.$.stats.health.value;

      embed.addField(
        "Basic",
        `Race - **${SpeciesManager.map.get(creature.$.info.species ?? "")?.$.info.name ?? "Unknown"}**\n` +
        function () {
          const arr: string[] = [];

          for (const t of Object.values(ModuleType).filter(x => !isNaN(Number(x)))) {
            const type = t as ModuleType;
            arr.push(`${ModuleTypeEmoji[type]}${ModuleType[type]} **${modules.get(type) ?? 0}**  ${modifiersDescriptor(ItemStatModule.getModifiers(type, modules.get(type) ?? 0) ?? [], " ")}`);
          }

          return arr.join("\n");
        }()
      ).addFields([
        {
          name: `Health **${creature.$.vitals.health}**/**${creature.$.stats.health.value - creature.$.vitals.injuries}** ` + 
          `(**${(100 * creature.$.vitals.health / creature.$.stats.health.value).toFixed(0)}%**)`,
          value: (make_bar(100 * creature.$.vitals.health / (creature.$.stats.health.value - creature.$.vitals.injuries), Creature.BAR_STYLES.Health, Math.max(1, (1 - injury_ratio) * Math.floor(creature.$.stats.health.value / BAR_LENGTH))).str ?? "") +
          (
            creature.$.vitals.injuries > 0
            ? make_bar(100, Creature.BAR_STYLES.Injuries, Math.max(1, injury_ratio * Math.floor(creature.$.stats.health.value / BAR_LENGTH))).str
            : ""
          ),
          inline: true
        },
        {
          name: `Shield ${creature.$.stats.shield.value > 0 ? textStat(creature.$.vitals.shield, creature.$.stats.shield.value) : "---"} **${creature.$.stats.shield_regen.value}**/t`,
          value: (
            creature.$.stats.shield.value > 0
            ? make_bar(100 * creature.$.vitals.shield / creature.$.stats.shield.value, Creature.BAR_STYLES.Shield, Math.max(1, Math.floor(creature.$.vitals.shield / creature.$.stats.shield.value))).str
            : "No **Shield** "
          ),
          inline: true
        },
        {
          name: "Vitals",
          inline: false,
          value: 
          `*(**${creature.$.stats.health.value}** Health - **${creature.$.vitals.injuries}** Injuries)*\n\n` +
          make_bar(100 * creature.$.vitals.action_points / creature.$.stats.action_points.value, Creature.BAR_STYLES.ActionPoints, creature.$.stats.action_points.value / creature.$.stats.attack_cost.value).str +
          ` **Action Points** ${textStat(creature.$.vitals.action_points, creature.$.stats.action_points.value)} ` +
          `**${creature.$.stats.ap_regen.value}**/t\n` + (
            creature.$.stats.ult_stack_target.value > 0
            ? `Ult Charge ${textStat(creature.$.abilities.ult_stacks, creature.$.stats.ult_stack_target.value)}\n`
            : ""
          ) + "\n" +
          make_bar(100 * creature.$.vitals.heat / creature.$.stats.heat_capacity.value, Creature.BAR_STYLES.Heat, creature.$.stats.heat_capacity.value / BAR_LENGTH).str +
          ` **Heat** ${textStat(creature.$.vitals.heat, creature.$.stats.heat_capacity.value)} ` +
          `**${creature.deltaHeat}** Delta ${creature.deltaHeat < 0 ? " ??????" : ""}\n` +
          `**${creature.$.stats.filtering.value}** Filtering >> **${(creature.location?.$.rads ?? 0)}** Area${(creature.location?.$.rads ?? 0) > creature.$.stats.filtering.value ? " ??????" : ""}\n` +
          "\n" +
          `**Intensity** ${textStat(creature.$.vitals.intensity, creature.$.stats.mental_strength.value)}`
        },
        {
          name: "Offense",
          value: 
            `**${creature.$.stats.accuracy.value}%** Accuracy *(Hit Chance)*\n` +
            `Melee **${creature.$.stats.melee.value}%** | **${creature.$.stats.ranged.value}%** Ranged *(Weapon Proficiency)*\n` +
            `**${creature.$.stats.damage.value}** Damage Rating *(Melee **${creature.getFinalDamage(DamageMethod.Melee).toFixed(1)}** | **${creature.getFinalDamage(DamageMethod.Ranged).toFixed(1)}** Ranged)*\n` +
            `**${creature.$.stats.ammo.value}** Attacks\n` +
            `**${creature.$.stats.tech.value}** Tech *(Ability Power)*\n` +
            "\n" +
            `Lethality **${creature.$.stats.lethality.value}** | **${creature.$.stats.passthrough.value}** Passthrough\n**${creature.$.stats.cutting.value}** Cutting\n` +
            `_(Reduces enemy **Armor**|**Dissipate** and **Tenacity**.)_` +
            "\n" +
            `Vamp **${creature.$.stats.vamp.value}%** | **${creature.$.stats.siphon.value}%** Siphon *(Regenerates **health** | **shields** by **%** of **Physical** | **Energy** Damage dealt.)*\n` +
            "\n" +
            `**${creature.$.stats.initiative.value}** Initiative` 
        },
        {
          name: "Defense",
          value:
          `**${creature.$.stats.armor.value}** Armor *(**${(100 * (1 - reductionMultiplier(creature.$.stats.armor.value))).toFixed(1)}%** Reduced Physical Damage)*\n` +
          `**${creature.$.stats.dissipate.value}** Dissipate *(**${(100 * (1 - reductionMultiplier(creature.$.stats.dissipate.value))).toFixed(1)}%** Reduced Energy Damage)*\n` +
          `Parry **${creature.$.stats.parry.value}%** | **${creature.$.stats.deflect.value}%** Deflect *(Reduces hit chance from **Melee** | **Ranged**)*\n` +
          "\n" +
          `**${creature.$.stats.tenacity.value}** Tenacity *(Taking **${(100 * reductionMultiplier(creature.$.stats.tenacity.value) * DAMAGE_TO_INJURY_RATIO).toFixed(1)}%** health damage as **Injuries**)*` +
          "\n" +
          `**${creature.$.stats.min_comfortable_temperature.value}**??C (**${(cToF(creature.$.stats.min_comfortable_temperature.value)).toFixed(1)}**??F) Min Comfortable Temperature *(**${creature.deltaHeat}**??C Delta)*` +
          "\n\n" +
          `**${creature.$.stats.stress_resistance.value}** Stress Resistance *(**${(100 * (1 - reductionMultiplier(creature.$.stats.stress_resistance.value))).toFixed(1)}%** Reduced Stress Damage)*`
        }
      ])
    } break;
    case "passives": {
      scrollable = true;

      const passives = creature.passives;
      total = passives.length;

      for (var i = index * PER_INDEX_PAGE; i < passives.length && i < PER_INDEX_PAGE * (index + 1); i++) {
        const passive = passives[i];

        if (passive.$.hide?.(creature))
          embed.addField(`<${i+1}>`, "????");

        (passive.$.hide?.(creature) ? gm_embed : embed).addField(
          `<${i+1}> ${passive.$.info.name}`,
          function() {
            var str = `*${replaceLore(passive.$.info.lore, passive.$.info.replacers ?? [], creature)}*`;
            if ((passive.$.modifiers ?? []).length > 0) {
              str += `\n- **Modifiers**\n`;
              for (const mod of passive.$.modifiers ?? []) {
                str += `**`;
                switch (mod.type) {
                  case ModifierType.MULTIPLY: str += `${mod.value.toFixed(2)}x`; break;
                  case ModifierType.ADD_PERCENT: str += `${mod.value >= 0 ? "+" : "-"}${(Math.abs(mod.value) * 100).toFixed(1)}%`; break;
                  case ModifierType.CAP_MAX: str += `${mod.value.toFixed(0)}^`; break;
                  case ModifierType.ADD: str += `${mod.value >= 0 ? "+" : "-"}${Math.abs(Math.round(100 * mod.value) / 100)}`; break;
                  case ModifierType.ADD_AFTER: str += `${Math.abs(Math.round(100 * mod.value) / 100)}${mod.value >= 0 ? "+" : "-"}`; break;
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
      const weapons = new Array<InventoryItem | null>().concat(creature.$.items.primary_weapon, ...creature.$.items.weapons); 
      const weapon_embed = new MessageEmbed().setColor(color);
      for (var w = 0; w < (Creature.MAX_EQUIPPED_WEAPONS + 1); w++) {
        const weapon = weapons[w];
        const itemdata = ItemManager.map.get(weapon?.id ?? "");

        weapon_embed.addField(
          w === 0
          ? "Primary Weapon"
          : `Backup Weapon ${w}`,
          `${itemdata ? `**${itemdata.displayName}**` : ""}\n${describeItem(weapon ?? undefined, creature) ?? ""}`.trim() || "Not Equipped"
        )

      }
      embeds.unshift(weapon_embed);

      for (const slot in SlotDescriptions) {
        const item = creature.$.items.slotted[slot as ItemSlot];
        const itemdata = ItemManager.map.get(item?.id ?? "");
        
        embed.addField(
          capitalize(slot),
          `${itemdata ? `**${itemdata.displayName}**` : ""}\n${describeItem(item ?? undefined, creature) ?? ""}`.trim() || "Not Equipped",
          true
        )
      }
      
      embed.addField(
        "Crafting Materials",
        function () {
          var str = "";

          for (const c in creature.$.items.crafting_materials) {
            const mat: number = creature.$.items.crafting_materials[c as Material];

            str += `**${mat}** ${capitalize(c)}\n`;
          }

          return str;
        }()
      )
    } break;
    case "backpack": {
      scrollable = true;

      const _items = creature.$.items.backpack;
      const items: (Item|undefined)[] = [];
      for (const i of _items) {
        const item = ItemManager.map.get(i.id);

        items.push(item);
      }

      if (items.length > total) {
        total = items.length
      }

      for (var i = index * PER_INDEX_PAGE; i < items.length && i < PER_INDEX_PAGE * (index + 1); i++) {
        const item = items[i];

        if (!item) continue;

        embed.addField(
          `<**${i+1}**> **${item.displayName}** \`${item.$.id}\`\n**${capitalize(item.$.type)}**${
            (item.$ as SpecializedWearableData).slot
            ? `, ${capitalize((item.$ as SpecializedWearableData).slot)}`
            : ""
          }`,
          describeItem(_items[i], creature) + "\n\n",
          item.$.type !== "weapon"
        )
      }
    } break;
    case "ultimate": {
      const ability = creature.ultimate;
      if (ability)
        embed.addField(
          `Ultimate \`${ability.$.id}\` ${ability.displayName}`,
          `${replaceLore(ability.$.info.lore, ability.$.info.replacers ?? [], creature)}\n\n` +
          `**${ability.$.min_targets}**${ability.$.max_targets ? `to **${ability.$.max_targets}**` : ""} Targets\n` +
          `**${ability.$.cost}** Ult Stacks\n` +
          `Type **${AbilityType[ability.$.type]}** / Role **${AbilityRole[ability.$.info.role]}**`
        )
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
            value: `${replaceLore(ability.$.info.lore, ability.$.info.replacers ?? [], creature)}\n\n` +
            `**${ability.$.haste ?? 1}** Haste\n` +
            `**${ability.$.min_targets}**${ability.$.max_targets ? `to **${ability.$.max_targets}**` : ""} Targets\n` +
            `**${ability.$.cost}** Action Points\n` +
            `Type **${AbilityType[ability.$.type]}** / Role **${AbilityRole[ability.$.info.role]}**`
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
              str += `[**${Math.round(source.flat_bonus + (source.from_skill * creature.$.stats.damage.value * ((type === DamageMethod.Melee ? creature.$.stats.melee.value : creature.$.stats.ranged.value) / 100)))} *(${source.flat_bonus} + ${(source.from_skill).toFixed(2)}x)* ${DamageType[source.type]}**]\n`
            }

            return str;
          }()}
          **${((attackdata.modifiers?.accuracy ?? 0) + (creature.$.stats.accuracy.value * rotateLine((type === DamageMethod.Melee ? creature.$.stats.melee.value : creature.$.stats.ranged.value) / 100, Creature.PROFICIENCY_ACCURACY_SCALE, 1))).toFixed(1)} *(${(creature.$.stats.accuracy.value * rotateLine((type === DamageMethod.Melee ? creature.$.stats.melee.value : creature.$.stats.ranged.value) / 100, Creature.PROFICIENCY_ACCURACY_SCALE, 1)).toFixed(1)} ${(attackdata.modifiers?.accuracy ?? 0) >= 0 ? "+" : "-"}${Math.abs(attackdata.modifiers?.accuracy ?? 0)})*** Accuracy
          **${creature.$.stats.lethality.value + (attackdata.modifiers?.lethality ?? 0)}** Lethality _(${creature.$.stats.lethality.value} **${(attackdata.modifiers?.lethality ?? 0) >= 0 ? "+" : "-"}${Math.abs((attackdata.modifiers?.lethality ?? 0))}**)_
          **${creature.$.stats.passthrough.value + (attackdata.modifiers?.passthrough ?? 0)}** Passthrough _(${creature.$.stats.passthrough.value} **${(attackdata.modifiers?.passthrough ?? 0) >= 0 ? "+" : "-"}${Math.abs((attackdata.modifiers?.passthrough ?? 0))}**)_
          **${creature.$.stats.cutting.value + (attackdata.modifiers?.cutting ?? 0)}** Cutting _(${creature.$.stats.cutting.value} **${(attackdata.modifiers?.cutting ?? 0) >= 0 ? "+" : "-"}${Math.abs((attackdata.modifiers?.cutting ?? 0))}**)_`
          + "\n\n";
        }

        return str;
      }

      const attack = creature.attackSet;
      embed.addFields([
        {
          name: "Position",
          value: `${CombatPosition[attack.type]} - ${DamageMethod[attack.type]} *(**${(100 * rotateLine((attack.type === DamageMethod.Melee ? creature.$.stats.melee.value : creature.$.stats.ranged.value) / 100, Creature.PROFICIENCY_DAMAGE_SCALE, 1)).toFixed(2)}%**)*`
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
    
        if (effectData.$.hide?.(creature))
          embed.addField(`<${i+1}>`, "????");

        (effectData.$.hide?.(creature, effect) ? gm_embed : embed).addField(
          `<${i+1}> ${effectData.getDisplayName(effect)}`,
          `*${replaceEffectLore(effectData.$.info.lore, effectData.$.info.replacers ?? [], effect, creature, true)}*\n\n${effect.ticks === -1 ? "**Cannot Expire**" : `for **${effect.ticks}** Ticks`} (\`${effect.id}\`)\n` +
          `\n${passivesDescriptor(Array.from(effectData.$.passives ?? []), false, creature)}`
        )

        const _hidden: (string | PassiveEffect)[] = [];
        for (let _p of effectData.$.passives ?? []) {
          if (typeof _p === "string") {
            // @ts-expect-error
            _p = PassivesManager.map.get(p);
          }
          const p = _p as PassiveEffect;

          if (p.$.hide?.(creature))
            _hidden.push(p);
        }

        if (_hidden.length > 0)
          gm_embed.addField(
            `<${i+1}> Hidden Passives`,
            passivesDescriptor(_hidden, true, creature)
          );
      }

      if (embed.fields.length == 0) {
        embed.setDescription("None");
      }
    } break;
    case "modules": {
      embed.addFields(
        {
          name: "Natural Modules",
          value: function () {
            const str: string[] = [];

            for (const [type, amt] of creature.natural_stat_modules) {
              str.push(`${ModuleTypeEmoji[type]} ${amt}`);
            }

            return str.join(", ");
          }() || "None",
          inline: true 
        }, {
          name: "Item Modules",
          value: function () {
            const str: string[] = [];

            for (const [type, amt] of creature.item_only_stat_modules) {
              str.push(`${ModuleTypeEmoji[type]} ${amt}`);
            }

            return str.join(", ");
          }() || "None",
          inline: true 
        }, {
          name: "Total Modules",
          value: function () {
            const arr: string[] = [];

            for (const t of Object.values(ModuleType).filter(x => !isNaN(Number(x)))) {
              const type = t as ModuleType;
              arr.push(`${ModuleTypeEmoji[type]}${ModuleType[type]} **${creature.stat_modules.get(type) ?? 0}**  ${modifiersDescriptor(ItemStatModule.getModifiers(type, creature.stat_modules.get(type) ?? 0) ?? [], " ")}`);
            }

            return arr.join("\n");
          }() || "None",
          inline: false
        },
      );
    } break;
    case "modifiers": {
      embed
      .addField(
        "Bases",
        function() {
          var str = "";

          const stats: Map<string, TrackableStat> = new Map();
          for (const s in creature.$.attributes)
            stats.set(s, creature.$.attributes[s as Attributes]);
          for (const s in creature.$.stats)
            stats.set(s, creature.$.stats[s as Stats]);

          for (const [s, stat] of stats)
            str += `**${Math.round(stat.base)}** ${capitalize(s.replaceAll(/_/g, " "))}\n`;

          return str;
        }(),
        true
      ).addField(
        "Modifiers",
        function() {
          var str = "";

          const array: NamedModifier[] = [];
          for (const _s in creature.$.stats) {
            const s = _s as Stats;
            const stat = creature.$.stats[s];
            
            for (const mod of stat.modifiers) {
              array.push({
                stat: s,
                type: mod.type,
                value: mod.value
              });
            }
          }
          for (const _a in creature.$.attributes) {
            const a = _a as Attributes;
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
              case ModifierType.MULTIPLY: str += `${mod.value.toFixed(2)}x`; break;
              case ModifierType.ADD_PERCENT: str += `${mod.value >= 0 ? "+" : "-"}${(Math.abs(mod.value) * 100).toFixed(1)}%`; break;
              case ModifierType.CAP_MAX: str += `${mod.value.toFixed(0)}^`; break;
              case ModifierType.ADD: str += `${mod.value >= 0 ? "+" : "-"}${Math.abs(Math.round(100 * mod.value) / 100)}`; break;
              case ModifierType.ADD_AFTER: str += `${Math.abs(Math.round(100 * mod.value) / 100)}${mod.value >= 0 ? "+" : "-"}`; break;
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
  
            const stats: Map<string, TrackableStat> = new Map();
            for (const s in creature.$.attributes)
              stats.set(s, creature.$.attributes[s as Attributes]);
            for (const s in creature.$.stats)
              stats.set(s, creature.$.stats[s as Stats]);
  
            for (const [s, stat] of stats)
              str += `**${Math.round(stat.value)}** ${capitalize(s.replaceAll(/_/g, " "))}\n`;
  
            return str;
          }(),
          true
        )
    } break;
    case "attributes": {
      embed
      .addField(
        "Points used",
        `**${creature.totalAttributePointsUsed}**/${Creature.ATTRIBUTE_POINTS}`
      ).setDescription(
        function () {
          var str = "";

          for (const _a in creature.$.attributes) {
            const a = _a as Attributes;
            const attr = creature.$.attributes[a];
            const attr_bonus = attr.value - attr.base;
            
            str += `**${attr.value} ${a}** *(**${attr.base}**/${Creature.ATTRIBUTE_MAX}${attr_bonus !== 0 ? ` ${(attr_bonus < 0 ? "-" : "+")} ${Math.abs(attr_bonus)} ???????` : ""})*\n${Creature.ATTRIBUTE_DESCRIPTIONS[a]}  ${modifiersDescriptor(Creature.ATTRIBUTE_MODS[a], ", ").trim() || ""}\n`
          }

          return str;
        }()
        +
        `\n*All attribute modifiers add to BASE stats, not modify. Descriptions are per-point.*`
      )
    } break;
    case "perks": {
      scrollable = true;

      const perks = creature.perks;
      total = perks.length;

      for (var i = index * PER_INDEX_PAGE; i < perks.length && i < PER_INDEX_PAGE * (index + 1); i++) {
        const perk = perks[i];

        if (perk.$.hide?.(creature))
          embed.addField(`<${i+1}>`, "????");

        (perk.$.hide?.(creature) ? gm_embed : embed).addField(
          `<${i+1}> ${perk.$.id ? `\`${perk.$.id}\`` : ""} **${perk.$.info.name}**`,
          `${perk.$.info.lore}`
        )
      }
    } break;
    case "skills": {
      scrollable = true;

      const skills = creature.skills;
      total = skills.length;

      for (var i = index * PER_INDEX_PAGE; i < skills.length && i < PER_INDEX_PAGE * (index + 1); i++) {
        const skill = skills[i];

        var str = "";

        if (skill.$.perks) {
          const perks: string[] = [];
          for (const p of skill.$.perks) {
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
        if (skill.$.passives) {
          const passives: string[] = [];
          for (const p of skill.$.passives) {
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
        if (skill.$.abilities) {
          const abilities: string[] = [];
          for (const a of skill.$.abilities) {
            let ability: CreatureAbility | undefined;
            if (typeof a === "string") {
              ability = AbilitiesManager.map.get(a)
            } else {
              ability = a;
            }
    
            if (!ability) continue;
            
            abilities.push(ability.displayName);
          }
    
          str += `**Abilities**: **${abilities.join("**, **")}**\n`;
        }
        if (skill.$.unique) {
          str += `Unique Flags: ${function () {
            var s = "";
    
            const uniques: string[] = Array.from(skill.$.unique);
            for (const u of uniques) {
              s += capitalize(u.replaceAll(/_/gi, " ")) + ", ";
            }
            
            return s.substring(0, s.length - 2);
          }()}`
        }

        if (skill.$.hide?.(creature))
          embed.addField(`<${i+1}>`, "????");

        (skill.$.hide?.(creature) ? gm_embed : embed).addField(
          `<${i+1}> \`${skill.$.id}\` **${skill.$.info.name}**`,
          `*${skill.$.info.lore}*\n\n${str}` 
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

          str += `<**${i+1}**> **${item.displayName}** \`${item.$.id}\`\n` + schematicDescriptor(item, creature.perkIDs);
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
          `**${location.$.temperature}**??C (**${Math.round(10 * cToF(location.$.temperature)) / 10}**??F) Temperature\n` +
          `${location.$.shop !== undefined ? "???" : "????"} - \`/char shop\` ${location.$.shop !== undefined ? "available" : "unavailable"}\n` + 
          `${location.$.hasEnhancedCrafting ? "???" : "????"} - ${location.$.hasEnhancedCrafting ? "Enhanced Crafting" : "Limited Crafting"}\n`
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

                str += `<**${a}**> \`${effect_data.$.id}\` **${effect_data.getDisplayName(active_effect)}**\n`;
              }

              return str;
            }() || "None"
          )
        }
      }
    } break;
    case "vitalsHistory": {
      scrollable = true;

      var i = 0;
      total = creature.$.vitalsHistory.length;
      for (var a = index * 5; a < (index + 1) * 5 && a < total; a++) {
        const his = creature.$.vitalsHistory[a];
        embeds[i] = his.type === "damage"
        ? await damageLogEmbed(his, db)
        : await healLogEmbed(his, db);
        i++;
      }
    } break;
  }

  const ind = page === "vitalsHistory" ? 5 : PER_INDEX_PAGE;

  embeds[embeds.length - 1].setFooter({text:
    `ID: ${creature.$._id}${(creature.$.info.locked || creature.$.info.npc) ? "" : " | NOT LOCKED"}` +
    (scrollable
    ? ` | ${(index * ind) + 1}-${(index + 1) * ind}/${total}`
    : "")
    })

  return {gm_embeds, embeds, scrollable, attachments};
}

const BAR_LENGTH = 10;

export function tableDescriptor(table: LootTable, perks?: Set<string>) {
  const pools = table.getHighestFromPerks(perks ?? new Set());
  const probs = LootTable.getProbabilities(pools);

  var str = "";
  for (const p in probs) {
    const pool = probs[p];
    str += `- Rolls **${pools[p].min_rolls}**${pools[p].max_rolls > pools[p].min_rolls ? `-**${pools[p].max_rolls}**` : ""} times\n`

    for (const i of pool) {
      const item = ItemManager.map.get(i.id);
      if (!item) continue;

      str += `**${Math.round(1000 * i.chance) / 10}%** x **${item.displayName}** \`${item.$.id}\`\n`
    }

    str += "\n";
  }
  return str.trim();
}

export function schematicDescriptor(item: Schematic, perks?: Set<string>) {
  var str = `${item.$.upgrade ? "???? " : ""}*${item.$.info.lore}*\n`;

  const table = LootTables.map.get(item.$.table);
  if (!table) return str;

  str += tableDescriptor(table, perks) + "\n";
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
          const material: number = item.$.requirements.materials[mat as Material];

          if (material !== 0)
            str += `**${material}** ${capitalize(mat)}, `;
        }

        return str.substring(0, str.length - 2);
      }() + "\n"
  }
  if (item.$.requirements.items && item.$.requirements.items.length > 0) {
    str +=
      "**Item Ingredients**\n" +
      (function () {
        var str = "";

        for (const i of item.$.requirements.items) {
          const thing = ItemManager.map.get(i);
          if (!thing) continue;

          str += `\`${thing.$.id}\` **${thing.displayName}**`;
        }

        return str;
      }() || "Invalid") + "\n" 
  }

  return str.trim();
}

export function describeItem(invitem?: InventoryItem, creature?: Creature) {
  var str = "";
  
  const item = ItemManager.map.get(invitem?.id ?? "");
  if (!item) return null;

  let lore = item.$.info.lore
  if ((item.$ as ConsumableItemData).info.replacers) {
    lore = replaceLore(lore, (item.$ as ConsumableItemData).info.replacers, creature);
  }

  str += `*${lore}*\n`;
  if (item.$.type === "weapon") {
    str += `Base Damage: **${item.$.base_damage}**\nBase Tech: **${item.$.base_tech}**`;
  }
  str += `\n`;

  if (typeof (invitem as WearableInventoryItem)?.stat_module === "number") {
    let stat_module: ModuleType = (invitem as WearableInventoryItem).stat_module;

    str += `Stat Module: ${ModuleTypeEmoji[stat_module]}${ModuleType[stat_module]}; ${modifiersDescriptor(ItemStatModule.getModifiers(stat_module), ", ")}\n\n`;
  }

  if (((invitem as EquippableInventoryItem)?.modifier_modules?.length ?? 0) > 0) {
    const _mods: string[] = [];
    for (const mod of (invitem as EquippableInventoryItem)?.modifier_modules ?? []) {
      const reference = (item.$ as WearableItemData | WeaponItemData).modifier_module?.mods.get(mod.stat);
      _mods.push(`${namedModifierDescriptor(mod)} _(${reference ? `${`**${
        reference.range[0] === reference.range[1]
        ? ""
        : (100 * invLerp(mod.value, reference.range[0], reference.range[1])).toFixed(1)
      }%**`}` : "Invalid"})_`);
    }
    str += `Modifier Modules: ${_mods.join(", ")}`;
  }


  if (item.$.type === "consumable") {
    const table = LootTables.map.get(item.$.returnTable ?? "");
    if (table)
      str += `\nAfter Use:\n${tableDescriptor(table)}\n\n`;
  } else if (item.$.type !== "generic") {
    if (item.$.type === "wearable") {
      switch (item.$.slot) {
        case "shield": {
          str += `Shield Primer: **${item.$.base_shield}** **${item.$.base_regen}**/t\n`
        } break;
        case "mask": {
          str += `Air Filter: **${item.$.base_filtering}**\n`;
        } break;
        case "jacket": {
          str += `Heat Capacity: **${item.$.base_heat_capacity}**\nInsulation: **${item.$.base_insulation}**\n`
        } break;
        case "vest": {
          str += `Armor **${item.$.base_armor}** | **${item.$.base_dissipate}** Dissipate\n`;
        } break;
        case "gloves": {
          str += `Action Points: **${item.$.base_ap}** **${item.$.base_ap_regen}**/t\nTech: **${item.$.base_tech}**\n`;
        } break;
        case "backpack": {
          str += `Parry **${item.$.base_parry}** | **${item.$.base_deflect}** Deflect\n`;
        } break;
        case "ultimate": {
          const ult = AbilitiesManager.map.get(item.$.ultimate);
          str += `**Ultimate**: **${ult?.$.info.name}**\n`
        } break;
      }
    }

    if (item.$.perks) {
      const perks: string[] = [];
      for (const p of item.$.perks) {
        let perk: CreaturePerk | undefined;
        if (typeof p === "string") {
          perk = PerkManager.map.get(p)
        } else {
          perk = p;
        }

        if (!perk || perk.$.hide?.(creature)) continue;
        
        perks.push(perk.$.info.name);
      }

      str += `**Perks**: **${perks.join("**, **")}**\n`;
    }
    if (item.$.passives) {
      const passives: string[] = [];
      for (const p of item.$.passives) {
        let pef: PassiveEffect | undefined;
        if (typeof p === "string") {
          pef = PassivesManager.map.get(p)
        } else {
          pef = p;
        }

        if (!pef || pef.$.hide?.(creature)) continue;
        
        passives.push(pef.$.info.name);
      }

      str += `**Passives**: **${passives.join("**, **")}**\n`;
    }
    if (item.$.abilities) {
      const abilities: string[] = [];
      for (const p of item.$.abilities) {
        let ab: CreatureAbility | undefined;
        if (typeof p === "string") {
          ab = AbilitiesManager.map.get(p)
        } else {
          ab = p;
        }

        if (!ab) continue;
        
        abilities.push(ab.displayName);
      }

      str += `**Abilities**: **${abilities.join("**, **")}**\n`;

    }

    const scrap: string[] = [];
    if (item.$.scrap) {
      for (const mat in item.$.scrap.materials) {
        const material: number = item.$.scrap.materials[mat as Material];

        if (material !== 0)
          scrap.push(`**${material}** ${capitalize(mat)}`)
      }
      str += `\nScraps for: ${scrap.join(", ")}\n`
    }

    switch (item.$.type) {
      case "weapon": {
        str += 
          `\nWeapon Type: **${DamageMethod[item.$.attack.type]}** | **${capitalize(WeaponCategory[item.$.category].replaceAll(/_/g, " "))}**\n` +
          `- **????Crit** Attack\n${attackDescriptor(item.$.attack.crit)}\n` +
          `- **????Normal** Attack\n${attackDescriptor(item.$.attack.normal)}\n` +
          `- **????Weak** Attack\n${attackDescriptor(item.$.attack.weak)}\n`
      } break;
    }
  }

  return str.trim();
}

export function rollResult(delta: number) {
  if (delta >= 0) return "Pass";
  if (delta < 0) return "Fail";
}

export const DIFFICULTY_MIN = 3;
export const DIFFICULTY_MAX = 20;

export const DICE_ROLL_SIDES = 6;
export const DICE_ROLL_AMOUNT = 2;