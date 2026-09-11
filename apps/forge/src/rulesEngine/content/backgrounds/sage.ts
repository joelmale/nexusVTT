/**
 * Sage Background Effects
 * Pure data - no game logic in code
 */

import type { SourcedEffect } from '../../types/effects';

/**
 * Sage background effects (2014)
 */
export const sage2014Effects: SourcedEffect[] = [
  // Skill proficiencies
  {
    sourceId: 'background:sage',
    effectId: 'sage-skills-2014',
    name: 'Sage Skills',
    description: 'You gain proficiency in Arcana and History.',
    effects: [
      {
        kind: 'skillProficiency',
        skill: 'Arcana',
        predicate: [{ type: 'edition', value: '2014' }],
      },
      {
        kind: 'skillProficiency',
        skill: 'History',
        predicate: [{ type: 'edition', value: '2014' }],
      },
    ],
    edition: '2014',
  },

  // Languages
  {
    sourceId: 'background:sage',
    effectId: 'sage-languages-2014',
    name: 'Sage Languages',
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
    sourceId: 'background:sage',
    effectId: 'sage-feature-2014',
    name: 'Researcher',
    description:
      'When you attempt to learn or recall a piece of lore, if you do not know that information, you often know where and from whom you can obtain it.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'researcher',
        name: 'Researcher',
        description:
          'When you attempt to learn or recall a piece of lore, if you do not know that information, you often know where and from whom you can obtain it.',
        predicate: [{ type: 'edition', value: '2014' }],
      },
      {
        kind: 'tag',
        tags: ['researcher'],
        predicate: [{ type: 'edition', value: '2014' }],
      },
    ],
    edition: '2014',
  },
];

/**
 * All Sage effects
 */
export const sageEffects: SourcedEffect[] = [...sage2014Effects];
