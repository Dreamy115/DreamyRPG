import { Client, EmbedFieldData, MessageActionRow, MessageEmbed, MessageSelectMenu } from "discord.js";
import { DisplaySeverity, replaceEffectLore, romanNumeral } from "../../game/ActiveEffects.js";
import Creature from "../../game/Creature.js";
import { replaceLore } from "../../game/CreatureAbilities.js";
import { reductionMultiplier, DAMAGE_TO_INJURY_RATIO, DamageMedium, DamageType } from "../../game/Damage.js";
import { CombatPosition } from "../../game/Fight.js";
import { AttackData } from "../../game/Items.js";
import { deltaHeatInfo } from "../../game/Locations.js";
import { PassiveModifier } from "../../game/PassiveEffects.js";
import { textStat, ModifierType, TrackableStat } from "../../game/Stats.js";
import { SpeciesManager, ClassManager, capitalize, ItemManager, EffectManager, AbilitiesManager, CONFIG, RecipeManager, PerkManager, LocationManager, limitString } from "../../index.js";
import { bar_styles, make_bar } from "../Bars.js";
import { ApplicationCommandHandler } from "../commands.js";
import { attributeComponents, ceditMenu } from "../component_commands/cedit.js";
import { modifierDescriptor } from "./handbook.js";

