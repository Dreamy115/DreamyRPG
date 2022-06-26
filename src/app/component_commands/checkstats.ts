import Creature from "../../game/Creature";
import { infoEmbed } from "../commands/char";
import { ComponentCommandHandler } from "../component_commands";

export default new ComponentCommandHandler(
  "checkstats",
  async function(interaction, Bot, db, args) {
    if (!interaction.isSelectMenu()) return;

    const [creature,] = await Promise.all([
      Creature.fetch(interaction.values[0], db),
      interaction.deferReply({ephemeral: true})
    ]);

    await interaction.editReply(await infoEmbed(creature, Bot, db, "stats")); 
  }
)