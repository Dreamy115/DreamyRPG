import { Client, MessageEmbed } from "discord.js";
import Creature from "../../game/Creature.js";
import { reductionMultiplier, DAMAGE_TO_INJURY_RATIO, DamageMedium, DamageType } from "../../game/Damage.js";
import { AttackData } from "../../game/Items.js";
import { textStat, ModifierType } from "../../game/Stats.js";
import { SpeciesManager, ClassManager, capitalize, ItemManager, EffectManager } from "../../index.js";
import { ApplicationCommand } from "../commands.js";
import { ceditMenu } from "../component_commands/cedit.js";

export default new ApplicationCommand(
  {
    name: "char",
    description: "Character management for players",
    type: "CHAT_INPUT",
    options: [
      {
        name: "create",
        description: "Create your character if you don't have one yet",
        type: "SUB_COMMAND"
      },
      {
        name: "info",
        description: "Show character make-up",
        type: "SUB_COMMAND",
        options: [
          {
            name: "page",
            description: "Which kind of information?",
            type: "STRING",
            required: true,
            choices: [
              {
                name: "Stats",
                value: "stats"
              },
              {
                name: "Items",
                value: "items"
              },
              {
                name: "Passives",
                value: "passives"
              },
              {
                name: "Attack",
                value: "attack"
              },
              {
                name: "Effects",
                value: "effects"
              }
            ]
          },
          {
            name: "user",
            description: "Find character by user",
            type: "USER"
          },
          {
            name: "id",
            description: "Find character by ID (For NPCs)",
            type: "STRING"
          }
        ]
      },
      {
        name: "edit",
        description: "Editing",
        type: "SUB_COMMAND"
      }
    ]
  },
  async function (interaction, Bot, db) {
    switch (interaction.options.getSubcommand(true)) {
      case "create": {
        await interaction.deferReply({ ephemeral: true });

        const char = await Creature.fetch(interaction.user.id, db, false).catch(() => null);
        console.log(char)
        if (char) {
          interaction.editReply({ content: "Character already exists!" });
          return;
        }

        new Creature({
          _id: interaction.user.id,
          info: {
            npc: false,
            display: {
              name: interaction.user.username,
              avatar: interaction.user.displayAvatarURL({ dynamic: true, size: 64 })
            }
          }
        }).put(db)
          .then(() => interaction.editReply({ content: "Successfully created your character! Use `/char edit` to finish 'em up." }))
          .catch((e) => {
            console.error(e);
            interaction.editReply({ content: "Something went wrong..." });
          })
      } break;
      case "info": {
        await interaction.deferReply({});

        const char = await Creature.fetch(interaction.options.getString("id") ?? interaction.options.getUser("user")?.id ?? interaction.user.id, db, false).catch(() => null);
        if (!char) {
          interaction.editReply({
            content: "Not found!"
          });
          return;
        }

        interaction.editReply({
          embeds: [await infoEmbed(char, Bot, interaction.options.getString("page", true))]
        })
      } break;
      case "edit": {
        await interaction.deferReply({});

        const char = await Creature.fetch(interaction.user.id, db, false).catch(() => null);
        if (!char) {
          interaction.editReply({
            content: "Not found!"
          });
          return;
        }

        interaction.editReply({
          content: `Editing menu for **${char.$.info.display.name}**`,
          components: ceditMenu(interaction.user.id)
        })
      } break;
    }
  }
)

