/**
 * Artificer 2024 Class Progression (Levels 1-20)
 *
 * Complete level-by-level feature progression for the 2024 D&D Artificer class.
 * Includes all features, resources, and player choices required at each level.
 */

import { ClassProgression } from '../classProgression';

export const artificer2024Progression: ClassProgression = {
  classSlug: 'artificer',
  className: 'Artificer',
  edition: '2024',
  hitDie: 'd8',
  asiLevels: [4, 8, 12, 16, 19],
  subclassLevel: 3,
  features: [
    // LEVEL 1
    {
      level: 1,
      name: 'Magical Tinkering',
      description: 'At 1st level, you learn how to invest a spark of magic into mundane objects. To use this ability, you must have thieves\' tools or artisan\'s tools in hand. You can take a short rest to magically tinker with one Tiny nonmagical object that isn\'t being worn or carried by anyone else. The object retains the magical effect until you use this feature again or you die.',
      automatic: true
    },
    {
      level: 1,
      name: 'Spellcasting',
      description: 'You have studied the workings of magic and how to cast spells, channeling the magic through objects. To observers, you don\'t appear to be casting spells in a conventional way; you appear to produce wonders from mundane items and outlandish inventions. See chapter 10 for the general rules of spellcasting and chapter 11 for the artificer spell list.',
      automatic: true
    },

    // LEVEL 2
    {
      level: 2,
      name: 'Infuse Item',
      description: 'At 2nd level, you gain the ability to imbue mundane items with certain magical infusions. The magic items you create with this feature last until you finish a long rest, unless the item reaches a total of 10 charges, at which point the item becomes a mundane item once more.',
      automatic: true,
      resources: [
        {
          id: 'infuse-item',
          name: 'Infuse Item',
          description: 'Imbue mundane items with magical infusions',
          maxUses: 2, // Scales with level
          rechargeType: 'long-rest'
        }
      ]
    },

    // LEVEL 3
    {
      level: 3,
      name: 'Artificer Specialist',
      description: 'At 3rd level, you choose the type of artificer you are. Choose one of the following options.',
      automatic: false,
      choices: [
        {
          type: 'subclass',
          description: 'Choose an Artificer Specialist: Alchemist, Armorer, Artillerist, or Battle Smith.',
          count: 1
        }
      ]
    },
    {
      level: 3,
      name: 'The Right Tool for the Job',
      description: 'At 3rd level, you master the use of artisan\'s tools. You gain proficiency with one type of artisan\'s tools of your choice, and you can use that type of tool as a spellcasting focus.',
      automatic: true
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
      name: 'Artificer Specialist Feature',
      description: 'At 5th level, you gain a feature granted by your Artificer Specialist.',
      automatic: true
    },

    // LEVEL 6
    {
      level: 6,
      name: 'Tool Expertise',
      description: 'Starting at 6th level, your proficiency bonus is doubled for any ability check you make that uses your proficiency with a tool.',
      automatic: true
    },

    // LEVEL 7
    {
      level: 7,
      name: 'Flash of Genius',
      description: 'Starting at 7th level, you gain the ability to come up with solutions under pressure. When you or another creature you can see within 30 feet of you makes an ability check or a saving throw, you can use your reaction to add your Intelligence modifier to the roll.',
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
      name: 'Artificer Specialist Feature',
      description: 'At 9th level, you gain a feature granted by your Artificer Specialist.',
      automatic: true
    },

    // LEVEL 10
    {
      level: 10,
      name: 'Magic Item Adept',
      description: 'When you reach 10th level, you achieve a profound understanding of how to use and make magic items: You can attune to up to four magic items at once. If you craft a magic item with a rarity of common or uncommon, it takes you a quarter of the normal time, and it costs you half as much of the usual gold.',
      automatic: true
    },

    // LEVEL 11
    {
      level: 11,
      name: 'Spell-Storing Item',
      description: 'At 11th level, you learn how to store a spell in an object. Whenever you finish a long rest, you can touch one simple or martial weapon or one item that you can use as a spellcasting focus, and you store a spell in it. The spell must be one you know, and it must have a level of 1st or 2nd.',
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
      name: 'Artificer Specialist Feature',
      description: 'At 13th level, you gain a feature granted by your Artificer Specialist.',
      automatic: true
    },

    // LEVEL 14
    {
      level: 14,
      name: 'Magic Item Savant',
      description: 'At 14th level, your skill with magic items deepens more: You can attune to up to five magic items at once. You ignore all class, race, spell, and level requirements on attuning to or using a magic item.',
      automatic: true
    },

    // LEVEL 15
    {
      level: 15,
      name: 'Artificer Specialist Feature',
      description: 'At 15th level, you gain a feature granted by your Artificer Specialist.',
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
      name: 'Artificer Specialist Feature',
      description: 'At 17th level, you gain a feature granted by your Artificer Specialist.',
      automatic: true
    },

    // LEVEL 18
    {
      level: 18,
      name: 'Magic Item Master',
      description: 'At 18th level, you can attune to up to six magic items at once.',
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
      name: 'Soul of Artifice',
      description: 'At 20th level, you develop a mystical connection to your magic items, which you can draw on for protection: You gain a +1 bonus to all saving throws per magic item you are currently attuned to. Each magic item you are attuned to counts as one item, even if it normally counts as more than one item for the purpose of determining how many items you can be attuned to.',
      automatic: true
    }
  ]
};