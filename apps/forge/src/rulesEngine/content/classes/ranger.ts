/**
 * Ranger Class Effects
 * Pure data - no game logic in code
 *
 * Ranger is a half-caster with nature magic, tracking, and combat skills
 * Key features: Favored Enemy, Natural Explorer, Fighting Style, Spellcasting
 */

import type { SourcedEffect } from '../../types/effects';
import { subclassEffectsByClass } from './subclassEffects';

/**
 * Ranger Proficiencies
 * Armor: Light armor, medium armor, shields
 * Weapons: Simple weapons, martial weapons
 * Saves: STR, DEX
 * Skills: Choose 3 from Animal Handling, Athletics, Insight, Investigation, Nature, Perception, Stealth, Survival
 */
export const rangerProficiencies: SourcedEffect[] = [
  // Armor proficiencies
  {
    sourceId: 'class:ranger',
    effectId: 'ranger-armor-proficiency',
    name: 'Armor Proficiency',
    description: 'You are proficient with light armor, medium armor, and shields.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'armor',
        values: ['Light armor', 'Medium armor', 'Shields'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 1 }],
      },
    ],
    edition: 'both',
  },

  // Weapon proficiencies
  {
    sourceId: 'class:ranger',
    effectId: 'ranger-weapon-proficiency',
    name: 'Weapon Proficiency',
    description: 'You are proficient with simple weapons and martial weapons.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'weapon',
        values: ['Simple weapons', 'Martial weapons'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 1 }],
      },
    ],
    edition: 'both',
  },

  // Saving throw proficiencies
  {
    sourceId: 'class:ranger',
    effectId: 'ranger-saving-throws',
    name: 'Saving Throw Proficiency',
    description: 'You are proficient in Strength and Dexterity saving throws.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'savingThrow',
        values: ['STR', 'DEX'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 1 }],
      },
    ],
    edition: 'both',
  },

  // Skill proficiencies (choice-based)
  {
    sourceId: 'class:ranger',
    effectId: 'ranger-skill-choice',
    name: 'Ranger Skills',
    description: 'Choose three from Animal Handling, Athletics, Insight, Investigation, Nature, Perception, Stealth, and Survival.',
    effects: [
      {
        kind: 'tag',
        tags: ['skill-choice-ranger'],
      },
    ],
    edition: 'both',
  },
];

/**
 * Ranger Level 1 Features
 */
export const rangerLevel1Features: SourcedEffect[] = [
  // Favored Enemy
  {
    sourceId: 'class:ranger',
    effectId: 'ranger-favored-enemy',
    name: 'Favored Enemy',
    description: 'You have significant experience studying, tracking, hunting, and even talking to a certain type of enemy.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'favored-enemy',
        name: 'Favored Enemy',
        description: 'Advantage on tracking and recalling info about favored enemy.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 1 }],
      },
      {
        kind: 'tag',
        tags: ['favored-enemy', 'tracking-bonus'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 1 }],
      },
    ],
    edition: '2014',
  },

  // Natural Explorer
  {
    sourceId: 'class:ranger',
    effectId: 'ranger-natural-explorer',
    name: 'Natural Explorer',
    description: 'You are particularly familiar with one type of natural environment and are adept at traveling and surviving in such regions.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'natural-explorer',
        name: 'Natural Explorer',
        description: 'Benefits when traveling in favored terrain.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 1 }],
      },
      {
        kind: 'tag',
        tags: ['natural-explorer', 'terrain-mastery'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 1 }],
      },
    ],
    edition: '2014',
  },

  // Deft Explorer (2024 replacement for Natural Explorer)
  {
    sourceId: 'class:ranger',
    effectId: 'ranger-deft-explorer',
    name: 'Deft Explorer',
    description: 'You are an unsurpassed explorer and survivor.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'deft-explorer',
        name: 'Deft Explorer',
        description: 'Gain expertise in one skill.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 1 }],
      },
      {
        kind: 'tag',
        tags: ['deft-explorer', 'expertise'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 1 }],
      },
    ],
    edition: '2024',
  },

  // Favored Foe (2024 replacement for Favored Enemy)
  {
    sourceId: 'class:ranger',
    effectId: 'ranger-favored-foe',
    name: 'Favored Foe',
    description: 'When you hit a creature with an attack roll, you can mark that creature as your favored foe for 1 minute.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'favored-foe',
        name: 'Favored Foe',
        description: 'Mark creature for extra 1d4 damage.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 1 }],
      },
      {
        kind: 'resource',
        resourceId: 'favored-foe',
        resourceType: 'perLongRest',
        value: {
          expression: '@proficiencyBonus',
          variables: ['@proficiencyBonus'],
        },
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 1 }],
      },
      {
        kind: 'tag',
        tags: ['favored-foe', 'bonus-damage'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 1 }],
      },
    ],
    edition: '2024',
  },
];