export default new ApplicationCommandHandler(
  {
    name: "char",
    description: "Character management for players",
    type: "CHAT_INPUT",
    options: [
      {
        name: "rollfor",
        description: "Roll for a stat check",
        type: "SUB_COMMAND",
        options: [
          {
            name: "id",
            description: "Find character by ID",
            type: "STRING",
            autocomplete: true
          },
          {
            name: "bonus",
            description: "Modify the check",
            type: "INTEGER"
          }
        ]
      },
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
                name: "Schematics",
                value: "schematics"
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
                name: "Abilities",
                value: "abilities"
              },
              {
                name: "Effects",
                value: "effects"
              },
              {
                name: "Attributes",
                value: "attributes"
              },
              {
                name: "All Active Modifiers",
                value: "modifiers"
              },
              {
                name: "Perks",
                value: "perks"
              },
              {
                name: "Skills",
                value: "skills"
              },
              {
                name: "Location",
                value: "location"
              },
              {
                name: "Raw Data (Debug)",
                value: "debug"
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
            type: "STRING",
            autocomplete: true
          }
        ]
      },
      {
        name: "editmenu",
        description: "Editing",
        type: "SUB_COMMAND"
      },
      {
        name: "craft",
        description: "Craft an item",
        type: "SUB_COMMAND",
        options: [
          {
            name: "recipe_id",
            description: "The ID of the recipe to craft",
            autocomplete: true,
            required: true,
            type: "STRING"
          }
        ]
      },
      {
        name: "shop",
        description: "Buy menu!",
        type: "SUB_COMMAND",
        options: [
          {
            name: "page",
            description: "Which page to display?",
            type: "INTEGER"
          }
        ]
      },
      {
        name: "say",
        description: "Say as character",
        type: "SUB_COMMAND",
        options: [
          {
            name: "id",
            description: "Find character by ID",
            type: "STRING",
            autocomplete: true,
            required: true
          },
          {
            name: "message",
            description: "Say something!",
            type: "STRING",
            required: true
          }
        ]
      }
    ]
  },
  async function (interaction, Bot, db) {
    if (!interaction.isCommand()) return;

    switch (interaction.options.getSubcommand(true)) {
      case "rollfor": {
        const [creature,] = await Promise.all([
          Creature.fetch(interaction.options.getString("id", false) ?? interaction.user.id, db).catch(() => null),
          interaction.deferReply({ephemeral: true})
        ]);

        if (!creature) {
          interaction.editReply({
            content: "Invalid creature"
          })
          return;
        }

        interaction.editReply({
          content: `Select a stat (with **${interaction.options.getInteger("bonus", false) ?? 0}** bonus)`,
          components: attributeComponents(creature, "", `rollstat/$ID/$ATTR/${interaction.options.getInteger("bonus", false) ?? 0}`)
        })
      } break;
      case "shop": {
        const [creature,] = await Promise.all([
          Creature.fetch(interaction.user.id, db),
          interaction.deferReply({ephemeral: true})
        ])

        if (!creature.$.info.locked) {
          interaction.editReply({
            content: "Need to lock in before using shops."
          })
          return;
        }

        const location = creature.location;
        if (!location?.shop) {
          interaction.editReply({
            content: "No shop available here."
          })
          return;
        }

        const embed = new MessageEmbed()
          .setTitle(location.shop.$.info.name)
          .setDescription(location.shop.$.info.lore)
          .setFooter(location.shop.$.id)
          .setColor("AQUA")

        const components: MessageActionRow[] = [
          new MessageActionRow().setComponents([
            new MessageSelectMenu()
              .setCustomId(`cedit/${creature.$._id}/edit/buy`)
              .setPlaceholder("Buy something...")
          ])
        ]; 

        for (var i = 25 * Math.abs((interaction.options.getInteger("page", false) ?? 1) - 1); i < 25; i++) {
          // @ts-expect-error
          const content = location.shop.$.content[i];
          if (!content) break;

          switch (content.type) {
            default: continue;
            case "item": {
              const item = ItemManager.map.get(content.id);
              if (!item) continue;
              // @ts-expect-error
              components[0].components[0]?.addOptions({
                label: item.$.info.name,
                value: String(i),
                description: `[${i}] Item`
              })

              embed.addField(
                `[${i}] Item - ${item.$.info.name} \`${item.$.id}\``,
                `*${item.$.info.lore}*\n\n${function(){
                  var arr: string[] = [];
                  for (const mat in content.cost) {
                    // @ts-expect-error
                    arr.push(`**${content.cost[mat]}** ${capitalize(mat)}`)
                  }

                  return arr.join(", ");
                }()}`
              )
            } break;
            case "service": {
              // @ts-expect-error
              components[0].components[0]?.addOptions({
                label: content.info.name,
                value: String(i),
                description: `[${i}] Service`
              })

              embed.addField(
                `[${i}] Service - ${content.info.name}`,
                `*${content.info.lore}*\n\n${function(){
                  var arr: string[] = [];
                  for (const mat in content.cost) {
                    // @ts-expect-error
                    arr.push(`**${content.cost[mat]}** ${capitalize(mat)}`)
                  }

                  return arr.join(", ");
                }()}`
              )
            }
          }
        }

        components[0].components[0]
          // @ts-expect-error
          .setMaxValues(components[0].components[0].options.length)
          .setMinValues(1)

        interaction.editReply({
          components,
          embeds: [embed]
        })
      } break;
      case "craft": {
        const recipe = RecipeManager.map.get(interaction.options.getString("recipe_id", true));
        if (!recipe?.$.id) return;
        
        const result = ItemManager.map.get(recipe.$.result);
        if (!result?.$.id) return;

        const [creature,] = await Promise.all([
          Creature.fetch(interaction.user.id, db),
          interaction.deferReply({ephemeral: true})
        ])

        try {
          if (!creature.schematics.has(recipe.$.id)) throw new Error("Doesn't have the schematic");
          if (recipe.$.requirements.enhancedCrafting && !creature.location?.$.hasEnhancedCrafting) throw new Error("You cannot craft this item in this location. Go to an area with Enhanced Crafting");

          var perks = creature.perks;
          for (const p of recipe.$.requirements.perks ?? []) {
            const perk = PerkManager.map.get(p);
            if (!perk) continue;

            if (!perks.find((v) => v.$.id === perk.$.id)) throw new Error(`Must have ${perk.$.info.name} (${perk.$.id}) perk`)
          }
          for (const mat in recipe.$.requirements.materials) {
            // @ts-expect-error
            const material: number = recipe.$.requirements.materials[mat];

            // @ts-expect-error
            if (creature.$.items.crafting_materials[mat] < material) throw new Error(`Not enough materials; need more ${capitalize(mat)}`)
          }
          for (const i of recipe.$.requirements.items ?? []) {
            const item = ItemManager.map.get(i);
            if (!item) continue;

            if (!creature.$.items.backpack.includes(item.$.id ?? "")) throw new Error(`Item ${item.$.info.name} (${item.$.id}) is missing (must be unequipped to count)`)
          }
        } catch (e: any) {
          interaction.editReply({
            content: `Your character doesn't meet the requirements:\n*${e?.message}*`
          });
          return;
        }

        for (const i of recipe.$.requirements.items ?? []) {
          const item = ItemManager.map.get(i);
          if (!item) continue;

          creature.$.items.backpack.splice(creature.$.items.backpack.findIndex(v => v === item.$.id), 1);
        }
        for (const mat in recipe.$.requirements.materials) {
          // @ts-expect-error
          creature.$.items.crafting_materials[mat] -= recipe.$.requirements.materials[mat];
        }

        creature.$.items.backpack.push(result.$.id);

        await creature.put(db);

        interaction.editReply({
          content: `You got **${result.$.info.name}**!`
        })
      } break;
      case "say": {
        const channel = await interaction.guild?.channels.fetch(interaction.channelId);
        if (!channel?.isText() || channel.isThread()) {
          interaction.reply({
            ephemeral: true,
            content: "Channel does not support webhooks"
          });
          return;
        }

        const [creature, member] = await Promise.all([
          Creature.fetch(interaction.options.getString("id", true), db).catch(() => null),
          interaction.guild?.members.fetch(interaction.user).catch(() => null),
          interaction.reply({content: `Awaiting dialogue...`})
        ]);
        
        if (!member) {
          interaction.editReply({
            content: "Dialogue: Invalid guild member. (4s)"
          })
          setTimeout(() => {
            interaction.deleteReply().catch();
          }, 4000)
          return;
        }
        if (!creature) {
          interaction.editReply({
            content: "Dialogue: Invalid character. (4s)"
          })
          setTimeout(() => {
            interaction.deleteReply().catch();
          }, 4000)
          return;
        }

        if (creature.$._id !== interaction.user.id && !member.roles.cache.has(CONFIG.guild?.gm_role ?? "")) {
          interaction.editReply({
            content: "Dialogue: To use someone else's character, you must be a GM (4s)"
          })
          setTimeout(() => {
            interaction.deleteReply().catch();
          }, 4000)
          return;
        }

        const wh = await channel.createWebhook(
          creature.displayName, {
            reason: "DreamyRPG Proxy",
            avatar: creature.$.info.display.avatar
          }
        )

        wh.send({
          content: interaction.options.getString("message", true)
        }).finally(() => {
          interaction.deleteReply();
          wh.delete();
        }).catch(console.error)

      } break;
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
          .then(() => interaction.editReply({ content: "Successfully created your character! Use `/char editmenu` to finish 'em up." }))
          .catch((e) => {
            console.error(e);
            interaction.editReply({ content: "Something went wrong..." });
          })
      } break;
      case "info": {
        await interaction.deferReply({});

        const char = await Creature.fetch(interaction.options.getString("id", false)?.split(" ")[0] ?? interaction.options.getUser("user")?.id ?? interaction.user.id, db, false).catch(() => null);
        if (!char) {
          interaction.editReply({
            content: "Not found!"
          });
          return;
        }

        const page = interaction.options.getString("page", true);

        if (page === "location" && char.$.info.npc) {
          const guild = await Bot.guilds.fetch(CONFIG.guild?.id ?? "");
          await guild.roles.fetch();
      
          const member = await guild.members.fetch(interaction.user.id).catch(() => null);
          if (!member || !member.roles.cache.has(CONFIG.guild?.gm_role ?? "")) {
            interaction.editReply({
              content: "Only GMs can access NPC location information"
            })
            return;
          } 
        }

        interaction.editReply({
          embeds: [await infoEmbed(char, Bot, page)]
        })
      } break;
      case "editmenu": {
        await interaction.deferReply({});

        const char = await Creature.fetch(interaction.user.id, db, false).catch(() => null);
        if (!char) {
          interaction.editReply({
            content: "Not found!"
          });
          return;
        }

        interaction.editReply({
          content: `Editing menu for **${char.displayName}**`,
          components: ceditMenu(char)
        })
      } break;
    }
  }
)

