/**
 * Bard Class Effects
 * Pure data - no game logic in code
 *
 * Bard is a full caster with support, skill expertise, and bardic inspiration
 * Key features: Bardic Inspiration, Jack of All Trades, Expertise, Song of Rest
 */

import type { SourcedEffect } from '../../types/effects';
import { subclassEffectsByClass } from './subclassEffects';
import { createFullCasterSpellSlots } from '../spellSlots';

/**
 * Bard Proficiencies
 * Armor: Light armor
 * Weapons: Simple weapons, hand crossbows, longswords, rapiers, shortswords
 * Tools: Three musical instruments
 * Saves: DEX, CHA
 * Skills: Choose 3 from any skill
 */
export const bardProficiencies: SourcedEffect[] = [
  // Armor proficiencies
  {
    sourceId: 'class:bard',
    effectId: 'bard-armor-proficiency',
    name: 'Armor Proficiency',
    description: 'You are proficient with light armor.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'armor',
        values: ['Light armor'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'bard', level: 1 }],
      },
    ],
    edition: 'both',
  },

  // Weapon proficiencies
  {
    sourceId: 'class:bard',
    effectId: 'bard-weapon-proficiency',
    name: 'Weapon Proficiency',
    description: 'You are proficient with simple weapons, hand crossbows, longswords, rapiers, and shortswords.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'weapon',
        values: ['Simple weapons', 'Hand crossbows', 'Longswords', 'Rapiers', 'Shortswords'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'bard', level: 1 }],
      },
    ],
    edition: 'both',
  },

  // Saving throw proficiencies
  {
    sourceId: 'class:bard',
    effectId: 'bard-saving-throws',
    name: 'Saving Throw Proficiency',
    description: 'You are proficient in Dexterity and Charisma saving throws.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'savingThrow',
        values: ['DEX', 'CHA'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'bard', level: 1 }],
      },
    ],
    edition: 'both',
  },

  // Tool proficiencies
  {
    sourceId: 'class:bard',
    effectId: 'bard-tool-proficiency',
    name: 'Tool Proficiency',
    description: 'You are proficient with three musical instruments of your choice.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'bard-instruments',
        name: 'Musical Instruments',
        description: 'Proficiency with three musical instruments.',
      },
      {
        kind: 'tag',
        tags: ['musical-instrument-proficiency'],
      },
    ],
    edition: 'both',
  },

  // Skill proficiencies (choice-based - any 3 skills)
  {
    sourceId: 'class:bard',
    effectId: 'bard-skill-choice',
    name: 'Bard Skills',
    description: 'Choose any three skills.',
    effects: [
      {
        kind: 'tag',
        tags: ['skill-choice-bard', 'any-skill-choice'],
      },
    ],
    edition: 'both',
  },
];

/**
 * Bard Level 1 Features
 */
export const bardLevel1Features: SourcedEffect[] = [
  // Spellcasting
  {
    sourceId: 'class:bard',
    effectId: 'bard-spellcasting',
    name: 'Spellcasting',
    description: 'You have learned to untangle and reshape the fabric of reality in harmony with your wishes and music.',
    effects: [
      {
        kind: 'spellcastingAbility',
        ability: 'CHA',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'bard', level: 1 }],
      },
      {
        kind: 'grantFeature',
        featureId: 'spellcasting',
        name: 'Spellcasting',
        description: 'Charisma is your spellcasting ability.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'bard', level: 1 }],
      },
      {
        kind: 'tag',
        tags: ['spellcasting', 'known-caster', 'full-caster'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'bard', level: 1 }],
      },
    ],
    edition: 'both',
  },

  // Bardic Inspiration (d6 at level 1)
  {
    sourceId: 'class:bard',
    effectId: 'bardic-inspiration',
    name: 'Bardic Inspiration',
    description: 'You can inspire others through stirring words or music.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'bardic-inspiration',
        name: 'Bardic Inspiration',
        description: 'Grant d6 bonus to ally\'s roll (d8 at 5th, d10 at 10th, d12 at 15th).',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'bard', level: 1 }],
      },
      {
        kind: 'resource',
        resourceId: 'bardic-inspiration',
        resourceType: 'perShortRest',
        value: {
          expression: '@abilities.CHA.modifier',
          variables: ['@abilities.CHA.modifier'],
        },
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'bard', level: 1 }],
      },
      {
        kind: 'tag',
        tags: ['bardic-inspiration', 'support'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'bard', level: 1 }],
      },
    ],
    edition: 'both',
  },
];

/**
 * Bard Level 2 Features
 */
