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
              content: "Done!"
            });

            await fight.constructQueue(db);
            await interaction.followUp(
              await fight.announceTurn(db, Bot)
            )
          } break;
        }
      } break;
    }
  }
)