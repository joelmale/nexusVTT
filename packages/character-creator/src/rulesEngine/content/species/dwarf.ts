/**
 * Dwarf Species Effects
 * Pure data - no game logic in code
 *
 * Dwarves have lineages in 2024: Hill Dwarf, Mountain Dwarf
 * 2014 has subraces with ability score bonuses
 */

import type { SourcedEffect } from '../../types/effects';

/**
 * Dwarf Base Traits (2024 edition)
 * Common to all dwarf lineages
 */
export const dwarf2024BaseEffects: SourcedEffect[] = [
  // Languages
  {
    sourceId: 'species:dwarf-2024',
    effectId: 'dwarf-languages',
    name: 'Dwarf Languages',
    description: 'You can speak, read, and write Common and Dwarvish.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'language',
        values: ['Common', 'Dwarvish'],
      },
    ],
    edition: '2024',
  },

  // Speed (25 feet, not reduced by heavy armor)
  {
    sourceId: 'species:dwarf-2024',
    effectId: 'dwarf-speed',
    name: 'Dwarf Speed',
    description: 'Your base walking speed is 25 feet. Your speed is not reduced by wearing heavy armor.',
    effects: [
      {
        kind: 'speed',
        movementType: 'walk',
        value: 25,
      },
      {
        kind: 'grantFeature',
        featureId: 'dwarf-armor-speed',
        name: 'Dwarven Resilience',
        description: 'Your speed is not reduced by wearing heavy armor.',
      },
      {
        kind: 'tag',
        tags: ['armor-speed-unhindered'],
      },
    ],
    edition: '2024',
  },

  // Darkvision
  {
    sourceId: 'species:dwarf-2024',
    effectId: 'dwarf-darkvision',
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
        description: 'You can see in darkness within 60 feet.',
      },
    ],
    edition: '2024',
  },

  // Dwarven Resilience (poison resistance)
  {
    sourceId: 'species:dwarf-2024',
    effectId: 'dwarf-resilience',
    name: 'Dwarven Resilience',
    description: 'You have advantage on saving throws against poison, and you have resistance against poison damage.',
    effects: [
      {
        kind: 'damageResistance',
        damageType: 'poison',
      },
      {
        kind: 'grantFeature',
        featureId: 'dwarven-resilience',
        name: 'Dwarven Resilience',
        description: 'Advantage on poison saves, resistance to poison damage.',
      },
      {
        kind: 'tag',
        tags: ['dwarven-resilience', 'poison-resistance'],
      },
    ],
    edition: '2024',
  },

  // Dwarven Toughness
  {
    sourceId: 'species:dwarf-2024',
    effectId: 'dwarf-toughness',
    name: 'Dwarven Toughness',
    description: 'Your hit point maximum increases by 1, and it increases by 1 every time you gain a level.',
    effects: [
      {
        kind: 'hitPoints',
        value: {
          expression: '@level',
          variables: ['@level'],
        },
        priority: 'additive',
        stacking: 'stack',
      },
      {
        kind: 'grantFeature',
        featureId: 'dwarven-toughness',
        name: 'Dwarven Toughness',
        description: '+1 HP per level.',
      },
      {
        kind: 'tag',
        tags: ['dwarven-toughness', 'bonus-hp'],
      },
    ],
    edition: '2024',
  },

  // Stonecunning
  {
    sourceId: 'species:dwarf-2024',
    effectId: 'dwarf-stonecunning',
    name: 'Stonecunning',
    description: 'Whenever you make an Intelligence (History) check related to the origin of stonework, you are considered proficient and add double your proficiency bonus.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'stonecunning',
        name: 'Stonecunning',
        description: 'Expertise on History checks about stonework.',
      },
      {
        kind: 'tag',
        tags: ['stonecunning', 'conditional-expertise'],
      },
    ],
    edition: '2024',
  },
];

/**
 * Hill Dwarf Lineage (2024)
 * Additional wisdom bonus
 */
