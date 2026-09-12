/**
 * Monk Class Effects
 * Pure data - no game logic in code
 */

import type { SourcedEffect } from '../../types/effects';
import { subclassEffectsByClass } from './subclassEffects';

/**
 * Monk base class proficiencies (both editions)
 */
export const monkProficiencies: SourcedEffect[] = [
  // Armor proficiencies (none)
  {
    sourceId: 'class:monk',
    effectId: 'monk-no-armor',
    name: 'No Armor Proficiency',
    description: 'Monks do not gain armor or shield proficiencies.',
    effects: [
      {
        kind: 'tag',
        tags: ['no-armor-proficiency'],
      },
    ],
    edition: 'both',
  },

  // Weapon proficiencies
  {
    sourceId: 'class:monk',
    effectId: 'monk-weapon-proficiency',
    name: 'Weapon Proficiency',
    description: 'You are proficient with simple weapons and shortswords.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'weapon',
        values: ['Simple weapons', 'Shortswords'],
        predicate: [{ type: 'classIs', slug: 'monk' }],
      },
    ],
    edition: 'both',
  },

  // Saving throw proficiencies
  {
    sourceId: 'class:monk',
    effectId: 'monk-saving-throws',
    name: 'Saving Throw Proficiency',
    description: 'You are proficient in Strength and Dexterity saving throws.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'savingThrow',
        values: ['STR', 'DEX'],
        predicate: [{ type: 'classIs', slug: 'monk' }],
      },
    ],
    edition: 'both',
  },

  // Skill proficiencies (choice-based, deferred to later phases)
  {
    sourceId: 'class:monk',
    effectId: 'monk-skill-choice',
    name: 'Monk Skills',
    description: 'Choose two from Acrobatics, Athletics, History, Insight, Religion, and Stealth.',
    // Note: This requires choice system
    effects: [
      {
        kind: 'tag',
        tags: ['skill-choice-monk'],
      },
    ],
    edition: 'both',
  },
];

/**
 * Monk level 1 features
 */
export const monkLevel1Features: SourcedEffect[] = [
  // Unarmored Defense
  {
    sourceId: 'class:monk',
    effectId: 'monk-unarmored-defense',
    name: 'Unarmored Defense',
    description:
      'While you are wearing no armor and not wielding a shield, your AC equals 10 + your Dexterity modifier + your Wisdom modifier.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'unarmored-defense-monk',
        name: 'Unarmored Defense',
        description: 'Your AC = 10 + DEX modifier + WIS modifier when not wearing armor or a shield.',
        predicate: [
          { type: 'classIs', slug: 'monk' },
          { type: 'levelAtLeast', value: 1 },
        ],
      },
      {
        kind: 'armorClass',
        value: {
          expression: '10 + @abilities.DEX.modifier + @abilities.WIS.modifier',
          variables: ['@abilities.DEX.modifier', '@abilities.WIS.modifier'],
        },
        priority: 'additive',
        stacking: 'max',
        predicate: [
          { type: 'classIs', slug: 'monk' },
          { type: 'levelAtLeast', value: 1 },
          { type: 'not', predicate: [{ type: 'hasTag', tag: 'wearing-armor' }] },
          { type: 'not', predicate: [{ type: 'hasTag', tag: 'wielding-shield' }] },
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

  // Martial Arts
  {
    sourceId: 'class:monk',
    effectId: 'monk-martial-arts',
    name: 'Martial Arts',
    description:
      'Your practice of martial arts gives you mastery of combat styles that use unarmed strikes and monk weapons.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'martial-arts',
        name: 'Martial Arts',
        description:
          'You can use DEX instead of STR for attack and damage rolls of unarmed strikes and monk weapons. You can roll a d4 in place of the normal damage of your unarmed strike or monk weapon. When you use the Attack action with an unarmed strike or monk weapon on your turn, you can make one unarmed strike as a bonus action.',
        predicate: [
          { type: 'classIs', slug: 'monk' },
          { type: 'levelAtLeast', value: 1 },
        ],
      },
      {
        kind: 'tag',
        tags: ['martial-arts'],
        predicate: [{ type: 'levelAtLeast', value: 1 }],
      },
    ],
    edition: 'both',
  },
];

