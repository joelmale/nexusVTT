/**
 * Sorcerer Class Effects
 * Pure data - no game logic in code
 */

import type { SourcedEffect } from '../../types/effects';
import { subclassEffectsByClass } from './subclassEffects';
import { createFullCasterSpellSlots } from '../spellSlots';

/**
 * Sorcerer base class proficiencies (both editions)
 */
export const sorcererProficiencies: SourcedEffect[] = [
  // Armor proficiencies (none)
  {
    sourceId: 'class:sorcerer',
    effectId: 'sorcerer-no-armor',
    name: 'No Armor Proficiency',
    description: 'Sorcerers do not gain armor or shield proficiencies.',
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
    sourceId: 'class:sorcerer',
    effectId: 'sorcerer-weapon-proficiency',
    name: 'Weapon Proficiency',
    description: 'You are proficient with daggers, darts, slings, quarterstaffs, and light crossbows.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'weapon',
        values: ['Daggers', 'Darts', 'Slings', 'Quarterstaffs', 'Light crossbows'],
        predicate: [{ type: 'classIs', slug: 'sorcerer' }],
      },
    ],
    edition: 'both',
  },

  // Saving throw proficiencies
  {
    sourceId: 'class:sorcerer',
    effectId: 'sorcerer-saving-throws',
    name: 'Saving Throw Proficiency',
    description: 'You are proficient in Constitution and Charisma saving throws.',
    effects: [
      {
        kind: 'grantProficiency',
        profType: 'savingThrow',
        values: ['CON', 'CHA'],
        predicate: [{ type: 'classIs', slug: 'sorcerer' }],
      },
    ],
    edition: 'both',
  },

  // Skill proficiencies (choice-based, deferred to later phases)
  {
    sourceId: 'class:sorcerer',
    effectId: 'sorcerer-skill-choice',
    name: 'Sorcerer Skills',
    description: 'Choose two from Arcana, Deception, Insight, Intimidation, Persuasion, and Religion.',
    // Note: This requires choice system
    effects: [
      {
        kind: 'tag',
        tags: ['skill-choice-sorcerer'],
      },
    ],
    edition: 'both',
  },
];

/**
 * Sorcerer spellcasting (CHA-based)
 */
export const sorcererSpellcasting: SourcedEffect[] = [
  {
    sourceId: 'class:sorcerer',
    effectId: 'sorcerer-spellcasting-ability',
    name: 'Spellcasting Ability',
    description: 'Charisma is your spellcasting ability for your sorcerer spells.',
    effects: [
      {
        kind: 'spellcastingAbility',
        ability: 'CHA',
        predicate: [{ type: 'classIs', slug: 'sorcerer' }],
      },
    ],
    edition: 'both',
  },
];

/**
 * Sorcerer level 2 features (Font of Magic)
 */
export const sorcererLevel2Features: SourcedEffect[] = [
  // Font of Magic - Sorcery Points
  {
    sourceId: 'class:sorcerer',
    effectId: 'sorcerer-font-of-magic',
    name: 'Font of Magic',
    description: 'You tap into a deep wellspring of magic within yourself. This wellspring is represented by sorcery points.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'font-of-magic',
        name: 'Font of Magic',
        description:
          'You have a number of sorcery points equal to your sorcerer level. You can use sorcery points to create spell slots or fuel metamagic options. You regain all expended sorcery points when you finish a long rest.',
        predicate: [
          { type: 'classIs', slug: 'sorcerer' },
          { type: 'levelAtLeast', value: 2 },
        ],
      },
      {
        kind: 'resource',
        resourceId: 'sorcery-points',
        resourceType: 'perLongRest',
        value: {
          expression: '@level',
          variables: ['@level'],
        },
        predicate: [
          { type: 'classIs', slug: 'sorcerer' },
          { type: 'levelAtLeast', value: 2 },
        ],
      },
      {
        kind: 'tag',
        tags: ['font-of-magic'],
        predicate: [{ type: 'levelAtLeast', value: 2 }],
      },
    ],
    edition: 'both',
  },
];

/**
 * Sorcerer level 3 features (Metamagic)
 */