export const hillDwarf2024Effects: SourcedEffect[] = [
  // Hill Dwarf Toughness (extra HP on top of base)
  {
    sourceId: 'species:hill-dwarf-2024',
    effectId: 'hill-dwarf-extra-toughness',
    name: 'Hill Dwarf Toughness',
    description: 'Your hit point maximum increases by an additional 1 per level.',
    effects: [
      {
        kind: 'hitPoints',
        value: {
          expression: '@level',
          variables: ['@level'],
        },
        priority: 'additive',
        stacking: 'stack',
      },
      {
        kind: 'grantFeature',
        featureId: 'hill-dwarf-toughness',
        name: 'Hill Dwarf Toughness',
        description: 'Additional +1 HP per level.',
      },
    ],
    edition: '2024',
  },
];

/**
 * Mountain Dwarf Lineage (2024)
 * Armor training
 */
export const mountainDwarf2024Effects: SourcedEffect[] = [
  // Dwarven Armor Training
  {
    sourceId: 'species:mountain-dwarf-2024',
    effectId: 'mountain-dwarf-armor-training',
    name: 'Dwarven Armor Training',
    description: 'You have proficiency with light and medium armor.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'armor',
        values: ['Light armor', 'Medium armor'],
      },
    ],
    edition: '2024',
  },
];

/**
 * Dwarf Base Traits (2014 edition)
 */
export const dwarf2014BaseEffects: SourcedEffect[] = [
  // Languages
  {
    sourceId: 'species:dwarf',
    effectId: 'dwarf-languages-2014',
    name: 'Dwarf Languages',
    description: 'You can speak, read, and write Common and Dwarvish.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'language',
        values: ['Common', 'Dwarvish'],
      },
    ],
    edition: '2014',
  },

  // Speed
  {
    sourceId: 'species:dwarf',
    effectId: 'dwarf-speed-2014',
    name: 'Dwarf Speed',
    description: 'Your base walking speed is 25 feet. Your speed is not reduced by wearing heavy armor.',
    effects: [
      {
        kind: 'speed',
        movementType: 'walk',
        value: 25,
      },
      {
        kind: 'grantFeature',
        featureId: 'dwarf-armor-speed',
        name: 'Armor Speed',
        description: 'Heavy armor doesn\'t reduce your speed.',
      },
      {
        kind: 'tag',
        tags: ['armor-speed-unhindered'],
      },
    ],
    edition: '2014',
  },

  // Darkvision
  {
    sourceId: 'species:dwarf',
    effectId: 'dwarf-darkvision-2014',
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
        description: 'See in darkness within 60 feet.',
      },
    ],
    edition: '2014',
  },

  // Dwarven Resilience
  {
    sourceId: 'species:dwarf',
    effectId: 'dwarf-resilience-2014',
    name: 'Dwarven Resilience',
    description: 'You have advantage on saving throws against poison, and you have resistance to poison damage.',
    effects: [
      {
        kind: 'damageResistance',
        damageType: 'poison',
      },
      {
        kind: 'grantFeature',
        featureId: 'dwarven-resilience',
        name: 'Dwarven Resilience',
        description: 'Advantage on poison saves, poison resistance.',
      },
      {
        kind: 'tag',
        tags: ['dwarven-resilience', 'poison-resistance'],
      },
    ],
    edition: '2014',
  },

  // Dwarven Combat Training
  {
    sourceId: 'species:dwarf',
    effectId: 'dwarf-combat-training-2014',
    name: 'Dwarven Combat Training',
    description: 'You have proficiency with the battleaxe, handaxe, light hammer, and warhammer.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'weapon',
        values: ['Battleaxe', 'Handaxe', 'Light hammer', 'Warhammer'],
      },
    ],
    edition: '2014',
  },

  // Tool Proficiency
  {
    sourceId: 'species:dwarf',
    effectId: 'dwarf-tool-proficiency-2014',
    name: 'Tool Proficiency',
    description: 'You gain proficiency with one of the following: smith\'s tools, brewer\'s supplies, or mason\'s tools.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'dwarf-tool-proficiency',
        name: 'Tool Proficiency',
        description: 'Proficiency with one artisan tool.',
      },
      {
        kind: 'tag',
        tags: ['dwarf-tool-proficiency'],
      },
    ],
    edition: '2014',
  },

  // Stonecunning
  {
    sourceId: 'species:dwarf',
    effectId: 'dwarf-stonecunning-2014',
    name: 'Stonecunning',
    description: 'Whenever you make an Intelligence (History) check related to the origin of stonework, you are considered proficient and add double your proficiency bonus.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'stonecunning',
        name: 'Stonecunning',
        description: 'Expertise on stonework History checks.',
      },
      {
        kind: 'tag',
        tags: ['stonecunning', 'conditional-expertise'],
      },
    ],
    edition: '2014',
  },

  // Base ability score (CON +2 for all dwarves)
  {
    sourceId: 'species:dwarf',
    effectId: 'dwarf-asi-base-2014',
    name: 'Dwarf Ability Score Increase',
    description: 'Your Constitution score increases by 2.',
    effects: [
      {
        kind: 'abilityScoreIncrease',
        ability: 'CON',
        value: 2,
        predicate: [{ type: 'edition', value: '2014' }],
      },
    ],
    edition: '2014',
  },
];

