import { Message, MessageActionRow, MessageButton } from "discord.js";
import Creature from "../../game/Creature";
import char, { infoEmbed } from "../commands/char";
import { ComponentCommandHandler } from "../component_commands";

export default new ComponentCommandHandler(
  "charinfoscroll",
  async function (interaction, Bot, db, args) {
    if (!interaction.message) return;
    
    const [creature,] = await Promise.all([
      Creature.fetch(args.shift() ?? "", db),
      interaction.deferReply()
    ]);
    interaction.deleteReply();

    const message = interaction.message as Message;

    const channel = interaction.guild
    ? await interaction.guild.channels.fetch(message.channelId ?? (interaction.message as Exclude<typeof interaction.message, Message>).channel_id)
    : await Bot.channels.fetch((interaction.message as Exclude<typeof interaction.message, Message>).channel_id ?? message.channelId)

    if (!channel?.isText?.()) throw new Error("Channel isn't text")

    const msg = await channel.messages.fetch(interaction.message.id);

    const page = args.shift();

    let index = Number(args.shift());

    const info = await infoEmbed(creature, Bot, page ?? "", index);
    
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
      embeds: [info.embed],
      components
    }

    msg.edit(payload).catch(() => {
      msg.delete();
      channel.send(payload);
    })
  }
)