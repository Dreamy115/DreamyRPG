import { MessageActionRow, MessageSelectMenu, MessageSelectOptionData } from "discord.js";
import Creature, { diceRoll } from "../../game/Creature";
import { TrackableStat } from "../../game/Stats";
import { ComponentCommandHandler } from "../component_commands";

export default new ComponentCommandHandler(
  "rollstat",
  async function(interaction, Bot, db, args) {
    const [creature,] = await Promise.all([
      Creature.fetch(args.shift() ?? "", db),
      interaction.deferReply({ephemeral: true})
    ]);

    const attr_name = args.shift();
    const bonus = Number(args.shift() ?? 0);

    // @ts-expect-error
    const attr: TrackableStat | undefined = creature.$.attributes[attr_name ?? ""]
    if (!attr || !attr_name) {
      interaction.editReply({
        content: "Invalid attribute"
      })
      return;
    }

    if (interaction.isButton()) {
      interaction.editReply({
        content: "Select difficulty",
        components: [new MessageActionRow().setComponents([
          new MessageSelectMenu()
            .setCustomId(`rollstat/${creature.$._id}/${attr_name}/${bonus}`)
            .setOptions(function () {
              const array: MessageSelectOptionData[] = [];

              for (var i = DIFFICULTY_MIN; i <= DIFFICULTY_MAX; i++) {
                array.push({
                  value: String(i),
                  label: String(i)
                })
              }

              return array;
            }())
        ])]
      })
    } else if (interaction.isSelectMenu()) {
      const diff = Number(interaction.values[0]);
      const rolls: number[] = [];
      for (var i = 0; i < DICE_ROLL_AMOUNT; i++) {
        rolls.push(diceRoll(DICE_ROLL_SIDES));
      }

      const score = rolls.reduce((p,v) => p += v) + attr.value;

      await interaction.editReply({
        content: "OK"
      });
      interaction.followUp({
        ephemeral: false,
        content: 
          `**${attr_name}** Check: ***${rollResult(score - diff)}***\n` +
          `**${score}** of **${diff}** *(**${rolls.join("**, **")}**)*\n` +
          `**${attr.value < 0 ? "-" : "+"}${Math.abs(attr.value)}** Attribute\n` +
          `**${bonus < 0 ? "-" : "+"}${Math.abs(bonus)}** Bonus\n` +
          `as **${creature.displayName}**`
      })
    }
  }
)

export function rollResult(delta: number) {
  if (delta >= 0) return "Pass";
  if (delta < 0) return "Fail";
}

export const DIFFICULTY_MIN = 3;
export const DIFFICULTY_MAX = 20;

export const DICE_ROLL_SIDES = 6;
export const DICE_ROLL_AMOUNT = 2;