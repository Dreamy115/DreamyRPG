import { Message } from "discord.js";
import { CONFIG, gameLoad, messageInput } from "../..";
import Creature, { CreatureDump } from "../../game/Creature";
import { HealType } from "../../game/Damage";
import { ComponentCommandHandler } from "../component_commands";

export default [
  new ComponentCommandHandler(
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

      if (!member || !member.roles.cache.has(CONFIG.guild?.gm_role ?? "")) {
        interaction.reply({
          ephemeral: true,
          content: "Not enough permissions (Must be GM)"
        });
        return;
      }

      const message = interaction.message as Message;

      const channel = interaction.guild
      ? await interaction.guild.channels.fetch(message.channelId ?? (interaction.message as Exclude<typeof interaction.message, Message>).channel_id)
      : await Bot.channels.fetch((interaction.message as Exclude<typeof interaction.message, Message>).channel_id ?? message.channelId)
      
      if (!channel?.isText?.()) throw new Error("Invalid channel");

      switch (args.shift()) {
        case "global": {
          switch (args.shift()) {
            case "advan_time": {
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
                const cursor = db.connection.collection(Creature.COLLECTION_NAME).find();

                var pre_date = new Date();
                for await (let data of cursor) {
                  const document = data as CreatureDump;
                  const creature: Creature = Creature.cache.get(document._id) ?? new Creature(document);

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
            case "regen": {
              await interaction.deferReply({ephemeral: true});

              /* SCOPE */ {
                const cursor = db.connection.collection(Creature.COLLECTION_NAME).find();

                var pre_date = new Date();
                for await (let data of cursor) {
                  const document = data as CreatureDump;
                  const creature: Creature = Creature.cache.get(document._id) ?? new Creature(document);

                  creature.heal({
                    from: "Long-Rest Regen",
                    sources: [{
                      type: HealType.Overheal,
                      value: creature.$.stats.health.value + creature.$.stats.shield.value
                    }]
                  });
                  creature.heal({
                    from: "Long-Rest Regen",
                    sources: [{
                      value: creature.$.stats.mana.value,
                      type: HealType.Mana
                    }]
                  });

                  creature.put(db);
                }
                var post_date = new Date();
                
                interaction.followUp({
                  ephemeral: true,
                  content: `Done in ${(post_date.getMilliseconds() - pre_date.getMilliseconds()) / 1000}s `
                })
              }
            } break;
            case "reload": {
              var r = interaction.reply({
                ephemeral: true,
                content: "Reloading..."
              });
              try {
                gameLoad();
                await r;
              } catch (e) {
                console.log(e);
                interaction.editReply({
                  content: "Something went wrong!"
                })
                return;
              }
              interaction.editReply({
                content: "Reloaded!"
              })
            } break;
          }
        } break;
      }
    }
  )
]