export async function infoEmbed(creature: Creature, Bot: Client, page: string): Promise<MessageEmbed> {
  const embed = new MessageEmbed();

  const owner = await Bot.users.fetch(creature.$._id).catch(() => null);

  embed
    .setTitle(creature.displayName)
    .setAuthor(creature.$.info.npc ? "NPC" : (owner?.tag ?? "Unknown"))
    .setColor((creature.$.info.locked || creature.$.info.npc) ? "AQUA" : "GREY")
    .setThumbnail(creature.$.info.display.avatar ?? "")
    .setFooter(`ID: ${creature.$._id}${(creature.$.info.locked || creature.$.info.npc) ? "" : "  NOT LOCKED NOT LOCKED NOT LOCKED"}`)

  switch (page) {
    default:
    case "debug": {
      embed.setDescription("```json\n" + JSON.stringify(creature.$, undefined, "  ") + "```");
    } break;
    case "stats": {
      const health_injury_proportions = (creature.$.stats.health.value - creature.$.vitals.injuries) / creature.$.stats.health.value;

      let health_length_mod, shield_length_mod;
      if (creature.$.stats.health.value >= creature.$.stats.shield.value) {
        health_length_mod = (creature.$.stats.health.value - creature.$.stats.shield.value) / creature.$.stats.health.value;
      } else {
        health_length_mod = (creature.$.stats.shield.value - creature.$.stats.health.value) / creature.$.stats.shield.value;
      }
      shield_length_mod = 1 - health_length_mod;

      embed.addField(
        "Basic",
        `Race - **${SpeciesManager.map.get(creature.$.info.species ?? "")?.$.info.name ?? "Unknown"}**\n` +  
        `Class - **${ClassManager.map.get(creature.$.info.class ?? "")?.$.info.name ?? "Unknown"}**\n` +
        `Level **${creature.$.experience.level}**`  
      ).addFields([
        {
          name: "Vitals",
          inline: false,
          value: 
          `*(**${creature.$.stats.health.value}** Health - **${creature.$.vitals.injuries}** Injuries)*\n` +
          make_bar(100 * creature.$.vitals.health / (creature.$.stats.health.value - creature.$.vitals.injuries), BAR_STYLE, Math.max(1, health_length_mod * Math.floor(BAR_LENGTH * health_injury_proportions))).str +
          (
            creature.$.vitals.injuries > 0
            ? make_bar(100, "░", Math.max(1, health_length_mod * Math.ceil(BAR_LENGTH - (BAR_LENGTH * health_injury_proportions)))).str
            : ""
          ) +
          ` **Health** **${creature.$.vitals.health}**/**${creature.$.stats.health.value - creature.$.vitals.injuries}** ` + 
          `(**${Math.round(100 * creature.$.vitals.health / creature.$.stats.health.value)}%**)\n` +
          (
            creature.$.stats.shield.value > 0
            ? make_bar(100 * creature.$.vitals.shield / creature.$.stats.shield.value, BAR_STYLE, shield_length_mod * BAR_LENGTH).str +
            ` **Shield** ${textStat(creature.$.vitals.shield, creature.$.stats.shield.value)} ` +
            `**${creature.$.stats.shield_regen.value}**/t`
            : "No **Shield**"
          ) + "\n" +
          make_bar(100 *creature.$.vitals.mana / creature.$.stats.mana.value, BAR_STYLE, BAR_LENGTH / 3).str +
          ` **Mana** ${textStat(creature.$.vitals.mana, creature.$.stats.mana.value)} `+
          `**${creature.$.stats.mana_regen.value}**/t\n`
        },
        {
          name: "Offense",
          value: 
            `**${creature.$.stats.accuracy.value}%** Accuracy *(Hit Chance)*\n` +
            `Melee **${creature.$.stats.melee.value}** | **${creature.$.stats.ranged.value}** Ranged *(Attack Power)*\n` +
            `**${creature.$.stats.tech.value}** Tech *(Ability Power)*\n` +
            "\n" +
            `**${creature.$.stats.lethality.value}** Lethality | **${creature.$.stats.defiltering.value}** Defiltering | **${creature.$.stats.cutting.value}** Cutting\n` +
            `*(Reduces effectivenes of enemy **Armor**, **Filter**, and **Tenacity** respectively)*` +
            "\n" +
            `Vamp **${creature.$.stats.vamp.value}%** | **${creature.$.stats.siphon.value}%** Siphon *(Regenerates **health** | **shields** by **%** of damage dealt when dealing **Physical** | **Energy** Damage)*\n` +
            "\n" +
            `**${creature.$.stats.initiative.value}** Initiative` 
        },
        {
          name: "Defense",
          value:
          `**${creature.$.stats.armor.value}** Armor *(**${Math.round(100 * (1 - reductionMultiplier(creature.$.stats.armor.value)))}%** Reduced Physical Damage)*\n` +
          `**${creature.$.stats.filter.value}** Filter *(**${Math.round(100 * (1 - reductionMultiplier(creature.$.stats.filter.value)))}%** Reduced Energy Damage)*\n` +
          `Parry **${creature.$.stats.parry.value}%** | **${creature.$.stats.deflect.value}%** Deflect *(Reduces hit chance from **Melee** | **Ranged**)*\n` +
          "\n" +
          `**${creature.$.stats.tenacity.value}** Tenacity *(Taking **${Math.round(100 * reductionMultiplier(creature.$.stats.tenacity.value) * DAMAGE_TO_INJURY_RATIO)}%** health damage as **Injuries**)*` +
          "\n" +
          `**${creature.$.stats.insulation.value}** Insulation (**${creature.deltaHeat}** Delta Heat - ${deltaHeatInfo(creature.deltaHeat)})`
        }
      ])
    } break;
    case "passives": {
      const passives = creature.passives;

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

          for (const item of creature.items) {
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

            for (const item of creature.items) {
              str += `**${item.$.info.name}** \`${item.$.id}\`\n*${item.$.info.lore}*\n\n`
            }

            return str.trim();
          }(creature) || "Empty",
          inline: true
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
          }(creature) || "Empty",
          inline: true
        }
      ]).addField(
        "Crafting Materials",
        function () {
          var str = "";

          for (const c in creature.$.items.crafting_materials) {
            // @ts-expect-error
            const mat: number = creature.$.items.crafting_materials[c];

            str += `**${mat}** ${capitalize(c)}\n`;
          }

          return str;
        }()
      )
    } break;
    case "abilities": {
      embed.addFields(function() {
        const array: EmbedFieldData[] = [];

        for (const ability of creature.abilities) {
          array.push({
            name: ability.$.info.name,
            value: `${replaceLore(ability.$.info.lore, ability.$.info.lore_replacers, creature)}\n\n**${ability.$.haste ?? 1}** Haste`
          })
        }

        return array;
      }())
    } break;
    case "attack": {
      function attackInfo(creature: Creature, attacks: AttackData[], type: DamageMedium) {
        var str = "";

        for (const attackdata of attacks) {
          str += `Sources:
          ${function () {
            var str = "";

            for (const source of attackdata.sources) {
              str += `[**${Math.round(source.flat_bonus + (source.from_skill * (type === DamageMedium.Melee ? creature.$.stats.melee.value : creature.$.stats.ranged.value)))} *(${source.flat_bonus} + ${Math.round(100 * source.from_skill) / 100}x)* ${DamageType[source.type]}**]\n`
            }

            return str;
          }()}
          **${(attackdata.modifiers?.accuracy ?? 0) + creature.$.stats.accuracy.value} *(${creature.$.stats.accuracy.value} ${(attackdata.modifiers?.accuracy ?? 0) >= 0 ? "+" : "-"}${Math.abs(attackdata.modifiers?.accuracy ?? 0)})*** Accuracy
          **${attackdata.modifiers?.lethality ?? 0}** Lethality
          **${attackdata.modifiers?.defiltering ?? 0}** Defiltering\n\n`;
        }

        return str;
      }

      const attack = creature.attackSet;
      embed.addFields([
        {
          name: "Position",
          value: `${CombatPosition[attack.type]} - ${DamageMedium[attack.type]}`
        },
        {
          name: "Crit",
          value: attackInfo(creature, attack.crit, attack.type),
          inline: true
        },
        {
          name: "Normal",
          value: attackInfo(creature, attack.normal, attack.type),
          inline: true
        },
        {
          name: "Weak",
          value: attackInfo(creature, attack.weak, attack.type),
          inline: true
        }
      ])
    } break;
    case "effects": {
      for (const effect of creature.active_effects) {
        const effectData = EffectManager.map.get(effect.id);
        if (!effectData) continue;
    
        embed.addField(
          `${effectData.$.info.name} ${function() {
            switch (effectData.$.display_severity) {
              default: return "";
              case DisplaySeverity.ARABIC: return String(effect.severity);
              case DisplaySeverity.ROMAN: return romanNumeral(effect.severity);
            }
          }()}`,
          `*${replaceEffectLore(effectData.$.info.lore, effectData.$.info.replacers, effect)}*\n\nfor **${effect.ticks}** Ticks (\`${effect.id}\`)`
        )
      }

      if (embed.fields.length == 0) {
        embed.setDescription("None");
      }
    } break;
    case "modifiers": {
      embed
      .addField(
        "Bases",
        function() {
          var str = "";

          for (const s in creature.$.stats) {
            // @ts-ignore
            const stat = creature.$.stats[s];
            str += `**${Math.round(stat.base)}** ${capitalize(s.replaceAll(/_/g, " "))}\n`;
          }

          return str;
        }(),
        true
      ).addField(
        "Modifiers",
        function() {
          var str = "";

          const array: PassiveModifier[] = [];
          for (const s in creature.$.stats) {
            // @ts-ignore
            const stat = creature.$.stats[s];
            
            for (const mod of stat.modifiers) {
              array.push({
                stat: s,
                type: mod.type,
                value: mod.value
              });
            }
          }
          for (const a in creature.$.attributes) {
            // @ts-ignore
            const attr = creature.$.attributes[a];
            
            for (const mod of attr.modifiers) {
              array.push({
                stat: a,
                type: mod.type,
                value: mod.value
              });
            }
          }

          for (const mod of array) {
            str += `**`;
            switch (mod.type) {
              case ModifierType.MULTIPLY: str += `${mod.value}x`; break;
              case ModifierType.ADD_PERCENT: str += `${mod.value >= 0 ? "+" : "-"}${Math.round(Math.abs(mod.value) * 1000) / 10}%`; break;
              case ModifierType.CAP_MAX: str += `${mod.value}^`; break;
              case ModifierType.ADD: str += `${mod.value >= 0 ? "+" : "-"}${Math.abs(mod.value)}`; break;
            }
            str += `** ${capitalize(mod.stat.replaceAll(/_/g, " "))}\n`;
          }

          return str;
        }() || "None",
        true
        ).addField(
          "Values",
          function() {
            var str = "";
  
            for (const s in creature.$.stats) {
              // @ts-ignore
              const stat = creature.$.stats[s];
  
              str += `**${Math.round(stat.value)}** ${capitalize(s.replaceAll(/_/g, " "))}\n`;
            }
  
            return str;
          }(),
          true
        )
    } break;
    case "attributes": {
      embed
      .setDescription(`Points used: **${creature.totalAttributePointsUsed}**/${creature.$.experience.level}`)
      .addField(
        "Attributes",
        function () {
          var str = "";

          for (const a in creature.$.attributes) {
            // @ts-expect-error
            const attr = creature.$.attributes[a];
            const attr_bonus = attr.value - attr.base;
            
            // @ts-expect-error
            str += `**${attr.value} ${a}**${attr_bonus !== 0 ? ` [Modifiers] *(**${attr.base}** ${`${(attr_bonus < 0 ? "-" : "+")} ${Math.abs(attr_bonus)}`})*` : ""}\n${Creature.ATTRIBUTE_DESCRIPTIONS[a]}  ${modifierDescriptor(Creature.ATTRIBUTE_MODS[a]).trim().replaceAll("\n", ", ") || ""}\n`
          }

          return str;
        }()
        +
        `\n*All attribute modifiers add to BASE stats, not modify. Descriptions are per-point.*`
      ).addField(
        "Per Level",
        "Regardless of attributes, each Level provides a creature with:\n" +
        modifierDescriptor(Creature.LEVEL_MODS).trim().replaceAll("\n", ", ") +
        "\non base stats."
      )
    } break;
    case "perks": {
      embed.setDescription(function() {
        var str = "";

        for (const perk of creature.perks) {
          str += `\`${perk.$.id}\` - **${perk.$.info.name}**\n${perk.$.info.lore}\n\n`
        }

        return str;
      }())
    } break;
    case "skills": {
      embed.setDescription(function() {
        var str = "";

        for (const skill of creature.skills) {
          str += `\`${skill.$.id}\` - **${skill.$.info.name}**\n${skill.$.info.lore}\n\n`
        }

        return str;
      }())
    } break;
    case "schematics": {
      embed.setDescription(function() {
        var str = "";

        for (const schem of creature.schematics) {
          const recipe = RecipeManager.map.get(schem);
          if (!recipe) continue;

          const result = ItemManager.map.get(recipe.$.result);

          str += `\`${recipe.$.id}\` >> ${result?.$.info.name} (\`${recipe.$.result}\`)\n`;
        }

        return str;
      }())
    } break;
    case "location": {
      const location = creature.location;
      if (!location) {
        embed.setDescription("Invalid location; ***v o i d***");
      } else {
        embed.setDescription(`**${location.$.info.name}** \`${location.$.id}\`\n${location.$.info.lore}`)

        embed.addField(
          "Flags",
          `**${location.$.temperature}** Temperature\n` +
          `${location.$.shop !== undefined ? "⬜" : "🔳"} - \`/char shop\` ${location.$.shop !== undefined ? "available" : "unavailable"}\n` + 
          `${location.$.hasEnhancedCrafting ? "⬜" : "🔳"} - ${location.$.hasEnhancedCrafting ? "Enhanced Crafting" : "Limited Crafting"}\n`
        )

        if (location.$.area_effects) {
          embed.addField(
            "Area Effects",
            function () {
              var str = "";

              for (const active_effect of location.$.area_effects) {
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
            }() || "None"
          )
        }
      }
    } break;
  }

  return embed;
}

const BAR_STYLE = bar_styles[0];
const BAR_LENGTH = 20;