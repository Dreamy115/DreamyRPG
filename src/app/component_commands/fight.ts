import { CONFIG } from "../..";
import Creature from "../../game/Creature";
import { Fight } from "../../game/Fight";
import { ComponentCommandHandler } from "../component_commands";

export default new ComponentCommandHandler(
  "fight",
  async function (interaction, Bot, db, args) {
    await interaction.deferReply({ ephemeral: true });

    const fight = await Fight.fetch(args.shift() ?? "", db).catch(() => null);
    if (!fight) {
      await interaction.editReply({
        content: "This fight has ended or is invalid"
      });
      return;
    }

    const creature = await Creature.fetch(fight.$.queue[0], db).catch(() => null);

    const guild = await Bot.guilds.fetch(CONFIG.guild?.id ?? "");
    await guild.roles.fetch();

    const member = await guild.members.fetch(interaction.user.id).catch(() => null);
    let IS_GM = true;
    if (!member || !member.roles.cache.has(CONFIG.guild?.gm_role ?? "")) {
      IS_GM = false;
      if (creature?.$._id !== interaction.user.id) {
        interaction.editReply({
          content: "Not enough permissions (Must own Creature or be GM)"
        });
        return;
      }
    } 

    switch (args.shift()) {
      case "endturn": {
        await interaction.editReply({
          content: "OK"
        });
        await fight.advanceTurn(db);
        await interaction.followUp(await fight.announceTurn(db, Bot));
      } break;
    }

    fight.put(db);
  }
)