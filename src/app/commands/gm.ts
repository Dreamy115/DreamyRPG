import { ApplicationCommandOptionChoice, MessageActionRow, MessageButton } from "discord.js";
import { CONFIG, gameLoad, LocationManager } from "../..";
import Creature, { CreatureDump } from "../../game/Creature";
import { DamageCause, DamageGroup, damageLogEmbed, DamageMethod, DamageType, ShieldReaction, HealType } from "../../game/Damage";
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
            for await (let document of cursor) {
              const data = document as CreatureDump;
              const creature: Creature = Creature.cache.get(data._id) ?? new Creature(data);

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
              for await (let document of cursor) {
                const data = document as CreatureDump;
                const creature: Creature = Creature.cache.get(data._id) ?? new Creature(data);

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
              for await (let document of cursor) {
                const data = document as CreatureDump;
                const creature: Creature = Creature.cache.get(data._id) ?? new Creature(data);

                creature.heal({
                  from: "Long-Rest Regen",
                  sources: [{
                    type: HealType.Overheal,
                    value: creature.$.stats.health.value + creature.$.stats.shield.value
                  }]
                });
                creature.heal({
                  from: "Long-Rest Regen",
                  sources: [{
                    value: creature.$.stats.mana.value,
                    type: HealType.Mana
                  }]
                });

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

            try {
              for (const p of parties) {
                for (const c of p) {
                  const creature = await Creature.fetch(c, db, true);
                  const fid = await creature.getFightID(db);
                  if(fid) {
                    interaction.editReply({
                      content: `\`${creature.$._id}\` **${creature.displayName}** is already in fight \`${fid}\``
                    })
                    return;
                  }
                }
              }
            } catch (e) {
              console.error(e);
              interaction.editReply({
                content: "Invalid Creaturelist"
              })
              return;
            }

            const fight = new Fight({
              parties
            })

            await interaction.editReply({
              content: "Preparing..."
            });

            try {
              await fight.prepare(db).then((log) => {
                console.log(log)
                interaction.editReply({
                  content: "Queueing..."
                })
              });
              fight.$.queue.unshift(fight.$.queue[0]);
              fight.advanceTurn(db);

              await fight.constructQueue(db).then(() => interaction.editReply({
                content: "Done!"
              }));
              
              await fight.put(db);

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

            for (const cid of fight.creatures) {
              const char = await Creature.fetch(cid, db).catch(() => null);
              if (!char) continue;
  
              for (const passive of char.passives)
                await passive.$.onFightExit?.(char, fight, db);
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