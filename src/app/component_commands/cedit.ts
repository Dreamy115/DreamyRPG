import { ButtonInteraction, ColorResolvable, CommandInteraction, Message, MessageActionRow, MessageButton, MessageEmbed, MessageSelectMenu, MessageSelectOptionData } from "discord.js";
import Mongoose from "mongoose";
import { capitalize, clamp, CONFIG, invLerp, ItemManager, lerp, limitString, LootTables, messageInput, removeMarkdown, removeVowels, SchematicsManager, SpeciesManager } from "../..";
import { CraftingMaterials, Material } from "../../game/Crafting";
import Creature, { Attributes, CreatureDump } from "../../game/Creature";
import { AbilityUseLog } from "../../game/CreatureAbilities";
import { damageLogEmbed, healLogEmbed } from "../../game/Damage";
import { createItem, DEFAULT_ITEM_OPT_STEP, EquippableInventoryItem, InventoryItem, Item, ItemQualityColor, ItemQualityEmoji, SpecializedWearableData, WeaponItemData, WearableInventoryItem, WearableItemData } from "../../game/Items";
import { LootTable } from "../../game/LootTables";
import { replaceLore } from "../../game/LoreReplacer";
import { ModuleType, ModuleTypeEmoji } from "../../game/Modules";
import { TrackableStat } from "../../game/Stats";
import { infoEmbed, tableDescriptor } from "../commands/char";
import { modifierDescirptor, namedModifierDescriptor } from "../commands/handbook";
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

    const message = interaction.message as Message;

    const channel = message.channel ?? await interaction.guild?.channels.fetch((interaction.message as Exclude<typeof interaction.message, Message>).channel_id ?? message.channelId).catch(() => null);
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

            let dump = creature.dump();
            (dump.info as Exclude<CreatureDump["info"], undefined>).species = interaction.values[0];

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
              creature.clearAttributes();

              creature.$.info.locked = true;
            }
          } break;
          case "weapon_switch": {
            if (await creature.getFightID(db).catch(() => null)) {
              interaction.followUp({
                ephemeral: true,
                content: "Use the weapon switch from the fight menu instead."
              });
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

              if (creature.$.items.primary_weapon)
                creature.$.items.weapons.push(creature.$.items.primary_weapon)
              creature.$.items.primary_weapon = creature.$.items.weapons.splice(index, 1)[0];
              
              creature.reload();

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
                case "modify": {
                  if (!IS_GM) {
                    if (await creature.getFightID(db)) {
                      interaction.followUp({
                        ephemeral: true,
                        content: "Cannot do that while fighting!"
                      });
                      return;
                    }
                    if (!creature.location?.$.hasEnhancedCrafting) {
                      interaction.followUp({
                        ephemeral: true,
                        content: "The location you're in must have Enhanced Crafting."
                      })
                      return;
                    }
                  }

                  switch (args.shift()) {
                    default: {
                      const opt_items: MessageSelectOptionData[] = [];
                      const rec_items: MessageSelectOptionData[] = [];

                      for (const i in creature.$.items.backpack) {
                        const _it = creature.$.items.backpack[i];
                        const item = ItemManager.map.get(_it?.id);
                        if (item?.$.type === "wearable" || item?.$.type === "weapon") {
                          const it = _it as EquippableInventoryItem;
                          if (item.$.optimize_cost)
                            opt_items.push({
                              label: `${capitalize((item.$ as SpecializedWearableData).slot ?? item.$.type)}: ${item.$.info.name}`,
                              emoji: ItemQualityEmoji[item.$.info.quality],
                              value: i,
                              description: limitString(removeMarkdown(
                                `${removeVowels((item.$ as SpecializedWearableData).slot ?? item.$.type).toUpperCase()} ` + (
                                  it.modifier_modules ? function() {
                                    const _mods: string[] = [];
                                    for (const mod of it.modifier_modules ?? []) {
                                      const reference = (item.$ as WearableItemData | WeaponItemData).modifier_module?.mods.get(mod.stat);
                                      _mods.push(`${namedModifierDescriptor(mod)} _(${reference ? `${`**${
                                        reference.range[0] === reference.range[1]
                                        ? ""
                                        : (100 * invLerp(mod.value, reference.range[0], reference.range[1])).toFixed(1)
                                      }%**`}` : "NUL"})_`);
                                    }
                                    return _mods.join(", ")
                                  }() : ""
                                )).trim(),
                                100
                              )
                            })
                          if (item.$.recalibrate_cost && it.modifier_modules) {
                            rec_items.push({
                              label: `${capitalize((item.$ as SpecializedWearableData).slot ?? item.$.type)}: ${item.$.info.name}`,
                              emoji: ItemQualityEmoji[item.$.info.quality],
                              value: i,
                              description: limitString(
                                removeMarkdown(
                                  function() {
                                    const _mods: string[] = [];
                                    for (const mod of (it as EquippableInventoryItem)?.modifier_modules ?? []) {
                                      const reference = (item.$ as WearableItemData | WeaponItemData).modifier_module?.mods.get(mod.stat);
                                      _mods.push(`${namedModifierDescriptor(mod)} _(${reference ? `${`**${
                                        reference.range[0] === reference.range[1]
                                        ? ""
                                        : (100 * invLerp(mod.value, reference.range[0], reference.range[1])).toFixed(1)
                                      }%**`}` : "NUL"})_`);
                                    }
                                  return _mods.join(", ")
                                  }()
                                ).trim(), 100
                              )
                            })
                          }
                        }
                      }
    
                      const components: MessageActionRow[] = [];
                      if (opt_items.length > 0) 
                        components.push(new MessageActionRow().setComponents([
                          new MessageSelectMenu()
                            .setCustomId(`cedit/${creature.$._id}/edit/item/modify/optimize`)
                            .setOptions(opt_items)
                            .setMaxValues(1).setMinValues(1)
                            .setPlaceholder("Optimize Items")
                        ]))

                      if (rec_items.length > 0)
                        components.push(new MessageActionRow().setComponents([
                          new MessageSelectMenu()
                            .setCustomId(`cedit/${creature.$._id}/edit/item/modify/recalibrate`)
                            .setOptions(rec_items)
                            .setMaxValues(1).setMinValues(1)
                            .setPlaceholder("Recalibrate Items")
                        ]))

                      if (components.length == 0) {
                        interaction.followUp({
                          ephemeral: true,
                          content: "No modifiable items found in your backpack."
                        });
                        return;
                      }
    
                      interaction.followUp({
                        ephemeral: true,
                        content: "Item Workshop...",
                        components
                      })
                      return;
                    } break;
                    case "optimize": {
                      const index = Number(args.shift());
                      if (isNaN(index)) return;

                      const it: EquippableInventoryItem = creature.$.items.backpack[index];
                      const item = ItemManager.map.get(it?.id);
                      if (
                        !item || (item.$.type !== "wearable" && item.$.type !== "weapon")
                        || !item.$.optimize_cost
                      ) {
                        interaction.followUp({
                          ephemeral: true,
                          content: "Item not optimizable"
                        });
                        return;
                      }

                      try {
                        for (const _mat in item.$.optimize_cost) {
                          const mat = _mat as Material;
                          const material: number = item.$.optimize_cost[mat];
              
                          if (creature.$.items.crafting_materials[mat] < material) throw new Error(`Not enough materials; need more ${capitalize(mat)}`)
                        }
                      } catch (e: any) {
                        interaction.editReply({
                          content: `Your character doesn't meet the requirements:\n*${e?.message}*`
                        });
                        return;
                      }

                      for (const _mat in item.$.optimize_cost) {
                        const mat = _mat as Material;
                        creature.$.items.crafting_materials[mat] -= item.$.optimize_cost[mat];
                      }

                      for (const mod of it.modifier_modules ?? []) {
                        const reference = item.$.modifier_module?.mods.get(mod.stat);
                        if (!reference) continue;
                        
                        const lerped = invLerp(mod.value, reference.range[0], reference.range[1]);
                        mod.value = lerp(clamp(lerped + (item.$.optimize_step ?? DEFAULT_ITEM_OPT_STEP), 0, 1), reference.range[0], reference.range[1]);
                      }

                    } break;
                    case "recalibrate": {
                      const index = Number(args.shift());
                      if (isNaN(index)) return;

                      const it: EquippableInventoryItem = creature.$.items.backpack[index];
                      const item = ItemManager.map.get(it?.id);
                      if (
                        !item || (item.$.type !== "wearable" && item.$.type !== "weapon")
                        || !item.$.recalibrate_cost
                      ) {
                        interaction.followUp({
                          ephemeral: true,
                          content: "Item not recalibrateable"
                        });
                        return;
                      }

                      try {
                        for (const _mat in item.$.recalibrate_cost) {
                          const mat = _mat as Material;
                          const material: number = item.$.recalibrate_cost[mat];
              
                          if (creature.$.items.crafting_materials[mat] < material) throw new Error(`Not enough materials; need more ${capitalize(mat)}`)
                        }
                      } catch (e: any) {
                        interaction.editReply({
                          content: `Your character doesn't meet the requirements:\n*${e?.message}*`
                        });
                        return;
                      }

                      for (const _mat in item.$.recalibrate_cost) {
                        const mat = _mat as Material;
                        creature.$.items.crafting_materials[mat] -= item.$.recalibrate_cost[mat];
                      }

                      it.modifier_modules = (createItem(item) as EquippableInventoryItem).modifier_modules;

                      const _mods: string[] = [];
                      for (const mod of it.modifier_modules ?? []) {
                        const reference = item.$.modifier_module?.mods.get(mod.stat);
                        if (!reference) {
                          _mods.push("Invalid");
                          continue;
                        }

                        _mods.push(`${namedModifierDescriptor(mod)} (**${(100 * invLerp(mod.value, reference.range[0], reference.range[1])).toFixed(1)}%**)`);
                      }

                      creature.put(db);
                      interaction.followUp({
                        ephemeral: true,
                        content: `New Attributes: ${_mods.join(", ")}`
                      })
                      return;
                    } break;
                  }

                } break;
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
                    var e = recipe.check(creature);
                    if (!e[0]) throw new Error(e[1]);
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
                  for (const _mat in recipe.$.requirements.materials) {
                    const mat = _mat as Material;
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
                  const items = args.shift();
                  if (items) {
                    const logs: AbilityUseLog[] = [];
                    const errors: [string, string][] = [];

                    for (const i of items.split(";")) {
                      const item = ItemManager.map.get(i);
                      
                      try {
                        if (item?.$.type !== "consumable") throw new Error(`Item ${i} isn't consumable or doesn't exist`);

                        const index = creature.$.items.backpack.findIndex((v) => v.id === item.$.id);
                        if (index === -1) throw new Error("Creature doesn't have item " + item.$.id);
                      
                        const log = await item.$.onUse?.(creature, db);
                        if (log === undefined) throw new Error("This item cannot be used directly. It must be consumed via an Ability or other means.");

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
                        errors.push([item?.$.id ?? "unknown", (e as Error)?.message ?? e]);
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
                        embeds: (log.vitalsLogs?.length ?? 0 > 0) ? await async function () {
                          const array: MessageEmbed[] = [];

                          for (const vlog of log.vitalsLogs ?? []) {
                            array.push(await (
                              vlog.type === "damage"
                              ? damageLogEmbed(vlog, db)
                              : healLogEmbed(vlog, db)
                            ))
                          }

                          return array;
                        }() : undefined
                      })
                    }

                    if (errors.length > 0) 
                      await interaction.followUp({
                        ephemeral: true,
                        content: `**${errors.length}** item(s) errored and have not been used:\n` + function () {
                          var str = "";

                          for (const e of errors) {
                            str += `\`${e[0]}\` - ${e[1]}\n`
                          }

                          return str;
                        }()
                      })

                    creature.put(db);
                  } else {
                    await consumeMenu(interaction, creature);
                  }
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

                  for (const i in creature.$.items.backpack) {
                    const _it = creature.$.items.backpack[i];
                    const _item = ItemManager.map.get(_it?.id);
                    if (!_item || _item.$.type === "consumable") continue;

                    const data = _item.$;
                    const it = _it as InventoryItem;

                    items.push({
                      label: `${capitalize((data as SpecializedWearableData).slot ?? data.type)}: ${data.info.name}`,
                      emoji: ItemQualityEmoji[data.info.quality],
                      value: i,
                      description: limitString(
                        `${function() {
                          const itm = (it as EquippableInventoryItem | WearableInventoryItem);
                          const _data = (data as unknown as WearableItemData | WeaponItemData);

                          var output = "";
                          if ((itm as WearableInventoryItem).stat_module) {
                            const _itm = itm as WearableInventoryItem;
                            output += `${ModuleTypeEmoji[_itm.stat_module]}${capitalize(ModuleType[_itm.stat_module])}`
                          }
                          if (itm.modifier_modules) {

                            const mods = [...itm.modifier_modules].sort((a, b) => {
                              const range_a = _data.modifier_module?.mods.get(a.stat)?.range ?? [0, 0];
                              const val_a = invLerp(a.value, range_a[0], range_a[1]);

                              const range_b = _data.modifier_module?.mods.get(b.stat)?.range ?? [0, 0];
                              const val_b = invLerp(b.value, range_b[0], range_b[1]);

                              return val_a - val_b;
                            });

                            const str: string[] = [];

                            for (const mod of mods) {
                              str.push(namedModifierDescriptor(mod));
                            }
                            output += ` ${str.join(", ")}`;
                          }

                          return removeMarkdown(output.trim());
                        }()}`,
                        100
                      )
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
                    content: "Items to equip",
                    components: [
                      new MessageActionRow().setComponents([
                        new MessageSelectMenu()
                          .setCustomId(`cedit/${creature.$._id}/edit/item/equip`)
                          .setOptions(items)
                          .setMaxValues(items.length)
                          .setMinValues(1)
                      ])
                    ]
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
                              description: capitalize((item.$ as SpecializedWearableData).slot ?? item.$.type)
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
                        .setMinValues(1)
                        .setMaxValues(creature.inventoryItems.length)
                      ])
                    ]})
                  return;
                } break;
              }
            } else if (interaction.isSelectMenu()) {
              switch (args.shift()) {
                case "use": {
                  const embeds: MessageEmbed[] = [];
                  const items: string[] = [];
                  for (const i of interaction.values) {
                    const item = ItemManager.map.get(i);
                    
                    try {
                      if (item?.$.type !== "consumable") throw new Error(`Item ${i} isn't consumable or doesn't exist`);

                      const index = creature.$.items.backpack.findIndex((v) => v.id === item.$.id);
                      if (index === -1) throw new Error("Creature doesn't have item " + item.$.id);
                    
                      if (!item.$.onUse)
                        throw new Error("This item cannot be used directly. It must be consumed via an Ability or other means.");

                      items.push(item.$.id);

                      const embed = new MessageEmbed()
                        .setColor(ItemQualityColor[item.$.info.quality] as ColorResolvable)
                        .setTitle(item.$.info.name)
                        .setDescription(replaceLore(item.$.info.lore, item.$.info.replacers, creature))
                      
                      if (item.$.returnTable) {
                        const table = LootTables.map.get(item.$.returnTable);
                        if (table) 
                          embed.addField(
                            "Returns",
                            tableDescriptor(table, creature.perkIDs)
                          );
                      }

                      embeds.push(embed);
                    } catch (e) {
                      embeds.push(
                        new MessageEmbed()
                          .setColor("DARK_ORANGE")
                          .setTitle(`?????? ${item?.$.info.name}`)
                          .setDescription((e as Error)?.message)
                      );
                      console.error(e);
                      continue;
                    }
                  }

                  interaction.followUp({
                    ephemeral: true,
                    content: "Use Items",
                    embeds,
                    components: [
                      new MessageActionRow().setComponents([
                        new MessageButton()
                          .setCustomId(`cedit/${creature?.$._id}/edit/item/use/${items.join(";")}`)
                          .setLabel("Confirm")
                          .setStyle("SUCCESS")
                      ])
                    ]
                  })

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

                  for (const i in interaction.values) {
                    const index = Number(i);

                    const it = creature.$.items.backpack[index];

                    const item = ItemManager.map.get(it?.id);
                    if (!item?.$.scrap) continue;

                    for (const _mat in item.$.scrap.materials ?? {}) {
                      const mat = _mat as Material;
                      const material: number = item.$.scrap.materials?.[mat] ?? 0;

                      if (typeof creature.$.items.crafting_materials[mat] === "number") {
                        creature.$.items.crafting_materials[mat] += material;
                        gained[mat] += material;
                      }
                    }

                    delete creature.$.items.backpack[index];
                    count++;
                  }
                  creature.$.items.backpack = creature.$.items.backpack.filter(v => v);

                  interaction.editReply({
                    content: `Scrapped **${count}** items`,
                    embeds: [new MessageEmbed()
                      .setColor("AQUA")
                      .setTitle("Materials Gained")
                      .setDescription(function() {
                        var str = "";

                        for (const mat in gained) {
                          const material: number = gained[mat as Material];

                          if (material !== 0)
                            str += `**${material}** ${capitalize(mat)}\n`;
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
                        if (creature.$.items.primary_weapon?.id === data.$.id) {
                          creature.$.items.backpack.push(creature.$.items.primary_weapon);
                          creature.$.items.primary_weapon = null;
                        } else {
                          creature.$.items.backpack.push(creature.$.items.weapons.splice(creature.$.items.weapons.findIndex(v => v.id === i), 1)[0]);
                        }
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
                    const index = Number(i);

                    const item = creature.$.items.backpack[index];
                    if (!item) continue;

                    const data = ItemManager.map.get(item.id);
                    switch (data?.$.type) {
                      default: continue;
                      case "weapon": {
                        creature.$.items.weapons.push(creature.$.items.backpack[index]);
                      } break;
                      case "wearable": {
                        const equipped = creature.$.items.slotted[data.$.slot];
                        if (equipped) {
                          creature.$.items.backpack.push(equipped);
                        }

                        creature.$.items.slotted[data.$.slot] = item as WearableInventoryItem;
                        
                        if (data.$.slot === "ultimate")
                          creature.$.abilities.ult_stacks = 0;  
                      } break;
                    }

                    delete creature.$.items.backpack[index];
                  }
                  creature.checkItemConflicts();
                } break;
                case "modify": {
                  if (!IS_GM) {
                    if (await creature.getFightID(db)) {
                      interaction.followUp({
                        ephemeral: true,
                        content: "Cannot do that while fighting!"
                      });
                      return;
                    }
                    if (!creature.location?.$.hasEnhancedCrafting) {
                      interaction.followUp({
                        ephemeral: true,
                        content: "The location you're in must have Enhanced Crafting."
                      })
                      return;
                    }
                  }

                  switch (args.shift()) {
                    case "optimize": {
                      const index = Number(interaction.values[0]);

                      const item: EquippableInventoryItem = creature.$.items.backpack[index];
                      const data = ItemManager.map.get(item?.id ?? "");

                      if (!item || (data?.$.type !== "wearable" && data?.$.type !== "weapon") || !data.$.optimize_cost) {
                        interaction.followUp({
                          ephemeral: true,
                          content: "Invalid item or not optimizable"
                        })
                        return;
                      }

                      var reqs = true;
                      try {
                        for (const _mat in data.$.optimize_cost) {
                          const mat = _mat as Material;
                          const material: number = data.$.optimize_cost[mat];

                          if (creature.$.items.crafting_materials[mat] < material) throw new Error(`Not enough materials; need more ${capitalize(mat)}`)
                        }
                      } catch (e: any) {
                        await interaction.editReply({
                          content: `Your character doesn't meet the requirements:\n*${e?.message}*\nShowing anyway...`
                        });
                        reqs = false;
                      }
    
                      interaction.followUp({
                        ephemeral: true,
                        embeds: [
                          new MessageEmbed()
                            .setTitle("Item Optimizing")
                            .setDescription(
                              `**${data.displayName}**\n` +
                              function() {
                                const itm = item as WearableInventoryItem;
                                if (!itm.stat_module) return "";
                                return `**${ModuleType[itm.stat_module]} ${ModuleTypeEmoji[itm.stat_module]}**\n`
                               }() + function() {
                                if ((item.modifier_modules?.length ?? 0) === 0) return "";

                                const str: string[] = [];

                                for (const mod of item.modifier_modules ?? []) {
                                  const reference = (data.$ as WearableItemData | WeaponItemData).modifier_module?.mods.get(mod.stat);
                                  if (!reference) continue;
                                  
                                  let lerped = invLerp(mod.value, reference.range[0], reference.range[1]);

                                  str.push(
                                    `${namedModifierDescriptor(mod)} ` +
                                    `(**${(100 * lerped).toFixed(1)}%**) -> ` +
                                    `${namedModifierDescriptor({
                                      stat: mod.stat,
                                      type: mod.type,
                                      value: lerp(clamp(lerped + (data.$.optimize_step ?? DEFAULT_ITEM_OPT_STEP), 0, 1), reference.range[0], reference.range[1])
                                    })}` +
                                    ` (**${(100 * Math.min(1, lerped + ((data.$ as WearableItemData | WeaponItemData).optimize_step ?? DEFAULT_ITEM_OPT_STEP))).toFixed(1)}%**)`
                                  )
                                }

                                return str.join("\n");
                              }()
                            ).addField(
                              "Cost",
                              `${function() {
                                const arr: string[] = [];

                                for (const _mat in data.$.optimize_cost) {
                                  const mat = _mat as Material;
                                  const material: number = data.$.optimize_cost[mat];
                                  
                                  if (material !== 0)
                                    arr.push(`**${material}** ${capitalize(mat)}`)
                                }

                                return arr;
                              }().join(", ")}`
                            )
                        ],
                        components: [
                          new MessageActionRow().setComponents([
                            new MessageButton()
                              .setCustomId(`cedit/${creature.$._id}/edit/item/modify/optimize/${index}`)
                              .setLabel(reqs ? "Confirm" : "Missing Requirement")
                              .setStyle("SUCCESS")
                              .setDisabled(!reqs)
                          ])
                        ]
                      })
                      return;
                    } break;
                    case "recalibrate": {
                      const index = Number(interaction.values[0]);

                      const item: EquippableInventoryItem = creature.$.items.backpack[index];
                      const data = ItemManager.map.get(item?.id ?? "");

                      if (!item || (data?.$.type !== "wearable" && data?.$.type !== "weapon") || !data.$.recalibrate_cost) {
                        interaction.followUp({
                          ephemeral: true,
                          content: "Invalid item or not recalibrateable"
                        })
                        return;
                      }

                      var reqs = true;
                      try {
                        for (const _mat in data.$.recalibrate_cost) {
                          const mat = _mat as Material;
                          const material: number = data.$.recalibrate_cost[mat];

                          if (creature.$.items.crafting_materials[mat] < material) throw new Error(`Not enough materials; need more ${capitalize(mat)}`)
                        }
                      } catch (e: any) {
                        await interaction.editReply({
                          content: `Your character doesn't meet the requirements:\n*${e?.message}*\nShowing anyway...`
                        });
                        reqs = false;
                      }
    
                      interaction.followUp({
                        ephemeral: true,
                        embeds: [
                          new MessageEmbed()
                            .setTitle("Item Recalibration")
                            .setDescription(
                              `**${data.displayName}**\n` +
                              function() {
                                const itm = item as WearableInventoryItem;
                                if (!itm.stat_module) return "";
                                return `**${ModuleType[itm.stat_module]}${ModuleTypeEmoji[itm.stat_module]}**\n`
                               }() + function() {
                                if ((item.modifier_modules?.length ?? 0) === 0) return "";

                                const str: string[] = [];

                                for (const mod of item.modifier_modules ?? []) {
                                  const reference = (data.$ as WearableItemData | WeaponItemData).modifier_module?.mods.get(mod.stat);
                                  if (!reference) continue;
                                  
                                  let lerped = invLerp(mod.value, reference.range[0], reference.range[1]);

                                  str.push(
                                    `${namedModifierDescriptor(mod)} ` +
                                    `(**${(100 * lerped).toFixed(1)}%**) -> ` +
                                    `[Random] (**??%**)`
                                  )
                                }

                                return `${str.join("\n")}\n\n**Possibilities:**\n${function() {
                                  var s = "";
                                  for (const [stat, mod] of data.$.modifier_module?.mods.entries() ?? []) {
                                    s += `${capitalize(stat).replaceAll(/_/g, " ")} **${modifierDescirptor({value: mod.range[0], type: mod.type})}** to **${modifierDescirptor({value: mod.range[1], type: mod.type})}**\n`;
                                  }
                                  return s.trim();
                                }()}`;
                              }()
                            ).addField(
                              "Cost",
                              `${function() {
                                const arr: string[] = [];

                                for (const _mat in data.$.recalibrate_cost) {
                                  const mat = _mat as Material;
                                  const material: number = data.$.recalibrate_cost[mat];
                                  
                                  if (material !== 0)
                                    arr.push(`**${material}** ${capitalize(mat)}`)
                                }

                                return arr;
                              }().join(", ")}`
                            )
                        ],
                        components: [
                          new MessageActionRow().setComponents([
                            new MessageButton()
                              .setCustomId(`cedit/${creature.$._id}/edit/item/modify/recalibrate/${index}`)
                              .setLabel(reqs ? "Confirm" : "Missing Requirement")
                              .setStyle("SUCCESS")
                              .setDisabled(!reqs)
                          ])
                        ]
                      })
                      return;
                    } break;
                  }
                } break;
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

                let ar = arg as Attributes; 

                if (creature.$.attributes[ar] instanceof TrackableStat) {
                  if (IS_GM || creature.totalAttributePointsUsed < Creature.ATTRIBUTE_POINTS) {
                    if (creature.$.attributes[ar].base >= Creature.ATTRIBUTE_MAX) {
                      interaction.followUp({
                        ephemeral: true,
                        content: "Attribute is MAXED OUT!"
                      })
                      return;
                    } else {
                      creature.$.attributes[ar].base++;
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
                content: `Expendable points: **${creature.totalAttributePointsUsed}**/${Creature.ATTRIBUTE_POINTS}\nPoint assignment is final!`,
                embeds: [(await infoEmbed(creature, Bot, db, "attributes")).embeds[0]],
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

              for (const id of cart) {
                const thing = location.shop.$.content[id];
                if (!thing) {
                  await interaction.followUp({
                    content: `[**${id}**] Errored`
                  });
                  continue;
                }

                try {
                  for (const _mat in thing.cost) {
                    const mat = _mat as Material;
                    const material: number = thing.cost[mat];
        
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
                      log = await thing.onBuy(creature, db);
                    } catch (e) {
                      console.error(e);
                      await interaction.followUp({
                        content: `[**${id}**] Errored`,
                        ephemeral: true
                      }); continue;
                    }
                  } break;
                }

                for (const _mat in thing.cost) {
                  const mat = _mat as Material;
                  creature.$.items.crafting_materials[mat] -= thing.cost[mat];
                }

                await interaction.followUp({
                  content: `[**${id}**] ${log.text}`,
                  embeds: await async function() {
                    const array: MessageEmbed[] = [];

                    for (const vlog of log.vitalsLogs ?? []) {
                      array.push(await (
                        vlog.type === "damage"
                        ? damageLogEmbed(vlog, db)
                        : healLogEmbed(vlog, db)
                      ))
                    }

                    return array;
                  }() || undefined,
                  ephemeral: true
                }); continue;

              }
            }            
          } break;
        }

        creature.reload();
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
        .setLabel("Assign Attributes"),
      new MessageButton()
        .setCustomId(`cedit/${creature.$._id}/edit/weapon_switch`)
        .setStyle("PRIMARY")
        .setLabel("Switch Weapons")
    ]),
    new MessageActionRow().addComponents([
      new MessageButton()
        .setCustomId(`cedit/${creature.$._id}/edit/item/modify`)
        .setStyle("PRIMARY")
        .setLabel("Modify Items"),
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
          .setMaxValues(Math.min(5, subitems.length))
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

  for (const i in creature.$.items.backpack) {
    const it = creature.$.items.backpack[i];
    const item = ItemManager.map.get(it.id);
    if (!item) continue;

    const scrap: string[] = [];
    if (item.$.scrap) {
      for (const _mat in item.$.scrap.materials) {
        const mat = _mat as Material;
        const material = item.$.scrap.materials[mat];

        if (material !== 0)
          scrap.push(`${material} ${capitalize(mat)}`)
      }
      items.push({
        label: item.$.info.name,
        emoji: ItemQualityEmoji[item.$.info.quality],
        description:
          `${i}>${
            (it as WearableInventoryItem).stat_module
            ? `${ModuleTypeEmoji[(it as WearableInventoryItem).stat_module]}`
            : ""
          } ${scrap.join(", ")} ${capitalize((item.$ as SpecializedWearableData).slot ?? item.$.type)}`,
        value: i
      })
    }
  }

  if (items.length == 0) {
    interaction.followUp({
      ephemeral: true,
      content: "No scrappable items in backpack!"
    });
    return;
  }

  interaction.followUp({
    ephemeral: true,
    content: "Items to scrap...",
    components: [
      new MessageActionRow().setComponents([
        new MessageSelectMenu()
          .setCustomId(`cedit/${creature.$._id}/edit/item/scrap`)
          .setOptions(items)
          .setMaxValues(items.length)
          .setMinValues(1)
      ])
    ]
  })
}

export async function consumeMenu(interaction: ButtonInteraction | CommandInteraction, creature: Creature) {
  const items: MessageSelectOptionData[] = [];

  for (const i of creature.$.items.backpack) {
    const item = ItemManager.map.get(i.id);
    if (item?.$.type !== "consumable") continue;

    items.push({
      label: item.$.info.name,
      emoji: item.$.onUse ? ItemQualityEmoji[item.$.info.quality] : "??????",
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