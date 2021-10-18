import { MessageActionRow, MessageButton } from "discord.js";
import { CONFIG, messageInput } from "../..";
import Creature from "../../game/Creature";
import { ComponentCommand } from "../component_commands";

export default new ComponentCommand(
  "cedit",
  async function (interaction, Bot, db, args) {
    const creature_id = args.shift();
    if (!creature_id) throw new Error("Invalid ID");

    if (creature_id !== interaction.user.id) {
      const guild = await Bot.guilds.fetch(CONFIG.guild?.id ?? "");

      if (guild.id !== interaction.guild?.id) {
        interaction.reply({
          ephemeral: true,
          content: "Operations on foreign creatures must be made on the Home Guild"
        });
        return;
      }

      const member = await guild.members.fetch(interaction.user.id).catch(() => null);
      if (!member || !member.roles.cache.has(CONFIG.guild?.gm_role ?? "")) {
        interaction.reply({
          ephemeral: true,
          content: "Not enough permissions (Must own Creature or be GM)"
        });
        return;
      }
    }

    switch(args.shift()) {
      case "delete": {
        await interaction.deferReply({ ephemeral: true });

        const creature = await Creature.fetch(creature_id, db).catch(() => null);
        if (!creature) {
          interaction.editReply({
            content: "Invalid character"
          })
          return;
        }

        await creature.delete(db);
        interaction.editReply({
          content: "Deleted!"
        })
      } break;
      case "edit": {
        await interaction.deferReply({ ephemeral: true });

        const creature = await Creature.fetch(creature_id, db).catch(() => null);
        if (!creature) {
          interaction.editReply({
            content: "Invalid character"
          })
          return;
        }

        switch(args.shift()) {
          case "name": {
            await interaction.followUp({
              ephemeral: true,
              content: "Please input the name in chat. Use `#` to cancel or wait."
            });

            // @ts-expect-error
            const channel = await interaction.guild?.channels.fetch(interaction.message.channel_id).catch(() => null);
            if (!channel?.isText()) throw new Error("Invalid channel");

            const input = await messageInput(channel, interaction.user.id);
            if (input === "#") {
              interaction.followUp({
                ephemeral: true,
                content: "Cancelled"
              });
              return;
            }

            creature.$.info.display.name = input; 
          } break;
          case "avatar": {
            await interaction.followUp({
              ephemeral: true,
              content: "Please input the avatar URL in chat. Use `#` to cancel or wait."
            });

            // @ts-expect-error
            const channel = await interaction.guild?.channels.fetch(interaction.message.channel_id).catch(() => null);
            if (!channel?.isText()) throw new Error("Invalid channel");

            const input = await messageInput(channel, interaction.user.id);
            if (input === "#") {
              interaction.followUp({
                ephemeral: true,
                content: "Cancelled"
              });
              return;
            }

            creature.$.info.display.avatar = input; 
          } break;
        }

        await creature.put(db);
        interaction.followUp({
          ephemeral: true,
          content: "Saved!"
        })
      } break;
    }
  }
)

export function ceditMenu(creature_id: string): MessageActionRow[] {
  return [
    new MessageActionRow().addComponents([
      new MessageButton()
        .setCustomId(`cedit/${creature_id}/edit/name`)
        .setStyle("SECONDARY")
        .setLabel("Change Name"),
      new MessageButton()
        .setCustomId(`cedit/${creature_id}/edit/avatar`)
        .setStyle("SECONDARY")
        .setLabel("Change Avatar")
    ]),
    new MessageActionRow().addComponents([
      new MessageButton()
        .setCustomId(`cedit/${creature_id}/delete`)
        .setStyle("DANGER")
        .setLabel("Delete")
    ])
  ]
}