/**
 * Monk level 2 features (Ki)
 */
export const monkLevel2Features: SourcedEffect[] = [
  // Ki feature
  {
    sourceId: 'class:monk',
    effectId: 'monk-ki',
    name: 'Ki',
    description: 'Your training allows you to harness the mystic energy of ki.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'ki',
        name: 'Ki',
        description:
          'You have a number of ki points equal to your monk level. You can spend these points to fuel various ki features. You regain all expended ki points when you finish a short or long rest.',
        predicate: [
          { type: 'classIs', slug: 'monk' },
          { type: 'levelAtLeast', value: 2 },
        ],
      },
      {
        kind: 'resource',
        resourceId: 'ki-points',
        resourceType: 'perShortRest',
        value: {
          expression: '@level',
          variables: ['@level'],
        },
        predicate: [
          { type: 'classIs', slug: 'monk' },
          { type: 'levelAtLeast', value: 2 },
        ],
      },
      {
        kind: 'tag',
        tags: ['ki'],
        predicate: [{ type: 'levelAtLeast', value: 2 }],
      },
    ],
    edition: 'both',
  },

  // Flurry of Blows
  {
    sourceId: 'class:monk',
    effectId: 'monk-flurry-of-blows',
    name: 'Flurry of Blows',
    description: 'Immediately after you take the Attack action on your turn, you can spend 1 ki point to make two unarmed strikes as a bonus action.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'flurry-of-blows',
        name: 'Flurry of Blows',
        description: 'Spend 1 ki point to make two unarmed strikes as a bonus action after taking the Attack action.',
        predicate: [
          { type: 'classIs', slug: 'monk' },
          { type: 'levelAtLeast', value: 2 },
        ],
      },
      {
        kind: 'tag',
        tags: ['flurry-of-blows'],
        predicate: [{ type: 'levelAtLeast', value: 2 }],
      },
    ],
    edition: 'both',
  },

  // Patient Defense
  {
    sourceId: 'class:monk',
    effectId: 'monk-patient-defense',
    name: 'Patient Defense',
    description: 'You can spend 1 ki point to take the Dodge action as a bonus action on your turn.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'patient-defense',
        name: 'Patient Defense',
        description: 'Spend 1 ki point to take the Dodge action as a bonus action.',
        predicate: [
          { type: 'classIs', slug: 'monk' },
          { type: 'levelAtLeast', value: 2 },
        ],
      },
      {
        kind: 'tag',
        tags: ['patient-defense'],
        predicate: [{ type: 'levelAtLeast', value: 2 }],
      },
    ],
    edition: 'both',
  },

  // Step of the Wind
  {
    sourceId: 'class:monk',
    effectId: 'monk-step-of-wind',
    name: 'Step of the Wind',
    description: 'You can spend 1 ki point to take the Disengage or Dash action as a bonus action on your turn, and your jump distance is doubled for the turn.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'step-of-wind',
        name: 'Step of the Wind',
        description: 'Spend 1 ki point to Disengage or Dash as a bonus action, and double jump distance.',
        predicate: [
          { type: 'classIs', slug: 'monk' },
          { type: 'levelAtLeast', value: 2 },
        ],
      },
      {
        kind: 'tag',
        tags: ['step-of-wind'],
        predicate: [{ type: 'levelAtLeast', value: 2 }],
      },
    ],
    edition: 'both',
  },
];

/**
 * All Monk effects
 */
export const monkEffects: SourcedEffect[] = [
  ...monkProficiencies,
  ...monkLevel1Features,
  ...monkLevel2Features,
  ...(subclassEffectsByClass.monk ?? []),
];
