import { MessageActionRow, MessageButton, MessageEmbed, MessageSelectMenu, MessageSelectOptionData } from "discord.js";
import { capitalize, ClassManager, CONFIG, ItemManager, limitString, messageInput, removeMarkdown, SkillManager, SpeciesManager } from "../..";
import { CraftingMaterials } from "../../game/Crafting";
import Creature, { HealType } from "../../game/Creature";
import { AbilityUseLog } from "../../game/CreatureAbilities";
import { DamageCause, DamageGroup, damageLogEmbed, DamageMethod, DamageType, ShieldReaction } from "../../game/Damage";
import { Item } from "../../game/Items";
import { TrackableStat } from "../../game/Stats";
import { infoEmbed } from "../commands/char";
import { ComponentCommandHandler } from "../component_commands";

export default new ComponentCommandHandler(
  "cedit",
  async function (interaction, Bot, db, args) {
    const creature_id = args.shift();
    if (!creature_id) throw new Error("Invalid ID");

    await interaction.deferReply({ ephemeral: true });

    const guild = await Bot.guilds.fetch(CONFIG.guild?.id ?? "");
    await guild.roles.fetch();

    if (creature_id !== interaction.user.id && guild.id !== interaction.guild?.id) {
      interaction.editReply({
        content: "Operations on foreign creatures must be made on the Home Guild"
      });
      return;
    }

    const member = await guild.members.fetch(interaction.user.id).catch(() => null);
    let IS_GM = true;
    if (!member || !member.roles.cache.has(CONFIG.guild?.gm_role ?? "")) {
      IS_GM = false;
      if (creature_id !== interaction.user.id) {
        interaction.editReply({
          content: "Not enough permissions (Must own Creature or be GM)"
        });
        return;
      }
    } 

    // @ts-expect-error
    const channel = interaction.message.channel ?? await interaction.guild?.channels.fetch(interaction.message.channel_id ?? interaction.message.channelId).catch(() => null);
    if (!channel?.isText?.()) throw new Error("Invalid channel");

    switch(args.shift()) {
      case "delete": {
        if (args.shift() === "confirm") {
          const creature = await Creature.fetch(creature_id, db).catch(() => null);
          if (!creature) {
            interaction.editReply({
              content: "Invalid character"
            })
            return;
          }

          await creature.delete(db);
          interaction.editReply({
            content: "Deleted!"
          })
        } else {
          interaction.editReply({
            content: 
              "Are you **100%** sure you want to delete this Creature? " +
              "You will not be able to recover them once this operation is final, " +
              "But you may create another one.\n" +
              "You can safely dismiss this message.",
            components: [
              new MessageActionRow().setComponents([
                new MessageButton()
                  .setCustomId(`cedit/${creature_id}/delete/confirm`)
                  .setStyle("DANGER")
                  .setLabel("Delete PERMANENTLY")
              ])
            ]
          })
        }
      } break;
      case "edit": {
        let creature = await Creature.fetch(creature_id, db).catch(() => null);
        if (!creature) {
          interaction.editReply({
            content: "Invalid character"
          })
          return;
        }

        switch(args.shift()) {
          case "name": {
            await interaction.followUp({
              ephemeral: true,
              content: "Please input the name in chat. Use `#` to cancel or wait."
            });

            const input = await messageInput(channel, interaction.user.id);
            if (input === "#") {
              interaction.followUp({
                ephemeral: true,
                content: "Cancelled"
              });
              return;
            }

            creature.$.info.display.name = input; 
          } break;
          case "avatar": {
            await interaction.followUp({
              ephemeral: true,
              content: "Please input the avatar URL in chat. Use `#` to cancel or wait."
            });

            if (!channel?.isText()) throw new Error("Invalid channel");

            const input = await messageInput(channel, interaction.user.id);
            if (input === "#") {
              interaction.followUp({
                ephemeral: true,
                content: "Cancelled"
              });
              return;
            }

            creature.$.info.display.avatar = input; 
          } break;
          case "species": {
            if (!interaction.isSelectMenu()) return;

            if (creature.$.info.locked && !IS_GM) {
              interaction.followUp({
                ephemeral: true,
                content: "You cannot change that when you've locked in"
              });
              return;
            }

            const species = SpeciesManager.map.get(interaction.values[0]);
            if (!species) {
              interaction.followUp({
                ephemeral: true,
                content: "Invalid species"
              });
              return;
            }

            if (!species.$.playable && !IS_GM) {
              interaction.followUp({
                ephemeral: true,
                content: "Player characters cannot be of an unplayable race."
              });
              return;
            }

            creature.wipeItems();
            let dump = creature.dump();
            // @ts-expect-error
            dump.info.species = interaction.values[0];
            // @ts-expect-error
            dump.info.class = undefined;

            creature = new Creature(dump);
          } break;
          case "lock": {
            if (args.shift() !== "confirm") {
              interaction.followUp({
                content:
                  "Are you sure? You will not be able to edit the Species or Class of your character anymore, but you'll gain the ability to use the character!\n" +
                  "*This will also reset the progress on your character, but you shouldn't have any in the first place!*",
                components: [new MessageActionRow().setComponents([new MessageButton()
                  .setCustomId(`cedit/${creature.$._id}/edit/lock/confirm`)
                  .setStyle("DANGER")
                  .setLabel("I understand!")
                ])],
                ephemeral: true
              })
              return;
            } else {
              const chosen_species = SpeciesManager.map.get(creature.$.info.species);
              if (!chosen_species) {
                interaction.followUp({
                  ephemeral: true,
                  content: "Invalid Species!"
                })
                return;
              }

              const chosen_class = ClassManager.map.get(creature.$.info.class ?? "");
              if (!chosen_class) {
                interaction.followUp({
                  ephemeral: true,
                  content: "Invalid class!"
                })
                return;
              }
              if (chosen_class.$.compatibleSpecies.length > 0 && !chosen_class.$.compatibleSpecies.includes(creature.$.info.species)) {
                interaction.followUp({
                  ephemeral: true,
                  content: "Class incompatible with race"
                })
                return;
              }

              creature.$.experience = {
                level: 1
              }
              creature.clearAttributes();

              creature.$.info.locked = true;
            }
          } break;
          case "class": {
            if (!interaction.isSelectMenu()) return;

            if (creature.$.info.locked && !IS_GM) {
              interaction.followUp({
                ephemeral: true,
                content: "You cannot change that when you've locked in"
              });
              return;
            }

            const chosen_class = ClassManager.map.get(interaction.values[0]);
            if (!chosen_class) {
              interaction.followUp({
                ephemeral: true,
                content: "Invalid class!"
              })
              return;
            }

            if (chosen_class.$.compatibleSpecies.length > 0 && !chosen_class.$.compatibleSpecies.includes(creature.$.info.species)) {
              interaction.followUp({
                ephemeral: true,
                content: "Class incompatible with race"
              })
              return;
            }

            creature.wipeItems();

            let dump = creature.dump();
            // @ts-expect-error
            dump.info.class = chosen_class.$.id;
            // @ts-expect-error
            dump.items.equipped = chosen_class.$.items ?? [];

            creature = new Creature(dump);
          } break;
          case "weapon_switch": {
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
              for (index; creature.$.items.equipped.length > index; index++) {
                const equipped = ItemManager.map.get(creature.$.items.equipped[index]);
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

              if (creature.$.items.primary_weapon)
                creature.$.items.equipped.push(creature.$.items.primary_weapon)
              creature.$.items.primary_weapon = creature.$.items.equipped.splice(index, 1)[0];
              creature = new Creature(creature.dump());

            } else if(interaction.isButton()) {
              interaction.followUp({
                ephemeral: true,
                content: "Choose a weapon from your equipped slots!",
                components: [
                  new MessageActionRow().addComponents([
                    new MessageSelectMenu()
                      .setCustomId(`cedit/${creature_id}/edit/weapon_switch`)
                      .setOptions(function() {
                        const array: MessageSelectOptionData[] = [];

                        for (const i of creature.$.items.equipped) {
                          const item = ItemManager.map.get(i);
                          if (item?.$.type != "weapon") continue;

                          array.push({
                            label: item.$.info.name,
                            description: limitString(item.$.info.lore, 100),
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
              return;
            } else return;
          } break;
          case "item": {
            if (interaction.isButton()) {
              switch (args.shift()) {
                case "scrap": {
                  if (!creature.$.info.locked && !creature.$.info.npc) {
                    interaction.editReply({
                      content: "You must lock in before scrapping or crafting items"
                    })
                    return;
                  }

                  const items: MessageSelectOptionData[] = [];

                  for (const i of creature.$.items.backpack) {
                    const item = ItemManager.map.get(i);
                    if (!item) continue;

                    items.push({
                      label: item.$.info.name,
                      value: item.$.id ?? ""
                    })
                  }

                  if (items.length == 0) {
                    interaction.followUp({
                      ephemeral: true,
                      content: "Backpack is empty!"
                    });
                    return;
                  }

                  interaction.followUp({
                    ephemeral: true,
                    content: "Items to scrap...",
                    components: backpackItemComponents(creature_id, items, `cedit/${creature_id}/edit/item/scrap`)
                  })
                  return;
                } break;
                case "use": {
                  const items: MessageSelectOptionData[] = [];

                  for (const i of creature.$.items.backpack) {
                    const item = ItemManager.map.get(i);
                    if (item?.$.type !== "consumable") continue;

                    items.push({
                      label: item.$.info.name,
                      value: item.$.id ?? ""
                    })
                  }

                  if (items.length == 0) {
                    interaction.followUp({
                      ephemeral: true,
                      content: "No consumables!"
                    });
                    return;
                  }

                  interaction.followUp({
                    ephemeral: true,
                    content: "Consumables...",
                    components: backpackItemComponents(creature_id, items, `cedit/${creature_id}/edit/item/use`)
                  });
                  return;
                } break;
                case "equip": {
                  const items: MessageSelectOptionData[] = [];

                  for (const i of creature.$.items.backpack) {
                    const item = ItemManager.map.get(i);
                    if (!item || item.$.type === "consumable") continue;

                    items.push({
                      label: item.$.info.name,
                      value: item.$.id ?? ""
                    })
                  }

                  if (items.length == 0) {
                    interaction.followUp({
                      ephemeral: true,
                      content: "Backpack is empty!"
                    });
                    return;
                  }

                  interaction.followUp({
                    ephemeral: true,
                    content: "Backpack contents...",
                    components: backpackItemComponents(creature_id, items, `cedit/${creature_id}/edit/item/equip`)
                  })
                  return;
                } break;
                case "unequip": {
                  if (creature.$.items.equipped.length == 0) {
                    interaction.followUp({
                      ephemeral: true,
                      content: "No items equipped"
                    })
                    return;
                  }

                  interaction.followUp({
                    ephemeral: true,
                    content: "Selected item will go to backpack",
                    components: [new MessageActionRow().addComponents([
                      new MessageSelectMenu()
                        .setCustomId(`cedit/${creature_id}/edit/item/unequip`)
                        .setOptions(function() {
                          const array: MessageSelectOptionData[] = [];

                          const items = creature.$.items.equipped;
                          for (var i = 0; i < items.length; i++) {
                            const item = ItemManager.map.get(items[i]);
                            if (!item) continue;

                            array.push({
                              label: item.$.info.name,
                              value: item.$.id ?? "",
                              description: capitalize(item.$.type)
                            })
                          }

                          const array2: MessageSelectOptionData[] = [];
                          for (const item of array) {
                            const index = array2.findIndex((v) => v.value === item.value);
                            if (index === -1) {
                              array2.push(item);
                            } else {
                              array2[index].description = "Multiple items found, only one will be unequipped"
                            }
                          }

                          return array2;
                        }())
                      ])
                    ]})
                  return;
                } break;
              }
            } else if (interaction.isSelectMenu()) {
              switch (args.shift()) {
                case "use": {
                  const logs: AbilityUseLog[] = [];
                  const errors: string[] = [];

                  for (const i of interaction.values) {
                    const item = ItemManager.map.get(i);
                    
                    try {
                      if (item?.$.type !== "consumable") throw new Error(`Item ${i} isn't consumable or doesn't exist`);

                      const index = creature.$.items.backpack.findIndex((v) => v === item.$.id);
                      if (index === -1) throw new Error("Creature doesn't have item " + item.$.id);
                    
                      const log = await item.$.onUse(creature);
                      creature.$.items.backpack.splice(index, 1, ...item.$.returnItems ?? []);

                      logs.push(log);
                    } catch (e) {
                      console.error(e);
                      errors.push(item?.$.id ?? "unknown");
                    }
                  }

                  await interaction.editReply({
                    content: "OK"
                  });


                  for (const log of logs) {
                    await interaction.followUp({
                      ephemeral: false,
                      content: log.text,
                      embeds: (log.damageLogs?.length ?? 0 > 0) ? function () {
                        const array: MessageEmbed[] = [];

                        for (const dmglog of log.damageLogs ?? [])
                          array.push(damageLogEmbed(dmglog));

                        return array;
                      }() : undefined
                    })
                  }

                  if (errors.length > 0) 
                    await interaction.followUp({
                      ephemeral: true,
                      content: `**${errors.length}** item(s) errored and have not been used: **${errors.join("**, **")}**`
                    })
                } break;
                case "scrap": {
                  if (!creature.$.info.locked && !creature.$.info.npc) {
                    interaction.editReply({
                      content: "You must lock in before scrapping or crafting items"
                    })
                    return;
                  }

                  const gained = new CraftingMaterials({});
                  let count = 0;

                  for (const i of interaction.values) {
                    const index = creature.$.items.backpack.findIndex(v => v === i);
                    if (index === -1) continue;

                    const item = ItemManager.map.get(i);
                    if (!item?.$.scrap) continue;

                    for (const mat in item.$.scrap.materials ?? {}) {
                      // @ts-expect-error
                      const material: number = item.$.scrap.materials[mat];

                      // @ts-expect-error
                      if (typeof creature.$.items.crafting_materials[mat] === "number") {
                        // @ts-expect-error
                        creature.$.items.crafting_materials[mat] += material;
                        // @ts-expect-error
                        gained[mat] += material;
                      }
                    }

                    creature.$.items.backpack.splice(index, 1);
                    count++;
                  }

                  interaction.editReply({
                    content: `Scrapped **${count}** items`,
                    embeds: [new MessageEmbed()
                      .setColor("AQUA")
                      .setTitle("Materials Gained")
                      .setDescription(function() {
                        var str = "";

                        for (const mat in gained) {
                          // @ts-expect-error
                          str += `**${gained[mat]}** ${capitalize(mat)}\n`;
                        }

                        return str;
                      }() || "None")
                    ]
                  });
                } break;
                case "unequip": {
                  for (const i of interaction.values) {
                    creature.$.items.backpack.push(creature.$.items.equipped.splice(creature.$.items.equipped.findIndex(v => v === i),1)[0]);
                  }
                } break;
                case "equip": {
                  for (const i of interaction.values) {
                    creature.$.items.equipped.push(creature.$.items.backpack.splice(creature.$.items.backpack.findIndex(v => v === i),1)[0]);
                  }
                  creature.checkItemConflicts();
                }
              }
            }
          } break;
          case "attr": {
            var arg = args.shift();
            if (arg) {
              if (arg === "!clear") {
                if (IS_GM) {
                  creature.clearAttributes();
                } else {
                  interaction.followUp({
                    content: "Not enough permissions (Must be GM)",
                    ephemeral: true
                  })
                  return;
                }
              } else {
                if (!IS_GM && !creature.$.info.locked) {
                  interaction.followUp({
                    content: "Cannot assign points if you have not locked in",
                    ephemeral: true
                  })
                  return;
                }

                // @ts-expect-error
                if (creature.$.attributes[arg] instanceof TrackableStat) {
                  if (IS_GM || creature.totalAttributePointsUsed < creature.$.experience.level) {
                    // @ts-expect-error
                    if (creature.$.attributes[arg].base >= Creature.ATTRIBUTE_MAX) {
                      interaction.followUp({
                        ephemeral: true,
                        content: "Attribute is MAXED OUT!"
                      })
                      return;
                    } else {
                      // @ts-expect-error
                      creature.$.attributes[arg].base++;
                    }
                  } else {
                    interaction.followUp({
                      ephemeral: true,
                      content: "Not enough points!"
                    })
                    return;
                  }
                } else {
                  interaction.followUp({
                    ephemeral: true,
                    content: "Invalid attribute"
                  });
                  return;
                }
              }
            } else {
              interaction.followUp({
                ephemeral: true,
                content: `Expendable points: **${creature.totalAttributePointsUsed}**/${creature.$.experience.level}\nPoint assignment is final!`,
                embeds: [await infoEmbed(creature, Bot, "attributes")],
                components: attributeComponents(creature, "Add ", "cedit/$ID/edit/attr/$ATTR")
              })
              return;
            }
          } break;
          case "buy": {
            if (!creature.$.info.locked) {
              interaction.editReply({
                content: "Need to lock in before using shops."
              })
              return;
            }

            const location = creature.location;
            if (!location?.shop?.$.content) {
              interaction.editReply({
                content: "No shop content available here."
              })
              return;
            }

            if (interaction.isSelectMenu()) {
              const cart: number[] = [];
              for (const want of interaction.values) {
                if (!isNaN(Number(want)) && location.shop.$.content.length > Number(want))
                  cart.push(Math.abs(Number(want)))
              }
              console.log(cart)
              for (const id of cart) {
                const thing = location.shop.$.content[id];
                if (!thing) {
                  await interaction.followUp({
                    content: `[**${id}**] Errored`
                  });
                  continue;
                }

                try {
                  for (const mat in thing.cost) {
                    // @ts-expect-error
                    const material: number = thing.cost[mat];
        
                    // @ts-expect-error
                    if (creature.$.items.crafting_materials[mat] < material) throw new Error(`${capitalize(mat)}`)
                  }
                } catch (e: any) {
                  interaction.followUp({
                    content: `[**${id}**] Cannot afford; ${e?.message}`,
                    ephemeral: true
                  });
                  continue;
                }

                var log: AbilityUseLog;
                switch (thing.type) {
                  default: await interaction.followUp({
                    content: `[**${id}**] Errored`
                  }); continue;
                  case "item": {
                    const item = ItemManager.map.get(thing.id);

                    log = {
                      text: `Received **${item?.$.info.name}** item`
                    }
                    creature.$.items.backpack.push(thing.id);
                  } break;
                  case "service": {
                    try {
                      log = await thing.onBuy(creature);
                    } catch (e) {
                      console.error(e);
                      await interaction.followUp({
                        content: `[**${id}**] Errored`,
                        ephemeral: true
                      }); continue;
                    }
                  } break;
                }

                for (const mat in thing.cost) {
                  // @ts-expect-error
                  creature.$.items.crafting_materials[mat] -= thing.cost[mat];
                }

                await interaction.followUp({
                  content: `[**${id}**] ${log.text}`,
                  embeds: function() {
                    const array: MessageEmbed[] = [];

                    for (const dmg of log.damageLogs ?? []) {
                      array.push(damageLogEmbed(dmg));
                    }

                    return array;
                  }() || undefined,
                  ephemeral: true
                }); continue;

              }
            }            
          } break;
          case "gm": {
            if (!IS_GM) {
              interaction.followUp({
                ephemeral: true,
                content: "Not enough permissions (Must be GM)"
              });
              return;
            }

            switch (args.shift()) {
              case "heal": {
                await interaction.followUp({
                  ephemeral: true,
                  content: 
                    "Please input heal string using this syntax: `<amount>,<type>` without spaces, whole numbers, and without %.\n" +
                    "Possible values:\n" +
                    "`<amount>` - A positive integer\n`<type` - `Health` `Mana` `Shield` `Overheal` `Injuries`\n" +
                    "ex. `25,Health`"
                });

                var inputmsg = await messageInput(channel, interaction.user.id).catch(() => "#");
                if (inputmsg === "#") {
                  interaction.followUp({
                    ephemeral: true,
                    content: "Cancelled"
                  });
                  return;
                }

                const input = inputmsg.split(",");

                try {
                  // @ts-expect-error
                  creature.heal(Number(input[0]), HealType[input[1]]);
                } catch (e) {
                  console.error(e);
                  interaction.followUp({
                    ephemeral: true,
                    content: "Error!"
                  });
                  return;
                }

              } break;
              case "tick": {
                creature.tick();
              }
              case "item": {
                if (interaction.isButton()) {
                  switch (args.shift()) {
                    case "add": {
                      await interaction.followUp({
                        ephemeral: true,
                        content: "Please input a comma separated list of item IDs, ex. \`starter_shield,starter_revolver\`"
                      });

                      let items = (await messageInput(channel, interaction.user.id)).split(/,/g);

                      var invalid_count = 0;
                      for (const i of items) {
                        const item = ItemManager.map.get(i);
                        if (!item?.$.id) {
                          invalid_count++;
                          continue;
                        }

                        creature.$.items.backpack.push(item.$.id);
                      }

                      if (invalid_count > 0)
                        interaction.followUp(({
                          ephemeral: true,
                          content: `${invalid_count} items were invalid and have not been added!`
                        }))
                    } break;
                    case "remove": {
                      const items: MessageSelectOptionData[] = [];

                      for (const i of creature.$.items.backpack) {
                        const item = ItemManager.map.get(i);
                        if (!item) continue;

                        items.push({
                          label: item.$.info.name,
                          value: item.$.id ?? ""
                        })
                      }

                      if (items.length == 0) {
                        interaction.followUp({
                          ephemeral: true,
                          content: "Backpack is empty!"
                        });
                        return;
                      }

                      interaction.followUp({
                        ephemeral: true,
                        content: "Select items from backpack. (To remove equipped items de-equip them first)",
                        components: backpackItemComponents(creature_id, items, `cedit/${creature_id}/edit/gm/item/remove`)
                      })
                      return;
                    } break;
                  }
                } else if (interaction.isSelectMenu()) {
                  switch (args.shift()) {
                    case "remove": {
                      for (const i of interaction.values) {
                        creature.$.items.backpack.splice(creature.$.items.backpack.findIndex((v) => v === i),1);
                      }
                    } break;
                  }
                }
              } break;
              case "skill": {
                if (interaction.isButton()) {
                  switch (args.shift()) {
                    case "add": {
                      await interaction.followUp({
                        ephemeral: true,
                        content: "Please input a comma separated list of item IDs, ex. \`some_skill,another_skill\`"
                      });

                      let skills = (await messageInput(channel, interaction.user.id)).split(/,/g);

                      var invalid_count = 0;
                      for (const i of skills) {
                        const skill = SkillManager.map.get(i);
                        if (!skill?.$.id) {
                          invalid_count++;
                          continue;
                        }

                        creature.$.items.skills.add(skill.$.id);
                      }

                      const unique_collisions: string[] = [];
                      const uniques: string[] = [];
                      for (const s of creature.$.items.skills) {
                        const skill = SkillManager.map.get(s);
                        if (!skill) continue;

                        for (const u of skill.$.unique ?? []) {
                          if (uniques.includes(u)) {
                            if (!unique_collisions.includes(u))
                              unique_collisions.push(u);
                          } else {
                            uniques.push(u);
                          }
                        }
                      }

                      if (unique_collisions.length > 0) {
                        interaction.followUp({
                          ephemeral: true,
                          content: 
                            `**WARNING!** multiple skills have the same unique flags and therefore are violating __uniqueness__!` + 
                            `These will not work together, and only one of them for each unique flag will work!\n` +
                            `Remove one of the colliding skills if you want to avoid unexpected behavior\n` +
                            `Violated uniques: **${unique_collisions.join("**, **")}**`
                        })
                      }

                      if (invalid_count > 0)
                        interaction.followUp({
                          ephemeral: true,
                          content: `${invalid_count} skills were invalid or the creature already has them and have not been added!`
                        })
                    } break;
                    case "remove": {
                      const skills: MessageSelectOptionData[] = [];

                      for (const s of creature.$.items.skills) {
                        const skill = SkillManager.map.get(s);
                        if (!skill) continue;

                        skills.push({
                          label: skill.$.info.name,
                          value: skill.$.id ?? ""
                        })
                      }

                      if (skills.length == 0) {
                        interaction.followUp({
                          ephemeral: true,
                          content: "Skill list is empty!"
                        });
                        return;
                      }

                      interaction.followUp({
                        ephemeral: true,
                        content: "Select skills from creature.",
                        components: backpackItemComponents(creature_id, skills, `cedit/${creature_id}/edit/gm/skill/remove`)
                      })
                      return;
                    } break;
                  }
                } else if (interaction.isSelectMenu()) {
                  switch (args.shift()) {
                    case "remove": {
                      for (const i of interaction.values) {
                        creature.$.items.skills.delete(i);
                      }
                    } break;
                  }
                }
              } break;
              case "effect": {
                switch (args.shift()) {
                  case "apply": {
                    await interaction.followUp({
                      ephemeral: true,
                      content: `Please type in the Effect id followed by severity, then amount of ticks. Ex. \`bleeding,2,5\``
                    });
    
                    var inputmsg = await messageInput(channel, interaction.user.id).catch(() => "#");
                    if (inputmsg === "#") {
                      interaction.followUp({
                        ephemeral: true,
                        content: "Cancelled"
                      });
                      return;
                    }

                    const input = inputmsg.split(",");

                    try {
                      const effect = {
                        id: input[0],
                        severity: Number(input[1]),
                        ticks: Number(input[2])
                      }

                      if (isNaN(effect.ticks) || isNaN(effect.severity)) throw new Error("Effect composition error.");

                      if (!creature.applyActiveEffect(effect, true)) throw new Error("Error applying effect!")
                    } catch (e) {
                      console.error(e);
                      interaction.followUp({
                        ephemeral: true,
                        content: "Error!"
                      });
                      return;
                    }

                  } break;
                  case "clear_all": {
                    if (interaction.isButton()) {
                      interaction.followUp({
                        ephemeral: true,
                        content: "Please select wipe type",
                        components: [wipeType(creature_id)]
                      })
                      return;
                    } else if (interaction.isSelectMenu()) {
                      // @ts-ignore
                      creature.clearAllEffects(interaction.values[0]);
                    }
                  } break;
                  case "clear": {
                    if (interaction.isButton()) {
                      `cedit/${creature_id}/edit/gm/effect/clear`
                      await interaction.followUp({
                        ephemeral: true,
                        content: `Please type in the Effect id`
                      });
      
                      var inputmsg = await messageInput(channel, interaction.user.id).catch(() => "#");
                      if (inputmsg === "#") {
                        interaction.followUp({
                          ephemeral: true,
                          content: "Cancelled"
                        });
                        return;
                      }

                      const components = [wipeType(creature_id)];
                      components[0].components[0].customId += `/${inputmsg}`

                      interaction.followUp({
                        ephemeral: true,
                        content: "Please select wipe type",
                        components
                      })
                      return;
                    } else if (interaction.isSelectMenu()) {
                      // @ts-ignore
                      if(!creature.clearActiveEffect(args.shift(), interaction.values[0])) {
                        interaction.followUp({
                          ephemeral: true,
                          content: "Errored. Perhaps the effect does not exist or isn't applied to this Creature?"
                        })
                        return;
                      } 
                    }
                  } break;
                }
              } break;
              case "exp": {
                switch (args.shift()) {
                  default: return;
                  case "lv": {
                    switch (args.shift()) {
                      default: return;
                      case "+": {
                        creature.$.experience.level++;
                      } break;
                      case "-": {
                        creature.$.experience.level--;
                      } break;
                      case "set": {
                        interaction.followUp({
                          content: "Please input a positive integer in chat",
                          ephemeral: true
                        })
                        const input = Math.round(Number(await messageInput(channel, interaction.user.id)));
                        if (isNaN(input) || input < 1) {
                          interaction.editReply({
                            content: "Invalid level. Must be a positive integer."
                          })
                          return;
                        }
                        creature.$.experience.level = input;
                      } break;
                    } break;
                  } break;
                }
              } break;
            } break;
          } break;
        }

        await creature.put(db);
        interaction.followUp({
          ephemeral: true,
          content: "Saved!"
        })
      } break;
    }
  }
)

export function ceditMenu(creature: Creature): MessageActionRow[] {
  const array = [
    new MessageActionRow().addComponents([
      new MessageButton()
        .setCustomId(`cedit/${creature.$._id}/edit/name`)
        .setStyle("SECONDARY")
        .setLabel("Change Name"),
      new MessageButton()
        .setCustomId(`cedit/${creature.$._id}/edit/avatar`)
        .setStyle("SECONDARY")
        .setLabel("Change Avatar"),
      new MessageButton()
        .setCustomId(`cedit/${creature.$._id}/edit/attr`)
        .setStyle("SUCCESS")
        .setLabel("Assign Attributes")
    ]),
    new MessageActionRow().addComponents([
      new MessageButton()
        .setCustomId(`cedit/${creature.$._id}/edit/weapon_switch`)
        .setStyle("PRIMARY")
        .setLabel("Switch Weapons"),
      new MessageButton()
        .setCustomId(`cedit/${creature.$._id}/edit/item/equip`)
        .setStyle("SECONDARY")
        .setLabel("Equip Item"),
      new MessageButton()
        .setCustomId(`cedit/${creature.$._id}/edit/item/unequip`)
        .setStyle("SECONDARY")
        .setLabel("Unequip Item"),
      new MessageButton()
        .setCustomId(`cedit/${creature.$._id}/edit/item/use`)
        .setStyle("PRIMARY")
        .setLabel("Consume Items"),
      new MessageButton()
        .setCustomId(`cedit/${creature.$._id}/edit/item/scrap`)
        .setStyle("DANGER")
        .setLabel("Scrap Items")
    ]),
    new MessageActionRow().addComponents([
      new MessageSelectMenu()
        .setCustomId(`cedit/${creature.$._id}/edit/species`)
        .setPlaceholder("Change Species")
        .addOptions(function() {
        const array: MessageSelectOptionData[] = [];

        for (const species of SpeciesManager.map.values()) {
          array.push({
            label: species.$.info.name + (species.$.playable ? "" : " (Unplayable)"),
            value: species.$.id,
            description: removeMarkdown(species.$.info.lore)
          })
        }

        return [...new Set(array)];
      }())
    ]),
    new MessageActionRow().addComponents([
      new MessageSelectMenu()
        .setCustomId(`cedit/${creature.$._id}/edit/class`)
        .setPlaceholder("Change Class")
        .addOptions(function() {
        const array: MessageSelectOptionData[] = [];

        for (const itemclass of ClassManager.map.values()) {
          if (itemclass.$.compatibleSpecies.length == 0 || itemclass.$.compatibleSpecies.includes(creature.$.info.species))
            array.push({
              label: itemclass.$.info.name,
              value: itemclass.$.id,
              description: removeMarkdown(itemclass.$.info.lore)
            })
        }

        if (array.length == 0) {
          array.push({
            label: "Not Found",
            value: "nothing",
            description: "No compatible kits found"
          })
        }

        return array;
      }())
    ]),
  ];

  if (!creature.$.info.locked) {
    array.push(new MessageActionRow().setComponents([
      new MessageButton()
        .setCustomId(`cedit/${creature.$._id}/edit/lock`)
        .setStyle("SUCCESS")
        .setLabel("Lock n Load"),
      new MessageButton()
        .setCustomId(`cedit/${creature.$._id}/delete`)
        .setStyle("DANGER")
        .setLabel("Delete")
    ]))
  } else {
    array.push(new MessageActionRow().setComponents([
      new MessageButton()
        .setCustomId(`cedit/${creature.$._id}/delete`)
        .setStyle("DANGER")
        .setLabel("Delete")
    ]))
  }

  return array;
}

export function gm_ceditMenu(creature_id: string): MessageActionRow[] {
  return [
    new MessageActionRow().addComponents([
      new MessageButton()
        .setCustomId(`cedit/${creature_id}/edit/gm/tick`)
        .setStyle("PRIMARY")
        .setLabel("Advance Tick"),
      new MessageButton()
        .setCustomId(`cedit/${creature_id}/edit/gm/damage`)
        .setStyle("DANGER")
        .setDisabled(true)
        .setLabel("Deal Damage (CLI Only)"),
      new MessageButton()
        .setCustomId(`cedit/${creature_id}/edit/gm/heal`)
        .setStyle("SUCCESS")
        .setLabel("Heal")
    ]),
    new MessageActionRow().addComponents([
      new MessageButton()
        .setCustomId(`cedit/${creature_id}/edit/gm/effect/apply`)
        .setStyle("PRIMARY")
        .setDisabled(true)
        .setLabel("Apply Effect (CLI Only)"),
      new MessageButton()
        .setCustomId(`cedit/${creature_id}/edit/gm/effect/clear`)
        .setStyle("PRIMARY")
        .setDisabled(true)
        .setLabel("Clear Effect (CLI Only)"),
      new MessageButton()
        .setCustomId(`cedit/${creature_id}/edit/gm/effect/clear_all`)
        .setStyle("SECONDARY")
        .setLabel("Clear All Effects")
    ]),
    new MessageActionRow().addComponents([
      new MessageButton()
        .setCustomId(`cedit/${creature_id}/edit/gm/item/add`)
        .setStyle("PRIMARY")
        .setDisabled(true)
        .setLabel("Add Item (CLI Only)"),
      new MessageButton()
        .setCustomId(`cedit/${creature_id}/edit/gm/item/remove`)
        .setStyle("SECONDARY")
        .setLabel("Remove Item"),
      new MessageButton()
        .setCustomId(`cedit/${creature_id}/edit/gm/skill/add`)
        .setStyle("PRIMARY")
        .setDisabled(true)
        .setLabel("Add Skill (CLI Only)"),
      new MessageButton()
        .setCustomId(`cedit/${creature_id}/edit/gm/skill/remove`)
        .setStyle("SECONDARY")
        .setLabel("Remove Skill"),
    ]),
    new MessageActionRow().setComponents([
      new MessageButton()
        .setCustomId(`cedit/${creature_id}/edit/gm/exp/lv/set`)
        .setStyle("SECONDARY")
        .setLabel("Set Level"),
      new MessageButton()
        .setCustomId(`cedit/${creature_id}/edit/gm/exp/lv/+`)
        .setStyle("PRIMARY")
        .setLabel("Increment Level"),
      new MessageButton()
        .setCustomId(`cedit/${creature_id}/edit/gm/exp/lv/-`)
        .setStyle("SECONDARY")
        .setLabel("Decrement Level"),
      new MessageButton()
        .setCustomId(`cedit/${creature_id}/edit/attr/!clear`)
        .setStyle("DANGER")
        .setLabel("Clear Attributes")
    ])
  ]
}


export function wipeType(creature_id: string) {
  return new MessageActionRow().addComponents([
    new MessageSelectMenu()
      .setCustomId(`cedit/${creature_id}/edit/gm/effect/clear_all`)
      .setOptions([
        {
          label: "Delete",
          value: "delete",
          description: "Clear the effects and call their onDelete function (recommended)"
        },
        {
          label: "Expire",
          value: "expire",
          description: "Simulate natural expiration of the effects"
        }
      ])
  ])
}

export function backpackItemComponents(creature_id: string, items: MessageSelectOptionData[], goto: string) {
  const array: MessageActionRow[] = [];
  
  for (var i = 0; i < items.length;) {
    const subitems: MessageSelectOptionData[] = [];
    for (var j = 0; j < 25; j++) {
      if (!items[i]) break;

      const index = subitems.findIndex((v) => v.value === items[i].value);
      if (index == -1) {
        subitems.push(items[i]);
      } else {
        subitems[index].description = "Multiple of the same item found, command affects only one"
      }
      i++;
    }
    array.push(
      new MessageActionRow().addComponents([
        new MessageSelectMenu()
          .setCustomId(goto)
          .setOptions(subitems)
          .setMinValues(1)
          .setMaxValues(subitems.length)
      ])
    )
    if (array.length >= 5) break;
  }

  return array;
}

export function attributeComponents(creature: Creature, prefix: string, customid: string) {
  const array: MessageActionRow[] = [];

  let row = new MessageActionRow();
  for (const a in creature.$.attributes) {
    row.addComponents(new MessageButton()
      .setCustomId(customid.replace("$ID", creature.$._id).replace("$ATTR", a))
      .setLabel(`${prefix}${a}`)
      .setStyle("PRIMARY")
    )
    if (row.components.length >= 5) {
      array.push(new MessageActionRow().setComponents(JSON.parse(JSON.stringify(row.components))));
      row = new MessageActionRow();
    }
  }
  if (row.components.length != 0)
    array.push(row);

  return array;  
}