import { Message, MessageActionRow, MessageButton, MessageEmbed, MessageSelectMenu, MessageSelectMenuOptions, MessageSelectOptionData } from "discord.js";
import { AbilitiesManager, CONFIG, ItemManager, limitString, rotateLine, sleep } from "../..";
import Creature, { diceRoll } from "../../game/Creature";
import { replaceLore } from "../../game/LoreReplacer";
import { DamageCause, DamageLog, damageLogEmbed, DamageMethod, DamageSource, ShieldReaction } from "../../game/Damage";
import { Combatant, CombatPosition, Fight } from "../../game/Fight";
import { Item, ItemQualityEmoji } from "../../game/Items";
import { abilitiesDescriptor } from "../commands/handbook";
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

    const combatants = await fight.getCombatantInfo(db);
    const self_combatant = combatants.get(creature.$._id); 
    if (!self_combatant) {
      interaction.editReply({
        content: "Invalid combatant."
      })
      return;
    }

    const target_choices: MessageSelectOptionData[] = [];
    for (const p in fight.$.parties) {
      const party = fight.$.parties[p];
      for (const cid of party) {
        const char = await Creature.fetch(cid, db).catch(() => null);
        if (!char) continue;

        target_choices.push({
          label: `${char.displayName} - Party ${p}`,
          value: char.$._id,
          description: 
            `(${char.$._id === creature.$._id ? "You" : (char.$.info.npc ? "NPC" : "Player")}) ` +
            function() {
              const combatant = combatants.get(char.$._id);
              if (!combatant) return "Unknown Position";

              switch (combatant.position) {
                case CombatPosition["No Position"]:
                default: return "No Position";
                case CombatPosition.Frontline: {
                  return "Frontline (No Modifiers)";
                }
                case CombatPosition.Support: {
                  return `Support (x${
                    self_combatant?.position === CombatPosition.Frontline
                    ? `${Math.round(1000 * FRONTLINE_TO_SUPPORT_MOD) / 10}`
                    : `${Math.round(1000 * ELSE_TO_SUPPORT_MOD) / 10}`
                  }% Accuracy)`
                }
              }
            }(),
        });
      }
    }

    switch (args.shift()) {
      case "refresh": {
        const message = interaction.message as Message;

        const channel = interaction.guild
        ? await interaction.guild.channels.fetch(message.channelId ?? (interaction.message as Exclude<typeof interaction.message, Message>).channel_id)
        : await Bot.channels.fetch((interaction.message as Exclude<typeof interaction.message, Message>).channel_id ?? message.channelId)
    
        if (!channel?.isText?.()) throw new Error("Channel isn't text")
    
        const msg = await channel.messages.fetch(interaction.message.id);

        const payload = await fight.announceTurn(db, Bot);

        msg.edit(payload).catch(() => {
          msg.delete();
          channel.send(payload);
        })

        interaction.editReply({content: "OK"});
      } break;
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
          if (winning_party === -2)
            interaction.followUp({
              content: `No one wins. Everyone's down.`
            })
          else
            interaction.followUp({
              content: `**Party ${winning_party}** is victorious`
            });

          for (const cid of fight.creatures) {
            const char = await Creature.fetch(cid, db).catch(() => null);
            if (!char) continue;

            for (const passive of char.passives)
              await passive.$.onFightExit?.(char, fight);
          }

          fight.delete(db);
          return;
        }

        while (true) {
          await fight.advanceTurn(db);
          const char = await Creature.fetch(fight.$.queue[0], db).catch(() => null);

          if (char?.alive) {
            break;
          } else {
            interaction.followUp({
              content: `**${char?.displayName}** is dead.`
            });
            await sleep(1500);
          }
        }
        await interaction.followUp(await fight.announceTurn(db, Bot));
      } break;
      case "attack": {
        if (!creature.canUseAttacks) {
          interaction.editReply({
            content: "You cannot Attack right now."
          })
          return;
        }

        if (interaction.isButton()) {
          if (creature.$.abilities.stacks === 0) {
            if (creature.$.vitals.mana >= creature.$.stats.attack_cost.value) {
              creature.$.vitals.mana -= creature.$.stats.attack_cost.value
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

                  for (var i = 1; i <= Creature.ATTACK_MAX_STACKS; i++) {
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
                    .setOptions([... new Set(target_choices)])
                ])
              ]
            })
            creature.$.abilities.stacks += rolled;
          } else {
            await interaction.editReply({
              content: `Rolled: **${rolled}** *(**${creature.$.abilities.stacks + rolled}**)*\n **~BUSTED~**`
            })
            
            for (const passive of creature.passives)
              passive.$.onBust?.(creature);

            creature.$.abilities.stacks = 0;
            const msg = await fight.announceTurn(db, Bot);
            msg.content = "**Busted an attack**";
            interaction.followUp(msg)
          }

          creature.put(db);
        }
      } break;
      case "attack_out": {
        if (!creature.canUseAttacks) {
          interaction.editReply({
            content: "You cannot Attack right now."
          })
          return;
        }

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

          const combatant = combatants.get(target.$._id);

          let accuracy_mod = combatant
          ? getAccuracyMod(self_combatant, combatant)
          : 1;

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
            let skill_value: number;
            switch (creature.attackSet.type) {
              case DamageMethod.Melee:
                skill_value = creature.$.stats.melee.value;
                break;
              case DamageMethod.Ranged:
                skill_value = creature.$.stats.ranged.value;
                break;
            }

            logs.push(target.applyDamage({
              cause: attack_type,
              chance: rotateLine(skill_value / 100, Creature.PROFICIENCY_ACCURACY_SCALE, 1) * accuracy_mod * (creature.$.stats.accuracy.value + (set.modifiers?.accuracy ?? 0)),
              method: creature.attackSet.type,
              penetration: {
                lethality: (set.modifiers?.lethality ?? 0) + creature.$.stats.lethality.value,
                passthrough: (set.modifiers?.passthrough ?? 0) + creature.$.stats.passthrough.value,
                cutting: (set.modifiers?.cutting ?? 0) + creature.$.stats.cutting.value
              },
              useDodge: true,
              attacker: creature,
              victim: target,
              sources: function () {
                const array: DamageSource[] = [];

                for (const src of set.sources) {
                  array.push({
                    type: src.type,
                    value: Math.round(src.flat_bonus + (creature.$.stats.damage.value * rotateLine(skill_value / 100, Creature.PROFICIENCY_DAMAGE_SCALE, 1) * src.from_skill)),
                    shieldReaction: src.shieldReaction ?? ShieldReaction.Normal
                  })
                }

                return array;
              }()
            }));
          }

          const embeds: MessageEmbed[] = []; 
          for (const log of logs) {
            embeds.push(damageLogEmbed(log));
            // @ts-expect-error WTF
            for (const passive of creature.passives) {
              await passive.$.onAttack?.(creature, log);
            }
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
      case "ult": {
        if (creature.$.abilities.stacks > 0) {
          interaction.followUp({
            ephemeral: true,
            content: "Finish attacking first!"
          });
          return;
        }

        if (interaction.isSelectMenu()) {
          const arg = args.shift();
          if (arg) {
            const target_ids = interaction.values;

            const ability = creature.ultimate;
            if (!ability) {
              interaction.followUp({
                ephemeral: true,
                content: "Invalid Ultimate or not equipped"
              });
              return;
            }

            if (creature.$.abilities.ult_stacks < creature.$.stats.ult_stack_target.value) {
              interaction.followUp({
                ephemeral: true,
                content: "Not enough stacks"
              })
              return;
            }

            const test: void | Error = await ability.$.test(creature).catch(e => typeof e === "string" ? new Error(e) : e);
            if (test instanceof Error) {
              interaction.followUp({
                ephemeral: true,
                content: `Cannot use ultimate: ${test.message}`
              });
              return;
            }

            const targets: Creature[] = []
            for (const tid of target_ids) {
              if (target_choices.findIndex((v) => v.value === tid) !== -1) {
                if (tid === creature.id) {
                  targets.push(creature);
                } else {
                  targets.push(await Creature.fetch(tid, db))
                }
              } else {
                interaction.followUp({
                  ephemeral: true,
                  content: "Invalid targets"
                });
                return;
              }
            }

            const accuracy_mods: number[] = [];
            for (const target of targets) {
              const combatant = combatants.get(target.$._id);

              if (ability.$.attackLike) {
                accuracy_mods.push(
                  combatant
                  ? getAccuracyMod(self_combatant, combatant)
                  : 1
                )
              } else {
                accuracy_mods.push(1);
              }
            }

            try {
              await ability.$.test(creature);
              const uselog = await ability.$.use(creature, targets, accuracy_mods);
              creature.$.vitals.mana -= ability.$.cost;
              creature.$.abilities.hand.splice(creature.$.abilities.hand.findIndex((v) => v === ability.$.id), 1);

              const damage_embeds = [];
              for (const log of uselog.damageLogs ?? []) {
                damage_embeds.push(damageLogEmbed(log));
              }

              for (const passive of creature.passives)
                await passive.$.onAbility?.(creature, ability, true);

              await creature.put(db);
              for (const target of targets) {
                if (target.id !== creature.id)
                  await target.put(db)
              }

              await interaction.editReply({
                content: Math.round(Math.random() * 100) == 1 ? "200 OK" : "OK"
              });
              await interaction.followUp({
                ephemeral: false,
                content: uselog.text,
                embeds: damage_embeds.length > 0 ? damage_embeds : undefined
              })

              interaction.followUp(await fight.announceTurn(db, Bot));
            } catch (e: any) {
              console.error(e);
              interaction.followUp({
                ephemeral: true,
                content: e?.message ?? e
              });
            }
          } else {
            const ability = creature.ultimate;
            if (!ability) {
              interaction.followUp({
                ephemeral: true,
                content: "Invalid Ultimate or not equipped"
              });
              return;
            }

            if (creature.$.abilities.ult_stacks < creature.$.stats.ult_stack_target.value) {
              interaction.followUp({
                ephemeral: true,
                content: "Not enough stacks"
              })
              return;
            }

            const test: void | Error = await ability.$.test(creature).catch(e => typeof e === "string" ? new Error(e) : e);
            if (test instanceof Error) {
              interaction.followUp({
                ephemeral: true,
                content: `Cannot use ultimate: ${test.message}`
              });
              return;
            }

            if (ability.$.min_targets > target_choices.length) {
              interaction.followUp({
                ephemeral: true,
                content: `Not enough fighters to satisfy Ultimate Ability minimum target requirement *(${target_choices.length}/${ability.$.min_targets})*`
              })
              return;
            }

            interaction.followUp({
              ephemeral: true,
              content: "Pick your targets",
              embeds: [
                new MessageEmbed()
                  .setTitle(ability.$.info.name)
                  .setDescription(
                    replaceLore(ability.$.info.lore, ability.$.info.lore_replacers, creature) +
                    `\n\n` +
                    `Cost **${ability.$.cost}**\n` +
                    `Haste **${ability.$.haste ?? 1}**\n` +
                    `${ability.$.attackLike ? `**Attack-Like** *(Affected by Positioning)*\n` : ""}`
                  )
              ],
              components: [new MessageActionRow().setComponents([new MessageSelectMenu()
                .setCustomId(`fight/${fight.$._id}/ult/${ability.$.id}`)
                .setMinValues(ability.$.min_targets)
                .setMaxValues(Math.min(ability.$.max_targets ?? (ability.$.min_targets || 1), target_choices.length))
                .setPlaceholder("Creatures")
                .setOptions(
                  ability.$.min_targets === 0
                  ? [{
                    value: creature.id,
                    label: creature.displayName,
                    description: "You can only pick yourself for this ability."
                  }]
                  : target_choices)
              ])]
            })
          }
        }
      } break;
      case "ability": {
        if (creature.$.abilities.stacks > 0) {
          interaction.followUp({
            ephemeral: true,
            content: "Finish attacking first!"
          });
          return;
        }

        if (!creature.canUseAbilities) {
          interaction.editReply({
            content: "You cannot use Abilities right now."
          })
          return;
        }

        if (interaction.isSelectMenu()) {
          const arg = args.shift();
          if (arg) {
            const target_ids = interaction.values;
            
            if (!creature.$.abilities.hand.includes(arg)) {
              interaction.followUp({
                ephemeral: true,
                content: "Ability not in hand."
              });
              return;
            }

            const ability = AbilitiesManager.map.get(arg);
            if (!ability) {
              interaction.followUp({
                ephemeral: true,
                content: "Invalid ability"
              });
              return;
            }

            const targets: Creature[] = []
            for (const tid of target_ids) {
              if (target_choices.findIndex((v) => v.value === tid) !== -1) {
                if (tid === creature.id) {
                  targets.push(creature);
                } else {
                  targets.push(await Creature.fetch(tid, db))
                }
              } else {
                interaction.followUp({
                  ephemeral: true,
                  content: "Invalid targets"
                });
                return;
              }
            }

            if (creature.$.vitals.mana < ability.$.cost) {
              interaction.followUp({
                ephemeral: true,
                content: "Not enough mana"
              })
              return;
            }

            const accuracy_mods: number[] = [];
            for (const target of targets) {
              const combatant = combatants.get(target.$._id);

              if (ability.$.attackLike) {
                accuracy_mods.push(
                  combatant
                  ? getAccuracyMod(self_combatant, combatant)
                  : 1
                )
              } else {
                accuracy_mods.push(1);
              }
            }

            try {
              await ability.$.test(creature);
              const uselog = await ability.$.use(creature, targets, accuracy_mods);
              creature.$.vitals.mana -= ability.$.cost;
              creature.$.abilities.hand.splice(creature.$.abilities.hand.findIndex((v) => v === ability.$.id), 1);

              const damage_embeds = [];
              for (const log of uselog.damageLogs ?? []) {
                damage_embeds.push(damageLogEmbed(log));
              }

              for (const passive of creature.passives)
                await passive.$.onAbility?.(creature, ability, false);

              await creature.put(db);
              for (const target of targets) {
                if (target.id !== creature.id)
                  await target.put(db)
              }
              
              await interaction.editReply({
                content: Math.round(Math.random() * 100) == 1 ? "200 OK" : "OK"
              });
              await interaction.followUp({
                ephemeral: false,
                content: uselog.text,
                embeds: damage_embeds.length > 0 ? damage_embeds : undefined
              })

              interaction.followUp(await fight.announceTurn(db, Bot));
            } catch (e: any) {
              console.error(e);
              interaction.followUp({
                ephemeral: true,
                content: e?.message ?? e
              });
            }
          } else {
            const ability_id = interaction.values[0];

            if (!creature.$.abilities.hand.includes(ability_id)) {
              interaction.followUp({
                ephemeral: true,
                content: "Ability not in hand."
              });
              return;
            }

            const ability = AbilitiesManager.map.get(ability_id);
            if (!ability) {
              interaction.followUp({
                ephemeral: true,
                content: "Invalid ability"
              });
              return;
            }

            if (creature.$.vitals.mana < ability.$.cost) {
              interaction.followUp({
                ephemeral: true,
                content: "Not enough mana"
              })
              return;
            }

            const test: void | Error = await ability.$.test(creature).catch(e => typeof e === "string" ? new Error(e) : e);
            if (test instanceof Error) {
              interaction.followUp({
                ephemeral: true,
                content: `Cannot use ability: ${test.message}`
              });
              return;
            }

            if (ability.$.min_targets > target_choices.length) {
              interaction.followUp({
                ephemeral: true,
                content: `Not enough fighters to satisfy Ability minimum target requirement *(${target_choices.length}/${ability.$.min_targets})*`
              })
              return;
            }

            interaction.followUp({
              ephemeral: true,
              content: "Pick your targets",
              embeds: [
                new MessageEmbed()
                  .setTitle(ability.$.info.name)
                  .setDescription(
                    replaceLore(ability.$.info.lore, ability.$.info.lore_replacers, creature) +
                    `\n\n` +
                    `Cost **${ability.$.cost}**\n` +
                    `Haste **${ability.$.haste ?? 1}**\n` +
                    `${ability.$.attackLike ? `**Attack-Like** *(Affected by Positioning)*\n` : ""}`
                  )
              ],
              components: [new MessageActionRow().setComponents([new MessageSelectMenu()
                .setCustomId(`fight/${fight.$._id}/ability/${ability.$.id}`)
                .setMinValues(ability.$.min_targets)
                .setMaxValues(Math.min(ability.$.max_targets ?? (ability.$.min_targets || 1), target_choices.length))
                .setPlaceholder("Creatures")
                .setOptions(
                  ability.$.min_targets === 0
                  ? [{
                    value: creature.id,
                    label: creature.displayName,
                    description: "You can only pick yourself for this ability."
                  }]
                  : target_choices)
              ])]
            })
          }
        }
      } break;
      case "ability_discard": {
        if (!creature.canUseAbilities) {
          interaction.editReply({
            content: "You cannot use Abilities right now."
          })
          return;
        }

        if (interaction.isSelectMenu()) {
          const ability_id = interaction.values[0];

          if (!creature.$.abilities.hand.includes(ability_id)) {
            interaction.followUp({
              ephemeral: true,
              content: "Ability not in hand."
            });
            return;
          }

          const ability = AbilitiesManager.map.get(ability_id);
          if (!ability) {
            interaction.followUp({
              ephemeral: true,
              content: "Invalid ability"
            });
            return;
          }

          if (creature.$.vitals.mana < Creature.ABILITY_DISCARD_COST) {
            interaction.followUp({
              ephemeral: true,
              content: "Not enough mana"
            })
            return;
          }

          creature.$.abilities.hand.splice(creature.$.abilities.hand.findIndex((v) => v === ability.$.id), 1);
          creature.$.vitals.mana -= Creature.ABILITY_DISCARD_COST;
          const new_ability = creature.drawAbilityCard();

          await creature.put(db);

          await interaction.editReply({
            content: Math.round(Math.random() * 100) == 1 ? "200 OK" : "OK"
          });
          await interaction.followUp({
            ephemeral: false,
            content: `**${ability.$.info.name}** discarded${new_ability ? ` and replaced by **${new_ability.$.info.name}**` : ""}.`
          });
          interaction.followUp(await fight.announceTurn(db, Bot));
        }
      } break;
      case "weapon_switch": {
        if (creature.$.abilities.stacks > 0) {
          interaction.followUp({
            ephemeral: true,
            content: "Finish attacking first!"
          });
          return;
        }

        if (creature.$.vitals.mana < creature.combat_switch_cost) {
          interaction.followUp({
            ephemeral: true,
            content: `Changing weapons mid-fight requires **${(100 * Creature.COMBAT_WEAPON_SWITCH_MULT).toFixed(0)}%** Attack Cost mana.`
          })
          return;
        }
        if (interaction.isSelectMenu()) {
          const id = String(interaction.values[0]);
          if (!id) {
            interaction.followUp({
              ephemeral: true,
              content: "Invalid item"
            })
            return;
          }

          let item: Item | null = null;
          var index = 0;
          for (index; creature.$.items.weapons.length > index; index++) {
            const equipped = ItemManager.map.get(creature.$.items.weapons[index].id);
            if (equipped?.$.type !== "weapon") continue;

            item = equipped;
            break;
          }

          if (!item) {
            interaction.followUp({
              ephemeral: true,
              content: "Invalid item"
            })
            return;
          }

          let old: Item | null = null;
          if (creature.$.items.primary_weapon) {
            creature.$.items.weapons.push(creature.$.items.primary_weapon);
            old = ItemManager.map.get(creature.$.items.primary_weapon.id) ?? null;
          }
          creature.$.items.primary_weapon = creature.$.items.weapons.splice(index, 1)[0];
          
          creature.$.vitals.mana -= creature.combat_switch_cost;
          creature.reload();

          await creature.put(db);

          await interaction.editReply({
            content: Math.round(Math.random() * 100) == 1 ? "200 OK" : "OK"
          });
          await interaction.followUp({
            ephemeral: false,
            content: `**${creature.displayName}** switched weapons ${old ? `**${old.displayName}** -> ` : ""}**${item.displayName}**`
          })
          interaction.followUp(await fight.announceTurn(db, Bot));
        } else if (interaction.isButton()) {
          interaction.followUp({
            ephemeral: true,
            content: "Choose a weapon from your equipped slots!",
            components: [
              new MessageActionRow().addComponents([
                new MessageSelectMenu()
                  .setCustomId(`fight/${fight.$._id}/weapon_switch`)
                  .setOptions(function() {
                    const array: MessageSelectOptionData[] = [];

                    for (const i of creature.$.items.weapons) {
                      const item = ItemManager.map.get(i.id);
                      if (item?.$.type != "weapon") continue;

                      array.push({
                        label: item.$.info.name,
                        description: limitString(item.$.info.lore, 100),
                        emoji: ItemQualityEmoji[item.$.info.quality],
                        value: item.$.id ?? "",
                      })
                    }

                    if (array.length == 0) {
                      array.push({
                        label: "None",
                        value: "null",
                        description: "No weapons found"
                      })
                    }

                    return array;
                  }())
              ])
            ]
          })
        }
      } break;
    }

    await fight.put(db);
  }
)

