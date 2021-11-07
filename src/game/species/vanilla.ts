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
      description: ""
    },
    playable: true,
    passives: [
      new PassiveEffect({
        info: {
          name: "Inherent Base",
          lore: "**112%** Health base, **28** Armor, **12** Filter, **120%** Melee Mult, **85%** Ranged Mult, **6** Tech"
        },
        preload: function (creature) {
          creature.$.stats.health.base *= 1.12;
          creature.$.stats.armor.base = 28;
          creature.$.stats.filter.base = 12;
          creature.$.stats.tech.base = 6;
        },
        modifiers: [
          {
            stat: "melee",
            type: ModifierType.MULTIPLY,
            value: 1.2
          },
          {
            stat: "ranged",
            type: ModifierType.MULTIPLY,
            value: 0.85
          }
        ]
      }),
      new PassiveEffect({
        info: {
          name: "Hard Noggin",
          lore: "As an earth pony, you're excellently durable, and physically well-built, but tech doesn't adapt as well."
        },
        modifiers: [
          {
            stat: "armor",
            type: ModifierType.MULTIPLY,
            value: 1.2
          },
          {
            stat: "health",
            type: ModifierType.MULTIPLY,
            value: 1.1
          },
          {
            stat: "tenacity",
            type: ModifierType.ADD_PERCENT,
            value: 0.15
          },
          {
            stat: "tech",
            type: ModifierType.MULTIPLY,
            value: 0.75
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
      description: ""
    },
    playable: true,
    passives: [
      new PassiveEffect({
        info: {
          name: "Inherent Base",
          lore: "**92%** Health base, **16** Armor, **20** Filter, **75%** Melee Mult, **120%** Ranged Mult, **9** Tech"
        },
        preload: function (creature) {
          creature.$.stats.health.base *= 0.92;
          creature.$.stats.armor.base = 16;
          creature.$.stats.filter.base = 20;
          creature.$.stats.tech.base = 9;
        },
        modifiers: [
          {
            stat: "melee",
            type: ModifierType.MULTIPLY,
            value: 0.75
          },
          {
            stat: "ranged",
            type: ModifierType.MULTIPLY,
            value: 1.2
          }
        ]
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
            value: 0.85
          },
          {
            stat: "armor",
            type: ModifierType.MULTIPLY,
            value: 0.92
          },
          {
            stat: "accuracy",
            type: ModifierType.MULTIPLY,
            value: 1.125
          },
          {
            stat: "deflect",
            type: ModifierType.MULTIPLY,
            value: 1.25
          },
          {
            stat: "parry",
            type: ModifierType.MULTIPLY,
            value: 1.1
          },
          {
            stat: "shield_regen",
            type: ModifierType.MULTIPLY,
            value: 1.2
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
      description: ""
    },
    playable: true,
    passives: [
      new PassiveEffect({
        info: {
          name: "Inherent Base",
          lore: "**95%** Health base, **18** Armor, **22** Filter, **90%** Melee Mult, **95%** Ranged Mult, **12** Tech"
        },
        preload: function (creature) {
          creature.$.stats.health.base *= 0.95;
          creature.$.stats.armor.base = 18;
          creature.$.stats.filter.base = 22;
          creature.$.stats.tech.base = 12;
        },
        modifiers: [
          {
            stat: "melee",
            type: ModifierType.MULTIPLY,
            value: 0.97
          },
          {
            stat: "ranged",
            type: ModifierType.MULTIPLY,
            value: 1.04
          }
        ]
      }),
      "unicorn_horn",
      new PassiveEffect({
        info: {
          name: "Unicorn's Nature",
          lore: "Way more proficient with tech rather than physicality"
        },
        modifiers: [
          {
            stat: "armor",
            type: ModifierType.MULTIPLY,
            value: 0.9
          },
          {
            stat: "shield",
            type: ModifierType.MULTIPLY,
            value: 1.15
          },
          {
            stat: "mana_regen",
            type: ModifierType.MULTIPLY,
            value: 1.35
          }
        ]
      })
    ]
  }),
  new CreatureSpecies({
    id: "batpony",
    info: {
      name: "Batpony",
      lore: "This one loves blood! Comes with lifesteal as a base",
      description: ""
    },
    playable: true,
    passives: [
      new PassiveEffect({
        info: {
          name: "Inherent Base",
          lore: "**78%** Health base, **21** Armor, **15** Filter, **103%** Melee Mult, **97%** Ranged Mult, **4** Tech"
        },
        preload: function (creature) {
          creature.$.stats.health.base *= 0.78;
          creature.$.stats.armor.base = 21;
          creature.$.stats.filter.base = 15;
          creature.$.stats.tech.base = 4;
        },
        modifiers: [
          {
            stat: "melee",
            type: ModifierType.MULTIPLY,
            value: 1.03
          },
          {
            stat: "ranged",
            type: ModifierType.MULTIPLY,
            value: 0.97
          }
        ]
      }),
      "blood_thirst",
      new PassiveEffect({
        info: {
          name: "Bat Blood",
          lore: "Lifesteal base"
        },
        preload: function (creature) {
          creature.$.stats.vamp.base += 14;
        },
        modifiers: [
          {
            stat: "vamp",
            type: ModifierType.ADD_PERCENT,
            value: 0.1
          }
        ]
      })
    ]
  }),
  new CreatureSpecies({
    id: "deer",
    info: {
      name: "Deer",
      lore: "Quiet and reserved, but excel in their own type of tech",
      description: ""
    },
    playable: true,
    passives: [
      new PassiveEffect({
        info: {
          name: "Inherent Base",
          lore: "**80%** Health base, **16** Armor, **24** Filter, **75%** Melee Mult, **99%** Ranged Mult, **14** Tech"
        },
        preload: function (creature) {
          creature.$.stats.health.base *= 0.8;
          creature.$.stats.armor.base = 16;
          creature.$.stats.filter.base = 24;
          creature.$.stats.tech.base = 14;
        },
        modifiers: [
          {
            stat: "melee",
            type: ModifierType.MULTIPLY,
            value: 0.75
          },
          {
            stat: "ranged",
            type: ModifierType.MULTIPLY,
            value: 0.99
          }
        ]
      }),
      "deertek_infused",
      new PassiveEffect({
        info: {
          name: "Way of the Deer",
          lore: "Very energy resistant at physical costs"
        },
        modifiers: [
          {
            stat: "shield",
            type: ModifierType.MULTIPLY,
            value: 1.25
          },
          {
            stat: "health",
            type: ModifierType.MULTIPLY,
            value: 0.8
          },
          {
            stat: "filter",
            type: ModifierType.MULTIPLY,
            value: 1.2
          },
          {
            stat: "armor",
            type: ModifierType.MULTIPLY,
            value: 0.9
          }
        ]
      })
    ]
  })
]