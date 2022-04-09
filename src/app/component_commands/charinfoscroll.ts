import { Message, MessageActionRow, MessageButton } from "discord.js";
import { CONFIG } from "../..";
import Creature from "../../game/Creature";
import { infoEmbed } from "../commands/char";
import { ComponentCommandHandler } from "../component_commands";

export default new ComponentCommandHandler(
  "charinfoscroll",
  async function (interaction, Bot, db, args) {
    if (!interaction.message) return;
    
    const [creature,] = await Promise.all([
      Creature.fetch(args.shift() ?? "", db),
      interaction.deferReply()
    ]);

    const page = args.shift();
    
    const guild = await Bot.guilds.fetch(CONFIG.guild?.id ?? "");
    await guild.roles.fetch();

    const member = await guild.members.fetch(interaction.user.id).catch(() => null);
    
    let IS_GM = true;
    if (!member || !member.roles.cache.has(CONFIG.guild?.gm_role ?? "")) { 
      IS_GM = false;
    }

    if (creature.$.info.npc && !IS_GM) {
      if ((await Creature.fetch(interaction.user.id, db, true)).location?.$.id !== creature.location?.$.id) {
        interaction.editReply({
          content: "You must be in the same location as the NPC to view their info"
        });
        return;
      } else if (
        page === "location" || page === "schematics" ||
        page === "backpack" || page === "debug"
      ) {
        interaction.editReply({
          content: "Only GMs can access this kind of information"
        });
        return;
      }
    }  

    interaction.deleteReply();

    const message = interaction.message as Message;

    const channel = interaction.guild
    ? await interaction.guild.channels.fetch(message.channelId ?? (interaction.message as Exclude<typeof interaction.message, Message>).channel_id)
    : await Bot.channels.fetch((interaction.message as Exclude<typeof interaction.message, Message>).channel_id ?? message.channelId)

    if (!channel?.isText?.()) throw new Error("Channel isn't text")

    const msg = await channel.messages.fetch(interaction.message.id);

    let index = Number(args.shift());
    const info = await infoEmbed(creature, Bot, db, page ?? "", index);
    
    const components = info.scrollable
    ? [
      new MessageActionRow().setComponents([
        new MessageButton()
          .setCustomId(`charinfoscroll/${creature.$._id}/${page}/${index + 1}`)
          .setStyle("SECONDARY")
          .setLabel("Scroll +"),
      ]),
      new MessageActionRow().setComponents([
        new MessageButton()
          .setCustomId(`charinfoscroll/${creature.$._id}/${page}/${index}`)
          .setStyle("SECONDARY")
          .setLabel("Refresh"),
      ])
    ]
    : undefined

    if (index > 0 && components) {
      components[0].addComponents(
        new MessageButton()
          .setCustomId(`charinfoscroll/${creature.$._id}/${page}/${index - 1}`)
          .setStyle("SECONDARY")
          .setLabel("-")
      )
    }
 
    const payload = {
      ephemeral: false,
      embeds: info.embeds,
      components,
      files: info.attachments
    }

    msg.edit(payload).catch(() => {
      msg.delete();
      channel.send(payload);
    });
    if (IS_GM && info.gm_embeds[0].fields.length > 0 || info.gm_embeds[0].description) 
      interaction.followUp({
        ephemeral: true,
        content: "PSST! Gm Only info found!",
        embeds: info.gm_embeds
      })
  }
)