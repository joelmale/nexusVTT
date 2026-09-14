/**
 * Acolyte Background Effects
 * Pure data - no game logic in code
 */

import type { SourcedEffect } from '../../types/effects';

/**
 * Acolyte background effects (2014)
 */
export const acolyte2014Effects: SourcedEffect[] = [
  // Skill proficiencies
  {
    sourceId: 'background:acolyte',
    effectId: 'acolyte-skills-2014',
    name: 'Acolyte Skills',
    description: 'You gain proficiency in Insight and Religion.',
    effects: [
      {
        kind: 'skillProficiency',
        skill: 'Insight',
        predicate: [{ type: 'edition', value: '2014' }],
      },
      {
        kind: 'skillProficiency',
        skill: 'Religion',
        predicate: [{ type: 'edition', value: '2014' }],
      },
    ],
    edition: '2014',
  },

  // Languages
  {
    sourceId: 'background:acolyte',
    effectId: 'acolyte-languages-2014',
    name: 'Acolyte Languages',
    description: 'You learn two languages of your choice.',
    effects: [
      {
        kind: 'tag',
        tags: ['bonus-languages:2'],
        predicate: [{ type: 'edition', value: '2014' }],
      },
    ],
    edition: '2014',
  },

  // Feature
  {
    sourceId: 'background:acolyte',
    effectId: 'acolyte-feature-2014',
    name: 'Shelter of the Faithful',
    description:
      'You and your companions can expect free healing and care at a temple, shrine, or other establishment of your faith.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'shelter-of-the-faithful',
        name: 'Shelter of the Faithful',
        description:
          'You and your companions can expect free healing and care at a temple, shrine, or other establishment of your faith.',
        predicate: [{ type: 'edition', value: '2014' }],
      },
      {
        kind: 'tag',
        tags: ['shelter-of-the-faithful'],
        predicate: [{ type: 'edition', value: '2014' }],
      },
    ],
    edition: '2014',
  },
];

/**
 * Acolyte background effects (2024)
 */
export const acolyte2024Effects: SourcedEffect[] = [
  // Skill proficiencies
  {
    sourceId: 'background:acolyte',
    effectId: 'acolyte-skills-2024',
    name: 'Acolyte Skills',
    description: 'You gain proficiency in Insight, Persuasion, and Religion.',
    effects: [
      {
        kind: 'skillProficiency',
        skill: 'Insight',
        predicate: [{ type: 'edition', value: '2024' }],
      },
      {
        kind: 'skillProficiency',
        skill: 'Persuasion',
        predicate: [{ type: 'edition', value: '2024' }],
      },
      {
        kind: 'skillProficiency',
        skill: 'Religion',
        predicate: [{ type: 'edition', value: '2024' }],
      },
    ],
    edition: '2024',
  },

  // Tool proficiencies
  {
    sourceId: 'background:acolyte',
    effectId: 'acolyte-tools-2024',
    name: 'Acolyte Tool Proficiencies',
    description: "You gain proficiency with Calligrapher's Supplies.",
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'tool',
        values: ["Calligrapher's Supplies"],
        predicate: [{ type: 'edition', value: '2024' }],
      },
    ],
    edition: '2024',
  },

  // Ability score bonuses (2024)
  {
    sourceId: 'background:acolyte',
    effectId: 'acolyte-ability-2024',
    name: 'Acolyte Ability Increases',
    description: 'Your Wisdom and Charisma scores each increase by 1.',
    effects: [
      {
        kind: 'abilityScoreIncrease',
        ability: 'WIS',
        value: 1,
        predicate: [{ type: 'edition', value: '2024' }],
      },
      {
        kind: 'abilityScoreIncrease',
        ability: 'CHA',
        value: 1,
        predicate: [{ type: 'edition', value: '2024' }],
      },
    ],
    edition: '2024',
  },

  // Feature
  {
    sourceId: 'background:acolyte',
    effectId: 'acolyte-feature-2024',
    name: 'Shelter of the Faithful',
    description:
      'You and your companions can expect free healing and care at a temple, shrine, or other establishment of your faith.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'shelter-of-the-faithful',
        name: 'Shelter of the Faithful',
        description:
          'You and your companions can expect free healing and care at a temple, shrine, or other establishment of your faith.',
        predicate: [{ type: 'edition', value: '2024' }],
      },
      {
        kind: 'tag',
        tags: ['shelter-of-the-faithful'],
        predicate: [{ type: 'edition', value: '2024' }],
      },
    ],
    edition: '2024',
  },
];

/**
 * All Acolyte effects
 */
export const acolyteEffects: SourcedEffect[] = [...acolyte2014Effects, ...acolyte2024Effects];
