import { ApplicationCommandOptionChoice, MessageActionRow, MessageButton } from "discord.js";
import { CONFIG, gameLoad, LocationManager } from "../..";
import Creature, { HealType } from "../../game/Creature";
import { DamageCause, DamageGroup, damageLogEmbed, DamageMethod, DamageType, ShieldReaction } from "../../game/Damage";
import { Fight } from "../../game/Fight";
import { TrackableStat } from "../../game/Stats";
import { ApplicationCommandHandler } from "../commands";
import { ceditMenu, gm_ceditMenu } from "../component_commands/cedit";

export default new ApplicationCommandHandler(
  {
    name: "gm",
    description: "Game master stuff",
    options: [
      {
        name: "ccreate",
        description: "Create a Creature",
        type: "SUB_COMMAND",
        options: [
          {
            name: "id",
            description: "An ID",
            type: "STRING",
            required: true
          }
        ]
      },
      {
        name: "cclone",
        description: "Clone a Creature",
        type: "SUB_COMMAND",
        options: [
          {
            name: "old_id",
            description: "Source Creature",
            type: "STRING",
            required: true,
            autocomplete: true
          },
          {
            name: "new_id",
            description: "New Creature",
            type: "STRING",
            required: true
          }
        ]
      },
      {
        name: "ceditmenu",
        description: "Edit a Creature GUI",
        type: "SUB_COMMAND",
        options: [
          {
            name: "cid",
            description: "Find by ID",
            type: "STRING",
            autocomplete: true
          },
          {
            name: "user",
            description: "Find by User",
            type: "USER"
          }
        ]
      },
      {
        name: "cedit_gm",
        description: "Edit a Creature (ADDITIONAL OPTIONS) CLI",
        type: "SUB_COMMAND_GROUP",
        options: [
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
            name: "effect_apply",
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
            name: "effect_clear",
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
            name: "effect_clear_all",
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
          },
          {
            name: "item_add",
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
            name: "item_remove",
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
            name: "skill_add",
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
            name: "skill_remove",
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
          },
          {
            name: "level_set",
            description: "Set the creature's level",
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
            name: "attributes_clear",
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
            name: "attribute_set",
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
      },
      {
        name: "globalmenu",
        description: "Global World management GUI",
        type: "SUB_COMMAND"
      },
      {
        name: "global",
        description: "Global World management CLI",
        type: "SUB_COMMAND_GROUP",
        options: [
          {
            name: "tick",
            description: "Pass the time for everyone",
            type: "SUB_COMMAND",
            options: [
              {
                name: "amount",
                description: "Amount of ticks to pass",
                type: "INTEGER",
                required: true
              }
            ]
          },
          {
            name: "reload",
            description: "Reload the game files",
            type: "SUB_COMMAND"
          },
          {
            name: "regen",
            description: "Regenerate Health Only for everyone after mission",
            type: "SUB_COMMAND"
          }
        ]
      },
      {
        name: "fight",
        description: "Instantiate a fight between Creatures",
        type: "SUB_COMMAND_GROUP",
        options: [
          {
            name: "start",
            description: "Start a Fight",
            type: "SUB_COMMAND",
            options: [
              {
                name: "creatures",
                description: "Comma separate Creatures, and semicolon separate Parties",
                type: "STRING",
                required: true
              }
            ]
          },
          {
            name: "end",
            description: "End a fight",
            type: "SUB_COMMAND",
            options: [
              {
                name: "id",
                description: "Fight ID",
                type: "STRING",
                required: true,
                autocomplete: true
              }
            ]
          },
          {
            name: "reannounce",
            description: "Reannounce a fight message. Has no effect otherwise.",
            type: "SUB_COMMAND",
            options: [
              {
                name: "id",
                description: "Fight ID",
                type: "STRING",
                required: true,
                autocomplete: true
              }
            ]
          }
        ]
      },
      {
        name: "cmove",
        description: "Move characters to Locations",
        type: "SUB_COMMAND_GROUP",
        options: [
          {
            name: "everyone",
            description: "Move everyone to a Location",
            type: "SUB_COMMAND",
            options: [
              {
                name: "location_id",
                description: "ID of the location",
                type: "STRING",
                autocomplete: true,
                required: true
              }
            ]
          },
          {
            name: "bulk",
            description: "Move characters in bulk",
            type: "SUB_COMMAND",
            options: [
              {
                name: "location_id",
                description: "ID of the location",
                type: "STRING",
                autocomplete: true,
                required: true
              },
              {
                name: "creatures",
                description: "Comma separate Creature IDs",
                type: "STRING",
                required: true
              }
            ]
          },
          {
            name: "single",
            description: "Move a single character (easiest, with autocomplete)",
            type: "SUB_COMMAND",
            options: [
              {
                name: "location_id",
                description: "ID of the location",
                type: "STRING",
                autocomplete: true,
                required: true
              },
              {
                name: "creature_id",
                description: "The Creature you want to move",
                type: "STRING",
                autocomplete: true,
                required: true
              }
            ]
          }
        ]
      }
    ]
  },
  async function (interaction, Bot, db) {
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

    switch (interaction.options.getSubcommandGroup(false) ?? interaction.options.getSubcommand()) {
      case "cmove": {
        const location = LocationManager.map.get(interaction.options.getString("location_id", true));
        if (!location) {
          interaction.reply({
            content: "Invalid location"
          })
          return;
        }

        switch (interaction.options.getSubcommand(true)) {
          case "single": {
            const [creature,] = await Promise.all([
              Creature.fetch(interaction.options.getString("creature_id", true), db),
              interaction.deferReply({ephemeral: true})
            ]);

            if (!creature) {
              interaction.editReply({
                content: "Invalid Creature"
              });
              return;
            }

            creature.$.info.location = location.$.id;

            await creature.put(db);
            interaction.editReply({
              content: "Moved!"
            })
          } break;
          case "everyone": {
            await interaction.deferReply({ephemeral: true});

            const cursor = db.connection.collection(Creature.COLLECTION_NAME).find();

            var pre_date = new Date();
            for await (let data of cursor) {
              // @ts-expect-error
              const creature = new Creature(data);

              creature.$.info.location = location.$.id;

              creature.put(db);
            }
            var post_date = new Date();
            
            interaction.followUp({
              ephemeral: true,
              content: `Done in ${(post_date.getMilliseconds() - pre_date.getMilliseconds()) / 1000}s `
            }) 
          } break;
          case "bulk": {
            interaction.deferReply({ephemeral: true})

            const creatures: Promise<Creature|null>[] = [];
            for (const cid of interaction.options.getString("creatures", true).split(/ *, */g)) {
              creatures.push(Creature.fetch(cid, db).catch(() => null));
            }

            let errors = 0;

            var pre_date = new Date();
            for await (const creature of creatures) {
              if (!creature) {
                errors++;
                continue;
              }

              creature.$.info.location = location.$.id;

              creature.put(db);
            }
            var post_date = new Date();

            if (errors) {
              await interaction.followUp({
                ephemeral: true,
                content: `**${errors}**/${creatures.length} Creatures errored`
              })
            }

            interaction.followUp({
              ephemeral: true,
              content: `Done in ${(post_date.getMilliseconds() - pre_date.getMilliseconds()) / 1000}s `
            }) 
          } break;
        }
      } break;
      case "cedit_normal": 
      case "cedit_gm": {
        const [creature,] = await Promise.all([
          Creature.fetch(interaction.options.getString("cid", true), db),
          interaction.deferReply({ephemeral: true})
        ])
        switch (interaction.options.getSubcommand(true)) {
          case "tick": {
            for (var i = 0; i < interaction.options.getInteger("amount", true); i++)
              creature.tick();
          } break;
          case "damage": {
            const damage: DamageGroup = {
              cause: DamageCause.Other,
              method: interaction.options.getInteger("method", true),
              chance: interaction.options.getNumber("chance", false) ?? 100,
              shieldReaction: interaction.options.getInteger("shield_reaction", true),
              useDodge: interaction.options.getBoolean("dodgeable", true),
              penetration: {
                lethality: interaction.options.getInteger("penetration", false) ?? undefined,
                defiltering: interaction.options.getInteger("penetration", false) ?? undefined,
                cutting: interaction.options.getInteger("cutting", false) ?? undefined
              },
              sources: [{
                type: interaction.options.getInteger("type", true),
                value: interaction.options.getNumber("amount", true)
              }]
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
          case "effect_apply": {
            creature.applyActiveEffect({
              id: interaction.options.getString("effect_id", true),
              severity: interaction.options.getInteger("severity", true),
              ticks: interaction.options.getInteger("ticks", true)
            }, true)
          } break;
          case "effect_clear": {
            creature.clearActiveEffect(
              interaction.options.getString("effect", true),
              // @ts-expect-error
              interaction.options.getString("type", true)
            )
          } break;
          case "effect_clear_all": {
            creature.clearAllEffects(
              // @ts-expect-error
              interaction.options.getString("type", true)
            )
          } break;
          case "item_add": {
            creature.$.items.backpack.push(interaction.options.getString("item_id", true));
          } break;
          case "item_remove": {
            const index = creature.$.items.backpack.findIndex(v => v === interaction.options.getString("item", true));
            if (!index) {
              interaction.followUp({
                ephemeral: true,
                content: "Item not in backpack!"
              })
              return;
            }
            creature.$.items.backpack.splice(index, 1);
          }
          case "skill_add": {
            creature.$.items.skills.add(interaction.options.getString("skill_id", true));
          } break;
          case "skill_remove": {
            creature.$.items.skills.delete(interaction.options.getString("unlocked_skill", true));
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
          case "attributes_clear": {
            for (const a in creature.$.attributes) {
              // @ts-expect-error
              const attr: TrackableStat = creature.$.attributes[a];

              attr.base = 0;
            }
          } break;
          case "attribute_set": {
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

        await creature.put(db);
        interaction.followUp({
          ephemeral: true,
          content: "Saved!"
        })
      } break;
      case "ceditmenu": {
        let creature_id = interaction.options.getString("id")?.split(" ")[0] ?? interaction.options.getUser("user")?.id ?? interaction.user.id;

        await interaction.deferReply({});

        const char = await Creature.fetch(creature_id, db, false).catch(() => null);
        if (!char) {
          interaction.editReply({
            content: "Not found!"
          });
          return;
        }

        await interaction.editReply({
          content: `Editing menu for **${char.displayName}**`,
          components: ceditMenu(char)
        })
        interaction.followUp({
          content: "Additional GM-Only editing *(May look more friendly, but CLI is easier, and has more functions. **I stronlgy advise using CLI instead**)*",
          components: gm_ceditMenu(char.$._id)
        })
      } break;
      case "globalmenu": {
        interaction.reply({
          ephemeral: true,
          content: "Global editing",
          components: [
            new MessageActionRow().setComponents([
              new MessageButton()
                .setCustomId("gm/global/advance_time")
                .setStyle("PRIMARY")
                .setLabel("Advance Time"),
              new MessageButton()
                .setCustomId("gm/global/regen")
                .setStyle("PRIMARY")
                .setLabel("Regen After Mission"),
              new MessageButton()
                .setCustomId("gm/global/reload")
                .setStyle("SECONDARY")
                .setLabel("Reload Game")
            ])
          ]
        })
      } break;
      case "global": {
        switch (interaction.options.getSubcommand(true)) {
          case "reload": {
            var r = interaction.reply({
              ephemeral: true,
              content: "Reloading..."
            });
            try {
              gameLoad();
              await r;
            } catch (e) {
              console.log(e);
              interaction.editReply({
                content: "Something went wrong!"
              })
              return;
            }
            interaction.editReply({
              content: "Reloaded!"
            })
          } break;
          case "tick": {
            const amount = interaction.options.getInteger("amount", true);
            if (amount <= 0) {
              interaction.reply({
                content: "Must be at least 1"
              });
              return;
            }
            await interaction.deferReply({ephemeral: true});
            /* SCOPE */ {
              const cursor = db.connection.collection(Creature.COLLECTION_NAME).find();

              var pre_date = new Date();
              for await (let data of cursor) {
                // @ts-expect-error
                const creature = new Creature(data);

                for (var i = 0; i < amount; i++) {
                  creature.tick();
                }

                creature.put(db);
              }
              var post_date = new Date();
              
              interaction.followUp({
                ephemeral: true,
                content: `Done in ${(post_date.getMilliseconds() - pre_date.getMilliseconds()) / 1000}s `
              })
            }
          } break;
          case "regen": {
            await interaction.deferReply({ephemeral: true});

            /* SCOPE */ {
              const cursor = db.connection.collection(Creature.COLLECTION_NAME).find();

              var pre_date = new Date();
              for await (let data of cursor) {
                // @ts-expect-error
                const creature = new Creature(data);

                creature.heal(creature.$.stats.health.value + creature.$.stats.shield.value, HealType.Overheal);
                creature.heal(creature.$.stats.mana.value, HealType.Mana);

                creature.put(db);
              }
              var post_date = new Date();
              
              interaction.followUp({
                ephemeral: true,
                content: `Done in ${(post_date.getMilliseconds() - pre_date.getMilliseconds()) / 1000}s `
              })
            }
          } break;
        }
      } break;
      case "fight": {
        switch (interaction.options.getSubcommand()) {
          case "start": {
            await interaction.deferReply({ ephemeral: true });

            const full: string[] = interaction.options.getString("creatures", true).split(/ *; */g); 
            const parties: string[][] = [];
            for (const p of full) {
              parties.push(p.split(/ *, */g))
            }

            const fight = new Fight({
              parties
            })

            await interaction.editReply({
              content: "Preparing..."
            });

            try {
              await fight.prepare(db).then(() => interaction.editReply({
                content: "Queueing..."
              }));
              await fight.constructQueue(db).then(() => interaction.editReply({
                content: "Done!"
              }));
              await fight.put(db);

              const first = await Creature.fetch(fight.$.queue[0], db);

              first.$.vitals.mana += first.$.stats.mana_regen.value;

              await first.put(db);

            } catch (e: any) {
              console.error(e);
              interaction.editReply({
                content: e?.message
              })
              return;
            }

            await interaction.followUp(
              await fight.announceTurn(db, Bot)
            )
          } break;
          case "end": {
            const fid = interaction.options.getString("id", true);

            const [fight, ] = await Promise.all([
              Fight.fetch(fid, db).catch(() => null),
              interaction.deferReply({ephemeral: true})
            ]);

            if (!fight) {
              interaction.editReply({
                content: "Invalid fight"
              })
              return;
            }

            await fight.delete(db);
            await interaction.editReply({
              content: "Deleted!"
            })
            interaction.followUp(await fight.announceEnd(db, Bot));
          } break;
          case "reannounce": {
            const fid = interaction.options.getString("id", true);

            const [fight, ] = await Promise.all([
              Fight.fetch(fid, db).catch(() => null),
              interaction.deferReply({ephemeral: true})
            ]);

            if (!fight) {
              interaction.editReply({
                content: "Invalid fight"
              })
              return;
            }

            await interaction.editReply({content: "OK"});
            interaction.followUp(await fight.announceTurn(db, Bot))
          }
        }
      } break;
      case "ccreate": {
        await interaction.deferReply({ephemeral: true});

        const cid = interaction.options.getString("id", true);
        if (!Creature.ID_REGEX.test(cid)) {
          interaction.followUp({
            ephemeral: true,
            content: Creature.ID_REGEX_ERR_MSG
          })
          return;
        }

        let creature = await Creature.fetch(cid, db).catch(() => null);
        if (creature) {
          interaction.followUp({
            ephemeral: true,
            content: "Creature already exists"
          })
          return;
        }

        creature = new Creature({
          _id: cid,
          info: {
            npc: true
          }
        })

        await creature.put(db);

        interaction.followUp({
          ephemeral: true,
          content: "Saved new Creature"
        })
      } break;
      case "cclone": {
        await interaction.deferReply({ephemeral: true});

        const new_cid = interaction.options.getString("new_id", true);
        if (!Creature.ID_REGEX.test(new_cid)) {
          interaction.followUp({
            ephemeral: true,
            content: Creature.ID_REGEX_ERR_MSG
          })
          return;
        }
        const old_cid = interaction.options.getString("old_id", true);

        let creature = await Creature.fetch(old_cid, db).catch(() => null);
        if (!creature) {
          interaction.followUp({
            ephemeral: true,
            content: "Nonexistent source Creature"
          })
          return;
        }

        let new_creature = await Creature.fetch(new_cid, db).catch(() => null);
        if (new_creature) {
          interaction.followUp({
            ephemeral: true,
            content: "Creature already exists"
          })
          return;
        }

        let data = JSON.parse(JSON.stringify(creature.dump()));
        data._id = new_cid;
        data.info.npc = true;

        new_creature = new Creature(data);
        await new_creature.put(db);

        interaction.followUp({
          ephemeral: true,
          content: "Saved new Creature"
        })
      } break;
    }
  }
)