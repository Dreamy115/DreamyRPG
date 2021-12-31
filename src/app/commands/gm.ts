import { MessageActionRow, MessageButton } from "discord.js";
import { CONFIG, LocationManager } from "../..";
import Creature from "../../game/Creature";
import { Fight } from "../../game/Fight";
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
        name: "cedit",
        description: "Edit a Creature",
        type: "SUB_COMMAND",
        options: [
          {
            name: "id",
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
        name: "global",
        description: "Global World management",
        type: "SUB_COMMAND"
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
      case "cedit": {
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
          content: "Additional GM-Only editing",
          components: gm_ceditMenu(char.$._id)
        })
      } break;
      case "global": {
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