async function infoEmbed(creature: Creature, Bot: Client, page: string): Promise<MessageEmbed> {
  const embed = new MessageEmbed();

  const owner = await Bot.users.fetch(creature.$._id).catch(() => null);

  embed
    .setTitle(creature.$.info.display.name)
    .setAuthor(creature.$.info.npc ? "NPC" : (owner?.tag ?? "Unknown"))
    .setColor("BLUE")
    .setThumbnail(creature.$.info.display.avatar ?? "")

  switch (page) {
    default:
    case "stats": {
      embed.addField(
        "Basic",
        `Race - **${SpeciesManager.map.get(creature.$.info.species ?? "")?.$.info.name ?? "Unknown"}**\n` +  
        `Class - **${ClassManager.map.get(creature.$.info.class ?? "")?.$.info.name ?? "Unknown"}**`  
      ).addFields([
        {
          name: "Vitals",
          inline: false,
          value: 
          `**Health** **${creature.$.vitals.health}**/**${creature.$.stats.health.value - creature.$.vitals.injuries}** (**${Math.round(100 * creature.$.vitals.health / creature.$.stats.health.value)}%**)  *(**${creature.$.stats.health.value}** Health - **${creature.$.vitals.injuries}** Injuries)*\n` +
          (creature.$.stats.shield.value > 0 ? `**Shield** ${textStat(creature.$.vitals.shield, creature.$.stats.shield.value)} **${creature.$.stats.shield_regen.value}**/t` : "No **Shield**") + "\n" +
          `**Mana** ${textStat(creature.$.vitals.mana, creature.$.stats.mana.value)} **${creature.$.stats.mana_regen.value}**/t\n`
        },
        {
          name: "Offense",
          value: 
            `**${creature.$.stats.accuracy.value}%** Accuracy *(Hit Chance)*\n` +
            `Melee **${creature.$.stats.melee.value}** | **${creature.$.stats.ranged.value}** Ranged *(Attack Power)*\n` +
            "\n" +
            `Vamp **${creature.$.stats.vamp.value}%** | **${creature.$.stats.siphon.value}%** Siphon *(Regenerates **health** | **shields** by **%** of damage dealt when dealing **physical** | **energy** damage)*\n` +
            "\n" +
            `**${creature.$.stats.tech.value}** Tech *(Ability Power)*` 
        },
        {
          name: "Defense",
          value:
          `**${creature.$.stats.armor.value}** Armor *(**${Math.round(100 * (1 - reductionMultiplier(creature.$.stats.armor.value)))}%** Reduced Physical Damage)*\n` +
          `**${creature.$.stats.filter.value}** Filter *(**${Math.round(100 * (1 - reductionMultiplier(creature.$.stats.filter.value)))}%** Reduced Energy Damage)*\n` +
          "\n" +
          `**${creature.$.stats.tenacity.value}** Tenacity *(Taking **${Math.round(100 * reductionMultiplier(creature.$.stats.tenacity.value) * DAMAGE_TO_INJURY_RATIO)}%** health damage as **Injuries**)*` +
          "\n" +
          `Parry **${creature.$.stats.parry.value}%** | **${creature.$.stats.deflect.value}%** Deflect *(Reduces hit chance from **Melee** | **Ranged**)*\n`
        }
      ])
    } break;
    case "passives": {
      const passives = creature.findPassives();

      for (var i = 0; i < passives.length && i < 20; i++) {
        const passive = passives[i];

        embed.addField(
          `${passive.$.info.name}`,
          function() {
            var str = `*${passive.$.info.lore}*`;
            if ((passive.$.modifiers ?? []).length > 0) {
              str += `\n- **Modifiers**\n`;
              for (const mod of passive.$.modifiers ?? []) {
                str += `**`;
                switch (mod.type) {
                  case ModifierType.MULTIPLY: str += `${mod.value}x`; break;
                  case ModifierType.ADD_PERCENT: str += `${mod.value >= 0 ? "+" : "-"}${Math.round(Math.abs(mod.value) * 1000) / 10}%`; break;
                  case ModifierType.CAP_MAX: str += `${mod.value}^`; break;
                  case ModifierType.ADD: str += `${mod.value >= 0 ? "+" : "-"}${Math.abs(mod.value)}`; break;
                }
                str += `** ${capitalize(mod.stat.replaceAll(/_/g, " "))}\n`;
              }
            }
            return str;
          }()
        )  
      }    
    } break;
    case "items": {
      embed.setDescription(
        function(creature: Creature) {
          let utilAmount = 0;
          let clothingAmount = 0;
          let weaponAmount = 0;

          for (const i of creature.getAllItemIDs()) {
            const item = ItemManager.map.get(i);
            if (!item) continue;

            switch (item.$.type) {
              case "wearable":
                switch (item.$.subtype) {
                  case "clothing":
                    clothingAmount++;
                    break;
                  case "utility":
                    utilAmount++;
                    break;
                }
                break;
              case "weapon":
                weaponAmount++;
                break;
            }
          }

          return `Clothing **${clothingAmount}**/**${Creature.MAX_EQUIPPED_CLOTHING}**
          Weapons **${weaponAmount}**/**${Creature.MAX_EQUIPPED_WEAPONS + 1}**
          Utility **${utilAmount}**/**${Creature.MAX_EQUIPPED_UTILITY}**`;
        }(creature)
      ).addFields([
        {
          name: "Equipped",
          value: function(creature: Creature) {
            var str = "";

            for (const i of creature.getAllItemIDs()) {
              const item = ItemManager.map.get(i);
              if (!item) continue;

              str += `**${item.$.info.name}** \`${item.$.id}\`\n*${item.$.info.lore}*\n\n`
            }

            return str.trim();
          }(creature) || "Empty"
        },
        {
          name: "Backpack",
          value: function(creature: Creature) {
            var str = "";

            for (const i of creature.$.items.backpack) {
              const item = ItemManager.map.get(i);
              if (!item) continue;

              str += `**${item.$.info.name}** \`${item.$.id}\`\n*${item.$.info.lore}*\n\n`
            }

            return str;
          }(creature) || "Empty"
        }
      ])
    } break;
    case "attack": {
      function attackInfo(creature: Creature, attacks: AttackData[]) {
        var str = "";

        for (const attackdata of attacks) {
          str += `- ${attackdata.type === DamageMedium.Melee ? "Melee" : "Ranged"}
          Sources:
          ${function () {
            var str = "";

            for (const source of attackdata.sources) {
              str += `[**${Math.round(source.flat_bonus + (source.from_skill * (attackdata.type === DamageMedium.Melee ? creature.$.stats.melee.value : creature.$.stats.ranged.value)))} *(${source.flat_bonus} + ${Math.round(100 * source.from_skill) / 100}x)* ${DamageType[source.type]}**]\n`
            }

            return str;
          }()}
          **${attackdata.modifiers.accuracy + creature.$.stats.accuracy.value} *(${creature.$.stats.accuracy.value} ${attackdata.modifiers.accuracy >= 0 ? "+" : "-"}${Math.abs(attackdata.modifiers.accuracy)})*** Accuracy
          **${attackdata.modifiers.lethality}** Lethality
          **${attackdata.modifiers.defiltering}** Defiltering\n\n`;
        }

        return str;
      }

      const attack = creature.attackSet;
      embed.addFields([
        {
          name: "Crit",
          value: attackInfo(creature, attack.crit),
          inline: true
        },
        {
          name: "Normal",
          value: attackInfo(creature, attack.normal),
          inline: true
        },
        {
          name: "Weak",
          value: attackInfo(creature, attack.weak),
          inline: true
        }
      ])
    } break;
    case "effects": {
      for (const effect of creature.$.active_effects) {
        const effectData = EffectManager.map.get(effect.id);
        if (!effectData) continue;
    
        embed.addField(
          `${effectData.$.info.name} ${effect.severity}`,
          `*${effectData.$.info.lore}*\n\nfor **${effect.ticks}** Ticks`
        )
      }

      if (embed.fields.length == 0) {
        embed.setDescription("None");
      }
    } break;
  }

  return embed;
}