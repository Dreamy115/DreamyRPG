import { ApplicationCommandData, Client, Intents, Snowflake, SnowflakeUtil, TextBasedChannels, TextChannel, User } from "discord.js";
import Mongoose from "mongoose";
import YAML from "yaml";

import fs from "fs";
import path from "path";

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import ApplicationCommandManager from "./app/commands.js";
import ComponentCommandManager from "./app/component_commands.js";
import CreatureSpeciesManager from "./game/Species.js";
import PassiveEffectManager from "./game/PassiveEffects.js";
import { DAMAGE_TO_INJURY_RATIO, reductionMultiplier } from "./game/Damage.js";
import ItemsManager from "./game/Items.js";
import CreatureClassManager from "./game/Classes.js";

process.on("uncaughtException", (e) => {
  console.error(e);
})

/// Global Variables
export const CONFIG: {
  client?: {
    token?: string
  }
  database?: {
    uri?: string
  }
  guild?: {
    id?: string
    gm_role?: string
  }
} = YAML.parse(fs.readFileSync(path.join(__dirname, "../config.yml")).toString());

if (!CONFIG.client?.token) throw new Error("client/token not defined in configuration file");
if (!CONFIG.database?.uri) throw new Error("database/uri not defined in configuration file");
if (!CONFIG.guild?.id) throw new Error("guild/id not defined in configuration file");
if (!CONFIG.guild?.gm_role) throw new Error("guild/gm_role not defined in configuration file");

//
export const db = Mongoose.connect(CONFIG.database.uri).then((v) => {console.log(v.connection); return v});

export const AppCmdManager = new ApplicationCommandManager();
export const CmpCmdManager = new ComponentCommandManager();

export const ItemManager = new ItemsManager();
export const ClassManager = new CreatureClassManager();
export const SpeciesManager = new CreatureSpeciesManager();
export const PassivesManager = new PassiveEffectManager();
///

const Bot = new Client({
  intents: [
    Intents.FLAGS.GUILD_MESSAGES
  ]
});

Bot.on("ready", async () => {
  console.log("Bot Ready;", Bot.user?.tag);

  // Loading Bot Stuff
  await AppCmdManager.load(path.join(__dirname, "app/commands"));
  await CmpCmdManager.load(path.join(__dirname, "app/component_commands"));

  console.log(`/${Array.from(AppCmdManager.map.keys()).length} >${Array.from(CmpCmdManager.map.keys()).length} Commands loaded`);

  const commandData: ApplicationCommandData[] = [];
  for (const cmd of AppCmdManager.map.values()) {
    commandData.push(cmd.data);
  }

  const guild = await Bot.guilds.fetch(CONFIG.guild?.id ?? "");
  guild.commands.set(commandData).then(() => console.log(`Commands uploaded to ${guild.id}`)).catch(() => console.error("Failed uploading commands"));

  // Loading Game Stuff
  ItemManager.load(path.join(__dirname, "game/items"));
  ClassManager.load(path.join(__dirname, "game/classes"));
  PassivesManager.load(path.join(__dirname, "game/passives"));
  SpeciesManager.load(path.join(__dirname, "game/species"));

  // Listeners
  Bot.on("interactionCreate", async (interaction) => {
    if (interaction.isCommand()) {
      const command = AppCmdManager.map.get(interaction.commandName);
      if (!command) {
        console.error(`Missing handler for /${interaction.commandName}`);
        return;
      }

      const executionId = SnowflakeUtil.generate();

      console.log(`/${interaction.commandName} @${interaction.user.id}`);

      console.time(`cmd-${executionId}`);
      await command.run(interaction, Bot, await db);
      console.timeEnd(`cmd-${executionId}`);

    } else if (interaction.isMessageComponent()) {
      const args = interaction.customId.split(/\//g);
      const commandName = args.shift();
      if (!commandName) return;

      const command = CmpCmdManager.map.get(commandName);
      if (!command) {
        console.error(`Missing handler for /${commandName}`);
        return;
      }

      const executionId = SnowflakeUtil.generate();

      try {
        console.log(`>${interaction.customId} @${interaction.user.id}`);

        console.time(`cmp-${executionId}`);
        await command.run(interaction, Bot, await db, args);
      } catch (e) {
        console.error(e);
      } finally {
        console.timeEnd(`cmp-${executionId}`);
      }
    }
  })
})

Bot.login(CONFIG.client.token);


export async function messageInput(channel: TextBasedChannels, userid: Snowflake, time = 10000) {
  const input = await channel.awaitMessages({
    errors: ["time"],
    max: 1,
    time,
    filter: (msg) => msg.author.id === userid
  }).then((collection) => {
    return collection.first() ?? null;
  }).catch(() => null);

  if (!input) throw new Error("No input");

  input.delete();
  return input.content;
}