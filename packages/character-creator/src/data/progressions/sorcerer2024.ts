/**
 * Sorcerer 2024 Class Progression (Levels 1-20)
 *
 * Complete level-by-level feature progression for the 2024 D&D Sorcerer class.
 * Includes all features, resources, and player choices required at each level.
 */

import { ClassProgression } from '../classProgression';

export const sorcerer2024Progression: ClassProgression = {
  classSlug: 'sorcerer',
  className: 'Sorcerer',
  edition: '2024',
  hitDie: 'd6',
  asiLevels: [4, 8, 12, 16, 19],
  subclassLevel: 1,
  features: [
    // LEVEL 1
    {
      level: 1,
      name: 'Spellcasting',
      description: 'An event in your past, or in the life of a parent or ancestor, left an indelible mark on you, infusing you with arcane magic. This font of magic, whatever its origin, fuels your spells. See chapter 10 for the general rules of spellcasting and chapter 11 for the sorcerer spell list.',
      automatic: true
    },
    {
      level: 1,
      name: 'Sorcerous Origin',
      description: 'Choose a sorcerous origin, which describes the source of your innate magical power. Choose one of the following options.',
      automatic: false,
      choices: [
        {
          type: 'subclass',
          description: 'Choose a Sorcerous Origin: Draconic Bloodline, Wild Magic, or Storm Sorcery.',
          count: 1
        }
      ]
    },

    // LEVEL 2
    {
      level: 2,
      name: 'Font of Magic',
      description: 'At 2nd level, you tap into a deep wellspring of magic within yourself. This wellspring is represented by sorcery points, which allow you to create a variety of magical effects. You have 2 sorcery points, and you gain more as you reach higher levels, as shown in the Sorcery Points column of the Sorcerer table. You can never have more sorcery points than shown on the table for your level. You regain all spent sorcery points when you finish a long rest.',
      automatic: true,
      resources: [
        {
          id: 'sorcery-points',
          name: 'Sorcery Points',
          description: 'Points for creating magical effects',
          maxUses: 2, // Scales with level
          rechargeType: 'long-rest'
        }
      ]
    },

    // LEVEL 3
    {
      level: 3,
      name: 'Metamagic',
      description: 'At 3rd level, you gain the ability to twist your spells to suit your needs. You gain two of the following Metamagic options of your choice. You gain another one at 10th and 17th level.',
      automatic: false,
      choices: [
        {
          type: 'metamagic',
          description: 'Choose two Metamagic options.',
          count: 2
        }
      ]
    },

    // LEVEL 4 - ASI
    {
      level: 4,
      name: 'Ability Score Improvement',
      description: 'When you reach 4th level, you can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1. As normal, you can\'t increase an ability score above 20 using this feature.',
      automatic: false,
      choices: [
        {
          type: 'asi',
          description: 'Increase one ability score by 2, or two ability scores by 1 each.',
          count: 2
        }
      ]
    },

    // LEVEL 5
    {
      level: 5,
      name: 'Magical Guidance',
      description: 'Starting at 5th level, you can use your sorcery points to gain advantage on an ability check. When you make an ability check that uses a skill you\'re proficient in, you can spend 1 sorcery point to gain advantage on the check.',
      automatic: true
    },

    // LEVEL 6
    {
      level: 6,
      name: 'Sorcerous Restoration',
      description: 'At 6th level, you regain 4 expended sorcery points whenever you finish a short rest.',
      automatic: true
    },

    // LEVEL 7
    {
      level: 7,
      name: 'Quickened Spell',
      description: 'When you cast a spell that has a casting time of 1 action, you can spend 2 sorcery points to change the casting time to 1 bonus action for this casting.',
      automatic: true
    },

    // LEVEL 8 - ASI
    {
      level: 8,
      name: 'Ability Score Improvement',
      description: 'When you reach 8th level, you can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1. As normal, you can\'t increase an ability score above 20 using this feature.',
      automatic: false,
      choices: [
        {
          type: 'asi',
          description: 'Increase one ability score by 2, or two ability scores by 1 each.',
          count: 2
        }
      ]
    },

    // LEVEL 9
    {
      level: 9,
      name: 'Magical Guidance Improvement',
      description: 'At 9th level, you can use Magical Guidance on any ability check, not just those using skills you\'re proficient in.',
      automatic: true
    },

    // LEVEL 10
    {
      level: 10,
      name: 'Metamagic Adept',
      description: 'At 10th level, you gain one additional Metamagic option of your choice.',
      automatic: false,
      choices: [
        {
          type: 'metamagic',
          description: 'Choose one additional Metamagic option.',
          count: 1
        }
      ]
    },

    // LEVEL 11
    {
      level: 11,
      name: 'Twin Spell',
      description: 'When you cast a spell that targets only one creature and doesn\'t have a range of self, you can spend a number of sorcery points equal to the spell\'s level to target a second creature in range with the same spell (1 sorcery point if the spell is a cantrip).',
      automatic: true
    },

    // LEVEL 12 - ASI
    {
      level: 12,
      name: 'Ability Score Improvement',
      description: 'When you reach 12th level, you can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1. As normal, you can\'t increase an ability score above 20 using this feature.',
      automatic: false,
      choices: [
        {
          type: 'asi',
          description: 'Increase one ability score by 2, or two ability scores by 1 each.',
          count: 2
        }
      ]
    },

    // LEVEL 13
    {
      level: 13,
      name: 'Sorcerous Restoration Improvement',
      description: 'At 13th level, you regain 6 expended sorcery points whenever you finish a short rest.',
      automatic: true
    },

    // LEVEL 14
    {
      level: 14,
      name: 'Spell Bombardment',
      description: 'Beginning at 14th level, when you roll damage for a spell and roll the maximum number on any of the dice, you can spend 1 sorcery point to reroll that die and add the new roll to the damage. You can use Spell Bombardment only once per turn.',
      automatic: true
    },

    // LEVEL 15
    {
      level: 15,
      name: 'Sorcerous Restoration Improvement',
      description: 'At 15th level, you regain 8 expended sorcery points whenever you finish a short rest.',
      automatic: true
    },

    // LEVEL 16 - ASI
    {
      level: 16,
      name: 'Ability Score Improvement',
      description: 'When you reach 16th level, you can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1. As normal, you can\'t increase an ability score above 20 using this feature.',
      automatic: false,
      choices: [
        {
          type: 'asi',
          description: 'Increase one ability score by 2, or two ability scores by 1 each.',
          count: 2
        }
      ]
    },

    // LEVEL 17
    {
      level: 17,
      name: 'Metamagic Master',
      description: 'At 17th level, you gain one additional Metamagic option of your choice.',
      automatic: false,
      choices: [
        {
          type: 'metamagic',
          description: 'Choose one additional Metamagic option.',
          count: 1
        }
      ]
    },

    // LEVEL 18
    {
      level: 18,
      name: 'Sorcerous Restoration Improvement',
      description: 'At 18th level, you regain 10 expended sorcery points whenever you finish a short rest.',
      automatic: true
    },

    // LEVEL 19 - ASI
    {
      level: 19,
      name: 'Ability Score Improvement',
      description: 'When you reach 19th level, you can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1. As normal, you can\'t increase an ability score above 20 using this feature.',
      automatic: false,
      choices: [
        {
          type: 'asi',
          description: 'Increase one ability score by 2, or two ability scores by 1 each.',
          count: 2
        }
      ]
    },

    // LEVEL 20
    {
      level: 20,
      name: 'Sorcerous Restoration Improvement',
      description: 'At 20th level, you regain 12 expended sorcery points whenever you finish a short rest.',
      automatic: true
    }
  ]
};