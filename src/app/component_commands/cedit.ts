import { ButtonInteraction, CommandInteraction, MessageActionRow, MessageButton, MessageEmbed, MessageSelectMenu, MessageSelectOptionData } from "discord.js";
import Mongoose from "mongoose";
import { capitalize, ClassManager, CONFIG, ItemManager, limitString, LootTables, messageInput, PerkManager, removeMarkdown, SchematicsManager, SkillManager, SpeciesManager } from "../..";
import { CraftingMaterials } from "../../game/Crafting";
import Creature, { HealType } from "../../game/Creature";
import { AbilityUseLog } from "../../game/CreatureAbilities";
import { DamageCause, DamageGroup, damageLogEmbed, DamageMethod, DamageType, ShieldReaction } from "../../game/Damage";
import { createItem, Item, ItemQualityEmoji } from "../../game/Items";
import { LootTable } from "../../game/LootTables";
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

        if (!IS_GM && !creature.alive) {
          interaction.followUp({
            ephemeral: true,
            content: "You're dead..."
          });
          return;
        }

        switch(args.shift()) {
          case "name": {
            await interaction.followUp({
              ephemeral: true,
              content: "Please input the name in chat. Use `#` to cancel or wait."
            });

            const input = await messageInput(channel, interaction.user.id);
            input.delete();
            if (input.content === "#") {
              interaction.followUp({
                ephemeral: true,
                content: "Cancelled"
              });
              return;
            }

            creature.$.info.display.name = input.content; 
          } break;
          case "avatar": {
            await interaction.followUp({
              ephemeral: true,
              content: "Please input the avatar URL in chat. Use `#` to cancel or wait."
            });

            if (!channel?.isText()) throw new Error("Invalid channel");

            const input = await messageInput(channel, interaction.user.id);
            input.delete();
            if (input.content === "#") {
              interaction.followUp({
                ephemeral: true,
                content: "Cancelled"
              });
              return;
            }

            creature.$.info.display.avatar = input.content; 
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
                  "Are you sure? You will not be able to edit the Species of your character anymore, and you will lose the Class and all items, but you'll gain the ability to use the character!\n" +
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

              creature.wipeItems();
              creature.$.info.class = undefined;
              creature.$.experience = {
                level: 1
              }
              creature.clearAttributes();

              creature.$.info.locked = true;
            }
          } break;
          case "class": {
            if (!IS_GM && await creature.getFightID(db)) {
              interaction.followUp({
                ephemeral: true,
                content: "Cannot do that while fighting!"
              });
              return;
            }

            if (creature.$.info.locked && !IS_GM) {
              if (creature.$.info.class && ClassManager.map.has(creature.$.info.class)) {
                interaction.followUp({
                  ephemeral: true,
                  content: "You cannot change the class."
                });
                return;
              } else if (creature.$.experience.level < Creature.MIN_LEVEL_FOR_CLASS) {
                interaction.followUp({
                  ephemeral: true,
                  content: `You must be level **${Creature.MIN_LEVEL_FOR_CLASS}** or higher to equip a class.`
                });
                return;
              }
            }

            if (interaction.isSelectMenu()) {
              const chosen_class = ClassManager.map.get(interaction.values[0]);
              if (!chosen_class) {
                interaction.followUp({
                  ephemeral: true,
                  content: "Invalid class!"
                })
                return;
              }

              if (chosen_class.$.compatibleSpecies.size > 0 && !chosen_class.$.compatibleSpecies.has(creature.$.info.species)) {
                interaction.followUp({
                  ephemeral: true,
                  content: "Class incompatible with race"
                })
                return;
              }

              if (creature.$.info.locked) {
                interaction.followUp({
                  ephemeral: true,
                  content: 
                    `Picked - **${chosen_class.$.info.name}** \`${chosen_class.$.id}\`\n` +
                    "Please hit the button to confirm. You cannot change this later!\n" +
                    "You can safely dismiss this message.",
                  components: [
                    new MessageActionRow().setComponents([
                      new MessageButton()
                        .setCustomId(`cedit/${creature.$._id}/edit/class/${chosen_class.$.id}`)
                        .setLabel("Confirm")
                        .setStyle("DANGER")
                    ])
                  ]
                })
              } else {
                let dump = creature.dump();
                // @ts-expect-error
                dump.info.class = chosen_class.$.id;
  
                creature = new Creature(dump);
  
                interaction.followUp({
                  ephemeral: true,
                  content: "Class assigned!"
                })
                creature.put(db);
                return;
              }
              return;
            } else if (interaction.isButton()) {
              const chosen_class = ClassManager.map.get(args.shift() ?? "");
              if (!chosen_class) {
                interaction.followUp({
                  ephemeral: true,
                  content: "Invalid class!"
                })
                return;
              }

              if (chosen_class.$.compatibleSpecies.size > 0 && !chosen_class.$.compatibleSpecies.has(creature.$.info.species)) {
                interaction.followUp({
                  ephemeral: true,
                  content: "Class incompatible with race"
                })
                return;
              }

              let dump = creature.dump();
              // @ts-expect-error
              dump.info.class = chosen_class.$.id;

              creature = new Creature(dump);

              interaction.followUp({
                ephemeral: true,
                content: "Class assigned!"
              })
              creature.put(db);
              return;
            }
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

              if (creature.$.items.primary_weapon)
                creature.$.items.weapons.push(creature.$.items.primary_weapon)
              creature.$.items.primary_weapon = creature.$.items.weapons.splice(index, 1)[0];
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
              return;
            } else return;
          } break;
          case "item": {
            if (interaction.isButton()) {
              switch (args.shift()) {
                case "craft": {
                  if (!IS_GM && await creature.getFightID(db)) {
                    interaction.followUp({
                      ephemeral: true,
                      content: "Cannot do that while fighting!"
                    });
                    return;
                  }

                  const recipe = SchematicsManager.map.get(args.shift() ?? "");
                  if (!recipe?.$.id) return;
                  
                  const pools = LootTables.map.get(recipe.$.table)?.getHighestFromPerks(creature.perkIDs);
                  if (!pools) {
                    interaction.editReply({
                      content: "LootTable error"
                    })
                    return;
                  }
                  const results = LootTable.generate(pools);
          
                  try {
                    if (!creature.schematics.has(recipe.$.id)) throw new Error("Doesn't have the schematic");
                    if (recipe.$.requirements.enhancedCrafting && !creature.location?.$.hasEnhancedCrafting) throw new Error("You cannot craft this item in this location. Go to an area with Enhanced Crafting");
          
                    var perks = creature.perks;
                    for (const p of recipe.$.requirements.perks ?? []) {
                      const perk = PerkManager.map.get(p);
                      if (!perk) continue;
          
                      if (!perks.find((v) => v.$.id === perk.$.id)) throw new Error(`Must have ${perk.$.info.name} \`${perk.$.id}\` perk`)
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
          
                      if (!creature.$.items.backpack.find(v => v.id === item.$.id)) throw new Error(`Item ${item.$.info.name} \`${item.$.id}\` is missing (must be unequipped to count)`)
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
          
                    creature.$.items.backpack.splice(creature.$.items.backpack.findIndex(v => v.id === item.$.id), 1);
                  }
                  for (const mat in recipe.$.requirements.materials) {
                    // @ts-expect-error
                    creature.$.items.crafting_materials[mat] -= recipe.$.requirements.materials[mat];
                  }
          
                  for (const res of results) {
                    const result = ItemManager.map.get(res);
                    if (result)
                     creature.$.items.backpack.push(createItem(result));
                  }
          
                  await creature.put(db);
          
                  await interaction.editReply({
                    content: `You got **${function() {
                      const names: string[] = [];
          
                      for (const res of results) {
                        const result = ItemManager.map.get(res);
                        if (result)
                          names.push(`${ItemQualityEmoji[result.$.info.quality]} ${result.$.info.name}`)
                      }
          
                      return names.join("**, **");
                    }() || "Nothing"}**!`
                  })
                  return;
                } break;
                case "scrap": {
                  await scrapMenu(interaction, creature, db, IS_GM);
                  return;
                } break;
                case "use": {
                  await consumeMenu(interaction, creature);
                  return;
                } break;
                case "equip": {
                  if (!IS_GM && await creature.getFightID(db)) {
                    interaction.followUp({
                      ephemeral: true,
                      content: "Cannot do that while fighting!"
                    });
                    return;
                  }

                  const items: MessageSelectOptionData[] = [];

                  for (const i of creature.$.items.backpack) {
                    const item = ItemManager.map.get(i.id);
                    if (!item || item.$.type === "consumable") continue;

                    items.push({
                      label: item.$.info.name,
                      emoji: ItemQualityEmoji[item.$.info.quality],
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
                    components: backpackItemComponents(items, `cedit/${creature_id}/edit/item/equip`)
                  })
                  return;
                } break;
                case "unequip": {
                  if (!IS_GM && await creature.getFightID(db)) {
                    interaction.followUp({
                      ephemeral: true,
                      content: "Cannot do that while fighting!"
                    });
                    return;
                  }

                  if (creature.inventoryItems.length === 0) {
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

                          const items = creature.inventoryItems;
                          for (var i = 0; i < items.length; i++) {
                            const item = ItemManager.map.get(items[i].id);
                            if (!item) continue;

                            array.push({
                              label: item.$.info.name,
                              emoji: ItemQualityEmoji[item.$.info.quality],
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

                      const index = creature.$.items.backpack.findIndex((v) => v.id === item.$.id);
                      if (index === -1) throw new Error("Creature doesn't have item " + item.$.id);
                    
                      const log = await item.$.onUse(creature);

                      const table = LootTables.map.get(item.$.returnTable ?? "");

                      if (table) {
                        const returns = LootTable.generate(table.getHighestFromPerks(creature.perkIDs));
                        creature.$.items.backpack.splice(index, 1, ...function() {
                          const arr = [];

                          for (const r of returns) {
                            arr.push(createItem(r))
                          }

                          return arr;
                        }());

                        log.returns = [];
                        for (const i of returns) {
                          const item = ItemManager.map.get(i);
                          if (item)
                            returns.push(item.displayName);
                        }
                      } else {
                        creature.$.items.backpack.splice(index, 1);
                      }

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
                      content: `${log.text}` + (
                        log.returns
                        ? `\n\nItem Returns: **${log.returns.join("**, **")}**`
                        : ""
                      ),
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

                  creature.put(db);
                  return;
                } break;
                case "scrap": {
                  if (!IS_GM && await creature.getFightID(db)) {
                    interaction.followUp({
                      ephemeral: true,
                      content: "Cannot do that while fighting!"
                    });
                    return;
                  }

                  if (!creature.$.info.locked && !creature.$.info.npc) {
                    interaction.editReply({
                      content: "You must lock in before scrapping or crafting items"
                    })
                    return;
                  }

                  const gained = new CraftingMaterials({});
                  let count = 0;

                  for (const i of interaction.values) {
                    const index = creature.$.items.backpack.findIndex(v => v.id === i);
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
                  if (!IS_GM && await creature.getFightID(db)) {
                    interaction.followUp({
                      ephemeral: true,
                      content: "Cannot do that while fighting!"
                    });
                    return;
                  }

                  for (const i of interaction.values) {
                    const data = ItemManager.map.get(i);
                    switch (data?.$.type) {
                      case "weapon": {
                        creature.$.items.backpack.push(creature.$.items.weapons.splice(creature.$.items.weapons.findIndex(v => v.id === i), 1)[0]);
                      } break;
                      case "wearable": {
                        const item = creature.$.items.slotted[data.$.slot];
                        if (item) {
                          creature.$.items.backpack.push(item);
                        }
                        creature.$.items.slotted[data.$.slot] = null;
                      } break;
                    }
                  }
                } break;
                case "equip": {
                  if (!IS_GM && await creature.getFightID(db)) {
                    interaction.followUp({
                      ephemeral: true,
                      content: "Cannot do that while fighting!"
                    });
                    return;
                  }

                  for (const i of interaction.values) {
                    const data = ItemManager.map.get(i);
                    switch (data?.$.type) {
                      case "weapon": {
                        creature.$.items.weapons.push(creature.$.items.backpack.splice(creature.$.items.backpack.findIndex(v => v.id === i), 1)[0]);
                      } break;
                      case "wearable": {
                        const index = creature.$.items.backpack.findIndex(v => v.id === i);
                        if (index === -1) continue;

                        const item = creature.$.items.backpack.splice(index, 1)[0];
                        if (item) {
                          const equipped = creature.$.items.slotted[data.$.slot];
                          if (equipped) {
                            creature.$.items.backpack.push(equipped);
                          }
                          creature.$.items.slotted[data.$.slot] = item;
                          
                          if (data.$.slot === "ultimate")
                            creature.$.abilities.ult_stacks = 0;
                        }
                      } break;
                    }
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

                if (!IS_GM && await creature.getFightID(db)) {
                  interaction.followUp({
                    ephemeral: true,
                    content: "Cannot do that while fighting!"
                  });
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
              if (!IS_GM && await creature.getFightID(db)) {
                interaction.followUp({
                  ephemeral: true,
                  content: "Cannot do that while fighting!"
                });
                return;
              }

              interaction.followUp({
                ephemeral: true,
                content: `Expendable points: **${creature.totalAttributePointsUsed}**/${creature.$.experience.level}\nPoint assignment is final!`,
                embeds: [(await infoEmbed(creature, Bot, "attributes")).embed],
                components: attributeComponents(creature, "Add ", "cedit/$ID/edit/attr/$ATTR")
              })
              return;
            }
          } break;
          case "buy": {
            if (!IS_GM && await creature.getFightID(db)) {
              interaction.followUp({
                ephemeral: true,
                content: "Cannot do that while fighting!"
              });
              return;
            }

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
                    creature.$.items.backpack.push(createItem(thing.id));
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
          if (itemclass.$.compatibleSpecies.size == 0 || itemclass.$.compatibleSpecies.has(creature.$.info.species))
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

export function backpackItemComponents(items: MessageSelectOptionData[], goto: string) {
  const array: MessageActionRow[] = [];
  
  for (var i = 0; i < items.length;) {
    const subitems: MessageSelectOptionData[] = [];
    const map_count = new Map<number, number>();
    for (var j = 0; j < 25; j++) {
      if (!items[i]) break;

      const index = subitems.findIndex((v) => v.value === items[i].value);
      if (index == -1) {
        subitems.push(items[i]);
      } else {
        map_count.set(index, Number(map_count.get(index) ?? 1) + 1);
      }
      i++;
    }

    for (const [index, count] of map_count) {
      subitems[index].label += ` x${count}`;
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

export async function scrapMenu(interaction: ButtonInteraction | CommandInteraction, creature: Creature, db: typeof Mongoose, IS_GM: boolean) {
  if (!IS_GM && await creature.getFightID(db)) {
    interaction.followUp({
      ephemeral: true,
      content: "Cannot do that while fighting!"
    });
    return;
  }

  if (!creature.$.info.locked && !creature.$.info.npc) {
    interaction.editReply({
      content: "You must lock in before scrapping or crafting items"
    })
    return;
  }

  const items: MessageSelectOptionData[] = [];

  for (const i of creature.$.items.backpack) {
    const item = ItemManager.map.get(i.id);
    if (!item) continue;

    const scrap: string[] = [];
    if (item.$.scrap) {
      for (const mat in item.$.scrap.materials) {
        // @ts-expect-error
        scrap.push(`${item.$.scrap.materials[mat]} ${capitalize(mat)}`)
      }
    }

    items.push({
      label: item.$.info.name,
      emoji: ItemQualityEmoji[item.$.info.quality],
      description: scrap.join(", "),
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
    components: backpackItemComponents(items, `cedit/${creature.$._id}/edit/item/scrap`)
  })
}

export async function consumeMenu(interaction: ButtonInteraction | CommandInteraction, creature: Creature) {
  const items: MessageSelectOptionData[] = [];

  for (const i of creature.$.items.backpack) {
    const item = ItemManager.map.get(i.id);
    if (item?.$.type !== "consumable") continue;

    items.push({
      label: item.$.info.name,
      emoji: ItemQualityEmoji[item.$.info.quality],
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
    components: backpackItemComponents(items, `cedit/${creature.$._id}/edit/item/use`)
  });
}