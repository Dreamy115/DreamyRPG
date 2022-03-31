import { Client, Guild, NewsChannel, TextChannel } from "discord.js";
import Mongoose from "mongoose";
import { CONFIG, SETTINGS, sleep } from "../..";
import Creature, { CreatureDump } from "../../game/Creature";
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

    SETTINGS.$ = Object.assign(SETTINGS.$, {simspeed: 0});

    interaction.reply({
      content: "Simulation stopped",
      ephemeral: true
    })
    return;
  }
  if (time < 10) {
    interaction.reply({
      content: "Simulation speed must be at least 10 seconds per tick",
      ephemeral: true
    })
    return;
  }
  SETTINGS.$ = Object.assign(SETTINGS.$, {simspeed: time});

  setSim(guild, db, Bot);

  interaction.reply({
    content: "Done!",
    ephemeral: true
  })
})

export async function setSim(guild: Guild, db: typeof Mongoose, Bot: Client) {
  const channel = await guild.channels.fetch(CONFIG.guild?.sim_channel ?? "").catch(() => null);
  if (channel?.isText()) {
    sim_channel = channel;
  }

  if (sim_interval !== null)
    clearInterval(sim_interval);
  
  sim_interval = setInterval(async () => {
    console.log("Ticking...")
    for await (const document of db.connection.collection(Creature.COLLECTION_NAME).find()) {
      try {
        const data = document as CreatureDump;
        const creature: Creature = Creature.cache.get(data._id) ?? new Creature(data);

        if (!(await creature.getFightID(db))) {
          creature.tick();
        }

        if (!creature.$.info.npc && sim_channel) {
          const {embeds} = await infoEmbed(creature, Bot, "stats");
          const msg = await sim_channel.messages.fetch(creature.$.sim_message ?? "").catch(() => null);
          if (msg) {
            try {
              msg.edit({
                embeds: [embeds[0]]
              }).then(() => creature.put(db))
            } catch {
              msg.delete().catch();
              sim_channel.send({
                embeds: [embeds[0]]
              }).then((m) => {
                creature.$.sim_message = m.id;
                creature.put(db)
              })
            }
          } else {
            sim_channel.send({
              embeds: [embeds[0]]
            }).then((m) => {
              creature.$.sim_message = m.id;
              creature.put(db)
            })
          }
        }
        await sleep(500);
      } catch (e) {
        console.error(e);
      }
    }
  }, (SETTINGS.$.simspeed ?? 10) * 1000);
}

export var sim_channel: NewsChannel | TextChannel | null = null;
export var sim_interval: NodeJS.Timer | null = null;