export const bardLevel2Features: SourcedEffect[] = [
  // Jack of All Trades
  {
    sourceId: 'class:bard',
    effectId: 'jack-of-all-trades',
    name: 'Jack of All Trades',
    description: 'You can add half your proficiency bonus, rounded down, to any ability check you make that doesn\'t already include your proficiency bonus.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'jack-of-all-trades',
        name: 'Jack of All Trades',
        description: 'Add half proficiency to unproficient checks.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'bard', level: 2 }],
      },
      {
        kind: 'tag',
        tags: ['jack-of-all-trades', 'skill-bonus'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'bard', level: 2 }],
      },
    ],
    edition: 'both',
  },

  // Song of Rest
  {
    sourceId: 'class:bard',
    effectId: 'song-of-rest',
    name: 'Song of Rest',
    description: 'You can use soothing music or oration to help revitalize your wounded allies during a short rest.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'song-of-rest',
        name: 'Song of Rest',
        description: 'Allies heal extra d6 during short rest (d8 at 9th, d10 at 13th, d12 at 17th).',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'bard', level: 2 }],
      },
      {
        kind: 'tag',
        tags: ['song-of-rest', 'healing', 'short-rest'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'bard', level: 2 }],
      },
    ],
    edition: 'both',
  },
];

/**
 * Bard Level 3 Features
 */
export const bardLevel3Features: SourcedEffect[] = [
  // Bard College (subclass choice at level 3)
  {
    sourceId: 'class:bard',
    effectId: 'bard-college',
    name: 'Bard College',
    description: 'You delve into the advanced techniques of a bard college of your choice.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'bard-college',
        name: 'Bard College',
        description: 'Choose your Bard College subclass.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'bard', level: 3 }],
      },
      {
        kind: 'tag',
        tags: ['bard-college', 'subclass-choice'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'bard', level: 3 }],
      },
    ],
    edition: 'both',
  },

  // Expertise (2 skills)
  {
    sourceId: 'class:bard',
    effectId: 'expertise-level-3',
    name: 'Expertise',
    description: 'Choose two of your skill proficiencies. Your proficiency bonus is doubled for any ability check you make that uses either of the chosen proficiencies.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'expertise-1',
        name: 'Expertise',
        description: 'Double proficiency on two skills.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'bard', level: 3 }],
      },
      {
        kind: 'tag',
        tags: ['expertise', 'skill-choice-expertise'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'bard', level: 3 }],
      },
    ],
    edition: 'both',
  },
];

/**
 * Bard Level 5 Features
 */
export const bardLevel5Features: SourcedEffect[] = [
  // Bardic Inspiration scales to d8
  {
    sourceId: 'class:bard',
    effectId: 'bardic-inspiration-d8',
    name: 'Bardic Inspiration (d8)',
    description: 'Your Bardic Inspiration die becomes a d8.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'bardic-inspiration-d8',
        name: 'Bardic Inspiration (d8)',
        description: 'Bardic Inspiration die is now d8.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'bard', level: 5 }],
      },
      {
        kind: 'tag',
        tags: ['bardic-inspiration-upgrade'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'bard', level: 5 }],
      },
    ],
    edition: 'both',
  },

  // Font of Inspiration
  {
    sourceId: 'class:bard',
    effectId: 'font-of-inspiration',
    name: 'Font of Inspiration',
    description: 'You regain all of your expended uses of Bardic Inspiration when you finish a short or long rest.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'font-of-inspiration',
        name: 'Font of Inspiration',
        description: 'Bardic Inspiration recharges on short rest.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'bard', level: 5 }],
      },
      {
        kind: 'tag',
        tags: ['font-of-inspiration'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'bard', level: 5 }],
      },
    ],
    edition: 'both',
  },
];

/**
 * Bard Level 6 Features
 */
export const bardLevel6Features: SourcedEffect[] = [
  // Countercharm
  {
    sourceId: 'class:bard',
    effectId: 'countercharm',
    name: 'Countercharm',
    description: 'You gain the ability to use musical notes or words of power to disrupt mind-influencing effects.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'countercharm',
        name: 'Countercharm',
        description: 'Grant advantage on saves vs. frightened/charmed.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'bard', level: 6 }],
      },
      {
        kind: 'tag',
        tags: ['countercharm', 'support'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'bard', level: 6 }],
      },
    ],
    edition: 'both',
  },
];

/**
 * Bard Level 10 Features
 */
