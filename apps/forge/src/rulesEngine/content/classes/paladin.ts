/**
 * Paladin Class Effects
 * Pure data - no game logic in code
 *
 * Paladin is a half-caster with divine magic, martial prowess, and auras
 * Key features: Divine Smite, Lay on Hands, Fighting Style, Auras
 */

import type { SourcedEffect } from '../../types/effects';
import { subclassEffectsByClass } from './subclassEffects';

/**
 * Paladin Proficiencies
 * Armor: All armor, shields
 * Weapons: Simple weapons, martial weapons
 * Saves: WIS, CHA
 * Skills: Choose 2 from Athletics, Insight, Intimidation, Medicine, Persuasion, Religion
 */
export const paladinProficiencies: SourcedEffect[] = [
  // Armor proficiencies
  {
    sourceId: 'class:paladin',
    effectId: 'paladin-armor-proficiency',
    name: 'Armor Proficiency',
    description: 'You are proficient with all armor and shields.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'armor',
        values: ['Light armor', 'Medium armor', 'Heavy armor', 'Shields'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'paladin', level: 1 }],
      },
    ],
    edition: 'both',
  },

  // Weapon proficiencies
  {
    sourceId: 'class:paladin',
    effectId: 'paladin-weapon-proficiency',
    name: 'Weapon Proficiency',
    description: 'You are proficient with simple weapons and martial weapons.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'weapon',
        values: ['Simple weapons', 'Martial weapons'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'paladin', level: 1 }],
      },
    ],
    edition: 'both',
  },

  // Saving throw proficiencies
  {
    sourceId: 'class:paladin',
    effectId: 'paladin-saving-throws',
    name: 'Saving Throw Proficiency',
    description: 'You are proficient in Wisdom and Charisma saving throws.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'savingThrow',
        values: ['WIS', 'CHA'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'paladin', level: 1 }],
      },
    ],
    edition: 'both',
  },

  // Skill proficiencies (choice-based)
  {
    sourceId: 'class:paladin',
    effectId: 'paladin-skill-choice',
    name: 'Paladin Skills',
    description: 'Choose two from Athletics, Insight, Intimidation, Medicine, Persuasion, and Religion.',
    effects: [
      {
        kind: 'tag',
        tags: ['skill-choice-paladin'],
      },
    ],
    edition: 'both',
  },
];

/**
 * Paladin Level 1 Features
 */
export const paladinLevel1Features: SourcedEffect[] = [
  // Divine Sense
  {
    sourceId: 'class:paladin',
    effectId: 'paladin-divine-sense',
    name: 'Divine Sense',
    description: 'The presence of strong evil registers on your senses like a noxious odor, and powerful good rings like heavenly music in your ears.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'divine-sense',
        name: 'Divine Sense',
        description: 'Detect celestials, fiends, and undead within 60 feet.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'paladin', level: 1 }],
      },
      {
        kind: 'resource',
        resourceId: 'divine-sense',
        resourceType: 'perLongRest',
        value: {
          expression: '1 + @abilities.CHA.modifier',
          variables: ['@abilities.CHA.modifier'],
        },
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'paladin', level: 1 }],
      },
      {
        kind: 'tag',
        tags: ['divine-sense'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'paladin', level: 1 }],
      },
    ],
    edition: 'both',
  },

  // Lay on Hands
  {
    sourceId: 'class:paladin',
    effectId: 'paladin-lay-on-hands',
    name: 'Lay on Hands',
    description: 'Your blessed touch can heal wounds. You have a pool of healing power that replenishes when you take a long rest.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'lay-on-hands',
        name: 'Lay on Hands',
        description: 'Heal HP or cure disease/poison.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'paladin', level: 1 }],
      },
      {
        kind: 'resource',
        resourceId: 'lay-on-hands',
        resourceType: 'perLongRest',
        value: {
          expression: '@classLevel.paladin * 5',
          variables: ['@classLevel.paladin'],
        },
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'paladin', level: 1 }],
      },
      {
        kind: 'tag',
        tags: ['lay-on-hands', 'healing'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'paladin', level: 1 }],
      },
    ],
    edition: 'both',
  },
];