/**
 * Ranger Level 2 Features
 */
export const rangerLevel2Features: SourcedEffect[] = [
  // Fighting Style
  {
    sourceId: 'class:ranger',
    effectId: 'ranger-fighting-style',
    name: 'Fighting Style',
    description: 'You adopt a particular style of fighting as your specialty.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'fighting-style',
        name: 'Fighting Style',
        description: 'Choose a fighting style.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 2 }],
      },
      {
        kind: 'tag',
        tags: ['fighting-style-choice'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 2 }],
      },
    ],
    edition: 'both',
  },

  // Spellcasting (half-caster, starts at level 2)
  {
    sourceId: 'class:ranger',
    effectId: 'ranger-spellcasting',
    name: 'Spellcasting',
    description: 'You have learned to use the magical essence of nature to cast spells.',
    effects: [
      {
        kind: 'spellcastingAbility',
        ability: 'WIS',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 2 }],
      },
      {
        kind: 'grantFeature',
        featureId: 'spellcasting',
        name: 'Spellcasting',
        description: 'Wisdom is your spellcasting ability.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 2 }],
      },
      {
        kind: 'tag',
        tags: ['spellcasting', 'known-caster', 'half-caster'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 2 }],
      },
    ],
    edition: 'both',
  },
];

/**
 * Ranger Level 3 Features
 */
export const rangerLevel3Features: SourcedEffect[] = [
  // Ranger Archetype (subclass choice at level 3)
  {
    sourceId: 'class:ranger',
    effectId: 'ranger-archetype',
    name: 'Ranger Archetype',
    description: 'You choose an archetype that you strive to emulate.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'ranger-archetype',
        name: 'Ranger Archetype',
        description: 'Choose your Ranger Archetype subclass.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 3 }],
      },
      {
        kind: 'tag',
        tags: ['ranger-archetype', 'subclass-choice'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 3 }],
      },
    ],
    edition: 'both',
  },

  // Primeval Awareness (2014)
  {
    sourceId: 'class:ranger',
    effectId: 'ranger-primeval-awareness',
    name: 'Primeval Awareness',
    description: 'You can use your action and expend one ranger spell slot to focus your awareness on the region around you.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'primeval-awareness',
        name: 'Primeval Awareness',
        description: 'Sense creatures within 1 mile (6 miles in favored terrain).',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 3 }],
      },
      {
        kind: 'tag',
        tags: ['primeval-awareness', 'detection'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 3 }],
      },
    ],
    edition: '2014',
  },

  // Primal Awareness (2024 replacement for Primeval Awareness)
  {
    sourceId: 'class:ranger',
    effectId: 'ranger-primal-awareness',
    name: 'Primal Awareness',
    description: 'You can cast certain spells without expending a spell slot.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'primal-awareness',
        name: 'Primal Awareness',
        description: 'Cast certain spells without spell slots.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 3 }],
      },
      {
        kind: 'tag',
        tags: ['primal-awareness', 'free-spells'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 3 }],
      },
    ],
    edition: '2024',
  },
];

/**
 * Ranger Level 5 Features
 */
export const rangerLevel5Features: SourcedEffect[] = [
  // Extra Attack
  {
    sourceId: 'class:ranger',
    effectId: 'ranger-extra-attack',
    name: 'Extra Attack',
    description: 'You can attack twice, instead of once, whenever you take the Attack action on your turn.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'extra-attack',
        name: 'Extra Attack',
        description: 'Attack twice when you take the Attack action.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 5 }],
      },
      {
        kind: 'tag',
        tags: ['extra-attack'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 5 }],
      },
    ],
    edition: 'both',
  },
];

/**
 * Ranger Level 8 Features
 */
