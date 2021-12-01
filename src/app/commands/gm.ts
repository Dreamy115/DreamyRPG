import { MessageActionRow, MessageButton } from "discord.js";
import { CONFIG } from "../..";
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
            required: true
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
            type: "STRING"
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
      case "cedit": {
        let creature_id = interaction.options.getString("id") ?? interaction.options.getUser("user")?.id ?? interaction.user.id;

        await interaction.deferReply({});

        const char = await Creature.fetch(creature_id, db, false).catch(() => null);
        if (!char) {
          interaction.editReply({
            content: "Not found!"
          });
          return;
        }

        await interaction.editReply({
          content: `Editing menu for **${char.$.info.display.name}**`,
          components: ceditMenu(creature_id)
        })
        interaction.followUp({
          content: "Additional GM-Only editing",
          components: gm_ceditMenu(creature_id)
        })
      } break;
      case "global": {
        interaction.reply({
          ephemeral: true,
          content: "Global editing",
          components: [
            new MessageActionRow().addComponents([
              new MessageButton()
                .setCustomId("gm/global/advance_time")
                .setStyle("PRIMARY")
                .setLabel("Advance Time")
            ])
          ]
        })
      } break;
      case "fight": {
        switch (interaction.options.getSubcommand()) {
          case "start": {
            await interaction.deferReply({ ephemeral: true });

            const full: string[] = interaction.options.getString("creatures", true).split(";"); 
            const parties: string[][] = [];
            for (const p of full) {
              parties.push(p.split(/,/g))
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
              }));;
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

            await fight.delete(db);
            interaction.editReply({
              content: "Deleted!"
            })
            interaction.followUp({
              ephemeral: false,
              embeds: (await fight.announceEnd(db, Bot)).embeds
            });
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

        const old_cid = interaction.options.getString("old_id", true);
        const new_cid = interaction.options.getString("new_id", true);

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