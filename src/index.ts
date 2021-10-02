import { ApplicationCommandData, Client, Intents, SnowflakeUtil } from "discord.js";
import Mongoose from "mongoose";
import YAML from "yaml";

import fs from "fs";
import path from "path";

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import ApplicationCommandManager from "./app/commands.js";
import ComponentCommandManager from "./app/component_commands.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


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
export const db = await Mongoose.connect(CONFIG.database.uri).then((v) => {console.log(v.connection); return v});

export const AppCmdManager = new ApplicationCommandManager();
export const CmpCmdManager = new ComponentCommandManager();
///

const Bot = new Client({
  intents: [
    Intents.FLAGS.GUILD_MESSAGES
  ]
});

Bot.on("ready", async () => {
  console.log("Bot Ready;", Bot.user?.tag);

  await AppCmdManager.load(path.join(__dirname, "app/commands"));
  await CmpCmdManager.load(path.join(__dirname, "app/commands"));

  console.log(`/${Array.from(AppCmdManager.map.keys()).length} >${Array.from(CmpCmdManager.map.keys()).length} Commands loaded`);

  const commandData: ApplicationCommandData[] = [];
  for (const cmd of AppCmdManager.map.values()) {
    commandData.push(cmd.data);
  }

  const guild = await Bot.guilds.fetch(CONFIG.guild?.id ?? "");
  guild.commands.set(commandData).then(() => console.log(`Commands uploaded to ${guild.id}`)).catch(() => console.error("Failed uploading commands"));

  Bot.on("interactionCreate", async (interaction) => {
    if (interaction.isCommand()) {
      const command = AppCmdManager.map.get(interaction.commandName);
      if (!command) {
        console.error(`Missing handler for /${interaction.commandName}`);
        return;
      }

      const executionId = SnowflakeUtil.generate();

      console.log(`/${interaction.commandName} @${interaction.user.id}`)

      console.time(`cmd-${executionId}`);
      await command.run(interaction, Bot, db);
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
        console.log(`>${interaction.customId} @${interaction.user.id}`)

        console.time(`cmp-${executionId}`);
        await command.run(interaction, Bot, db, args);
      } catch (e) {
        console.error(e);
      } finally {
        console.timeEnd(`cmp-${executionId}`);
      }
    }
  })
})

Bot.login(CONFIG.client.token);