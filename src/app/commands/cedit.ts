import { ApplicationCommandOptionChoice } from "discord.js";
import { capitalize, CONFIG } from "../..";
import { CraftingMaterials } from "../../game/Crafting";
import Creature, { HealType } from "../../game/Creature";
import { DamageType, DamageMethod, ShieldReaction, DamageCause, DamageGroup, damageLogEmbed } from "../../game/Damage";
import { ApplicationCommandHandler } from "../commands";
import { ceditMenu, gm_ceditMenu } from "../component_commands/cedit";

export default new ApplicationCommandHandler({
  name: "cedit",
  description: "Creature manipulation for GMs",
  type: "CHAT_INPUT",
  options: [
    {
      name: "menu",
      description: "Editing GUI if you reaaally need it",
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
      name: "loot",
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

            // @ts-expect-error
            for (const type of Object.values(DamageType).filter(x => !isNaN(x))) {
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

            // @ts-expect-error
            for (const type of Object.values(DamageMethod).filter(x => !isNaN(x))) {
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

            // @ts-expect-error
            for (const type of Object.values(ShieldReaction).filter(x => !isNaN(x))) {
              options.push({
                name: ShieldReaction[Number(type)],
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

            // @ts-expect-error
            for (const type of Object.values(HealType).filter(x => !isNaN(x))) {
              options.push({
                name: HealType[Number(type)],
                value: type
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
  console.log()
  if (!member || !member.roles.cache.has(CONFIG.guild?.gm_role ?? "")) {
    interaction.reply({
      ephemeral: true,
      content: "Not enough permissions (Must be GM)"
    });
    return;
  }

  const [creature,] = await Promise.all([
    Creature.fetch(interaction.options.getString("cid", true), db).catch(() => null),
    interaction.deferReply({ephemeral: true})
  ]);

  if (!creature) {
    interaction.editReply({
      content: "Invalid Creature"
    });
    return;
  }

  switch (interaction.options.getSubcommandGroup(false) ?? interaction.options.getSubcommand(true)) {
    case "menu": {
      await interaction.editReply({
        content: `Editing menu for **${creature.displayName}**`,
        components: ceditMenu(creature)
      })
      interaction.followUp({
        content: "Additional GM-Only editing *(May look more friendly, but CLI is easier, and has more functions. **I stronlgy advise using CLI instead**)*",
        components: gm_ceditMenu(creature.$._id)
      })
    } break;
    case "tick": {
      for (var i = 0; i < interaction.options.getInteger("amount", true); i++)
        creature.tick();
    } break;
    case "damage": {
      const damage: DamageGroup = {
        cause: DamageCause.Other,
        method: interaction.options.getInteger("method", true),
        chance: interaction.options.getNumber("chance", false) ?? 100,
        shieldReaction: interaction.options.getInteger("shield_reaction", false) ?? ShieldReaction.Normal,
        useDodge: interaction.options.getBoolean("dodgeable", true),
        penetration: {
          lethality: interaction.options.getInteger("penetration", false) ?? undefined,
          defiltering: interaction.options.getInteger("penetration", false) ?? undefined,
          cutting: interaction.options.getInteger("cutting", false) ?? undefined
        },
        sources: [{
          type: interaction.options.getInteger("type", true),
          value: interaction.options.getNumber("amount", true)
        }],
        attacker: interaction.options.getString("attacker", true)
      }

      const log = creature.applyDamage(damage);
      await interaction.editReply({content: "OK"});
      interaction.followUp({
        embeds: [damageLogEmbed(log)]
      })
      creature.put(db);
      return;
    } break;
    case "heal": {
      creature.heal(
        interaction.options.getNumber("amount", true),
        interaction.options.getInteger("type", true)
      )
    } break;
    case "crafting_materials": {
      const mat = interaction.options.getString("material", true);

      switch (interaction.options.getSubcommand(true)) {
        // @ts-expect-error
        case "set": creature.$.items.crafting_materials[mat] = interaction.options.getInteger("amount", true); break;
        // @ts-expect-error
        case "add": creature.$.items.crafting_materials[mat] += interaction.options.getInteger("amount", true); break;
      }

      // @ts-expect-error
      creature.$.items.crafting_materials[mat] = Math.max(creature.$.items.crafting_materials[mat], 0);
    } break;
    case "effects": {
      switch (interaction.options.getSubcommand(true)) {
        case "apply": {
          creature.applyActiveEffect({
            id: interaction.options.getString("effect_id", true),
            severity: interaction.options.getInteger("severity", true),
            ticks: interaction.options.getInteger("ticks", true)
          }, true)
        } break;
        case "clear": {
          creature.clearActiveEffect(
            interaction.options.getString("effect", true),
            // @ts-expect-error
            interaction.options.getString("type", true)
          )
        } break;
        case "clear_all": {
          creature.clearAllEffects(
            // @ts-expect-error
            interaction.options.getString("type", true)
          )
        } break;
      }
    } break;
    case "items": {
      switch (interaction.options.getSubcommand(true)) {
        case "add": {
          creature.$.items.backpack.push(interaction.options.getString("item_id", true));
        } break;
        case "remove": {
          const index = creature.$.items.backpack.findIndex(v => v === interaction.options.getString("item", true));
          if (!index) {
            interaction.followUp({
              ephemeral: true,
              content: "Item not in backpack!"
            })
            return;
          }
          creature.$.items.backpack.splice(index, 1);
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
            // @ts-expect-error
            const attr: TrackableStat = creature.$.attributes[a];
    
            attr.base = 0;
          }
        } break;
        case "set": {
          // @ts-expect-error
          const attr: TrackableStat | undefined = creature.$.attributes[interaction.options.getString("attribute", true)];
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

  await creature.put(db);
  interaction.followUp({
    ephemeral: true,
    content: "Saved!"
  })
})