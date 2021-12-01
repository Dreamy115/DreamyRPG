import { MessageActionRow, MessageButton, MessageEmbed, MessageSelectMenu, MessageSelectMenuOptions, MessageSelectOptionData } from "discord.js";
import { CONFIG, sleep } from "../..";
import Creature, { diceRoll } from "../../game/Creature";
import { DamageCause, DamageLog, damageLogEmbed, DamageMedium, DamageSource, ShieldReaction } from "../../game/Damage";
import { Fight } from "../../game/Fight";
import { ComponentCommandHandler } from "../component_commands";

export default new ComponentCommandHandler(
  "fight",
  async function (interaction, Bot, db, args) {
    await interaction.deferReply({ ephemeral: true });

    const fight = await Fight.fetch(args.shift() ?? "", db).catch(() => null);
    if (!fight) {
      await interaction.editReply({
        content: "This fight has ended or is invalid"
      });
      return;
    }

    const creature = await Creature.fetch(fight.$.queue[0], db).catch(() => null);
    if (!creature) {
      interaction.editReply({
        content: "Invalid Creature"
      });
      return;
    }

    const guild = await Bot.guilds.fetch(CONFIG.guild?.id ?? "");
    await guild.roles.fetch();

    const member = await guild.members.fetch(interaction.user.id).catch(() => null);
    let IS_GM = true;
    if (!member || !member.roles.cache.has(CONFIG.guild?.gm_role ?? "")) {
      IS_GM = false;
      if (creature?.$._id !== interaction.user.id) {
        interaction.editReply({
          content: "Not enough permissions (Must own Creature or be GM)"
        });
        return;
      }
    } 

    const target_choices: MessageSelectOptionData[] = [];
    for (const p in fight.$.parties) {
      const party = fight.$.parties[p];
      for (const cid of party) {
        const char = await Creature.fetch(cid, db).catch(() => null);
        if (!char) continue;

        target_choices.push({
          label: `${char.$.info.display.name} - Party ${p}`,
          value: char.$._id,
          description: char.$._id === creature.$._id ? "You" : (char.$.info.npc ? "NPC" : "Player"),
        });
      }
    }

    switch (args.shift()) {
      case "endturn": {
        if (creature.$.abilities.stacks > 0) {
          interaction.editReply({
            content: "You must 'cash-out' your attack stacks before passing the turn!"
          });
          return;
        }

        await interaction.editReply({
          content: "OK"
        });
        
        const winning_party = await fight.checkWinningParty(db);
        if (winning_party !== -1) {
          interaction.followUp({
            content: `**Party ${winning_party}** is victorious`
          })
          fight.delete(db);
          return;
        }

        while (true) {
          await fight.advanceTurn(db);
          const char = await Creature.fetch(fight.$.queue[0], db).catch(() => null);
          if (char?.isAbleToFight()) {
            break;
          } else {
            interaction.followUp({
              content: `**${char?.$.info.display.name}** is unable to fight.`
            });
            await sleep(1500);
          }
        }
        await interaction.followUp(await fight.announceTurn(db, Bot));
      } break;
      case "attack": {
        if (interaction.isButton()) {
          if (creature.$.abilities.stacks === 0) {
            if (creature.$.vitals.mana >= Creature.ATTACK_COST) {
              creature.$.vitals.mana -= Creature.ATTACK_COST
            } else {
              interaction.editReply({
                content: "Not enough Mana"
              });
              return;
            }
          }

          const rolled = diceRoll(Creature.ATTACK_STACK_DIE_SIZE);

          if (creature.$.abilities.stacks + rolled <= Creature.ATTACK_MAX_STACKS) {
            interaction.editReply({
              content: 
                `Rolled: **${rolled}** *(**${creature.$.abilities.stacks + rolled}**)*\n` +
                function () {
                  var str = "";

                  for (var i = 1; i < Creature.ATTACK_MAX_STACKS; i++) {
                    if (i <= creature.$.abilities.stacks + rolled) {
                      switch (Creature.ATTACK_VALUES[i]) {
                        case null:
                          str += ":white_large_square:";
                          break;
                        case DamageCause.Weak_Attack:
                          str += ":yellow_square:";
                          break;
                        case DamageCause.Normal_Attack:
                          str += ":green_square:";
                          break;
                        case DamageCause.Critical_Attack:
                          str += ":red_square:";
                          break;
                      }
                    } else {
                      str += ":black_large_square:";
                    }
                    if (i === creature.$.abilities.stacks) str += "|";
                  }

                  return str;
                }(),
              components: [
                new MessageActionRow().setComponents([
                  new MessageButton()
                    .setCustomId(`fight/${fight.$._id}/attack`)
                    .setLabel("Roll Again")
                    .setStyle("PRIMARY")
                ]),
                new MessageActionRow().setComponents([
                  new MessageSelectMenu()
                    .setCustomId(`fight/${fight.$._id}/attack_out`)
                    .setPlaceholder("Cash-out Attack")
                    .setOptions(target_choices)
                ])
              ]
            })
            creature.$.abilities.stacks += rolled;
          } else {
            interaction.editReply({
              content: `Rolled: **${rolled}** *(**${creature.$.abilities.stacks + rolled}**)*\n **~BUSTED~**`
            })
            creature.$.abilities.stacks = 0;
          }

          creature.put(db);
        }
      } break;
      case "attack_out": {
        if (interaction.isSelectMenu()) {
          const attack_type = Creature.ATTACK_VALUES[creature.$.abilities.stacks];
          if (attack_type === null || attack_type === undefined) {
            interaction.editReply({
              content: "Cannot cash out a miss or overshoot"
            })
            return;
          }
          
          const target_id = interaction.values[0];
          
          const target = await Creature.fetch(target_id, db).catch(() => null);
          if (!target) {
            interaction.editReply({
              content: "Invalid target"
            })
            return;
          }
          if (target?.$._id === creature.$._id) {
            interaction.editReply({
              content: "Cannot attack yourself, silly!"
            })
            return;
          }

          let type: "normal"|"weak"|"crit";
          switch (attack_type) {
            default: return;
            case DamageCause.Weak_Attack:
              type = "weak";
              break;
            case DamageCause.Normal_Attack:
              type = "normal";
              break;
            case DamageCause.Critical_Attack:
              type = "crit";
              break;
          }

          const logs: DamageLog[] = [];
          for (const set of creature.attackSet[type]) {
            let dodge_value: number;
            let skill_value: number;
            switch (set.type) {
              case DamageMedium.Direct:
              default:
                dodge_value = 0;
                skill_value = Math.round((creature.$.stats.melee.value + creature.$.stats.ranged.value) / 2)
                break;
              case DamageMedium.Melee:
                dodge_value = target.$.stats.parry.value;
                skill_value = creature.$.stats.melee.value;
                break;
              case DamageMedium.Ranged:
                dodge_value = target.$.stats.deflect.value;
                skill_value = creature.$.stats.ranged.value;
                break;
            }

            logs.push(target.applyDamage({
              cause: attack_type,
              chance: creature.$.stats.accuracy.value + set.modifiers.accuracy - dodge_value,
              medium: set.type,
              penetration: {
                lethality: set.modifiers.lethality,
                defiltering: set.modifiers.defiltering
              },
              shieldReaction: ShieldReaction.Normal,
              useDodge: true,
              attacker: creature,
              victim: target,
              sources: function () {
                const array: DamageSource[] = [];

                for (const src of set.sources) {
                  array.push({
                    type: src.type,
                    value: src.flat_bonus + skill_value
                  })
                }

                return array;
              }()
            }));
          }

          const embeds: MessageEmbed[] = []; 
          for (const log of logs) {
            embeds.push(damageLogEmbed(log));
          }

          creature.$.abilities.stacks = 0;

          await Promise.all([
            creature.put(db),
            target.put(db)
          ])

          await interaction.editReply({
            content: "OK"
          })
          interaction.followUp({
            ephemeral: false,
            embeds
          })
          interaction.followUp(await fight.announceTurn(db, Bot))
        }
      } break;
      case "ability": {

      } break;
    }

    fight.put(db);
  }
)