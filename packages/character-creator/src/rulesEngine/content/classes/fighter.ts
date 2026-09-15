/**
 * Fighter Class Effects
 * Pure data - no game logic in code
 */

import type { SourcedEffect } from '../../types/effects';
import { subclassEffectsByClass } from './subclassEffects';

/**
 * Fighter base class proficiencies (both editions)
 */
export const fighterProficiencies: SourcedEffect[] = [
  // Armor proficiencies
  {
    sourceId: 'class:fighter',
    effectId: 'fighter-armor-proficiency',
    name: 'Armor Proficiency',
    description: 'You are proficient with light armor, medium armor, heavy armor, and shields.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'armor',
        values: ['Light armor', 'Medium armor', 'Heavy armor', 'Shields'],
        predicate: [{ type: 'classIs', slug: 'fighter' }],
      },
    ],
    edition: 'both',
  },

  // Weapon proficiencies
  {
    sourceId: 'class:fighter',
    effectId: 'fighter-weapon-proficiency',
    name: 'Weapon Proficiency',
    description: 'You are proficient with simple weapons and martial weapons.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'weapon',
        values: ['Simple weapons', 'Martial weapons'],
        predicate: [{ type: 'classIs', slug: 'fighter' }],
      },
    ],
    edition: 'both',
  },

  // Saving throw proficiencies
  {
    sourceId: 'class:fighter',
    effectId: 'fighter-saving-throws',
    name: 'Saving Throw Proficiency',
    description: 'You are proficient in Strength and Constitution saving throws.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'savingThrow',
        values: ['STR', 'CON'],
        predicate: [{ type: 'classIs', slug: 'fighter' }],
      },
    ],
    edition: 'both',
  },

  // Skill proficiencies (choice-based, deferred to later phases)
  {
    sourceId: 'class:fighter',
    effectId: 'fighter-skill-choice',
    name: 'Fighter Skills',
    description:
      'Choose two from Acrobatics, Animal Handling, Athletics, History, Insight, Intimidation, Perception, Persuasion, and Survival.',
    // Note: This requires choice system
    effects: [
      {
        kind: 'tag',
        tags: ['skill-choice-fighter'],
      },
    ],
    edition: 'both',
  },
];

/**
 * Fighter level 1 features
 */
