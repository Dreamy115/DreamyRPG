import { Item } from "../Items";
import { PassiveEffect } from "../PassiveEffects";

export default [
  new Item({
    id: "basic_shield-1",
    info: {
      name: "Starter Shield",
      lore: "A basic, used shield primer. Will stop a ping-pong ball thrown in your face but don't expect too much."
    },
    type: "utility",
    unique: ["shield"],
    passives: [
      new PassiveEffect({
        info: {
          name: "Shield Primer",
          lore: `Base Shield **20 SP** **4**/t`
        },
        preload: function (creature) {
          creature.$.stats.shield.base += 20;
          creature.$.stats.shield_regen.base += 4;
        }
      })
    ]
  })
]