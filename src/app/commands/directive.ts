import { Client, Guild, MessageEmbed, NewsChannel, TextChannel } from "discord.js";
import Mongoose from "mongoose";
import { CONFIG, Directives, EffectManager, SETTINGS } from "../..";
import Creature from "../../game/Creature";
import { ApplicationCommandHandler } from "../commands";
import { infoEmbed } from "./char";

import { createPatch } from "rfc6902";
import { GameDirective } from "../../game/GameDirectives";
import { passivesDescriptor, perksDescriptor } from "./handbook";
import { DisplaySeverity, romanNumeral } from "../../game/ActiveEffects";

export default new ApplicationCommandHandler({
  name: "directive",
  description: "Manage or fetch directives",
  type: "CHAT_INPUT",
  options: [
    {
      name: "get",
      description: "Get the directives",
      type: "SUB_COMMAND"
    },
    {
      name: "clear",
      description: "Clear all active directives",
      type: "SUB_COMMAND"
    },
    {
      name: "enable",
      description: "Enable a directive",
      type: "SUB_COMMAND",
      options: [
        {
          name: "directive",
          description: "The directive",
          type: "STRING",
          autocomplete: true,
          required: true
        }
      ]
    },
    {
      name: "disable",
      description: "Disable a directive",
      type: "SUB_COMMAND",
      options: [
        {
          name: "directive",
          description: "The directive",
          type: "STRING",
          autocomplete: true,
          required: true
        }
      ]
    }
  ]
}, async function(interaction, Bot, db) {
  if (!interaction.isCommand()) return;

  if (interaction.options.getSubcommand(false) === "get") {
    const embed = new MessageEmbed()
      .setTitle("Active Directives")

    for (const gd of GameDirective.enabled) {
      embed.addField(
        gd.$.info.name,
        `${gd.$.info.lore}\n\n` + 
        (
          gd.$.passives
          ? `- **Passives**'\n${passivesDescriptor(Array.from(gd.$.passives ?? [])) || "None"}\n`
          : ""  
        ) +
        (
          gd.$.perks
          ? `- **Perks**'\n${perksDescriptor(Array.from(gd.$.perks ?? [])) || "None"}\n`
          : ""  
        ) +
        (
          gd.$.effects
          ? `- **Global Effects**\n${function () {
            var str = "";

            for (const active_effect of gd.$.effects) {
              const effect_data = EffectManager.map.get(active_effect.id);
              if (!effect_data) continue;

              str += `\`${effect_data.$.id}\` **${effect_data.$.info.name}${function(){
                switch (effect_data.$.display_severity) {
                  case DisplaySeverity.NONE:
                  default: return "";
                  case DisplaySeverity.ARABIC: return " " + active_effect.severity;
                  case DisplaySeverity.ROMAN: return " " + romanNumeral(active_effect.severity);
                }
              }()}**\n`;
            }

            return str;
          }() || "None"}\n`
          : ""
        )
      )
    }

    interaction.reply({
      embeds: [embed],
      ephemeral: true
    })
    return;
  }

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

  const did = interaction.options.getString("directive", false);
  let directive: GameDirective | null = null;
  if (did) {
    directive = Directives.map.get(did) ?? null;
    if (!directive) {
      interaction.reply({
        content: "Invalid Directive"
      })
      return;
    }
  }
  
  const directives = new Set<string>(SETTINGS.$.directives);
  switch (interaction.options.getSubcommand(true)) {
    case "enable": {
      directives.add(directive?.$.id ?? "");
    } break;
    case "disable": {
      directives.delete(directive?.$.id ?? "");
    } break;
    case "clear": {
      directives.clear();
    } break;
  }

  if (directives.size > 20) {
    interaction.reply({
      content: "There can be at most 20 directives",
      ephemeral: true
    })
    return;
  }
  SETTINGS.$ = Object.assign(SETTINGS.$, {directives});

  Creature.cache.flushAll();

  interaction.reply({
    content: "Done!",
    ephemeral: true
  })
})