export const sorcererLevel3Features: SourcedEffect[] = [
  // Metamagic choice (choose 2)
  {
    sourceId: 'class:sorcerer',
    effectId: 'sorcerer-metamagic',
    name: 'Metamagic',
    description: 'You gain the ability to twist your spells to suit your needs.',
    choice: {
      id: 'metamagic',
      prompt: 'Choose two Metamagic options',
      type: 'select',
      min: 2,
      max: 2,
      predicate: [
        { type: 'classIs', slug: 'sorcerer' },
        { type: 'levelAtLeast', value: 3 },
      ],
      options: [
        {
          value: 'careful-spell',
          label: 'Careful Spell',
          description: 'Spend 1 sorcery point to protect allies from spell effects',
          effects: [
            {
              kind: 'grantFeature',
              featureId: 'metamagic-careful-spell',
              name: 'Metamagic: Careful Spell',
              description:
                'When you cast a spell that forces other creatures to make a saving throw, you can protect some of those creatures from the spell\'s full force. To do so, you spend 1 sorcery point and choose a number of those creatures up to your Charisma modifier (minimum of one creature). A chosen creature automatically succeeds on its saving throw against the spell.',
            },
            {
              kind: 'tag',
              tags: ['metamagic:careful-spell'],
            },
          ],
        },
        {
          value: 'distant-spell',
          label: 'Distant Spell',
          description: 'Spend 1 sorcery point to double spell range',
          effects: [
            {
              kind: 'grantFeature',
              featureId: 'metamagic-distant-spell',
              name: 'Metamagic: Distant Spell',
              description:
                'When you cast a spell that has a range of 5 feet or greater, you can spend 1 sorcery point to double the range of the spell. When you cast a spell that has a range of touch, you can spend 1 sorcery point to make the range of the spell 30 feet.',
            },
            {
              kind: 'tag',
              tags: ['metamagic:distant-spell'],
            },
          ],
        },
        {
          value: 'empowered-spell',
          label: 'Empowered Spell',
          description: 'Spend 1 sorcery point to reroll damage dice',
          effects: [
            {
              kind: 'grantFeature',
              featureId: 'metamagic-empowered-spell',
              name: 'Metamagic: Empowered Spell',
              description:
                'When you roll damage for a spell, you can spend 1 sorcery point to reroll a number of the damage dice up to your Charisma modifier (minimum of one). You must use the new rolls. You can use Empowered Spell even if you have already used a different Metamagic option during the casting of the spell.',
            },
            {
              kind: 'tag',
              tags: ['metamagic:empowered-spell'],
            },
          ],
        },
        {
          value: 'extended-spell',
          label: 'Extended Spell',
          description: 'Spend 1 sorcery point to double spell duration',
          effects: [
            {
              kind: 'grantFeature',
              featureId: 'metamagic-extended-spell',
              name: 'Metamagic: Extended Spell',
              description:
                'When you cast a spell that has a duration of 1 minute or longer, you can spend 1 sorcery point to double its duration, to a maximum duration of 24 hours.',
            },
            {
              kind: 'tag',
              tags: ['metamagic:extended-spell'],
            },
          ],
        },
        {
          value: 'heightened-spell',
          label: 'Heightened Spell',
          description: 'Spend 3 sorcery points to impose disadvantage on saving throw',
          effects: [
            {
              kind: 'grantFeature',
              featureId: 'metamagic-heightened-spell',
              name: 'Metamagic: Heightened Spell',
              description:
                'When you cast a spell that forces a creature to make a saving throw to resist its effects, you can spend 3 sorcery points to give one target of the spell disadvantage on its first saving throw made against the spell.',
            },
            {
              kind: 'tag',
              tags: ['metamagic:heightened-spell'],
            },
          ],
        },
        {
          value: 'quickened-spell',
          label: 'Quickened Spell',
          description: 'Spend 2 sorcery points to cast spell as bonus action',
          effects: [
            {
              kind: 'grantFeature',
              featureId: 'metamagic-quickened-spell',
              name: 'Metamagic: Quickened Spell',
              description:
                'When you cast a spell that has a casting time of 1 action, you can spend 2 sorcery points to change the casting time to 1 bonus action for this casting.',
            },
            {
              kind: 'tag',
              tags: ['metamagic:quickened-spell'],
            },
          ],
        },
        {
          value: 'subtle-spell',
          label: 'Subtle Spell',
          description: 'Spend 1 sorcery point to cast without components',
          effects: [
            {
              kind: 'grantFeature',
              featureId: 'metamagic-subtle-spell',
              name: 'Metamagic: Subtle Spell',
              description:
                'When you cast a spell, you can spend 1 sorcery point to cast it without any somatic or verbal components.',
            },
            {
              kind: 'tag',
              tags: ['metamagic:subtle-spell'],
            },
          ],
        },
        {
          value: 'twinned-spell',
          label: 'Twinned Spell',
          description: 'Spend sorcery points to target second creature',
          effects: [
            {
              kind: 'grantFeature',
              featureId: 'metamagic-twinned-spell',
              name: 'Metamagic: Twinned Spell',
              description:
                'When you cast a spell that targets only one creature and doesn\'t have a range of self, you can spend a number of sorcery points equal to the spell\'s level to target a second creature in range with the same spell (1 sorcery point if the spell is a cantrip). To be eligible, a spell must be incapable of targeting more than one creature at the spell\'s current level.',
            },
            {
              kind: 'tag',
              tags: ['metamagic:twinned-spell'],
            },
          ],
        },
      ],
    },
    effects: [],
    edition: 'both',
  },
];

/**
 * All Sorcerer effects
 */
export const sorcererEffects: SourcedEffect[] = [
  ...sorcererProficiencies,
  ...sorcererSpellcasting,
  ...createFullCasterSpellSlots('sorcerer'),
  ...sorcererLevel2Features,
  ...sorcererLevel3Features,
  ...(subclassEffectsByClass.sorcerer ?? []),
];
