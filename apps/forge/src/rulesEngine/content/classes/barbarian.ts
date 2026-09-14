/**
 * Barbarian Class Effects
 * Pure data - no game logic in code
 */

import type { SourcedEffect } from '../../types/effects';
import { subclassEffectsByClass } from './subclassEffects';

/**
 * Barbarian base class proficiencies (both editions)
 */
export const barbarianProficiencies: SourcedEffect[] = [
  // Armor proficiencies
  {
    sourceId: 'class:barbarian',
    effectId: 'barbarian-armor-proficiency',
    name: 'Armor Proficiency',
    description: 'You are proficient with light armor, medium armor, and shields.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'armor',
        values: ['Light armor', 'Medium armor', 'Shields'],
        predicate: [{ type: 'classIs', slug: 'barbarian' }],
      },
    ],
    edition: 'both',
  },

  // Weapon proficiencies
  {
    sourceId: 'class:barbarian',
    effectId: 'barbarian-weapon-proficiency',
    name: 'Weapon Proficiency',
    description: 'You are proficient with simple weapons and martial weapons.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'weapon',
        values: ['Simple weapons', 'Martial weapons'],
        predicate: [{ type: 'classIs', slug: 'barbarian' }],
      },
    ],
    edition: 'both',
  },

  // Saving throw proficiencies
  {
    sourceId: 'class:barbarian',
    effectId: 'barbarian-saving-throws',
    name: 'Saving Throw Proficiency',
    description: 'You are proficient in Strength and Constitution saving throws.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'savingThrow',
        values: ['STR', 'CON'],
        predicate: [{ type: 'classIs', slug: 'barbarian' }],
      },
    ],
    edition: 'both',
  },

  // Skill proficiencies (choice-based, deferred to later phases)
  {
    sourceId: 'class:barbarian',
    effectId: 'barbarian-skill-choice',
    name: 'Barbarian Skills',
    description: 'Choose two from Animal Handling, Athletics, Intimidation, Nature, Perception, and Survival.',
    // Note: This requires choice system
    effects: [
      {
        kind: 'tag',
        tags: ['skill-choice-barbarian'],
      },
    ],
    edition: 'both',
  },
];

/**
 * Barbarian level 1 features
 */
export const barbarianLevel1Features: SourcedEffect[] = [
  // Rage feature with scaling uses
  {
    sourceId: 'class:barbarian',
    effectId: 'barbarian-rage',
    name: 'Rage',
    description:
      'In battle, you fight with primal ferocity. On your turn, you can enter a rage as a bonus action.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'rage',
        name: 'Rage',
        description:
          'While raging, you gain a bonus to damage rolls, advantage on Strength checks and saves, and resistance to physical damage. Your rage lasts for 1 minute.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'barbarian', level: 1 }],
      },
      {
        kind: 'tag',
        tags: ['rage'],
        predicate: [{ type: 'levelAtLeast', value: 1 }],
      },
    ],
    edition: 'both',
  },

  // Rage uses - Level 1: 2 uses
  {
    sourceId: 'class:barbarian',
    effectId: 'barbarian-rage-uses-L1',
    name: 'Rage Uses (Level 1)',
    description: '2 rages per long rest',
    effects: [
      {
        kind: 'resource',
        resourceId: 'rage',
        resourceType: 'perLongRest',
        value: 2,
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'barbarian', level: 1 }],
      },
    ],
    edition: 'both',
  },

  // Rage uses - Level 3: 3 uses
  {
    sourceId: 'class:barbarian',
    effectId: 'barbarian-rage-uses-L3',
    name: 'Rage Uses (Level 3)',
    description: '3 rages per long rest',
    effects: [
      {
        kind: 'resource',
        resourceId: 'rage',
        resourceType: 'perLongRest',
        value: 1,
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'barbarian', level: 3 }],
      },
    ],
    edition: 'both',
  },

  // Rage uses - Level 6: 4 uses
  {
    sourceId: 'class:barbarian',
    effectId: 'barbarian-rage-uses-L6',
    name: 'Rage Uses (Level 6)',
    description: '4 rages per long rest',
    effects: [
      {
        kind: 'resource',
        resourceId: 'rage',
        resourceType: 'perLongRest',
        value: 1,
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'barbarian', level: 6 }],
      },
    ],
    edition: 'both',
  },

  // Rage uses - Level 12: 5 uses
  {
    sourceId: 'class:barbarian',
    effectId: 'barbarian-rage-uses-L12',
    name: 'Rage Uses (Level 12)',
    description: '5 rages per long rest',
    effects: [
      {
        kind: 'resource',
        resourceId: 'rage',
        resourceType: 'perLongRest',
        value: 1,
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'barbarian', level: 12 }],
      },
    ],
    edition: 'both',
  },

  // Rage uses - Level 17: 6 uses
  {
    sourceId: 'class:barbarian',
    effectId: 'barbarian-rage-uses-L17',
    name: 'Rage Uses (Level 17)',
    description: '6 rages per long rest',
    effects: [
      {
        kind: 'resource',
        resourceId: 'rage',
        resourceType: 'perLongRest',
        value: 1,
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'barbarian', level: 17 }],
      },
    ],
    edition: 'both',
  },

  // Rage uses - Level 20: Unlimited (represented as 999)
  {
    sourceId: 'class:barbarian',
    effectId: 'barbarian-rage-uses-L20',
    name: 'Rage Uses (Level 20)',
    description: 'Unlimited rages',
    effects: [
      {
        kind: 'resource',
        resourceId: 'rage',
        resourceType: 'perLongRest',
        value: 993, // 2 + 1 + 1 + 1 + 1 + 993 = 999 (effectively unlimited)
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'barbarian', level: 20 }],
      },
    ],
    edition: 'both',
  },

  // Unarmored Defense
  {
    sourceId: 'class:barbarian',
    effectId: 'barbarian-unarmored-defense',
    name: 'Unarmored Defense',
    description: 'While you are not wearing armor, your Armor Class equals 10 + your Dexterity modifier + your Constitution modifier.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'unarmored-defense-barbarian',
        name: 'Unarmored Defense',
        description: 'Your AC = 10 + DEX modifier + CON modifier when not wearing armor.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'barbarian', level: 1 }],
      },
      {
        kind: 'armorClass',
        value: {
          expression: '10 + @abilities.DEX.modifier + @abilities.CON.modifier',
          variables: ['@abilities.DEX.modifier', '@abilities.CON.modifier'],
        },
        priority: 'additive',
        stacking: 'max',
        predicate: [
          { type: 'classIs', slug: 'barbarian' },
          { type: 'levelAtLeast', value: 1 },
          { type: 'not', predicate: [{ type: 'hasTag', tag: 'wearing-armor' }] },
        ],
      },
      {
        kind: 'tag',
        tags: ['unarmored-defense'],
        predicate: [{ type: 'levelAtLeast', value: 1 }],
      },
    ],
    edition: 'both',
  },
];

/**
 * All Barbarian effects
 */
export const barbarianEffects: SourcedEffect[] = [
  ...barbarianProficiencies,
  ...barbarianLevel1Features,
  ...(subclassEffectsByClass.barbarian ?? []),
];
