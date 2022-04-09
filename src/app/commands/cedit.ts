import { ApplicationCommandOptionChoice, MessageEmbed } from "discord.js";
import { capitalize, CONFIG, ItemManager, LootTables } from "../..";
import { CraftingMaterials, Material } from "../../game/Crafting";
import Creature, { Attributes } from "../../game/Creature";
import { DamageCause, DamageGroup, damageLogEmbed, DamageMethod, DamageType, healLogEmbed, HealType, PlatingReaction, ShieldReaction } from "../../game/Damage";
import { ConsumableItemData, createItem, InventoryItem, SpecializedWearableData, UltimateWearableItemData } from "../../game/Items";
import { LootTable } from "../../game/LootTables";
import { replaceLore } from "../../game/LoreReplacer";
import { TrackableStat } from "../../game/Stats";
import { ApplicationCommandHandler } from "../commands";
import { ceditMenu } from "../component_commands/cedit";

export default new ApplicationCommandHandler({
  name: "cedit",
  description: "Creature manipulation for GMs",
  type: "CHAT_INPUT",
  options: [
    {
      name: "changeid",
      description: "Change the ID of the Creature",
      type: "SUB_COMMAND",
      options: [
        {
          name: "cid",
          description: "Find by ID",
          type: "STRING",
          autocomplete: true,
          required: true
        },
        {
          name: "target",
          description: "The new ID",
          type: "STRING",
          autocomplete: true,
          required: true
        },
        {
          name: "npc",
          description: "Change the NPC status (if designating an NPC to a Player or vice-versa)",
          type: "BOOLEAN",
          required: false
        }
      ]
    },
    {
      name: "menu",
      description: "Editing GUI for the regular things",
      type: "SUB_COMMAND",
      options: [
        {
          name: "cid",
          description: "Find by ID",
          type: "STRING",
          autocomplete: true,
          required: true
        }
      ]
    },
    {
      name: "grant_loot",
      description: "Grant some loot from a loot table!",
      type: "SUB_COMMAND",
      options: [
        {
          name: "cid",
          description: "Find by ID",
          type: "STRING",
          autocomplete: true,
          required: true
        },
        {
          name: "loottable",
          description: "Loot table ID",
          type: "STRING",
          autocomplete: true,
          required: true
        }
      ]
    },
    {
      name: "tick",
      description: "Pass the time for the creature",
      type: "SUB_COMMAND",
      options: [
        {
          name: "cid",
          description: "Find by ID",
          type: "STRING",
          autocomplete: true,
          required: true
        },
        {
          name: "amount",
          description: "Amount of ticks to pass",
          type: "INTEGER",
          required: true 
        }
      ]
    },
    {
      name: "damage",
      description: "Apply Damage",
      type: "SUB_COMMAND",
      options: [
        {
          name: "cid",
          description: "Find by ID",
          type: "STRING",
          autocomplete: true,
          required: true
        },
        {
          name: "type",
          description: "Damage Type",
          type: "INTEGER",
          required: true,
          choices: function () {
            const options: ApplicationCommandOptionChoice[] = [];

            for (const type of Object.values(DamageType).filter(x => !isNaN(Number(x)))) {
              options.push({
                name: DamageType[Number(type)],
                value: type
              })
            }

            return options;
          }()
        },
        {
          name: "method",
          description: "Damage Method",
          type: "INTEGER",
          required: true,
          choices: function () {
            const options: ApplicationCommandOptionChoice[] = [];

            for (const type of Object.values(DamageMethod).filter(x => !isNaN(Number(x)))) {
              options.push({
                name: DamageMethod[Number(type)],
                value: type
              })
            }

            return options;
          }()
        },
        {
          name: "amount",
          description: "Amount of damage",
          type: "NUMBER",
          required: true
        },
        {
          name: "dodgeable",
          description: "Does the damage have reduced chance with target's dodge?",
          type: "BOOLEAN",
          required: true
        },
        {
          name: "attacker",
          description: "What attacked the Creature?",
          type: "STRING"
        },
        {
          name: "chance",
          description: "Chance of damaging in %",
          type: "NUMBER"
        },
        {
          name: "penetration",
          description: "Amount of lethality/defiltering",
          type: "INTEGER"
        },
        {
          name: "cutting",
          description: "Tenacity penetration",
          type: "INTEGER"
        },
        {
          name: "shield_reaction",
          description: "How the shield reacts",
          type: "INTEGER",
          choices: function () {
            const options: ApplicationCommandOptionChoice[] = [];

            for (const type of Object.values(ShieldReaction).filter(x => !isNaN(Number(x)))) {
              options.push({
                name: ShieldReaction[Number(type)],
                value: type
              })
            }

            return options;
          }()
        },
        {
          name: "plating_reaction",
          description: "How the plating reacts",
          type: "INTEGER",
          choices: function () {
            const options: ApplicationCommandOptionChoice[] = [];

            for (const type of Object.values(PlatingReaction).filter(x => !isNaN(Number(x)))) {
              options.push({
                name: PlatingReaction[Number(type)],
                value: type
              })
            }

            return options;
          }()
        }
      ]
    },
    {
      name: "heal",
      description: "Heal or Regen resource",
      type: "SUB_COMMAND",
      options: [
        {
          name: "cid",
          description: "Find by ID",
          type: "STRING",
          autocomplete: true,
          required: true
        },
        {
          name: "type",
          description: "The type of heal",
          type: "INTEGER",
          required: true,
          choices: function () {
            const options: ApplicationCommandOptionChoice[] = [];

            for (const type of Object.values(HealType).filter(x => !isNaN(Number(x)))) {
              options.push({
                name: HealType[Number(type)],
                value: Number(type)
              })
            }

            return options;
          }()
        },
        {
          name: "amount",
          description: "Amount to restore",
          type: "NUMBER",
          required: true
        }
      ]
    },
    {
      name: "clear_history",
      description: "Clears Health History of a character",
      type: "SUB_COMMAND",
      options: [
        {
          name: "cid",
          description: "Find by ID",
          type: "STRING",
          autocomplete: true,
          required: true
        }
      ]
    },
    {
      name: "effects",
      description: "Manage the Creature's ActiveEffects",
      type: "SUB_COMMAND_GROUP",
      options: [
        {
          name: "apply",
          description: "Apply an Effect",
          type: "SUB_COMMAND",
          options: [
            {
              name: "cid",
              description: "Find by ID",
              type: "STRING",
              autocomplete: true,
              required: true
            },
            {
              name: "effect_id",
              description: "Effect to apply",
              type: "STRING",
              autocomplete: true,
              required: true
            },
            {
              name: "severity",
              description: "Severity",
              type: "INTEGER",
              required: true
            },
            {
              name: "ticks",
              description: "Amount of ticks for the effect to linger",
              type: "INTEGER",
              required: true
            }
          ]
        },
        {
          name: "clear",
          description: "Clear an effect",
          type: "SUB_COMMAND",
          options: [
            {
              name: "cid",
              description: "Find by ID",
              type: "STRING",
              autocomplete: true,
              required: true
            },
            {
              name: "effect",
              description: "Effect to remove",
              type: "STRING",
              autocomplete: true,
              required: true
            },
            {
              name: "type",
              description: "The type of removal",
              type: "STRING",
              required: true,
              choices: [
                {
                  name: "Simulated Expiration",
                  value: "expire"
                },
                {
                  name: "Straight-Up Delete",
                  value: "delete"
                }
              ]
            }
          ]
        },
        {
          name: "clear_all",
          description: "Clear an effect",
          type: "SUB_COMMAND",
          options: [
            {
              name: "cid",
              description: "Find by ID",
              type: "STRING",
              autocomplete: true,
              required: true
            },
            {
              name: "type",
              description: "The type of removal",
              type: "STRING",
              required: true,
              choices: [
                {
                  name: "Simulated Expiration",
                  value: "expire"
                },
                {
                  name: "Straight-Up Delete",
                  value: "delete"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      name: "items",
      description: "Manage the Creature's Items",
      type: "SUB_COMMAND_GROUP",
      options: [
        {
          name: "add",
          description: "Add an item to Creature's backpack",
          type: "SUB_COMMAND",
          options: [
            {
              name: "cid",
              description: "Find by ID",
              type: "STRING",
              autocomplete: true,
              required: true
            },
            {
              name: "item_id",
              description: "The item to add",
              type: "STRING",
              autocomplete: true,
              required: true
            },
            {
              name: "amount",
              description: "Amount of the item to give",
              type: "INTEGER",
              required: false
            }
          ]
        },
        {
          name: "remove",
          description: "Remove an item from Creature's backpack",
          type: "SUB_COMMAND",
          options: [
            {
              name: "cid",
              description: "Find by ID",
              type: "STRING",
              autocomplete: true,
              required: true
            },
            {
              name: "backpack_item",
              description: "The item to remove",
              type: "STRING",
              autocomplete: true,
              required: true
            }
          ]
        },
        {
          name: "wipe",
          description: "Completly wipe the inventory (Both equipped and backpacked)",
          type: "SUB_COMMAND",
          options: [
            {
              name: "cid",
              description: "Find by ID",
              type: "STRING",
              autocomplete: true,
              required: true
            }
          ]
        }
      ]
    },
    {
      name: "skills",
      description: "Manage the Creature's Skills",
      type: "SUB_COMMAND_GROUP",
      options: [
        {
          name: "add",
          description: "Add an additional skill to Creature",
          type: "SUB_COMMAND",
          options: [
            {
              name: "cid",
              description: "Find by ID",
              type: "STRING",
              autocomplete: true,
              required: true
            },
            {
              name: "skill_id",
              description: "The skill to add",
              type: "STRING",
              autocomplete: true,
              required: true
            }
          ]
        },
        {
          name: "remove",
          description: "Remove an additional skill from Creature",
          type: "SUB_COMMAND",
          options: [
            {
              name: "cid",
              description: "Find by ID",
              type: "STRING",
              autocomplete: true,
              required: true
            },
            {
              name: "unlocked_skill",
              description: "The skill to remove",
              type: "STRING",
              autocomplete: true,
              required: true
            }
          ]
        }
      ]
    },
    {
      name: "schematics",
      description: "Manage the Creature's schematics",
      type: "SUB_COMMAND_GROUP",
      options: [
        {
          name: "add",
          description: "Add an additional skill to Creature",
          type: "SUB_COMMAND",
          options: [
            {
              name: "cid",
              description: "Find by ID",
              type: "STRING",
              autocomplete: true,
              required: true
            },
            {
              name: "schematic_id",
              description: "The schematic to add",
              type: "STRING",
              autocomplete: true,
              required: true
            }
          ]
        },
        {
          name: "remove",
          description: "Remove an additional schematic from Creature",
          type: "SUB_COMMAND",
          options: [
            {
              name: "cid",
              description: "Find by ID",
              type: "STRING",
              autocomplete: true,
              required: true
            },
            {
              name: "unlocked_schematic",
              description: "The skill to remove",
              type: "STRING",
              autocomplete: true,
              required: true
            }
          ]
        }
      ]
    },
    {
      name: "crafting_materials",
      description: "Manage the Creature's materials",
      type: "SUB_COMMAND_GROUP",
      options: [
        {
          name: "set",
          description: "Set the materials amount",
          type: "SUB_COMMAND",
          options: [
            {
              name: "cid",
              description: "Find by ID",
              type: "STRING",
              autocomplete: true,
              required: true
            },
            {
              name: "material",
              description: "The material to set",
              type: "STRING",
              required: true,
              choices: function () {
                const array: ApplicationCommandOptionChoice[] = [];

                for (const mat in new CraftingMaterials({})) {
                  array.push({
                    name: capitalize(mat),
                    value: mat
                  })
                }

                return array;
              }()
            },
            {
              name: "amount",
              description: "The amount to set to",
              type: "INTEGER",
              required: true
            }
          ]
        },
        {
          name: "add",
          description: "Add/remove some materials",
          type: "SUB_COMMAND",
          options: [
            {
              name: "cid",
              description: "Find by ID",
              type: "STRING",
              autocomplete: true,
              required: true
            },
            {
              name: "material",
              description: "The material to add to",
              type: "STRING",
              required: true,
              choices: function () {
                const array: ApplicationCommandOptionChoice[] = [];

                for (const mat in new CraftingMaterials({})) {
                  array.push({
                    name: capitalize(mat),
                    value: mat
                  })
                }

                return array;
              }()
            },
            {
              name: "amount",
              description: "The amount to add. Negative amounts supported",
              type: "INTEGER",
              required: true
            }
          ]
        }
      ]
    },
    {
      name: "ult_stacks",
      description: "Manage the Creature's ult stacks",
      type: "SUB_COMMAND_GROUP",
      options: [
        {
          name: "set",
          description: "Set the stacks amount",
          type: "SUB_COMMAND",
          options: [
            {
              name: "cid",
              description: "Find by ID",
              type: "STRING",
              autocomplete: true,
              required: true
            },
            {
              name: "amount",
              description: "The amount to set to",
              type: "INTEGER",
              required: true
            }
          ]
        },
        {
          name: "add",
          description: "Add/remove stacks",
          type: "SUB_COMMAND",
          options: [
            {
              name: "cid",
              description: "Find by ID",
              type: "STRING",
              autocomplete: true,
              required: true
            },
            {
              name: "amount",
              description: "The amount to add. Negative amounts supported",
              type: "INTEGER",
              required: true
            }
          ]
        }
      ]
    },
    {
      name: "level_set",
      description: "Set the Creature's level",
      type: "SUB_COMMAND",
      options: [
        {
          name: "cid",
          description: "Find by ID",
          type: "STRING",
          autocomplete: true,
          required: true
        },
        {
          name: "amount",
          description: "The level amount",
          type: "INTEGER",
          required: true
        }
      ]
    },
    {
      name: "attributes",
      description: "Set the attributes",
      type: "SUB_COMMAND_GROUP",
      options: [
        {
          name: "clear",
          description: "Reset all attributes to 0",
          type: "SUB_COMMAND",
          options: [
            {
              name: "cid",
              description: "Find by ID",
              type: "STRING",
              autocomplete: true,
              required: true
            }
          ]
        },
        {
          name: "set",
          description: "Set an attribute",
          type: "SUB_COMMAND",
          options: [
            {
              name: "cid",
              description: "Find by ID",
              type: "STRING",
              autocomplete: true,
              required: true
            },
            {
              name: "attribute",
              description: "Which attribute?",
              type: "STRING",
              required: true,
              choices: function () {
                const array: ApplicationCommandOptionChoice[] = [];
    
                for (const a in new Creature({_id: ""}).$.attributes) {
                  array.push({
                    name: a,
                    value: a
                  });
                }
    
                return array;
              }()
            },
            {
              name: "amount",
              description: "Set to what amount? (Typical range 0-8)",
              type: "INTEGER",
              required: true
            }
          ]
        }
      ]
    }
  ],
}, async function (interaction, Bot, db) {
  if (!interaction.isCommand()) return;

  const guild = await Bot.guilds.fetch(CONFIG.guild?.id ?? "");
  await guild.roles.fetch();

  if (guild.id !== interaction.guild?.id) {
    interaction.reply({
      ephemeral: true,
      content: "GM Operations must be on Home Guild"
    });
    return;
  }

  const member = await guild.members.fetch(interaction.user.id).catch(() => null);

  if (!member || !member.roles.cache.has(CONFIG.guild?.gm_role ?? "")) {
    interaction.reply({
      ephemeral: true,
      content: "Not enough permissions (Must be GM)"
    });
    return;
  }

  const [creature,] = await Promise.all([
    Creature.fetch(interaction.options.getString("cid", true).split(" ", 2)[0], db).catch(() => null),
    interaction.deferReply({ephemeral: true})
  ]);

  if (!creature) {
    interaction.editReply({
      content: "Invalid Creature"
    });
    return;
  }

  switch (interaction.options.getSubcommandGroup(false) ?? interaction.options.getSubcommand(true)) {
    case "clear_history": {
      creature.$.vitalsHistory = [];
    } break;
    case "changeid": {
      const target_id = interaction.options.getString("target", true);
      if (!Creature.ID_REGEX.test(target_id)) {
        interaction.editReply({
          content: "Invalid ID"
        });
        return;
      }
      if (await Creature.fetch(target_id, db, true).catch(() => null)) {
        interaction.editReply({
          content: "Already exists!"
        });
        return;
      }
      creature.$._id = target_id;
      creature.$.info.npc = interaction.options.getBoolean("npc", false) ?? creature.$.info.npc;
    } break;
    case "grant_loot": {
      const table = LootTables.map.get(interaction.options.getString("loottable", true));
      if (!table) return;

      const items = LootTable.generate(table.getHighestFromPerks(creature.perkIDs));

      creature.$.items.backpack.push(...function() {
        const arr: InventoryItem[] = [];

        for (const i of items) {
          arr.push(createItem(i));
        }

        return arr;
      }());
      creature.put(db);

      await interaction.editReply({content: "OK"});

      const embed = new MessageEmbed()
        .setColor("AQUA")
        .setTitle("Booty Granted!")
        .setAuthor(creature.displayName, creature.$.info.display.avatar ?? undefined)
        .setFooter(`Creature ID: ${creature.$._id}`)
        .setDescription(`**${creature.displayName}**, enjoy your sweet loot!`)

      for (const i of items) {
        const item = ItemManager.map.get(i);
        const lore = item?.$.info.lore ?? "Such a myserious item... We weren't able to load it!";

        embed.addField(
          `${item?.displayName ?? "Unknown"}`,
          `**${capitalize(item?.$.type ?? "Unknown")}**${
            (item?.$ as (undefined | Exclude<SpecializedWearableData, UltimateWearableItemData>))?.slot
            ? `, ${capitalize((item?.$ as (undefined | Exclude<SpecializedWearableData, UltimateWearableItemData>))?.slot ?? "Unknown")}`
            : ""
          }\n` +
          `*${
            (item?.$ as (undefined | ConsumableItemData))?.info.replacers
            ? replaceLore(lore, (item?.$ as (undefined | ConsumableItemData))?.info.replacers ?? [], creature)
            : lore
          }*`
        )
      }

      interaction.followUp({
        embeds: [embed]
      })
      return;
    } break;
    case "menu": {
      await interaction.editReply({
        content: "OK"
      })
      await interaction.followUp({
        content: `Editing menu for **${creature.displayName}**`,
        components: ceditMenu(creature)
      })
      return;
    } break;
    case "tick": {
      for (var i = 0; i < interaction.options.getInteger("amount", true); i++)
        await creature.tick(db);
    } break;
    case "damage": {
      const damage: DamageGroup = {
        cause: DamageCause.Other,
        method: interaction.options.getInteger("method", true),
        chance: interaction.options.getNumber("chance", false) ?? 100,
        useDodge: interaction.options.getBoolean("dodgeable", true),
        penetration: {
          lethality: interaction.options.getInteger("penetration", false) ?? undefined,
          passthrough: interaction.options.getInteger("penetration", false) ?? undefined,
          cutting: interaction.options.getInteger("cutting", false) ?? undefined
        },
        sources: [{
          type: interaction.options.getInteger("type", true),
          value: interaction.options.getNumber("amount", true),
          shieldReaction: interaction.options.getInteger("shield_reaction", false) ?? ShieldReaction.Normal,
          platingReaction: interaction.options.getInteger("plating_reaction", false) ?? PlatingReaction.Normal
        }],
        from: interaction.options.getString("attacker", false) ?? undefined
      }

      const log = await creature.applyDamage(damage, db);
      await interaction.editReply({content: "OK"});
      interaction.followUp({
        embeds: [await damageLogEmbed(log, db)]
      })
      
      creature.put(db);
      return;
    } break;
    case "heal": {
      await interaction.followUp({
        content: "Saved!"
      });
      interaction.followUp({
        ephemeral: false,
        embeds: [
          await healLogEmbed(await creature.heal({
            from: "Healing GM-Commmand",
            sources: [{
              type: interaction.options.getInteger("type", true),
              value: interaction.options.getNumber("amount", true),
            }]
          }, db), db)
        ]
      });
      creature.put(db);
      return;
    } break;
    case "crafting_materials": {
      const mat = interaction.options.getString("material", true) as Material;

      switch (interaction.options.getSubcommand(true)) {
        case "set": creature.$.items.crafting_materials[mat] = interaction.options.getInteger("amount", true); break;
        case "add": creature.$.items.crafting_materials[mat] += interaction.options.getInteger("amount", true); break;
      }

      creature.$.items.crafting_materials[mat] = Math.max(creature.$.items.crafting_materials[mat], 0);
    } break;
    case "ult_stacks": {
      switch (interaction.options.getSubcommand(true)) {
        case "set": creature.$.abilities.ult_stacks = interaction.options.getInteger("amount", true); break;
        case "add": creature.$.abilities.ult_stacks += interaction.options.getInteger("amount", true); break;
      }

      creature.$.abilities.ult_stacks = Math.max(creature.$.abilities.ult_stacks, 0);
    } break;
    case "effects": {
      switch (interaction.options.getSubcommand(true)) {
        case "apply": {
          await creature.applyActiveEffect({
            id: interaction.options.getString("effect_id", true),
            severity: interaction.options.getInteger("severity", true),
            ticks: interaction.options.getInteger("ticks", true)
          }, db, true)
        } break;
        case "clear": {
          await creature.clearActiveEffect(
            interaction.options.getString("effect", true),
            interaction.options.getString("type", true) as "expire" | "delete",
            db
          )
        } break;
        case "clear_all": {
          await creature.clearAllEffects(
            interaction.options.getString("type", true) as "expire" | "delete",
            db
          )
        } break;
      }
    } break;
    case "items": {
      switch (interaction.options.getSubcommand(true)) {
        case "add": {
          for (var i = 0; i < (interaction.options.getInteger("amount", false) ?? 1); i++)
            creature.$.items.backpack.push(createItem(interaction.options.getString("item_id", true)));
        } break;
        case "remove": {
          const index = creature.$.items.backpack.findIndex(v => v.id === interaction.options.getString("backpack_item", true));
          if (index === -1) {
            interaction.followUp({
              ephemeral: true,
              content: "Item not in backpack!"
            })
            return;
          }
          creature.$.items.backpack.splice(index, 1);
        } break;
        case "wipe": {
          creature.wipeItems();
        } break;
      }
    } break;
    case "skills": {
      switch (interaction.options.getSubcommand(true)) {
        case "add": {
          creature.$.items.skills.add(interaction.options.getString("skill_id", true));
        } break;
        case "remove": {
          creature.$.items.skills.delete(interaction.options.getString("unlocked_skill", true));
        } break;
      }
    } break;
    case "schematics": {
      switch (interaction.options.getSubcommand(true)) {
        case "add": {
          creature.$.items.schematics.add(interaction.options.getString("schematic_id", true));
        } break;
        case "remove": {
          creature.$.items.schematics.delete(interaction.options.getString("unlocked_schematic", true));
        } break;
      }
    } break;
    case "level_set": {
      const amount = interaction.options.getInteger("amount", true);
      if (amount < 1) {
        interaction.followUp({
          ephemeral: true,
          content: "Must be 1 or greater!"
        });
        return;
      }
      creature.$.experience.level = amount;
    } break;
    case "attributes": {
      switch (interaction.options.getSubcommand(true)) {
        case "clear": {
          for (const a in creature.$.attributes) {
            const attr: TrackableStat = creature.$.attributes[a as Attributes];
    
            attr.base = 0;
          }
        } break;
        case "set": {
          const attr: TrackableStat | undefined = creature.$.attributes[interaction.options.getString("attribute", true) as Attributes];
          if (!attr) {
            interaction.followUp({
              ephemeral: true,
              content: "No such attribute!"
            });
            return;
          }
          attr.base = interaction.options.getInteger("amount", true); 
        } break;
      }
    }
  }

  creature.reload();
  await creature.put(db);
  interaction.followUp({
    ephemeral: true,
    content: "Saved!"
  })
})