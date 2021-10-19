// VANILLA RACE PACK

import { PassiveEffect } from "../PassiveEffects.js";
import { CreatureSpecies } from "../Species.js";
import { ModifierType } from "../Stats.js";

export default [
  new CreatureSpecies({
    id: "default",
    info: {
      name: "Earth Pony",
      lore: "A big, strong equine. Best physical traits",
      description: "TBA"
    },
    playable: true,
    passives: [
      new PassiveEffect({
        info: {
          name: "Inherent Base",
          lore: "**115%** Health base, **28** Armor, **12** Filter, **130%** Melee Base, **80%** Ranged Base, **6** Tech"
        },
        preload: function (creature) {
          creature.$.stats.health.base *= 1.15;
          creature.$.stats.armor.base = 28;
          creature.$.stats.filter.base = 12;
          creature.$.stats.melee.base *= 1.30;
          creature.$.stats.ranged.base *= 0.80;
          creature.$.stats.tech.base = 6;
        }
      }),
      new PassiveEffect({
        info: {
          name: "Hard Noggin",
          lore: "As an earth pony, you're excellently durable, and physically well-built, but tech doesn't adapt as well."
        },
        modifiers: [
          {
            stat: "health",
            type: ModifierType.MULTIPLY,
            value: 1.2
          },
          {
            stat: "tenacity",
            type: ModifierType.ADD_PERCENT,
            value: 0.1
          },
          {
            stat: "tech",
            type: ModifierType.MULTIPLY,
            value: 0.8
          },
          {
            stat: "melee",
            type: ModifierType.MULTIPLY,
            value: 1.1
          }
        ]
      })
    ]
  }),
  new CreatureSpecies({
    id: "pegasus",
    info: {
      name: "Pegasus",
      lore: "A smaller, swift, and agile equine",
      description: "TBA"
    },
    playable: true,
    passives: [
      new PassiveEffect({
        info: {
          name: "Inherent Base",
          lore: "**90%** Health base, **20** Armor, **20** Filter, **75%** Melee Base, **135%** Ranged Base, **9** Tech"
        },
        preload: function (creature) {
          creature.$.stats.health.base *= 0.9;
          creature.$.stats.armor.base = 20;
          creature.$.stats.filter.base = 20;
          creature.$.stats.melee.base *= 0.75;
          creature.$.stats.ranged.base *= 1.35;
          creature.$.stats.tech.base = 9;
        }
      }),
      new PassiveEffect({
        info: {
          name: "Swift Scout",
          lore: "You're swift and agile! It does come with it's drawbacks though"
        },
        modifiers: [
          {
            stat: "health",
            type: ModifierType.MULTIPLY,
            value: 0.9
          },
          {
            stat: "deflect",
            type: ModifierType.MULTIPLY,
            value: 1.2
          },
          {
            stat: "parry",
            type: ModifierType.MULTIPLY,
            value: 1.15
          }
        ]
      })
    ]
  }),
  new CreatureSpecies({
    id: "unicorn",
    info: {
      name: "Unicorn",
      lore: "An average between equines. This one specialises in tech and abilities.",
      description: "TBA"
    },
    playable: true,
    passives: [
      new PassiveEffect({
        info: {
          name: "Inherent Base",
          lore: "**100%** Health base, **18** Armor, **22** Filter, **100%** Melee Base, **105%** Ranged Base, **10** Tech"
        },
        preload: function (creature) {
          creature.$.stats.health.base *= 1.0;
          creature.$.stats.armor.base = 18;
          creature.$.stats.filter.base = 22;
          creature.$.stats.melee.base *= 1.00;
          creature.$.stats.ranged.base *= 1.05;
          creature.$.stats.tech.base = 12;
        }
      }),
      new PassiveEffect({
        info: {
          name: "Unicorn Horn",
          lore: "That horn works as a great amplifier!"
        },
        modifiers: [
          {
            stat: "tech",
            type: ModifierType.MULTIPLY,
            value: 1.2
          },
          {
            stat: "filter",
            type: ModifierType.MULTIPLY,
            value: 1.15
          }
        ]
      }),
      new PassiveEffect({
        info: {
          name: "Unicorn's Nature",
          lore: "Way more proficient with tech rather than physicality"
        },
        modifiers: [
          {
            stat: "melee",
            type: ModifierType.MULTIPLY,
            value: 0.9
          },
          {
            stat: "ranged",
            type: ModifierType.MULTIPLY,
            value: 0.95
          }
        ]
      })
    ]
  })
]