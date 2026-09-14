/**
 * Human Species Effects
 * Pure data - no game logic in code
 *
 * Note: 2014 Humans had flexible +1 to all abilities or +1/+1/+1/+1/+1/+1
 * 2024 Humans have no ability bonuses (those come from backgrounds)
 */

import type { SourcedEffect } from '../../types/effects';

/**
 * Human base species effects (2024 edition)
 */
export const human2024Effects: SourcedEffect[] = [
  // Languages
  {
    sourceId: 'species:human-2024',
    effectId: 'human-languages',
    name: 'Human Languages',
    description: 'You can speak, read, and write Common and one extra language of your choice.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'language',
        values: ['Common'],
      },
    ],
    edition: '2024',
  },

  // Speed
  {
    sourceId: 'species:human-2024',
    effectId: 'human-speed',
    name: 'Human Speed',
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

  // Resourceful (Heroic Inspiration on Long Rest)
  {
    sourceId: 'species:human-2024',
    effectId: 'human-resourceful',
    name: 'Resourceful',
    description: 'You regain Heroic Inspiration whenever you finish a Long Rest.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'resourceful',
        name: 'Resourceful',
        description: 'You regain Heroic Inspiration whenever you finish a Long Rest.',
      },
      {
        kind: 'tag',
        tags: ['resourceful', 'heroic-inspiration-recovery'],
      },
    ],
    edition: '2024',
  },

  // Skillful (Extra skill proficiency)
  {
    sourceId: 'species:human-2024',
    effectId: 'human-skillful',
    name: 'Skillful',
    description: 'You gain proficiency in one skill of your choice.',
    // Note: This requires a choice system, implemented in later phases
    // For now, mark as feature
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'skillful',
        name: 'Skillful',
        description: 'You gain proficiency in one skill of your choice.',
      },
      {
        kind: 'tag',
        tags: ['skillful', 'bonus-skill-proficiency'],
      },
    ],
    edition: '2024',
  },

  // Versatile (Extra Origin Feat)
  {
    sourceId: 'species:human-2024',
    effectId: 'human-versatile',
    name: 'Versatile',
    description: 'You gain one Origin Feat of your choice.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'versatile',
        name: 'Versatile',
        description: 'You gain one Origin Feat of your choice.',
      },
      {
        kind: 'tag',
        tags: ['versatile', 'bonus-origin-feat'],
      },
    ],
    edition: '2024',
  },
];

/**
 * Human base species effects (2014 edition)
 */
export const human2014Effects: SourcedEffect[] = [
  // Languages
  {
    sourceId: 'species:human',
    effectId: 'human-languages-2014',
    name: 'Human Languages',
    description: 'You can speak, read, and write Common and one extra language of your choice.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'language',
        values: ['Common'],
      },
    ],
    edition: '2014',
  },

  // Speed
  {
    sourceId: 'species:human',
    effectId: 'human-speed-2014',
    name: 'Human Speed',
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

  // 2014: +1 to all ability scores (standard human)
  {
    sourceId: 'species:human',
    effectId: 'human-ability-standard-2014',
    name: 'Human Ability Score Increase',
    description: 'Your ability scores each increase by 1.',
    effects: [
      {
        kind: 'abilityScoreIncrease',
        ability: 'STR',
        value: 1,
        predicate: [{ type: 'edition', value: '2014' }],
      },
      {
        kind: 'abilityScoreIncrease',
        ability: 'DEX',
        value: 1,
        predicate: [{ type: 'edition', value: '2014' }],
      },
      {
        kind: 'abilityScoreIncrease',
        ability: 'CON',
        value: 1,
        predicate: [{ type: 'edition', value: '2014' }],
      },
      {
        kind: 'abilityScoreIncrease',
        ability: 'INT',
        value: 1,
        predicate: [{ type: 'edition', value: '2014' }],
      },
      {
        kind: 'abilityScoreIncrease',
        ability: 'WIS',
        value: 1,
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
];
