import { diceRoll } from "../../game/Creature";
import { ApplicationCommandHandler } from "../commands";

export default new ApplicationCommandHandler(
  {
    name: "roll",
    description: "Roll a die",
    type: "CHAT_INPUT",
    options: [
      {
        name: "size",
        type: "INTEGER",
        required: true,
        description: "A positive integer die. Doesn't have to actually exist as long as it's a positive number"
      }
    ]
  },
  async function(interaction, Bot, db) {
    if (!interaction.isCommand()) return;
    const [member,] = await Promise.all([
      interaction.guild?.members.fetch(interaction.user).catch(() => null),
      interaction.deferReply({ephemeral: false})
    ])

    interaction.editReply({
      content: `**${member?.nickname ?? interaction.user.username}** rolled a **${diceRoll(Math.abs(interaction.options.getInteger("size", true)))}**/${Math.abs(interaction.options.getInteger("size", true))}`
    });
  }
)