export const bardLevel10Features: SourcedEffect[] = [
  // Bardic Inspiration scales to d10
  {
    sourceId: 'class:bard',
    effectId: 'bardic-inspiration-d10',
    name: 'Bardic Inspiration (d10)',
    description: 'Your Bardic Inspiration die becomes a d10.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'bardic-inspiration-d10',
        name: 'Bardic Inspiration (d10)',
        description: 'Bardic Inspiration die is now d10.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'bard', level: 10 }],
      },
      {
        kind: 'tag',
        tags: ['bardic-inspiration-upgrade'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'bard', level: 10 }],
      },
    ],
    edition: 'both',
  },

  // Magical Secrets
  {
    sourceId: 'class:bard',
    effectId: 'magical-secrets-10',
    name: 'Magical Secrets',
    description: 'You have plundered magical knowledge from a wide spectrum of disciplines.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'magical-secrets-1',
        name: 'Magical Secrets',
        description: 'Learn two spells from any class.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'bard', level: 10 }],
      },
      {
        kind: 'tag',
        tags: ['magical-secrets', 'spell-choice'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'bard', level: 10 }],
      },
    ],
    edition: 'both',
  },

  // Expertise (2 more skills)
  {
    sourceId: 'class:bard',
    effectId: 'expertise-level-10',
    name: 'Expertise',
    description: 'Choose two more of your skill proficiencies to gain expertise in.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'expertise-2',
        name: 'Expertise (Additional)',
        description: 'Double proficiency on two more skills.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'bard', level: 10 }],
      },
      {
        kind: 'tag',
        tags: ['expertise', 'skill-choice-expertise'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'bard', level: 10 }],
      },
    ],
    edition: 'both',
  },
];

/**
 * Bard Level 14 Features
 */
export const bardLevel14Features: SourcedEffect[] = [
  // Magical Secrets (additional)
  {
    sourceId: 'class:bard',
    effectId: 'magical-secrets-14',
    name: 'Magical Secrets',
    description: 'You have plundered more magical knowledge.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'magical-secrets-2',
        name: 'Magical Secrets (Additional)',
        description: 'Learn two more spells from any class.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'bard', level: 14 }],
      },
      {
        kind: 'tag',
        tags: ['magical-secrets', 'spell-choice'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'bard', level: 14 }],
      },
    ],
    edition: 'both',
  },
];

/**
 * Bard Level 15 Features
 */
export const bardLevel15Features: SourcedEffect[] = [
  // Bardic Inspiration scales to d12
  {
    sourceId: 'class:bard',
    effectId: 'bardic-inspiration-d12',
    name: 'Bardic Inspiration (d12)',
    description: 'Your Bardic Inspiration die becomes a d12.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'bardic-inspiration-d12',
        name: 'Bardic Inspiration (d12)',
        description: 'Bardic Inspiration die is now d12.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'bard', level: 15 }],
      },
      {
        kind: 'tag',
        tags: ['bardic-inspiration-upgrade'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'bard', level: 15 }],
      },
    ],
    edition: 'both',
  },
];

/**
 * Bard Level 18 Features
 */
export const bardLevel18Features: SourcedEffect[] = [
  // Magical Secrets (additional)
  {
    sourceId: 'class:bard',
    effectId: 'magical-secrets-18',
    name: 'Magical Secrets',
    description: 'You have plundered even more magical knowledge.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'magical-secrets-3',
        name: 'Magical Secrets (Additional)',
        description: 'Learn two more spells from any class.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'bard', level: 18 }],
      },
      {
        kind: 'tag',
        tags: ['magical-secrets', 'spell-choice'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'bard', level: 18 }],
      },
    ],
    edition: 'both',
  },
];

/**
 * Bard Level 20 Features
 */
export const bardLevel20Features: SourcedEffect[] = [
  // Superior Inspiration
  {
    sourceId: 'class:bard',
    effectId: 'superior-inspiration',
    name: 'Superior Inspiration',
    description: 'When you roll initiative and have no uses of Bardic Inspiration left, you regain one use.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'superior-inspiration',
        name: 'Superior Inspiration',
        description: 'Regain 1 use when rolling initiative if you have none.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'bard', level: 20 }],
      },
      {
        kind: 'tag',
        tags: ['superior-inspiration'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'bard', level: 20 }],
      },
    ],
    edition: 'both',
  },
];

/**
 * All Bard effects
 */
export const bardEffects: SourcedEffect[] = [
  ...bardProficiencies,
  ...bardLevel1Features,
  ...bardLevel2Features,
  ...bardLevel3Features,
  ...bardLevel5Features,
  ...bardLevel6Features,
  ...bardLevel10Features,
  ...bardLevel14Features,
  ...bardLevel15Features,
  ...bardLevel18Features,
  ...bardLevel20Features,
  ...createFullCasterSpellSlots('bard'),
  ...(subclassEffectsByClass.bard ?? []),
];