export const fighterLevel1Features: SourcedEffect[] = [
  // Fighting Style (full choice implementation)
  {
    sourceId: 'class:fighter',
    effectId: 'fighter-fighting-style',
    name: 'Fighting Style',
    description: 'You adopt a particular style of fighting as your specialty.',
    choice: {
      id: 'fighting-style',
      prompt: 'Choose your Fighting Style',
      type: 'select',
      min: 1,
      max: 1,
      predicate: [
        { type: 'classIs', slug: 'fighter' },
        { type: 'levelAtLeast', value: 1 },
      ],
      options: [
        {
          value: 'archery',
          label: 'Archery',
          description: '+2 bonus to attack rolls with ranged weapons',
          effects: [
            {
              kind: 'grantFeature',
              featureId: 'fighting-style-archery',
              name: 'Fighting Style: Archery',
              description: 'You gain a +2 bonus to attack rolls you make with ranged weapons.',
            },
            {
              kind: 'tag',
              tags: ['fighting-style:archery'],
            },
          ],
        },
        {
          value: 'defense',
          label: 'Defense',
          description: '+1 bonus to AC while wearing armor',
          effects: [
            {
              kind: 'grantFeature',
              featureId: 'fighting-style-defense',
              name: 'Fighting Style: Defense',
              description: 'While you are wearing armor, you gain a +1 bonus to AC.',
            },
            {
              kind: 'armorClass',
              value: 1,
              priority: 'flag',
              stacking: 'stack',
              predicate: [{ type: 'hasTag', tag: 'wearing-armor' }],
            },
            {
              kind: 'tag',
              tags: ['fighting-style:defense'],
            },
          ],
        },
        {
          value: 'dueling',
          label: 'Dueling',
          description: '+2 damage with one-handed melee weapons',
          effects: [
            {
              kind: 'grantFeature',
              featureId: 'fighting-style-dueling',
              name: 'Fighting Style: Dueling',
              description:
                'When you are wielding a melee weapon in one hand and no other weapons, you gain a +2 bonus to damage rolls with that weapon.',
            },
            {
              kind: 'tag',
              tags: ['fighting-style:dueling'],
            },
          ],
        },
        {
          value: 'great-weapon-fighting',
          label: 'Great Weapon Fighting',
          description: 'Reroll 1s and 2s on damage dice with two-handed melee weapons',
          effects: [
            {
              kind: 'grantFeature',
              featureId: 'fighting-style-gwf',
              name: 'Fighting Style: Great Weapon Fighting',
              description:
                'When you roll a 1 or 2 on a damage die for an attack you make with a melee weapon that you are wielding with two hands, you can reroll the die.',
            },
            {
              kind: 'tag',
              tags: ['fighting-style:great-weapon-fighting'],
            },
          ],
        },
        {
          value: 'protection',
          label: 'Protection',
          description: 'Impose disadvantage on attacks against allies near you',
          effects: [
            {
              kind: 'grantFeature',
              featureId: 'fighting-style-protection',
              name: 'Fighting Style: Protection',
              description:
                'When a creature you can see attacks a target other than you that is within 5 feet of you, you can use your reaction to impose disadvantage on the attack roll.',
            },
            {
              kind: 'tag',
              tags: ['fighting-style:protection'],
            },
          ],
        },
        {
          value: 'two-weapon-fighting',
          label: 'Two-Weapon Fighting',
          description: 'Add ability modifier to damage of off-hand attack',
          effects: [
            {
              kind: 'grantFeature',
              featureId: 'fighting-style-twf',
              name: 'Fighting Style: Two-Weapon Fighting',
              description: 'When you engage in two-weapon fighting, you can add your ability modifier to the damage of the second attack.',
            },
            {
              kind: 'tag',
              tags: ['fighting-style:two-weapon-fighting'],
            },
          ],
        },
      ],
    },
    effects: [],
    edition: 'both',
  },

  // Second Wind
  {
    sourceId: 'class:fighter',
    effectId: 'fighter-second-wind',
    name: 'Second Wind',
    description: 'You have a limited well of stamina that you can draw on to protect yourself from harm.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'second-wind',
        name: 'Second Wind',
        description:
          'On your turn, you can use a bonus action to regain hit points equal to 1d10 + your fighter level. Once you use this feature, you must finish a short or long rest before you can use it again.',
        predicate: [
          { type: 'classIs', slug: 'fighter' },
          { type: 'levelAtLeast', value: 1 },
        ],
      },
      {
        kind: 'resource',
        resourceId: 'second-wind',
        resourceType: 'perShortRest',
        value: 1,
        predicate: [{ type: 'levelAtLeast', value: 1 }],
      },
      {
        kind: 'tag',
        tags: ['second-wind'],
        predicate: [{ type: 'levelAtLeast', value: 1 }],
      },
    ],
    edition: 'both',
  },
];

/**
 * Fighter Level 5+ Features
 */
export const fighterLevel5Features: SourcedEffect[] = [
  // Extra Attack
  {
    sourceId: 'class:fighter',
    effectId: 'extra-attack',
    name: 'Extra Attack',
    description: 'You can attack twice, instead of once, whenever you take the Attack action on your turn.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'extra-attack',
        name: 'Extra Attack',
        description: 'You can attack twice when you take the Attack action.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'fighter', level: 5 }],
      },
      {
        kind: 'tag',
        tags: ['extra-attack'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'fighter', level: 5 }],
      },
    ],
    edition: 'both',
  },
];

/**
 * All Fighter effects
 */
export const fighterEffects: SourcedEffect[] = [
  ...fighterProficiencies,
  ...fighterLevel1Features,
  ...fighterLevel5Features,
  ...(subclassEffectsByClass.fighter ?? []),
];