/**
 * Paladin Level 2 Features
 */
export const paladinLevel2Features: SourcedEffect[] = [
  // Fighting Style (choice)
  {
    sourceId: 'class:paladin',
    effectId: 'paladin-fighting-style',
    name: 'Fighting Style',
    description: 'You adopt a particular style of fighting as your specialty.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'fighting-style',
        name: 'Fighting Style',
        description: 'Choose a fighting style.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'paladin', level: 2 }],
      },
      {
        kind: 'tag',
        tags: ['fighting-style-choice'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'paladin', level: 2 }],
      },
    ],
    edition: 'both',
  },

  // Spellcasting (half-caster, starts at level 2)
  {
    sourceId: 'class:paladin',
    effectId: 'paladin-spellcasting',
    name: 'Spellcasting',
    description: 'You have learned to draw on divine magic through meditation and prayer to cast spells.',
    effects: [
      {
        kind: 'spellcastingAbility',
        ability: 'CHA',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'paladin', level: 2 }],
      },
      {
        kind: 'grantFeature',
        featureId: 'spellcasting',
        name: 'Spellcasting',
        description: 'Charisma is your spellcasting ability.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'paladin', level: 2 }],
      },
      {
        kind: 'tag',
        tags: ['spellcasting', 'prepared-caster', 'half-caster'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'paladin', level: 2 }],
      },
    ],
    edition: 'both',
  },

  // Divine Smite
  {
    sourceId: 'class:paladin',
    effectId: 'paladin-divine-smite',
    name: 'Divine Smite',
    description: 'When you hit a creature with a melee weapon attack, you can expend one spell slot to deal radiant damage to the target, in addition to the weapon\'s damage.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'divine-smite',
        name: 'Divine Smite',
        description: 'Expend spell slot for extra radiant damage.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'paladin', level: 2 }],
      },
      {
        kind: 'tag',
        tags: ['divine-smite', 'spell-slot-feature'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'paladin', level: 2 }],
      },
    ],
    edition: 'both',
  },
];

/**
 * Paladin Level 3 Features
 */
export const paladinLevel3Features: SourcedEffect[] = [
  // Divine Health
  {
    sourceId: 'class:paladin',
    effectId: 'paladin-divine-health',
    name: 'Divine Health',
    description: 'The divine magic flowing through you makes you immune to disease.',
    effects: [
      {
        kind: 'conditionImmunity',
        condition: 'diseased',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'paladin', level: 3 }],
      },
      {
        kind: 'grantFeature',
        featureId: 'divine-health',
        name: 'Divine Health',
        description: 'You are immune to disease.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'paladin', level: 3 }],
      },
      {
        kind: 'tag',
        tags: ['divine-health', 'disease-immunity'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'paladin', level: 3 }],
      },
    ],
    edition: 'both',
  },

  // Sacred Oath (subclass choice at level 3)
  {
    sourceId: 'class:paladin',
    effectId: 'paladin-sacred-oath',
    name: 'Sacred Oath',
    description: 'You swear the oath that binds you as a paladin forever.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'sacred-oath',
        name: 'Sacred Oath',
        description: 'Choose your Sacred Oath subclass.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'paladin', level: 3 }],
      },
      {
        kind: 'tag',
        tags: ['sacred-oath', 'subclass-choice'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'paladin', level: 3 }],
      },
    ],
    edition: 'both',
  },
];

/**
 * Paladin Level 5 Features
 */
export const paladinLevel5Features: SourcedEffect[] = [
  // Extra Attack
  {
    sourceId: 'class:paladin',
    effectId: 'paladin-extra-attack',
    name: 'Extra Attack',
    description: 'You can attack twice, instead of once, whenever you take the Attack action on your turn.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'extra-attack',
        name: 'Extra Attack',
        description: 'Attack twice when you take the Attack action.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'paladin', level: 5 }],
      },
      {
        kind: 'tag',
        tags: ['extra-attack'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'paladin', level: 5 }],
      },
    ],
    edition: 'both',
  },
];

/**
 * Paladin Level 6 Features
 */
