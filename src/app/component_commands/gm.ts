import { CONFIG, messageInput } from "../..";
import Creature from "../../game/Creature";
import { ComponentCommand } from "../component_commands";

export default [
  new ComponentCommand(
    "gm",
    async function(interaction, Bot, db, args) {
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

      // @ts-expect-error
      const channel = interaction.message.channel ?? await interaction.guild?.channels.fetch(interaction.message.channel_id ?? interaction.message.channelId).catch(() => null);
      if (!channel?.isText?.()) throw new Error("Invalid channel");

      switch (args.shift()) {
        case "global": {
          switch (args.shift()) {
            case "advance_time": {
              await interaction.reply({
                ephemeral: true,
                content: "Please input the amount of ticks in chat as an Integer.\n**WARNING!** This will load every Creature and tick them individually. If your database of Creatures is a bit large it might take a while."
              })

              var inputmsg = await messageInput(channel, interaction.user.id).catch(() => "#");
              if (inputmsg === "#") {
                interaction.followUp({
                  ephemeral: true,
                  content: "Cancelled"
                });
                return;
              }

              let input = Number(inputmsg);
              if (isNaN(input) || input <= 0) {
                interaction.followUp({
                  ephemeral: true,
                  content: "The amount of time must be a positive integer."
                });
                return;
              }

              /* SCOPE */ {
                const cursor = db.connection.collection("Creatures").find();

                var pre_date = new Date();
                for await (let data of cursor) {
                  // @ts-expect-error
                  const creature = new Creature(data);

                  for (var i = 0; i < input; i++) {
                    creature.tick();
                  }

                  creature.put(db);
                }
                var post_date = new Date();
                
                interaction.followUp({
                  ephemeral: true,
                  content: `Done in ${(post_date.getMilliseconds() - pre_date.getMilliseconds()) / 1000}s `
                })
              }

            } break;
          }
        } break;
      }
    }
  )
]