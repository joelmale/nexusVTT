/**
 * Cleric Class Effects
 * Pure data - no game logic in code
 */

import type { SourcedEffect } from '../../types/effects';
import { subclassEffectsByClass } from './subclassEffects';
import { createFullCasterSpellSlots } from '../spellSlots';

/**
 * Cleric base class proficiencies (both editions)
 */
export const clericProficiencies: SourcedEffect[] = [
  // Armor proficiencies (base - 2024 adds heavy/martial via Divine Order)
  {
    sourceId: 'class:cleric',
    effectId: 'cleric-armor-proficiency',
    name: 'Armor Proficiency',
    description: 'You are proficient with light armor, medium armor, and shields.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'armor',
        values: ['Light armor', 'Medium armor', 'Shields'],
        predicate: [{ type: 'classIs', slug: 'cleric' }],
      },
    ],
    edition: 'both',
  },

  // Weapon proficiencies
  {
    sourceId: 'class:cleric',
    effectId: 'cleric-weapon-proficiency',
    name: 'Weapon Proficiency',
    description: 'You are proficient with simple weapons.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'weapon',
        values: ['Simple weapons'],
        predicate: [{ type: 'classIs', slug: 'cleric' }],
      },
    ],
    edition: 'both',
  },

  // Saving throw proficiencies
  {
    sourceId: 'class:cleric',
    effectId: 'cleric-saving-throws',
    name: 'Saving Throw Proficiency',
    description: 'You are proficient in Wisdom and Charisma saving throws.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'savingThrow',
        values: ['WIS', 'CHA'],
        predicate: [{ type: 'classIs', slug: 'cleric' }],
      },
    ],
    edition: 'both',
  },

  // Skill proficiencies (choice-based)
  {
    sourceId: 'class:cleric',
    effectId: 'cleric-skill-choice',
    name: 'Cleric Skills',
    description: 'Choose two from History, Insight, Medicine, Persuasion, and Religion.',
    effects: [
      {
        kind: 'tag',
        tags: ['skill-choice-cleric'],
      },
    ],
    edition: 'both',
  },
];

/**
 * Cleric spellcasting
 */
export const clericSpellcasting: SourcedEffect[] = [
  {
    sourceId: 'class:cleric',
    effectId: 'cleric-spellcasting-ability',
    name: 'Spellcasting Ability',
    description: 'Wisdom is your spellcasting ability for your cleric spells.',
    effects: [
      {
        kind: 'spellcastingAbility',
        ability: 'WIS',
        predicate: [
          { type: 'classIs', slug: 'cleric' },
          { type: 'levelAtLeast', value: 1 },
        ],
      },
    ],
    edition: 'both',
  },

  {
    sourceId: 'class:cleric',
    effectId: 'cleric-prepared-caster',
    name: 'Prepared Spellcasting',
    description: 'You prepare spells from the cleric spell list.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'cleric-spellcasting',
        name: 'Spellcasting',
        description: 'You can prepare spells from the cleric spell list.',
        predicate: [
          { type: 'classIs', slug: 'cleric' },
          { type: 'levelAtLeast', value: 1 },
        ],
      },
      {
        kind: 'tag',
        tags: ['prepared-caster'],
        predicate: [{ type: 'levelAtLeast', value: 1 }],
      },
    ],
    edition: 'both',
  },
];

/**
 * 2024 Cleric: Divine Order (Level 1 choice)
 * This is a major difference from 2014 where Domain was chosen at level 1
 */
export const clericDivineOrder2024: SourcedEffect = {
  sourceId: 'class:cleric-2024',
  effectId: 'divine-order-choice',
  name: 'Divine Order',
  description: 'Choose your divine role: Protector or Thaumaturge.',
  choice: {
    id: 'divine-order',
    prompt: 'Choose your Divine Order',
    type: 'select',
    min: 1,
    max: 1,
    predicate: [
      { type: 'edition', value: '2024' },
      { type: 'classIs', slug: 'cleric' },
      { type: 'levelAtLeast', value: 1 },
    ],
    options: [
      {
        value: 'protector',
        label: 'Protector',
        description: 'You gain proficiency with heavy armor and martial weapons.',
        effects: [
          {
            kind: 'grantProficiency',
            profType: 'armor',
            values: ['Heavy armor'],
          },
          {
            kind: 'grantProficiency',
            profType: 'weapon',
            values: ['Martial weapons'],
          },
          {
            kind: 'grantFeature',
            featureId: 'divine-order-protector',
            name: 'Divine Order: Protector',
            description: 'You have training in battle as a protector of your faith.',
          },
          {
            kind: 'tag',
            tags: ['divine-order:protector'],
          },
        ],
      },
      {
        value: 'thaumaturge',
        label: 'Thaumaturge',
        description:
          'You know one additional cantrip, and your WIS modifier is added to Arcana and Religion checks.',
        effects: [
          {
            kind: 'grantFeature',
            featureId: 'divine-order-thaumaturge',
            name: 'Divine Order: Thaumaturge',
            description:
              'You know one additional cantrip from the cleric spell list. When you make an Intelligence (Arcana) or Intelligence (Religion) check, you gain a bonus to the check equal to your Wisdom modifier.',
          },
          {
            kind: 'skillBonus',
            skill: 'Arcana',
            value: {
              expression: '@abilities.WIS.modifier',
              variables: ['@abilities.WIS.modifier'],
            },
            stacking: 'stack',
          },
          {
            kind: 'skillBonus',
            skill: 'Religion',
            value: {
              expression: '@abilities.WIS.modifier',
              variables: ['@abilities.WIS.modifier'],
            },
            stacking: 'stack',
          },
          {
            kind: 'tag',
            tags: ['divine-order:thaumaturge'],
          },
        ],
      },
    ],
  },
  edition: '2024',
};

/**
 * All Cleric effects
 */
export const clericEffects: SourcedEffect[] = [
  ...clericProficiencies,
  ...clericSpellcasting,
  clericDivineOrder2024,
  ...createFullCasterSpellSlots('cleric'),
  ...(subclassEffectsByClass.cleric ?? []),
];
