import { ApplicationCommandData, AutocompleteInteraction, Client, CommandInteraction, Intents, Snowflake, SnowflakeUtil, TextBasedChannels } from "discord.js";
import Mongoose from "mongoose";
import YAML from "yaml";

import fs from "fs";
import path from "path";

var clamp = (amt: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, amt));
}
var capitalize = function (str: string): string {
  const array = str.split(/ +/g);
  array.forEach((v, i, a) => a[i] = v.substr(0, 1).toUpperCase().concat(v.substr(1)));
  
  return array.join(" ");
}
export {clamp, capitalize};

import ApplicationCommandManager from "./app/commands.js";
import ComponentCommandManager from "./app/component_commands.js";
import CreatureSpeciesManager from "./game/Species.js";
import PassiveEffectManager from "./game/PassiveEffects.js";
import ItemsManager from "./game/Items.js";
import CreatureAbilitiesManager from "./game/CreatureAbilities.js";
import ActiveEffectManager from "./game/ActiveEffects.js";
import AutocompleteManager from "./app/autocomplete.js";
import CreaturePerkManager from "./game/Perks.js";
import CreatureSkillManager from "./game/Skills.js";
import CraftingManager from "./game/Crafting.js";
import GameLocationManager from "./game/Locations.js";
import LocationShopsManager from "./game/Shops.js";
import LootTableManager from "./game/LootTables.js";
import DirectiveManager from "./game/GameDirectives.js";

export const ItemManager = new ItemsManager();
export const SpeciesManager = new CreatureSpeciesManager();
export const PassivesManager = new PassiveEffectManager();
export const AbilitiesManager = new CreatureAbilitiesManager();
export const EffectManager = new ActiveEffectManager();
export const SkillManager = new CreatureSkillManager();
export const PerkManager = new CreaturePerkManager();

export const LocationManager = new GameLocationManager();
export const ShopManager = new LocationShopsManager();
export const SchematicsManager = new CraftingManager();

export const LootTables = new LootTableManager();

import { setSim } from "./app/commands/simulation.js";

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
    sim_channel?: string
  }
  cache?: {
    creatureTTL?: number
    creatureCheckPeriod?: number
    fightTTL?: number
    fightCheckPeriod?: number
  }
  documentation?: {
    link?: string
  }
} = YAML.parse(fs.readFileSync(path.join(__dirname, "../config.yml")).toString());

if (!CONFIG.client?.token) throw new Error("client/token not defined in configuration file");
if (!CONFIG.database?.uri) throw new Error("database/uri not defined in configuration file");
if (!CONFIG.guild?.id) throw new Error("guild/id not defined in configuration file");
if (!CONFIG.guild?.gm_role) throw new Error("guild/gm_role not defined in configuration file");
//

export const Directives = new DirectiveManager();

export const SETTINGS = new class Settings {
  private data: {
    simspeed?: number
    directives?: Set<string>
  }
  get $(): Settings["data"] {
    return this.data;
  }
  set $(val: Settings["data"]) {
    fs.writeFileSync(path.join(__dirname, "../settings.yml"), YAML.stringify(val));
    this.data = val ?? {};
  }
  constructor () {
    this.data = {};
  }
  async load(p: fs.PathLike) {
    const read = await fs.promises.readFile(p).then((b) => b.toString()).catch(() => "");
    this.data = YAML.parse(read) ?? {};
  }
}
//
export const db = Mongoose.connect(CONFIG.database.uri).then((v) => {console.log(v.connection); return v});

export function gameLoad() {
  console.log("Loading game items");
  
  ItemManager.load(path.join(__dirname, "game/items"));
  PassivesManager.load(path.join(__dirname, "game/passives"));
  SpeciesManager.load(path.join(__dirname, "game/species"));
  AbilitiesManager.load(path.join(__dirname, "game/abilities"));
  EffectManager.load(path.join(__dirname, "game/effects"));
  SkillManager.load(path.join(__dirname, "game/skills"));
  PerkManager.load(path.join(__dirname, "game/perks"));

  LocationManager.load(path.join(__dirname, "game/locations"));
  ShopManager.load(path.join(__dirname, "game/shops"));
  SchematicsManager.load(path.join(__dirname, "game/schematics"));

  LootTables.load(path.join(__dirname, "game/loottables"));
  
  Directives.load(path.join(__dirname, "game/game_modes"));

  console.log("Loading complete");
}
///

const Bot = new Client({
  intents: [
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MEMBERS
  ]
});