export const paladinLevel6Features: SourcedEffect[] = [
  // Aura of Protection
  {
    sourceId: 'class:paladin',
    effectId: 'paladin-aura-protection',
    name: 'Aura of Protection',
    description: 'Whenever you or a friendly creature within 10 feet of you must make a saving throw, the creature gains a bonus to the saving throw equal to your Charisma modifier.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'aura-of-protection',
        name: 'Aura of Protection',
        description: '+CHA to saves within 10 feet (30 feet at level 18).',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'paladin', level: 6 }],
      },
      {
        kind: 'savingThrowBonus',
        ability: 'all',
        value: {
          expression: '@abilities.CHA.modifier',
          variables: ['@abilities.CHA.modifier'],
        },
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'paladin', level: 6 }],
      },
      {
        kind: 'tag',
        tags: ['aura-of-protection', 'save-bonus'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'paladin', level: 6 }],
      },
    ],
    edition: 'both',
  },
];

/**
 * Paladin Level 10 Features
 */
export const paladinLevel10Features: SourcedEffect[] = [
  // Aura of Courage
  {
    sourceId: 'class:paladin',
    effectId: 'paladin-aura-courage',
    name: 'Aura of Courage',
    description: 'You and friendly creatures within 10 feet of you can\'t be frightened while you are conscious.',
    effects: [
      {
        kind: 'conditionImmunity',
        condition: 'frightened',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'paladin', level: 10 }],
      },
      {
        kind: 'grantFeature',
        featureId: 'aura-of-courage',
        name: 'Aura of Courage',
        description: 'Immunity to frightened within 10 feet (30 feet at level 18).',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'paladin', level: 10 }],
      },
      {
        kind: 'tag',
        tags: ['aura-of-courage', 'fear-immunity'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'paladin', level: 10 }],
      },
    ],
    edition: 'both',
  },
];

/**
 * Paladin Level 11 Features
 */
export const paladinLevel11Features: SourcedEffect[] = [
  // Improved Divine Smite
  {
    sourceId: 'class:paladin',
    effectId: 'paladin-improved-divine-smite',
    name: 'Improved Divine Smite',
    description: 'Whenever you hit a creature with a melee weapon, the creature takes an extra 1d8 radiant damage.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'improved-divine-smite',
        name: 'Improved Divine Smite',
        description: '+1d8 radiant damage on all melee weapon hits.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'paladin', level: 11 }],
      },
      {
        kind: 'tag',
        tags: ['improved-divine-smite', 'bonus-damage'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'paladin', level: 11 }],
      },
    ],
    edition: 'both',
  },
];

/**
 * Paladin Level 14 Features
 */
export const paladinLevel14Features: SourcedEffect[] = [
  // Cleansing Touch
  {
    sourceId: 'class:paladin',
    effectId: 'paladin-cleansing-touch',
    name: 'Cleansing Touch',
    description: 'You can use your action to end one spell on yourself or on one willing creature that you touch.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'cleansing-touch',
        name: 'Cleansing Touch',
        description: 'End one spell with a touch.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'paladin', level: 14 }],
      },
      {
        kind: 'resource',
        resourceId: 'cleansing-touch',
        resourceType: 'perLongRest',
        value: {
          expression: '@abilities.CHA.modifier',
          variables: ['@abilities.CHA.modifier'],
        },
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'paladin', level: 14 }],
      },
      {
        kind: 'tag',
        tags: ['cleansing-touch', 'spell-removal'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'paladin', level: 14 }],
      },
    ],
    edition: 'both',
  },
];

/**
 * All Paladin effects
 */
export const paladinEffects: SourcedEffect[] = [
  ...paladinProficiencies,
  ...paladinLevel1Features,
  ...paladinLevel2Features,
  ...paladinLevel3Features,
  ...paladinLevel5Features,
  ...paladinLevel6Features,
  ...paladinLevel10Features,
  ...paladinLevel11Features,
  ...paladinLevel14Features,
  // Note: Spell slots handled by half-caster spell slot progression (not yet implemented)
  ...(subclassEffectsByClass.paladin ?? []),
];