export const rangerLevel8Features: SourcedEffect[] = [
  // Land's Stride
  {
    sourceId: 'class:ranger',
    effectId: 'ranger-lands-stride',
    name: 'Land\'s Stride',
    description: 'Moving through nonmagical difficult terrain costs you no extra movement.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'lands-stride',
        name: 'Land\'s Stride',
        description: 'Ignore nonmagical difficult terrain.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 8 }],
      },
      {
        kind: 'tag',
        tags: ['lands-stride', 'movement-enhancement'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 8 }],
      },
    ],
    edition: 'both',
  },
];

/**
 * Ranger Level 10 Features
 */
export const rangerLevel10Features: SourcedEffect[] = [
  // Hide in Plain Sight (2014)
  {
    sourceId: 'class:ranger',
    effectId: 'ranger-hide-in-plain-sight',
    name: 'Hide in Plain Sight',
    description: 'You can spend 1 minute creating camouflage for yourself.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'hide-in-plain-sight',
        name: 'Hide in Plain Sight',
        description: '+10 to Stealth when remaining still.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 10 }],
      },
      {
        kind: 'tag',
        tags: ['hide-in-plain-sight', 'stealth-bonus'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 10 }],
      },
    ],
    edition: '2014',
  },

  // Nature's Veil (2024 replacement for Hide in Plain Sight)
  {
    sourceId: 'class:ranger',
    effectId: 'ranger-natures-veil',
    name: 'Nature\'s Veil',
    description: 'You can use a bonus action to become invisible.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'natures-veil',
        name: 'Nature\'s Veil',
        description: 'Become invisible until the end of your next turn.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 10 }],
      },
      {
        kind: 'resource',
        resourceId: 'natures-veil',
        resourceType: 'perLongRest',
        value: {
          expression: '@proficiencyBonus',
          variables: ['@proficiencyBonus'],
        },
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 10 }],
      },
      {
        kind: 'tag',
        tags: ['natures-veil', 'invisibility'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 10 }],
      },
    ],
    edition: '2024',
  },
];

/**
 * Ranger Level 14 Features
 */
export const rangerLevel14Features: SourcedEffect[] = [
  // Vanish
  {
    sourceId: 'class:ranger',
    effectId: 'ranger-vanish',
    name: 'Vanish',
    description: 'You can use the Hide action as a bonus action on your turn. Also, you can\'t be tracked by nonmagical means.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'vanish',
        name: 'Vanish',
        description: 'Hide as bonus action, can\'t be tracked nonmagically.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 14 }],
      },
      {
        kind: 'tag',
        tags: ['vanish', 'bonus-action-hide', 'tracking-immunity'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 14 }],
      },
    ],
    edition: 'both',
  },
];

/**
 * Ranger Level 18 Features
 */
export const rangerLevel18Features: SourcedEffect[] = [
  // Feral Senses
  {
    sourceId: 'class:ranger',
    effectId: 'ranger-feral-senses',
    name: 'Feral Senses',
    description: 'You gain preternatural senses that help you fight creatures you can\'t see.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'feral-senses',
        name: 'Feral Senses',
        description: 'Attack invisible creatures without disadvantage.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 18 }],
      },
      {
        kind: 'tag',
        tags: ['feral-senses', 'blindsight-like'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 18 }],
      },
    ],
    edition: 'both',
  },
];

/**
 * Ranger Level 20 Features
 */
export const rangerLevel20Features: SourcedEffect[] = [
  // Foe Slayer
  {
    sourceId: 'class:ranger',
    effectId: 'ranger-foe-slayer',
    name: 'Foe Slayer',
    description: 'You become an unparalleled hunter of your enemies.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'foe-slayer',
        name: 'Foe Slayer',
        description: 'Add WIS modifier to attack or damage roll once per turn.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 20 }],
      },
      {
        kind: 'tag',
        tags: ['foe-slayer', 'attack-bonus', 'damage-bonus'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'ranger', level: 20 }],
      },
    ],
    edition: 'both',
  },
];

/**
 * All Ranger effects
 */
export const rangerEffects: SourcedEffect[] = [
  ...rangerProficiencies,
  ...rangerLevel1Features,
  ...rangerLevel2Features,
  ...rangerLevel3Features,
  ...rangerLevel5Features,
  ...rangerLevel8Features,
  ...rangerLevel10Features,
  ...rangerLevel14Features,
  ...rangerLevel18Features,
  ...rangerLevel20Features,
  // Note: Spell slots handled by half-caster spell slot progression (not yet implemented)
  ...(subclassEffectsByClass.ranger ?? []),
];