function getAccuracyMod(self: Combatant, combatant: Combatant) {
  switch (combatant?.position) {
    case CombatPosition["No Position"]:
    default: return 1;
    case CombatPosition.Frontline: {
      switch (self.position) {
        case CombatPosition.Frontline: return FRONTLINE_TO_FRONTLINE_MOD;
        case CombatPosition["No Position"]: return ELSE_TO_FRONTLINE_MOD;
        case CombatPosition.Support: return SUPPORT_TO_FRONTLINE_MOD;
      }
    }
    case CombatPosition.Support: {
      switch (self.position) {
        case CombatPosition.Frontline: return FRONTLINE_TO_SUPPORT_MOD;
        case CombatPosition["No Position"]: return ELSE_TO_SUPPORT_MOD;
        case CombatPosition.Support: return SUPPORT_TO_SUPPORT_MOD;
      }
    }
  }
}

export const FRONTLINE_TO_SUPPORT_MOD = 0.15;
export const SUPPORT_TO_SUPPORT_MOD = 0.65;
export const SUPPORT_TO_FRONTLINE_MOD = 0.9;
export const FRONTLINE_TO_FRONTLINE_MOD = 1.1;

export const ELSE_TO_SUPPORT_MOD = 0.5;
export const ELSE_TO_FRONTLINE_MOD = 1;