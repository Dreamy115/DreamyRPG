import { MessageActionRow, MessageButton, MessageSelectMenu, MessageSelectOptionData } from "discord.js";
import { ClassManager, CONFIG, ItemManager, messageInput, SpeciesManager } from "../..";
import Creature, { HealType } from "../../game/Creature";
import { DamageCause, DamageGroup, damageLogEmbed, DamageMedium, DamageType, ShieldReaction } from "../../game/Damage";
import { Item } from "../../game/Items";
import { ComponentCommand } from "../component_commands";

export default new ComponentCommand(
  "cedit",
  async function (interaction, Bot, db, args) {
    const creature_id = args.shift();
    if (!creature_id) throw new Error("Invalid ID");

    const guild = await Bot.guilds.fetch(CONFIG.guild?.id ?? "");
    await guild.roles.fetch();

    if (creature_id !== interaction.user.id && guild.id !== interaction.guild?.id) {
      interaction.reply({
        ephemeral: true,
        content: "Operations on foreign creatures must be made on the Home Guild"
      });
      return;
    }

    const member = await guild.members.fetch(interaction.user.id).catch(() => null);
    let IS_GM = true;
    if (!member || !member.roles.cache.has(CONFIG.guild?.gm_role ?? "")) {
      IS_GM = false;
      if (creature_id !== interaction.user.id) {
        interaction.reply({
          ephemeral: true,
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
        await interaction.deferReply({ ephemeral: true });

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
      } break;
      case "edit": {
        await interaction.deferReply({ ephemeral: true });

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

            let dump = creature.dump();
            // @ts-expect-error
            dump.info.species = interaction.values[0];
            creature = new Creature(dump);
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

            let dump = creature.dump();
            // @ts-expect-error
            dump.info.class = interaction.values[0];

            // @ts-expect-error
            dump.items.backpack = [];
            // @ts-expect-error
            dump.items.primary_weapon = null;
            // @ts-expect-error
            dump.items.equipped = [
              "starter_revolver",
              "starter_shield",
              "starter_knife"
            ]

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
                            description: item.$.info.lore.length > 100 ? item.$.info.lore.substr(0, 99) + "…" : item.$.info.lore,
                            value: item.$.id ?? "",
                          })
                        }

                        if (array.length == 0) {
                          array.push({
                            label: "None",
                            value: "",
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
          case "gm": {
            if (!IS_GM) {
              interaction.followUp({
                ephemeral: true,
                content: "Not enough permissions (Must be GM)"
              });
              return;
            }

            switch (args.shift()) {
              case "damage": {
                await interaction.followUp({
                  ephemeral: true,
                  content: 
                    "Please input damage string using this syntax: `<type>,<medium>,<value>,<chance>,<penetration>,<shield_reaction>` without spaces, whole numbers, and without %.\n" +
                    "ex. `Physical,Melee,25,100,0,Normal`"
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
                  const group: DamageGroup = {
                    chance: Number(input[3]),
                    // @ts-expect-error
                    medium: DamageMedium[input[1]],
                    penetration: {
                      defiltering: Number(input[4]),
                      lethality: Number(input[4])
                    },
                    // @ts-expect-error
                    shieldReaction: ShieldReaction[input[5]],
                    useDodge: true,
                    sources: [{
                      // @ts-expect-error
                      type: DamageType[input[0]],
                      value: Number(input[2])
                    }],
                    cause: DamageCause.Other
                  }

                  interaction.followUp({
                    embeds: [damageLogEmbed(creature.applyDamage(group))]
                  });
                } catch (e) {
                  console.error(e);
                  interaction.followUp({
                    ephemeral: true,
                    content: "Error!"
                  });
                  return;
                }

              } break;
              case "heal": {
                await interaction.followUp({
                  ephemeral: true,
                  content: 
                    "Please input heal string using this syntax: `<amount>,<type>` without spaces, whole numbers, and without %.\n" +
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

export function ceditMenu(creature_id: string): MessageActionRow[] {
  return [
    new MessageActionRow().addComponents([
      new MessageButton()
        .setCustomId(`cedit/${creature_id}/edit/name`)
        .setStyle("SECONDARY")
        .setLabel("Change Name"),
      new MessageButton()
        .setCustomId(`cedit/${creature_id}/edit/avatar`)
        .setStyle("SECONDARY")
        .setLabel("Change Avatar")
    ]),
    new MessageActionRow().addComponents([
      new MessageSelectMenu()
        .setCustomId(`cedit/${creature_id}/edit/species`)
        .setPlaceholder("Change Species")
        .addOptions(function() {
        const array: MessageSelectOptionData[] = [];

        for (const species of SpeciesManager.map.values()) {
          array.push({
            label: species.$.info.name,
            value: species.$.id,
            description: species.$.info.lore
          })
        }

        return array;
      }())
    ]),
    new MessageActionRow().addComponents([
      new MessageSelectMenu()
        .setCustomId(`cedit/${creature_id}/edit/class`)
        .setPlaceholder("Change Class")
        .addOptions(function() {
        const array: MessageSelectOptionData[] = [];

        for (const itemclass of ClassManager.map.values()) {
          array.push({
            label: itemclass.$.info.name,
            value: itemclass.$.id,
            description: itemclass.$.info.lore
          })
        }

        return array;
      }())
    ]),
    new MessageActionRow().addComponents([
      new MessageButton()
        .setCustomId(`cedit/${creature_id}/edit/weapon_switch`)
        .setStyle("PRIMARY")
        .setLabel("Switch Weapons")
    ]),
    new MessageActionRow().addComponents([
      new MessageButton()
        .setCustomId(`cedit/${creature_id}/delete`)
        .setStyle("DANGER")
        .setLabel("Delete")
    ])
  ]
}

export function gm_ceditMenu(creature_id: string): MessageActionRow[] {
  return [
    new MessageActionRow().addComponents([
      new MessageButton()
        .setCustomId(`cedit/${creature_id}/edit/gm/damage`)
        .setStyle("DANGER")
        .setLabel("Deal Damage"),
      new MessageButton()
        .setCustomId(`cedit/${creature_id}/edit/gm/heal`)
        .setStyle("SUCCESS")
        .setLabel("Heal")
    ])
  ]
}