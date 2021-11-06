import Creature from "../../game/Creature.js";
import { ApplicationCommand } from "../commands.js";
import { ceditMenu } from "../component_commands/cedit.js";

export default new ApplicationCommand(
  {
    name: "char",
    description: "Character management for players",
    type: "CHAT_INPUT",
    options: [
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
                name: "Items",
                value: "items"
              },
              {
                name: "Passives",
                value: "passives"
              },
              {
                name: "Attack",
                value: "attack"
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
            type: "STRING"
          }
        ]
      },
      {
        name: "edit",
        description: "Editing",
        type: "SUB_COMMAND"
      }
    ]
  },
  async function (interaction, Bot, db) {
    switch (interaction.options.getSubcommand(true)) {
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
          .then(() => interaction.editReply({ content: "Successfully created your character! Use `/char edit` to finish 'em up." }))
          .catch((e) => {
            console.error(e);
            interaction.editReply({ content: "Something went wrong..." });
          })
      } break;
      case "info": {
        await interaction.deferReply({});

        const char = await Creature.fetch(interaction.options.getString("id") ?? interaction.options.getUser("user")?.id ?? interaction.user.id, db, false).catch(() => null);
        if (!char) {
          interaction.editReply({
            content: "Not found!"
          });
          return;
        }

        interaction.editReply({
          embeds: [await char.infoEmbed(Bot, interaction.options.getString("page", true))]
        })
      } break;
      case "edit": {
        await interaction.deferReply({});

        const char = await Creature.fetch(interaction.user.id, db, false).catch(() => null);
        if (!char) {
          interaction.editReply({
            content: "Not found!"
          });
          return;
        }

        interaction.editReply({
          content: `Editing menu for **${char.$.info.display.name}**`,
          components: ceditMenu(interaction.user.id)
        })
      } break;
    }
  }
)