import { ApplicationCommand } from "../commands.js";

export default new ApplicationCommand(
  {
    name: "ping",
    description: "Ping!"
  },
  async function(interaction, Bot, db) {
    interaction.reply("Pong!");
  }
)