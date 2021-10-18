import { MessageActionRow, MessageButton } from "discord.js";
import { messageInput } from "../..";
import Creature from "../../game/Creature";
import { ComponentCommand } from "../component_commands";

export default new ComponentCommand(
  "cedit",
  async function (interaction, Bot, db, args) {
    const creature_id = args.shift();
    if (!creature_id) throw new Error("Invalid ID");

    switch(args.shift()) {
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

            if (!interaction.channel) throw new Error("Invalid channel");

            const input = await messageInput(interaction.channel, interaction.user.id);
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

            if (!interaction.channel) throw new Error("Invalid channel");

            const input = await messageInput(interaction.channel, interaction.user.id);
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
        .setLabel("Change Name")
    ])
  ]
}