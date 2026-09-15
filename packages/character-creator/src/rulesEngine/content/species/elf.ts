/**
 * Elf Species Effects
 * Pure data - no game logic in code
 *
 * Elves have lineages in 2024: High Elf, Wood Elf, Drow
 * 2014 has subraces with similar traits
 */

import type { SourcedEffect } from '../../types/effects';

/**
 * Elf Base Traits (2024 edition)
 * Common to all elf lineages
 */
export const elf2024BaseEffects: SourcedEffect[] = [
  // Languages
  {
    sourceId: 'species:elf-2024',
    effectId: 'elf-languages',
    name: 'Elf Languages',
    description: 'You can speak, read, and write Common and Elven.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'language',
        values: ['Common', 'Elven'],
      },
    ],
    edition: '2024',
  },

  // Speed
  {
    sourceId: 'species:elf-2024',
    effectId: 'elf-speed',
    name: 'Elf Speed',
    description: 'Your base walking speed is 30 feet.',
    effects: [
      {
        kind: 'speed',
        movementType: 'walk',
        value: 30,
      },
    ],
    edition: '2024',
  },

  // Darkvision
  {
    sourceId: 'species:elf-2024',
    effectId: 'elf-darkvision',
    name: 'Darkvision',
    description: 'You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.',
    effects: [
      {
        kind: 'sense',
        senseType: 'darkvision',
        range: 60,
      },
      {
        kind: 'grantFeature',
        featureId: 'darkvision',
        name: 'Darkvision',
        description: 'You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.',
      },
    ],
    edition: '2024',
  },

  // Fey Ancestry
  {
    sourceId: 'species:elf-2024',
    effectId: 'elf-fey-ancestry',
    name: 'Fey Ancestry',
    description: 'You have advantage on saving throws against being charmed, and magic cannot put you to sleep.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'fey-ancestry',
        name: 'Fey Ancestry',
        description: 'You have advantage on saving throws against being charmed, and magic cannot put you to sleep.',
      },
      {
        kind: 'tag',
        tags: ['fey-ancestry', 'charm-resistance', 'sleep-immunity'],
      },
    ],
    edition: '2024',
  },

  // Keen Senses
  {
    sourceId: 'species:elf-2024',
    effectId: 'elf-keen-senses',
    name: 'Keen Senses',
    description: 'You have proficiency in the Perception skill.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'skill',
        values: ['Perception'],
      },
    ],
    edition: '2024',
  },

  // Trance
  {
    sourceId: 'species:elf-2024',
    effectId: 'elf-trance',
    name: 'Trance',
    description: 'Elves don\'t need to sleep. Instead, they meditate deeply for 4 hours a day, gaining the same benefit as a human does from 8 hours of sleep.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'trance',
        name: 'Trance',
        description: 'You meditate deeply for 4 hours instead of sleeping for 8 hours.',
      },
      {
        kind: 'tag',
        tags: ['trance', 'reduced-rest-time'],
      },
    ],
    edition: '2024',
  },
];

/**
 * High Elf Lineage (2024)
 * Int bonus, cantrip, extra language
 */
export const highElf2024Effects: SourcedEffect[] = [
  // High Elf Cantrip
  {
    sourceId: 'species:high-elf-2024',
    effectId: 'high-elf-cantrip',
    name: 'High Elf Cantrip',
    description: 'You know the Prestidigitation cantrip. Intelligence is your spellcasting ability for it.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'high-elf-cantrip',
        name: 'High Elf Cantrip',
        description: 'You know the Prestidigitation cantrip.',
      },
      {
        kind: 'tag',
        tags: ['high-elf-magic', 'bonus-cantrip'],
      },
    ],
    edition: '2024',
  },

  // Extra Language
  {
    sourceId: 'species:high-elf-2024',
    effectId: 'high-elf-extra-language',
    name: 'Extra Language',
    description: 'You can speak, read, and write one extra language of your choice.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'high-elf-language',
        name: 'Extra Language',
        description: 'You can speak, read, and write one extra language of your choice.',
      },
      {
        kind: 'tag',
        tags: ['bonus-language'],
      },
    ],
    edition: '2024',
  },
];

/**
 * Wood Elf Lineage (2024)
 * Increased speed, Mask of the Wild
 */
