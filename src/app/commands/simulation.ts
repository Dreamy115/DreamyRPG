import { Client, NewsChannel, TextChannel } from "discord.js";
import Mongoose from "mongoose";
import { CONFIG } from "../..";
import Creature from "../../game/Creature";
import { ApplicationCommandHandler } from "../commands";
import { infoEmbed } from "./char";

import { createPatch } from "rfc6902";

export default new ApplicationCommandHandler({
  name: "simulation",
  description: "Set the simulation speed",
  type: "CHAT_INPUT",
  options: [
    {
      name: "time",
      description: "The amount of time between simulation ticks. Must be at least 10 seconds, or 0 to disable",
      type: "NUMBER",
      required: true
    }
  ]
}, async function(interaction, Bot, db) {
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

  const time = interaction.options.getNumber("time", true);
  if (time === 0) {
    if (sim_interval !== null)
      clearInterval(sim_interval);

    interaction.reply({
      content: "Simulation stopped",
      ephemeral: true
    })
    return;6
  }
  if (time < 10) {
    interaction.reply({
      content: "Simulation speed must be at least 10 seconds per tick",
      ephemeral: true
    })
    return;
  }

  const channel = await guild.channels.fetch(CONFIG.guild?.sim_channel ?? "").catch(() => null);
  if (channel?.isText()) {
    sim_channel = channel;
  } else {
    interaction.reply({
      content: "Invalid Sim-Channel... Proceeding without live-update.",
      ephemeral: true
    })
  }

  if (sim_interval !== null)
    clearInterval(sim_interval);
  
  sim_interval = setInterval(async () => {
    console.log("Ticking...")
    for await (const document of db.connection.collection(Creature.COLLECTION_NAME).find()) {
      try {
        // @ts-expect-error
        const creature = new Creature(document);

        if (!(await creature.getFightID(db))) {
          creature.tick();
        }

        if (!creature.$.info.npc && sim_channel) {
          const {embed} = await infoEmbed(creature, Bot, "stats");
          const msg = await sim_channel.messages.fetch(creature.$.sim_message ?? "").catch(() => null);
          if (msg) {
            try {
              await msg.edit({
                embeds: [embed]
              })
            } catch {
              msg.delete().catch();
              const m = await sim_channel.send({
                embeds: [embed]
              });
              creature.$.sim_message = m.id;
            }
          } else {
            const m = await sim_channel.send({
              embeds: [embed]
            })
            creature.$.sim_message = m.id;
          }
        }
        await creature.put(db);
      } catch (e) {
        console.error(e);
      }
    }
  }, time * 1000);

  interaction.reply({
    content: "Done!",
    ephemeral: true
  })
})

export var sim_channel: NewsChannel | TextChannel | null = null;
export var sim_interval: NodeJS.Timer | null = null;