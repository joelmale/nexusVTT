/**
 * Halfling Species Effects
 * Pure data - no game logic in code
 *
 * Halflings have lineages in 2024: Lightfoot, Stout
 * 2014 has subraces with ability score bonuses
 */

import type { SourcedEffect } from '../../types/effects';

/**
 * Halfling Base Traits (2024 edition)
 * Common to all halfling lineages
 */
export const halfling2024BaseEffects: SourcedEffect[] = [
  // Languages
  {
    sourceId: 'species:halfling-2024',
    effectId: 'halfling-languages',
    name: 'Halfling Languages',
    description: 'You can speak, read, and write Common and Halfling.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'language',
        values: ['Common', 'Halfling'],
      },
    ],
    edition: '2024',
  },

  // Speed
  {
    sourceId: 'species:halfling-2024',
    effectId: 'halfling-speed',
    name: 'Halfling Speed',
    description: 'Your base walking speed is 25 feet.',
    effects: [
      {
        kind: 'speed',
        movementType: 'walk',
        value: 25,
      },
    ],
    edition: '2024',
  },

  // Lucky
  {
    sourceId: 'species:halfling-2024',
    effectId: 'halfling-lucky',
    name: 'Lucky',
    description: 'When you roll a 1 on the d20 for an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'lucky',
        name: 'Lucky',
        description: 'Reroll natural 1s on d20 rolls.',
      },
      {
        kind: 'tag',
        tags: ['lucky', 'reroll-ones'],
      },
    ],
    edition: '2024',
  },

  // Brave
  {
    sourceId: 'species:halfling-2024',
    effectId: 'halfling-brave',
    name: 'Brave',
    description: 'You have advantage on saving throws against being frightened.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'brave',
        name: 'Brave',
        description: 'Advantage on saves against being frightened.',
      },
      {
        kind: 'tag',
        tags: ['brave', 'fear-resistance'],
      },
    ],
    edition: '2024',
  },

  // Halfling Nimbleness
  {
    sourceId: 'species:halfling-2024',
    effectId: 'halfling-nimbleness',
    name: 'Halfling Nimbleness',
    description: 'You can move through the space of any creature that is of a size larger than yours.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'halfling-nimbleness',
        name: 'Halfling Nimbleness',
        description: 'Move through larger creatures\' spaces.',
      },
      {
        kind: 'tag',
        tags: ['halfling-nimbleness', 'movement-flexibility'],
      },
    ],
    edition: '2024',
  },
];

/**
 * Lightfoot Halfling Lineage (2024)
 * Naturally stealthy
 */
export const lightfootHalfling2024Effects: SourcedEffect[] = [
  // Naturally Stealthy
  {
    sourceId: 'species:lightfoot-halfling-2024',
    effectId: 'lightfoot-naturally-stealthy',
    name: 'Naturally Stealthy',
    description: 'You can attempt to hide even when you are obscured only by a creature that is at least one size larger than you.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'naturally-stealthy',
        name: 'Naturally Stealthy',
        description: 'Hide behind larger creatures.',
      },
      {
        kind: 'tag',
        tags: ['naturally-stealthy', 'hide-bonus'],
      },
    ],
    edition: '2024',
  },
];

/**
 * Stout Halfling Lineage (2024)
 * Poison resistance
 */
export const stoutHalfling2024Effects: SourcedEffect[] = [
  // Stout Resilience
  {
    sourceId: 'species:stout-halfling-2024',
    effectId: 'stout-resilience',
    name: 'Stout Resilience',
    description: 'You have advantage on saving throws against poison, and you have resistance against poison damage.',
    effects: [
      {
        kind: 'damageResistance',
        damageType: 'poison',
      },
      {
        kind: 'grantFeature',
        featureId: 'stout-resilience',
        name: 'Stout Resilience',
        description: 'Advantage on poison saves, poison resistance.',
      },
      {
        kind: 'tag',
        tags: ['stout-resilience', 'poison-resistance'],
      },
    ],
    edition: '2024',
  },
];

/**
 * Halfling Base Traits (2014 edition)
 */