export const woodElf2024Effects: SourcedEffect[] = [
  // Fleet of Foot - Additional 5 feet speed
  {
    sourceId: 'species:wood-elf-2024',
    effectId: 'wood-elf-fleet',
    name: 'Fleet of Foot',
    description: 'Your base walking speed increases to 35 feet.',
    effects: [
      {
        kind: 'speed',
        movementType: 'walk',
        value: 5, // Stacks with base elf speed of 30
        priority: 'additive',
        stacking: 'stack',
      },
    ],
    edition: '2024',
  },

  // Mask of the Wild
  {
    sourceId: 'species:wood-elf-2024',
    effectId: 'wood-elf-mask',
    name: 'Mask of the Wild',
    description: 'You can attempt to hide even when you are only lightly obscured by foliage, heavy rain, falling snow, mist, and other natural phenomena.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'mask-of-the-wild',
        name: 'Mask of the Wild',
        description: 'You can attempt to hide in natural phenomena.',
      },
      {
        kind: 'tag',
        tags: ['mask-of-the-wild', 'stealth-in-nature'],
      },
    ],
    edition: '2024',
  },

  // Wood Elf Magic - Druidcraft cantrip
  {
    sourceId: 'species:wood-elf-2024',
    effectId: 'wood-elf-magic',
    name: 'Wood Elf Magic',
    description: 'You know the Druidcraft cantrip. Wisdom is your spellcasting ability for it.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'wood-elf-magic',
        name: 'Wood Elf Magic',
        description: 'You know the Druidcraft cantrip.',
      },
      {
        kind: 'tag',
        tags: ['wood-elf-magic', 'bonus-cantrip'],
      },
    ],
    edition: '2024',
  },
];

/**
 * Drow Lineage (2024)
 * Superior Darkvision, Drow Magic
 */
export const drow2024Effects: SourcedEffect[] = [
  // Superior Darkvision (120 feet instead of 60)
  {
    sourceId: 'species:drow-2024',
    effectId: 'drow-superior-darkvision',
    name: 'Superior Darkvision',
    description: 'Your darkvision has a radius of 120 feet.',
    effects: [
      {
        kind: 'sense',
        senseType: 'darkvision',
        range: 60, // Additional 60 feet on top of base elf darkvision
        priority: 'additive',
        stacking: 'max', // Take the maximum darkvision range
      },
    ],
    edition: '2024',
  },

  // Drow Magic - Dancing Lights cantrip
  {
    sourceId: 'species:drow-2024',
    effectId: 'drow-magic-cantrip',
    name: 'Drow Magic',
    description: 'You know the Dancing Lights cantrip. Charisma is your spellcasting ability for it.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'drow-magic',
        name: 'Drow Magic',
        description: 'You know the Dancing Lights cantrip.',
      },
      {
        kind: 'tag',
        tags: ['drow-magic', 'bonus-cantrip'],
      },
    ],
    edition: '2024',
  },

  // Sunlight Sensitivity
  {
    sourceId: 'species:drow-2024',
    effectId: 'drow-sunlight-sensitivity',
    name: 'Sunlight Sensitivity',
    description: 'You have disadvantage on attack rolls and Perception checks that rely on sight when you, the target of your attack, or whatever you are trying to perceive is in direct sunlight.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'sunlight-sensitivity',
        name: 'Sunlight Sensitivity',
        description: 'You have disadvantage on attack rolls and Perception checks in direct sunlight.',
      },
      {
        kind: 'tag',
        tags: ['sunlight-sensitivity', 'conditional-disadvantage'],
      },
    ],
    edition: '2024',
  },
];

/**
 * Elf Base Traits (2014 edition)
 */
