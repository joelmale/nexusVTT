/**
 * Wizard Class Effects
 * Pure data - no game logic in code
 */

import type { SourcedEffect } from '../../types/effects';
import { subclassEffectsByClass } from './subclassEffects';
import { createFullCasterSpellSlots } from '../spellSlots';

/**
 * Wizard base class proficiencies (both editions)
 */
export const wizardProficiencies: SourcedEffect[] = [
  // Weapon proficiencies (limited)
  {
    sourceId: 'class:wizard',
    effectId: 'wizard-weapon-proficiency',
    name: 'Weapon Proficiency',
    description: 'You are proficient with daggers, darts, slings, quarterstaffs, and light crossbows.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'weapon',
        values: ['Daggers', 'Darts', 'Slings', 'Quarterstaffs', 'Light crossbows'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'wizard', level: 1 }],
      },
    ],
    edition: 'both',
  },

  // Saving throw proficiencies
  {
    sourceId: 'class:wizard',
    effectId: 'wizard-saving-throws',
    name: 'Saving Throw Proficiency',
    description: 'You are proficient in Intelligence and Wisdom saving throws.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'savingThrow',
        values: ['INT', 'WIS'],
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'wizard', level: 1 }],
      },
    ],
    edition: 'both',
  },

  // Skill proficiencies (choice-based)
  {
    sourceId: 'class:wizard',
    effectId: 'wizard-skill-choice',
    name: 'Wizard Skills',
    description: 'Choose two from Arcana, History, Insight, Investigation, Medicine, and Religion.',
    effects: [
      {
        kind: 'tag',
        tags: ['skill-choice-wizard'],
      },
    ],
    edition: 'both',
  },
];

/**
 * Wizard spellcasting (level 1+)
 */
export const wizardSpellcasting: SourcedEffect[] = [
  {
    sourceId: 'class:wizard',
    effectId: 'wizard-spellcasting-ability',
    name: 'Spellcasting Ability',
    description: 'Intelligence is your spellcasting ability for your wizard spells.',
    effects: [
      {
        kind: 'spellcastingAbility',
        ability: 'INT',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'wizard', level: 1 }],
      },
    ],
    edition: 'both',
  },

  {
    sourceId: 'class:wizard',
    effectId: 'wizard-spellbook',
    name: 'Spellbook',
    description: 'You have a spellbook containing six 1st-level wizard spells of your choice.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'spellbook',
        name: 'Spellbook',
        description:
          'Your spellbook is the repository of the wizard spells you know. You can copy spells into it and prepare spells from it.',
        predicate: [{ type: 'classLevelAtLeast', classSlug: 'wizard', level: 1 }],
      },
      {
        kind: 'tag',
        tags: ['spellbook', 'prepared-caster'],
        predicate: [{ type: 'levelAtLeast', value: 1 }],
      },
    ],
    edition: 'both',
  },
];

/**
 * All Wizard effects
 */
export const wizardEffects: SourcedEffect[] = [
  ...wizardProficiencies,
  ...wizardSpellcasting,
  ...createFullCasterSpellSlots('wizard'),
  ...(subclassEffectsByClass.wizard ?? []),
];