/**
 * Hill Dwarf Subrace (2014)
 * +2 CON, +1 WIS
 */
export const hillDwarf2014Effects: SourcedEffect[] = [
  // Ability Score Increase
  {
    sourceId: 'species:hill-dwarf',
    effectId: 'hill-dwarf-asi-2014',
    name: 'Hill Dwarf Ability Score Increase',
    description: '+1 Wisdom',
    effects: [
      {
        kind: 'abilityScoreIncrease',
        ability: 'WIS',
        value: 1,
        predicate: [{ type: 'edition', value: '2014' }],
      },
    ],
    edition: '2014',
  },

  // Dwarven Toughness
  {
    sourceId: 'species:hill-dwarf',
    effectId: 'hill-dwarf-toughness-2014',
    name: 'Dwarven Toughness',
    description: 'Your hit point maximum increases by 1, and it increases by 1 every time you gain a level.',
    effects: [
      {
        kind: 'hitPoints',
        value: {
          expression: '@level',
          variables: ['@level'],
        },
        priority: 'additive',
        stacking: 'stack',
      },
      {
        kind: 'grantFeature',
        featureId: 'dwarven-toughness',
        name: 'Dwarven Toughness',
        description: '+1 HP per level.',
      },
      {
        kind: 'tag',
        tags: ['dwarven-toughness', 'bonus-hp'],
      },
    ],
    edition: '2014',
  },
];

/**
 * Mountain Dwarf Subrace (2014)
 * +2 CON, +2 STR
 */
export const mountainDwarf2014Effects: SourcedEffect[] = [
  // Ability Score Increase
  {
    sourceId: 'species:mountain-dwarf',
    effectId: 'mountain-dwarf-asi-2014',
    name: 'Mountain Dwarf Ability Score Increase',
    description: '+2 Strength',
    effects: [
      {
        kind: 'abilityScoreIncrease',
        ability: 'STR',
        value: 2,
        predicate: [{ type: 'edition', value: '2014' }],
      },
    ],
    edition: '2014',
  },

  // Dwarven Armor Training
  {
    sourceId: 'species:mountain-dwarf',
    effectId: 'mountain-dwarf-armor-training-2014',
    name: 'Dwarven Armor Training',
    description: 'You have proficiency with light and medium armor.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'armor',
        values: ['Light armor', 'Medium armor'],
      },
    ],
    edition: '2014',
  },
];

/**
 * Consolidated dwarf effects by lineage/subrace
 */
export const dwarfEffects = {
  // 2024 lineages
  dwarf2024: [...dwarf2024BaseEffects],
  hillDwarf2024: [...dwarf2024BaseEffects, ...hillDwarf2024Effects],
  mountainDwarf2024: [...dwarf2024BaseEffects, ...mountainDwarf2024Effects],

  // 2014 subraces
  dwarf2014: [...dwarf2014BaseEffects],
  hillDwarf2014: [...dwarf2014BaseEffects, ...hillDwarf2014Effects],
  mountainDwarf2014: [...dwarf2014BaseEffects, ...mountainDwarf2014Effects],
};