export const halfling2014BaseEffects: SourcedEffect[] = [
  // Languages
  {
    sourceId: 'species:halfling',
    effectId: 'halfling-languages-2014',
    name: 'Halfling Languages',
    description: 'You can speak, read, and write Common and Halfling.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'language',
        values: ['Common', 'Halfling'],
      },
    ],
    edition: '2014',
  },

  // Speed
  {
    sourceId: 'species:halfling',
    effectId: 'halfling-speed-2014',
    name: 'Halfling Speed',
    description: 'Your base walking speed is 25 feet.',
    effects: [
      {
        kind: 'speed',
        movementType: 'walk',
        value: 25,
      },
    ],
    edition: '2014',
  },

  // Lucky
  {
    sourceId: 'species:halfling',
    effectId: 'halfling-lucky-2014',
    name: 'Lucky',
    description: 'When you roll a 1 on an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'lucky',
        name: 'Lucky',
        description: 'Reroll natural 1s.',
      },
      {
        kind: 'tag',
        tags: ['lucky', 'reroll-ones'],
      },
    ],
    edition: '2014',
  },

  // Brave
  {
    sourceId: 'species:halfling',
    effectId: 'halfling-brave-2014',
    name: 'Brave',
    description: 'You have advantage on saving throws against being frightened.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'brave',
        name: 'Brave',
        description: 'Advantage on fear saves.',
      },
      {
        kind: 'tag',
        tags: ['brave', 'fear-resistance'],
      },
    ],
    edition: '2014',
  },

  // Halfling Nimbleness
  {
    sourceId: 'species:halfling',
    effectId: 'halfling-nimbleness-2014',
    name: 'Halfling Nimbleness',
    description: 'You can move through the space of any creature that is of a size larger than yours.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'halfling-nimbleness',
        name: 'Halfling Nimbleness',
        description: 'Move through larger creatures.',
      },
      {
        kind: 'tag',
        tags: ['halfling-nimbleness', 'movement-flexibility'],
      },
    ],
    edition: '2014',
  },

  // Base ability score (DEX +2 for all halflings)
  {
    sourceId: 'species:halfling',
    effectId: 'halfling-asi-base-2014',
    name: 'Halfling Ability Score Increase',
    description: 'Your Dexterity score increases by 2.',
    effects: [
      {
        kind: 'abilityScoreIncrease',
        ability: 'DEX',
        value: 2,
        predicate: [{ type: 'edition', value: '2014' }],
      },
    ],
    edition: '2014',
  },
];

/**
 * Lightfoot Halfling Subrace (2014)
 * +2 DEX, +1 CHA
 */
export const lightfootHalfling2014Effects: SourcedEffect[] = [
  // Ability Score Increase
  {
    sourceId: 'species:lightfoot-halfling',
    effectId: 'lightfoot-asi-2014',
    name: 'Lightfoot Halfling Ability Score Increase',
    description: '+1 Charisma',
    effects: [
      {
        kind: 'abilityScoreIncrease',
        ability: 'CHA',
        value: 1,
        predicate: [{ type: 'edition', value: '2014' }],
      },
    ],
    edition: '2014',
  },

  // Naturally Stealthy
  {
    sourceId: 'species:lightfoot-halfling',
    effectId: 'lightfoot-naturally-stealthy-2014',
    name: 'Naturally Stealthy',
    description: 'You can attempt to hide even when you are obscured only by a creature that is at least one size larger than you.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'naturally-stealthy',
        name: 'Naturally Stealthy',
        description: 'Hide behind larger creatures.',
      },
      {
        kind: 'tag',
        tags: ['naturally-stealthy', 'hide-bonus'],
      },
    ],
    edition: '2014',
  },
];

/**
 * Stout Halfling Subrace (2014)
 * +2 DEX, +1 CON
 */
export const stoutHalfling2014Effects: SourcedEffect[] = [
  // Ability Score Increase
  {
    sourceId: 'species:stout-halfling',
    effectId: 'stout-asi-2014',
    name: 'Stout Halfling Ability Score Increase',
    description: '+1 Constitution',
    effects: [
      {
        kind: 'abilityScoreIncrease',
        ability: 'CON',
        value: 1,
        predicate: [{ type: 'edition', value: '2014' }],
      },
    ],
    edition: '2014',
  },

  // Stout Resilience
  {
    sourceId: 'species:stout-halfling',
    effectId: 'stout-resilience-2014',
    name: 'Stout Resilience',
    description: 'You have advantage on saving throws against poison, and you have resistance against poison damage.',
    effects: [
      {
        kind: 'damageResistance',
        damageType: 'poison',
      },
      {
        kind: 'grantFeature',
        featureId: 'stout-resilience',
        name: 'Stout Resilience',
        description: 'Poison resistance.',
      },
      {
        kind: 'tag',
        tags: ['stout-resilience', 'poison-resistance'],
      },
    ],
    edition: '2014',
  },
];

/**
 * Consolidated halfling effects by lineage/subrace
 */
export const halflingEffects = {
  // 2024 lineages
  halfling2024: [...halfling2024BaseEffects],
  lightfootHalfling2024: [...halfling2024BaseEffects, ...lightfootHalfling2024Effects],
  stoutHalfling2024: [...halfling2024BaseEffects, ...stoutHalfling2024Effects],

  // 2014 subraces
  halfling2014: [...halfling2014BaseEffects],
  lightfootHalfling2014: [...halfling2014BaseEffects, ...lightfootHalfling2014Effects],
  stoutHalfling2014: [...halfling2014BaseEffects, ...stoutHalfling2014Effects],
};
