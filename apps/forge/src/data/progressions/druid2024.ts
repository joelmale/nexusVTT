/**
 * Druid 2024 Class Progression (Levels 1-20)
 *
 * Complete level-by-level feature progression for the 2024 D&D Druid class.
 * Includes all features, resources, and player choices required at each level.
 */

import { ClassProgression } from '../classProgression';

export const druid2024Progression: ClassProgression = {
  classSlug: 'druid',
  className: 'Druid',
  edition: '2024',
  hitDie: 'd8',
  asiLevels: [4, 8, 12, 16, 19],
  subclassLevel: 2,
  features: [
    // LEVEL 1
    {
      level: 1,
      name: 'Druidic',
      description: 'You know Druidic, the secret language of druids. You can speak the language and use it to leave hidden messages. You and others who know this language automatically spot such a message. Others spot the message\'s presence with a successful DC 15 Intelligence (Investigation) check but can\'t decipher it without magic.',
      automatic: true
    },
    {
      level: 1,
      name: 'Spellcasting',
      description: 'Drawing on the divine essence of nature itself, you can cast spells to shape that essence to your will. See chapter 10 for the general rules of spellcasting and chapter 11 for the druid spell list.',
      automatic: true
    },

    // LEVEL 2
    {
      level: 2,
      name: 'Wild Shape',
      description: 'Starting at 2nd level, you can use your action to magically assume the shape of a beast that you have seen before. You can use this feature twice. You regain expended uses when you finish a short or long rest.',
      automatic: true,
      choices: [
        {
          type: 'wild-shape',
          description: 'Choose a beast form for Wild Shape.',
          count: 1
        }
      ],
      resources: [
        {
          id: 'wild-shape',
          name: 'Wild Shape',
          description: 'Transform into a beast',
          maxUses: 2,
          rechargeType: 'short-rest'
        }
      ]
    },
    {
      level: 2,
      name: 'Druid Circle',
      description: 'At 2nd level, you choose to identify with a circle of druids. Your choice grants you features at 2nd level and again at 6th, 10th, and 14th level.',
      automatic: false,
      choices: [
        {
          type: 'subclass',
          description: 'Choose a Druid Circle: Circle of the Land, Circle of the Moon, or Circle of the Shepherd.',
          count: 1
        }
      ]
    },

    // LEVEL 3
    {
      level: 3,
      name: 'Spellcasting Improvement',
      description: 'The spells you can cast as a 3rd-level druid are expanded.',
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
      name: 'Wild Shape Improvement',
      description: 'You can use your Wild Shape feature three times.',
      automatic: true
    },

    // LEVEL 6
    {
      level: 6,
      name: 'Druid Circle Feature',
      description: 'At 6th level, you gain a feature granted by your Druid Circle.',
      automatic: true
    },

    // LEVEL 7
    {
      level: 7,
      name: 'Spellcasting Improvement',
      description: 'The spells you can cast as a 7th-level druid are expanded.',
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
      name: 'Spellcasting Improvement',
      description: 'The spells you can cast as a 9th-level druid are expanded.',
      automatic: true
    },

    // LEVEL 10
    {
      level: 10,
      name: 'Druid Circle Feature',
      description: 'At 10th level, you gain a feature granted by your Druid Circle.',
      automatic: true
    },
    {
      level: 10,
      name: 'Wild Shape Improvement',
      description: 'You can use your Wild Shape feature four times.',
      automatic: true
    },

    // LEVEL 11
    {
      level: 11,
      name: 'Spellcasting Improvement',
      description: 'The spells you can cast as an 11th-level druid are expanded.',
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
      name: 'Spellcasting Improvement',
      description: 'The spells you can cast as a 13th-level druid are expanded.',
      automatic: true
    },

    // LEVEL 14
    {
      level: 14,
      name: 'Druid Circle Feature',
      description: 'At 14th level, you gain a feature granted by your Druid Circle.',
      automatic: true
    },

    // LEVEL 15
    {
      level: 15,
      name: 'Spellcasting Improvement',
      description: 'The spells you can cast as a 15th-level druid are expanded.',
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
      name: 'Spellcasting Improvement',
      description: 'The spells you can cast as a 17th-level druid are expanded.',
      automatic: true
    },

    // LEVEL 18
    {
      level: 18,
      name: 'Timeless Body',
      description: 'Starting at 18th level, the primal magic that you wield causes you to age more slowly. For every 10 years that pass, your body ages only 1 year.',
      automatic: true
    },
    {
      level: 18,
      name: 'Beast Spells',
      description: 'Beginning at 18th level, you can cast many of your druid spells in any shape you assume using Wild Shape. You can perform the somatic and verbal components of a druid spell while in a beast shape, but you aren\'t able to provide material components.',
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
      name: 'Archdruid',
      description: 'At 20th level, you can use your Wild Shape an unlimited number of times. Additionally, you can ignore the verbal and somatic components of your druid spells, as well as any material components that lack a cost and aren\'t consumed by a spell. You gain this benefit in both your normal shape and your beast shape from Wild Shape.',
      automatic: true
    }
  ]
};