export const elf2014BaseEffects: SourcedEffect[] = [
  // Languages
  {
    sourceId: 'species:elf',
    effectId: 'elf-languages-2014',
    name: 'Elf Languages',
    description: 'You can speak, read, and write Common and Elvish.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'language',
        values: ['Common', 'Elvish'],
      },
    ],
    edition: '2014',
  },

  // Speed
  {
    sourceId: 'species:elf',
    effectId: 'elf-speed-2014',
    name: 'Elf Speed',
    description: 'Your base walking speed is 30 feet.',
    effects: [
      {
        kind: 'speed',
        movementType: 'walk',
        value: 30,
      },
    ],
    edition: '2014',
  },

  // Darkvision
  {
    sourceId: 'species:elf',
    effectId: 'elf-darkvision-2014',
    name: 'Darkvision',
    description: 'You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.',
    effects: [
      {
        kind: 'sense',
        senseType: 'darkvision',
        range: 60,
      },
      {
        kind: 'grantFeature',
        featureId: 'darkvision',
        name: 'Darkvision',
        description: 'You can see in dim light within 60 feet.',
      },
    ],
    edition: '2014',
  },

  // Keen Senses
  {
    sourceId: 'species:elf',
    effectId: 'elf-keen-senses-2014',
    name: 'Keen Senses',
    description: 'You have proficiency in the Perception skill.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'skill',
        values: ['Perception'],
      },
    ],
    edition: '2014',
  },

  // Fey Ancestry
  {
    sourceId: 'species:elf',
    effectId: 'elf-fey-ancestry-2014',
    name: 'Fey Ancestry',
    description: 'You have advantage on saving throws against being charmed, and magic can\'t put you to sleep.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'fey-ancestry',
        name: 'Fey Ancestry',
        description: 'Advantage on charm saves, immune to magical sleep.',
      },
      {
        kind: 'tag',
        tags: ['fey-ancestry', 'charm-resistance', 'sleep-immunity'],
      },
    ],
    edition: '2014',
  },

  // Trance
  {
    sourceId: 'species:elf',
    effectId: 'elf-trance-2014',
    name: 'Trance',
    description: 'Elves don\'t need to sleep. Instead, they meditate deeply, remaining semiconscious, for 4 hours a day.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'trance',
        name: 'Trance',
        description: 'Meditate for 4 hours instead of sleeping 8 hours.',
      },
      {
        kind: 'tag',
        tags: ['trance', 'reduced-rest-time'],
      },
    ],
    edition: '2014',
  },
];

/**
 * High Elf Subrace (2014)
 * +2 DEX, +1 INT
 */
export const highElf2014Effects: SourcedEffect[] = [
  // Ability Score Increase
  {
    sourceId: 'species:high-elf',
    effectId: 'high-elf-asi-2014',
    name: 'High Elf Ability Score Increase',
    description: '+2 Dexterity, +1 Intelligence',
    effects: [
      {
        kind: 'abilityScoreIncrease',
        ability: 'DEX',
        value: 2,
        predicate: [{ type: 'edition', value: '2014' }],
      },
      {
        kind: 'abilityScoreIncrease',
        ability: 'INT',
        value: 1,
        predicate: [{ type: 'edition', value: '2014' }],
      },
    ],
    edition: '2014',
  },

  // Elf Weapon Training
  {
    sourceId: 'species:high-elf',
    effectId: 'high-elf-weapon-training-2014',
    name: 'Elf Weapon Training',
    description: 'You have proficiency with the longsword, shortsword, shortbow, and longbow.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'weapon',
        values: ['Longsword', 'Shortsword', 'Shortbow', 'Longbow'],
      },
    ],
    edition: '2014',
  },

  // Cantrip
  {
    sourceId: 'species:high-elf',
    effectId: 'high-elf-cantrip-2014',
    name: 'Cantrip',
    description: 'You know one cantrip of your choice from the wizard spell list. Intelligence is your spellcasting ability for it.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'high-elf-cantrip',
        name: 'High Elf Cantrip',
        description: 'You know one wizard cantrip.',
      },
      {
        kind: 'tag',
        tags: ['high-elf-magic', 'bonus-cantrip'],
      },
    ],
    edition: '2014',
  },

  // Extra Language
  {
    sourceId: 'species:high-elf',
    effectId: 'high-elf-language-2014',
    name: 'Extra Language',
    description: 'You can speak, read, and write one extra language of your choice.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'high-elf-language',
        name: 'Extra Language',
        description: 'You know one extra language.',
      },
      {
        kind: 'tag',
        tags: ['bonus-language'],
      },
    ],
    edition: '2014',
  },
];

/**
 * Wood Elf Subrace (2014)
 * +2 DEX, +1 WIS
 */