Bot.on("ready", async () => {
  console.log("Bot Ready;", Bot.user?.tag);

  // Loading Bot Stuff
  await ApplicationCommandManager.load(path.join(__dirname, "app/commands"));
  await ComponentCommandManager.load(path.join(__dirname, "app/component_commands"));
  await AutocompleteManager.load(path.join(__dirname, "app/autocomplete"));

  console.log(`/${Array.from(ApplicationCommandManager.map.keys()).length} >${Array.from(ComponentCommandManager.map.keys()).length} Commands loaded`);

  const commandData: ApplicationCommandData[] = [];
  for (const cmd of ApplicationCommandManager.map.values()) {
    commandData.push(cmd.data);
  }

  const guild = await Bot.guilds.fetch(CONFIG.guild?.id ?? "");
  await guild.roles.fetch();
  guild.commands.set(commandData).then(() => console.log(`Commands uploaded to ${guild.id}`)).catch((e) => console.error("Failed uploading commands", e));

  // Loading Game Stuff
  gameLoad();

  // Listeners
  Bot.on("interactionCreate", async (interaction) => {
    if (interaction.isCommand()) {
      const command = ApplicationCommandManager.map.get(interaction.commandName);
      if (!command) {
        console.error(`Missing handler for /${interaction.commandName}`);
        return;
      }

      const executionId = SnowflakeUtil.generate();

      console.log(`/${logCommandInteraction(interaction)}`, `@${interaction.user.id}`);

      console.time(`cmd-${executionId}`);
      await command.executor(interaction, Bot, await db);
      console.timeEnd(`cmd-${executionId}`);

    } else if (interaction.isMessageComponent()) {
      const args = interaction.customId.split(/\//g);
      const commandName = args.shift();
      if (!commandName) return;

      const command = ComponentCommandManager.map.get(commandName);
      if (!command) {
        console.error(`Missing handler for /${commandName}`);
        return;
      }

      const executionId = SnowflakeUtil.generate();

      try {
        console.log(`>${interaction.customId} @${interaction.user.id}`);

        console.time(`cmp-${executionId}`);
        await command.executor(interaction, Bot, await db, args);
      } catch (e) {
        console.error(e);
      } finally {
        console.timeEnd(`cmp-${executionId}`);
      }
    } else if (interaction.isAutocomplete()) {
      const command = AutocompleteManager.map.get(interaction.commandName);
      if (!command) {
        console.error(`Missing handler for A/${interaction.commandName}`);
        return;
      }

      const executionId = SnowflakeUtil.generate();
    
      const focus = interaction.options.getFocused(true);
      console.log(`A/${logCommandInteraction(interaction)} | ${focus.name}`, `@${interaction.user.id}`);

      console.time(`aut-${executionId}`);
      await command.executor(interaction, Bot, await db);
      console.timeEnd(`aut-${executionId}`);
    }
  })

  console.log("Loading Settings...");
  await SETTINGS.load(path.join(__dirname, "../settings.yml")).then(async () => {
    if ((SETTINGS?.$?.simspeed ?? 0) >= 10) {
      setSim(guild, await db, Bot);
    }
  });
  console.log("Loading Settings Complete")
})

Bot.login(CONFIG.client.token);

export async function messageInput(channel: TextBasedChannels, userid: Snowflake, time = 30000) {
  const input = await channel.awaitMessages({
    errors: ["time"],
    max: 1,
    time,
    filter: (msg) => msg.author.id === userid
  }).then((collection) => {
    return collection.first() ?? null;
  }).catch(() => null);

  if (!input) throw new Error("No input");

  return input;
}
export function shuffle(array: any[]): any[] {
  let currentIndex = array.length,  randomIndex;

  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }

  return array;
}

export function limitString(str: string, max_length: number) {
  max_length = Math.max(1, max_length);

  return str.length > 100 ? str.substr(0, max_length - 1) + "…" : str;
}
export function removeVowels(str: string): string {
  return str.replaceAll(/[aeiouy]/gi, "");
}

export async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function removeMarkdown(str: string) {
  return str.replaceAll(/\\(\*|_|`|~|\\)/g, '$1').replace(/(\*|_|`|~|\\)/g, "")
}

export function logCommandInteraction(interaction: CommandInteraction | AutocompleteInteraction): string {
  var str = interaction.commandName + " ";
 
  const subcommandgroup = interaction.options.getSubcommandGroup(false);
  const subcommand = interaction.options.getSubcommand(false);

  const options = (
    subcommandgroup
    ? interaction.options.data[0].options?.[0].options
    : interaction.options.data[0].options
  ) ?? Array.from(interaction.options.data.values())

  if (subcommandgroup) {
    str += subcommandgroup + " "
  }
  if (subcommand) {
    str += subcommand + " "
  }

  for (const option of options) {
    str += `${option.name}:${option.value} `;
  }

  return str.trim();
}

export function rotateLine(x: number, scale: number, y: number) {
  return ((x - y) * scale) + y;
}

export function invLerp(amt: number, min: number, max: number) {
  return (amt - min) / (max - min);
}
export function lerp(amt: number, min: number, max: number) {
  return (1 - amt) * min + amt * max;
}
