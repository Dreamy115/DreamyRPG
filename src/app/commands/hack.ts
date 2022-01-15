import { MessageEmbed } from "discord.js";
import { CONFIG, messageInput } from "../..";
import Creature, { diceRoll } from "../../game/Creature";
import { ApplicationCommandHandler } from "../commands";

export default new ApplicationCommandHandler({
  name: "hack",
  description: "Play the hacking minigame!",
  options: [
    {
      name: "sequences",
      description: "Amount of sequences to solve to pass",
      type: "INTEGER",
      required: true
    },
    {
      name: "cid",
      description: "Play as a creature (For GMs. Players leave this empty)",
      type: "STRING",
      autocomplete: true 
    }
  ]
}, async function (interaction, Bot, db) {
  if (!interaction.isCommand()) return;

  const [creature, member] = await Promise.all([
    Creature.fetch(interaction.options.getString("cid", false) ?? interaction.user.id, db).catch(() => null),
    interaction.guild?.members.fetch(interaction.user).catch(() => null),
    interaction.reply({content: `Awaiting hacking minigame...`})
  ]);

  const channel = await interaction.guild?.channels.fetch(interaction.channelId);
  if (!channel?.isText()) {
    interaction.editReply({
      content: "Channel isn't text. Somehow."
    })
    setTimeout(() => {
      interaction.deleteReply().catch();
    }, 4000)
    return;
  }
  
  if (!member) {
    interaction.editReply({
      content: "Hacking: Invalid guild member. (4s)"
    })
    setTimeout(() => {
      interaction.deleteReply().catch();
    }, 4000)
    return;
  }
  if (!creature) {
    interaction.editReply({
      content: "Hacking: Invalid character. (4s)"
    })
    setTimeout(() => {
      interaction.deleteReply().catch();
    }, 4000)
    return;
  }

  if (HACK_playing.has(creature.$._id)) {
    interaction.editReply({
      content: "Hacking: Already playing!"
    });
    setTimeout(() => {
      interaction.deleteReply().catch();
    }, 4000)
    return;
  }

  if (creature.$._id !== interaction.user.id && !member.roles.cache.has(CONFIG.guild?.gm_role ?? "")) {
    interaction.editReply({
      content: "Hacking: To use someone else's character, you must be a GM (4s)"
    })
    setTimeout(() => {
      interaction.deleteReply().catch();
    }, 4000)
    return;
  }

  const diff = interaction.options.getInteger("sequences", true);
  if (diff <= 0) {
    interaction.editReply({
      content: "Hacking: Difficulty must be 1 "
    })
    setTimeout(() => {
      interaction.deleteReply().catch();
    }, 4000)
    return;
  }

  const numbers: number[][] = [];
  for (var i = 0; i < diff; i++) {
    const arr: number[] = [];
    for (var j = 0; j < 4; j++) {
      arr.push(diceRoll(10) - 1)
    }
    numbers.push(arr);
  }

  const time = ((diff - 1) * 45) + 60 + ((5 + diff * 5) * creature.$.attributes.INT.value);

  HACK_playing.set(creature.$._id, {
    numbers,
    time
  });

  const embed = new MessageEmbed()
    .setTitle("Hacking!")
    .setAuthor(creature.displayName, creature.$.info.display.avatar ?? undefined)
    .setDescription(
      "To start playing, type in **4** numbers in chat. There will be feedback provided on your guess:\n" +
      "🟦 - If that number exists in the sequence, and is in the correct position\n" +
      "🟨 - The number exists, but is not in the correct position\n" +
      "⬛ - That number is not in the sequence.\n\n" +
      `You must solve **${numbers.length}** sequences in **${time}s** to pass. Type in \`#\` to cancel early.` 
    )

  await interaction.editReply({
    embeds: [embed]
  });

  var int = setInterval(() => {
    const play = HACK_playing.get(creature.$._id);
    if (!play) {
      clearInterval(int);
      return;
    }

    play.time--;
    if (play.time <= 0) {
      clearInterval(int);
      HACK_playing.delete(creature.$._id);

      interaction.followUp({
        content: "Failed: Timed out\n" + `**${play.numbers.length}** sequences left unsolved... So close!`
      })
    }
  }, 1000);

  while (HACK_playing.has(creature.$._id)) {
    const game = HACK_playing.get(creature.$._id);
    const input = await messageInput(channel, interaction.user.id, ).catch(() => null);
    if (!game?.numbers[0] || !input || !HACK_playing.has(creature.$._id)) return;

    if (input === "#") {
      interaction.followUp({
        content: "Failed: Cancelled early."
      });
      HACK_playing.delete(creature.$._id);
      return;
    }

    let guess: number[] = [];
    for (const char of input) {
      if (isNaN(Number(char))) {
        interaction.followUp({
          content: "Invalid guess! Must be numbers only. Example: **1234**"
        });
        return;
      }

      guess.push(Number(char));
      if (guess.length >= 4) break;
    }
    while (guess.length < 4) {
      guess.push(0);
    }

    let allgood = true;
    const feedback: string[] = [];
    const result: (boolean | null)[] = [];
    for (const n in game.numbers[0]) {
      if (game.numbers[0][n] === guess[n]) {
        result.push(true);
        feedback.push("🟦");
      } else if (game.numbers[0].includes(guess[n])) {
        allgood = false;
        
        result.push(null)
        feedback.push("🟨");
      } else {
        allgood = false;

        result.push(false);
        feedback.push("⬛");
      }
    }

    interaction.followUp({
      content: `\`${guess.join("")}\` - **${game.time}s**, **${game.numbers.length}** left\n${feedback.join("")}`
    });

    if (allgood) {
      game.numbers.shift();

      if (game.numbers.length === 0) {
        interaction.followUp({
          content: `Passed! Time left > **${game.time}s**`
        });
        HACK_playing.delete(creature.$._id)
      } else {
        interaction.followUp({
          content: `Sequence passed! **${game.numbers.length}** left. Proceed...`
        });
      }
    }
  }
})

export const HACK_playing = new Map<string, {
  numbers: number[][],
  time: number
}>();