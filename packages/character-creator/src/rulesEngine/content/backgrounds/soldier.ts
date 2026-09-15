/**
 * Soldier Background Effects
 * Pure data - no game logic in code
 */

import type { SourcedEffect } from '../../types/effects';

/**
 * Soldier background effects (2014)
 */
export const soldier2014Effects: SourcedEffect[] = [
  // Skill proficiencies
  {
    sourceId: 'background:soldier',
    effectId: 'soldier-skills-2014',
    name: 'Soldier Skills',
    description: 'You gain proficiency in Athletics and Intimidation.',
    effects: [
      {
        kind: 'skillProficiency',
        skill: 'Athletics',
        predicate: [{ type: 'edition', value: '2014' }],
      },
      {
        kind: 'skillProficiency',
        skill: 'Intimidation',
        predicate: [{ type: 'edition', value: '2014' }],
      },
    ],
    edition: '2014',
  },

  // Tool proficiencies
  {
    sourceId: 'background:soldier',
    effectId: 'soldier-tools-2014',
    name: 'Soldier Tool Proficiencies',
    description: 'You gain proficiency with one type of gaming set and vehicles (land).',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'tool',
        values: ['Dice set', 'Vehicles (land)'],
        predicate: [{ type: 'edition', value: '2014' }],
      },
    ],
    edition: '2014',
  },

  // Feature
  {
    sourceId: 'background:soldier',
    effectId: 'soldier-feature-2014',
    name: 'Military Rank',
    description:
      'You have a military rank from your career as a soldier. Soldiers loyal to your former military organization still recognize your authority and influence.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'military-rank',
        name: 'Military Rank',
        description:
          'You have a military rank from your career as a soldier. Soldiers loyal to your former military organization still recognize your authority and influence.',
        predicate: [{ type: 'edition', value: '2014' }],
      },
      {
        kind: 'tag',
        tags: ['military-rank'],
        predicate: [{ type: 'edition', value: '2014' }],
      },
    ],
    edition: '2014',
  },
];

/**
 * All Soldier effects
 */
export const soldierEffects: SourcedEffect[] = [...soldier2014Effects];