export const woodElf2014Effects: SourcedEffect[] = [
  // Ability Score Increase
  {
    sourceId: 'species:wood-elf',
    effectId: 'wood-elf-asi-2014',
    name: 'Wood Elf Ability Score Increase',
    description: '+2 Dexterity, +1 Wisdom',
    effects: [
      {
        kind: 'abilityScoreIncrease',
        ability: 'DEX',
        value: 2,
        predicate: [{ type: 'edition', value: '2014' }],
      },
      {
        kind: 'abilityScoreIncrease',
        ability: 'WIS',
        value: 1,
        predicate: [{ type: 'edition', value: '2014' }],
      },
    ],
    edition: '2014',
  },

  // Elf Weapon Training
  {
    sourceId: 'species:wood-elf',
    effectId: 'wood-elf-weapon-training-2014',
    name: 'Elf Weapon Training',
    description: 'You have proficiency with the longsword, shortsword, shortbow, and longbow.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'weapon',
        values: ['Longsword', 'Shortsword', 'Shortbow', 'Longbow'],
      },
    ],
    edition: '2014',
  },

  // Fleet of Foot
  {
    sourceId: 'species:wood-elf',
    effectId: 'wood-elf-fleet-2014',
    name: 'Fleet of Foot',
    description: 'Your base walking speed increases to 35 feet.',
    effects: [
      {
        kind: 'speed',
        movementType: 'walk',
        value: 5,
        priority: 'additive',
        stacking: 'stack',
      },
    ],
    edition: '2014',
  },

  // Mask of the Wild
  {
    sourceId: 'species:wood-elf',
    effectId: 'wood-elf-mask-2014',
    name: 'Mask of the Wild',
    description: 'You can attempt to hide even when you are only lightly obscured by foliage, heavy rain, falling snow, mist, and other natural phenomena.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'mask-of-the-wild',
        name: 'Mask of the Wild',
        description: 'Hide in natural phenomena.',
      },
      {
        kind: 'tag',
        tags: ['mask-of-the-wild', 'stealth-in-nature'],
      },
    ],
    edition: '2014',
  },
];

/**
 * Drow Subrace (2014)
 * +2 DEX, +1 CHA
 */
export const drow2014Effects: SourcedEffect[] = [
  // Ability Score Increase
  {
    sourceId: 'species:drow',
    effectId: 'drow-asi-2014',
    name: 'Drow Ability Score Increase',
    description: '+2 Dexterity, +1 Charisma',
    effects: [
      {
        kind: 'abilityScoreIncrease',
        ability: 'DEX',
        value: 2,
        predicate: [{ type: 'edition', value: '2014' }],
      },
      {
        kind: 'abilityScoreIncrease',
        ability: 'CHA',
        value: 1,
        predicate: [{ type: 'edition', value: '2014' }],
      },
    ],
    edition: '2014',
  },

  // Superior Darkvision
  {
    sourceId: 'species:drow',
    effectId: 'drow-superior-darkvision-2014',
    name: 'Superior Darkvision',
    description: 'Your darkvision has a radius of 120 feet.',
    effects: [
      {
        kind: 'sense',
        senseType: 'darkvision',
        range: 60, // Additional 60 on top of base 60
        priority: 'additive',
        stacking: 'max',
      },
    ],
    edition: '2014',
  },

  // Sunlight Sensitivity
  {
    sourceId: 'species:drow',
    effectId: 'drow-sunlight-sensitivity-2014',
    name: 'Sunlight Sensitivity',
    description: 'You have disadvantage on attack rolls and Perception checks when you, the target of your attack, or whatever you are trying to perceive is in direct sunlight.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'sunlight-sensitivity',
        name: 'Sunlight Sensitivity',
        description: 'Disadvantage in sunlight.',
      },
      {
        kind: 'tag',
        tags: ['sunlight-sensitivity', 'conditional-disadvantage'],
      },
    ],
    edition: '2014',
  },

  // Drow Magic
  {
    sourceId: 'species:drow',
    effectId: 'drow-magic-2014',
    name: 'Drow Magic',
    description: 'You know the Dancing Lights cantrip. Charisma is your spellcasting ability for it.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'drow-magic',
        name: 'Drow Magic',
        description: 'You know the Dancing Lights cantrip.',
      },
      {
        kind: 'tag',
        tags: ['drow-magic', 'bonus-cantrip'],
      },
    ],
    edition: '2014',
  },

  // Drow Weapon Training
  {
    sourceId: 'species:drow',
    effectId: 'drow-weapon-training-2014',
    name: 'Drow Weapon Training',
    description: 'You have proficiency with rapiers, shortswords, and hand crossbows.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'weapon',
        values: ['Rapier', 'Shortsword', 'Hand crossbow'],
      },
    ],
    edition: '2014',
  },
];

/**
 * Consolidated elf effects by lineage/subrace
 */
export const elfEffects = {
  // 2024 lineages
  elf2024: [...elf2024BaseEffects],
  highElf2024: [...elf2024BaseEffects, ...highElf2024Effects],
  woodElf2024: [...elf2024BaseEffects, ...woodElf2024Effects],
  drow2024: [...elf2024BaseEffects, ...drow2024Effects],

  // 2014 subraces
  elf2014: [...elf2014BaseEffects],
  highElf2014: [...elf2014BaseEffects, ...highElf2014Effects],
  woodElf2014: [...elf2014BaseEffects, ...woodElf2014Effects],
  drow2014: [...elf2014BaseEffects, ...drow2014Effects],
};
