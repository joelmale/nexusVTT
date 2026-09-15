/**
 * Warlock 2024 Class Progression (Levels 1-20)
 *
 * Complete level-by-level feature progression for the 2024 D&D Warlock class.
 * Includes all features, resources, and player choices required at each level.
 */

import { ClassProgression } from '../classProgression';

export const warlock2024Progression: ClassProgression = {
  classSlug: 'warlock',
  className: 'Warlock',
  edition: '2024',
  hitDie: 'd8',
  asiLevels: [4, 8, 12, 16, 19],
  subclassLevel: 1,
  features: [
    // LEVEL 1
    {
      level: 1,
      name: 'Otherworldly Patron',
      description: 'At 1st level, you have struck a bargain with an otherworldly being of your choice. Your choice grants you features at 1st level and again at 6th, 10th, and 14th level.',
      automatic: false,
      choices: [
        {
          type: 'subclass',
          description: 'Choose an Otherworldly Patron: The Fiend, The Great Old One, or The Hexblade.',
          count: 1
        }
      ]
    },
    {
      level: 1,
      name: 'Pact Magic',
      description: 'Your arcane research and the magic bestowed on you by your patron have given you facility with spells. See chapter 10 for the general rules of spellcasting and chapter 11 for the warlock spell list.',
      automatic: true
    },

    // LEVEL 2
    {
      level: 2,
      name: 'Eldritch Invocations',
      description: 'In your study of occult lore, you have unearthed eldritch invocations, fragments of forbidden knowledge that imbue you with an abiding magical ability. At 2nd level, you gain two eldritch invocations of your choice. When you gain certain warlock levels, you gain additional invocations of your choice.',
      automatic: false,
      choices: [
        {
          type: 'invocation',
          description: 'Choose two Eldritch Invocations.',
          count: 2
        }
      ]
    },

    // LEVEL 3
    {
      level: 3,
      name: 'Pact Boon',
      description: 'At 3rd level, your otherworldly patron bestows a gift upon you for your loyal service. You gain one of the following features of your choice.',
      automatic: false,
      choices: [
        {
          type: 'pact-boon',
          description: 'Choose a Pact Boon: Pact of the Chain, Pact of the Blade, Pact of the Tome, or Pact of the Talisman.',
          count: 1
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
      name: 'Eldritch Invocation',
      description: 'At 5th level, you gain one eldritch invocation of your choice.',
      automatic: false,
      choices: [
        {
          type: 'invocation',
          description: 'Choose one Eldritch Invocation.',
          count: 1
        }
      ]
    },

    // LEVEL 6
    {
      level: 6,
      name: 'Otherworldly Patron Feature',
      description: 'At 6th level, you gain a feature granted by your Otherworldly Patron.',
      automatic: true
    },

    // LEVEL 7
    {
      level: 7,
      name: 'Eldritch Invocation',
      description: 'At 7th level, you gain one eldritch invocation of your choice.',
      automatic: false,
      choices: [
        {
          type: 'invocation',
          description: 'Choose one Eldritch Invocation.',
          count: 1
        }
      ]
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
      name: 'Eldritch Invocation',
      description: 'At 9th level, you gain one eldritch invocation of your choice.',
      automatic: false,
      choices: [
        {
          type: 'invocation',
          description: 'Choose one Eldritch Invocation.',
          count: 1
        }
      ]
    },

    // LEVEL 10
    {
      level: 10,
      name: 'Otherworldly Patron Feature',
      description: 'At 10th level, you gain a feature granted by your Otherworldly Patron.',
      automatic: true
    },

    // LEVEL 11
    {
      level: 11,
      name: 'Mystic Arcanum',
      description: 'At 11th level, your patron bestows upon you a magical secret called an arcanum. Choose one 6th-level spell from the warlock spell list as this arcanum. You can cast this spell once without expending a spell slot. You must finish a long rest before you can cast it in this way again.',
      automatic: false,
      choices: [
        {
          type: 'spell-mastery',
          description: 'Choose one 6th-level warlock spell as your Mystic Arcanum.',
          count: 1
        }
      ]
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
      name: 'Mystic Arcanum',
      description: 'At 13th level, you gain another Mystic Arcanum. Choose one 7th-level spell from the warlock spell list as this arcanum.',
      automatic: false,
      choices: [
        {
          type: 'spell-mastery',
          description: 'Choose one 7th-level warlock spell as your Mystic Arcanum.',
          count: 1
        }
      ]
    },

    // LEVEL 14
    {
      level: 14,
      name: 'Otherworldly Patron Feature',
      description: 'At 14th level, you gain a feature granted by your Otherworldly Patron.',
      automatic: true
    },

    // LEVEL 15
    {
      level: 15,
      name: 'Mystic Arcanum',
      description: 'At 15th level, you gain another Mystic Arcanum. Choose one 8th-level spell from the warlock spell list as this arcanum.',
      automatic: false,
      choices: [
        {
          type: 'spell-mastery',
          description: 'Choose one 8th-level warlock spell as your Mystic Arcanum.',
          count: 1
        }
      ]
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
      name: 'Mystic Arcanum',
      description: 'At 17th level, you gain another Mystic Arcanum. Choose one 9th-level spell from the warlock spell list as this arcanum.',
      automatic: false,
      choices: [
        {
          type: 'spell-mastery',
          description: 'Choose one 9th-level warlock spell as your Mystic Arcanum.',
          count: 1
        }
      ]
    },

    // LEVEL 18
    {
      level: 18,
      name: 'Eldritch Invocation',
      description: 'At 18th level, you gain one eldritch invocation of your choice.',
      automatic: false,
      choices: [
        {
          type: 'invocation',
          description: 'Choose one Eldritch Invocation.',
          count: 1
        }
      ]
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
      name: 'Eldritch Master',
      description: 'At 20th level, you can draw on your inner reserve of mystical power while entreating your patron to regain expended spell slots. You can spend 1 minute entreating your patron for aid to regain all your expended spell slots from your Pact Magic feature. Once you regain spell slots with this feature, you must finish a long rest before you can do so again.',
      automatic: true,
      resources: [
        {
          id: 'eldritch-master',
          name: 'Eldritch Master',
          description: 'Regain all expended Pact Magic spell slots',
          maxUses: 1,
          rechargeType: 'long-rest'
        }
      ]
    }
  ]
};