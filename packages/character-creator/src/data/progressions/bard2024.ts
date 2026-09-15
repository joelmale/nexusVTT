/**
 * Bard 2024 Class Progression (Levels 1-20)
 *
 * Complete level-by-level feature progression for the 2024 D&D Bard class.
 * Includes all features, resources, and player choices required at each level.
 */

import { ClassProgression } from '../classProgression';

export const bard2024Progression: ClassProgression = {
  classSlug: 'bard',
  className: 'Bard',
  edition: '2024',
  hitDie: 'd8',
  asiLevels: [4, 8, 12, 16, 19],
  subclassLevel: 3,
  features: [
    // LEVEL 1
    {
      level: 1,
      name: 'Spellcasting',
      description: 'You have learned to untangle and reshape the fabric of reality in harmony with your wishes and music. Your spells are part of your vast repertoire, magic that you can tune to different situations. See chapter 10 for the general rules of spellcasting and chapter 11 for the bard spell list.',
      automatic: true
    },
    {
      level: 1,
      name: 'Bardic Inspiration',
      description: 'You can inspire others through stirring words or music. To do so, you use a bonus action on your turn to choose one creature other than yourself within 60 feet of you who can hear you. That creature gains one Bardic Inspiration die, a d6. Once within the next 10 minutes, the creature can roll the die and add the number rolled to one ability check, attack roll, or saving throw it makes. The creature can wait until after it rolls the d20 before deciding to use the Bardic Inspiration die, but must decide before the DM says whether the roll succeeds or fails. Once the Bardic Inspiration die is rolled, it is lost. A creature can have only one Bardic Inspiration die at a time. You can use this feature a number of times equal to your Charisma modifier (a minimum of once). You regain any expended uses when you finish a long rest.',
      automatic: true,
      resources: [
        {
          id: 'bardic-inspiration',
          name: 'Bardic Inspiration',
          description: 'Inspire allies with bonus action',
          maxUses: 3, // Scales with Charisma modifier, minimum 1
          rechargeType: 'long-rest'
        }
      ]
    },

    // LEVEL 2
    {
      level: 2,
      name: 'Jack of All Trades',
      description: 'Starting at 2nd level, you can add half your proficiency bonus, rounded down, to any ability check you make that doesn\'t already include your proficiency bonus.',
      automatic: true
    },
    {
      level: 2,
      name: 'Song of Rest',
      description: 'Beginning at 2nd level, you can use soothing music or oration to help revitalize your wounded allies during a short rest. If you or any friendly creatures who can hear your performance regain hit points at the end of the short rest by spending one or more Hit Dice, each of those creatures regains an extra 1d6 hit points.',
      automatic: true
    },

    // LEVEL 3
    {
      level: 3,
      name: 'Bard College',
      description: 'At 3rd level, you delve into the advanced techniques of a bard college of your choice. Choose one of the following options.',
      automatic: false,
      choices: [
        {
          type: 'subclass',
          description: 'Choose a Bard College: College of Valor, College of Lore, or College of Glamour.',
          count: 1
        }
      ]
    },
    {
      level: 3,
      name: 'Expertise',
      description: 'At 3rd level, choose two of your skill proficiencies. Your proficiency bonus is doubled for any ability check you make that uses either of the chosen proficiencies. At 10th level, you can choose another two skill proficiencies to gain this benefit.',
      automatic: false,
      choices: [
        {
          type: 'skill-expertise',
          description: 'Choose two skills for Expertise.',
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
      name: 'Font of Inspiration',
      description: 'Beginning when you reach 5th level, you regain all of your expended uses of Bardic Inspiration when you finish a short or long rest.',
      automatic: true
    },

    // LEVEL 6
    {
      level: 6,
      name: 'Countercharm',
      description: 'At 6th level, you gain the ability to use musical notes or words of power to disrupt mind-influencing effects. As an action, you can start a performance that lasts until the end of your next turn. During that time, you and any friendly creatures within 30 feet of you have advantage on saving throws against being frightened or charmed. A creature must be able to hear you to gain this benefit. The performance ends early if you are incapacitated or silenced or if you voluntarily end it (no action required).',
      automatic: true
    },

    // LEVEL 7
    {
      level: 7,
      name: 'Magical Secrets',
      description: 'By 7th level, you have plundered magical knowledge from a wide spectrum of disciplines. Choose two spells from any class, including this one. A spell you choose must be of a level you can cast, as shown on the Bard table. The chosen spells count as bard spells for you and are included in the number in the Spells Known column of the Bard table.',
      automatic: false,
      choices: [
        {
          type: 'spells',
          description: 'Choose two spells from any class as Magical Secrets.',
          count: 2
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
      name: 'Song of Rest Improvement',
      description: 'When you use your Song of Rest feature, you can choose any creatures during the rest, not just creatures that regain hit points from spending Hit Dice.',
      automatic: true
    },

    // LEVEL 10
    {
      level: 10,
      name: 'Bardic Inspiration Improvement',
      description: 'At 10th level, your Bardic Inspiration die changes to a d8.',
      automatic: true
    },
    {
      level: 10,
      name: 'Expertise Improvement',
      description: 'At 10th level, you can choose another two skill proficiencies to gain the benefit of Expertise.',
      automatic: false,
      choices: [
        {
          type: 'skill-expertise',
          description: 'Choose two additional skills for Expertise.',
          count: 2
        }
      ]
    },
    {
      level: 10,
      name: 'Magical Secrets Improvement',
      description: 'At 10th level, you learn two additional spells from any class. These spells count as bard spells for you.',
      automatic: false,
      choices: [
        {
          type: 'spells',
          description: 'Choose two additional spells from any class as Magical Secrets.',
          count: 2
        }
      ]
    },

    // LEVEL 11
    {
      level: 11,
      name: 'Superior Inspiration',
      description: 'At 11th level, when any ally who has a Bardic Inspiration die from you rolls it to add to their d20 test but the roll fails, they can keep the die. They can roll it again and choose which roll to use.',
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
      name: 'Song of Rest Improvement',
      description: 'At 13th level, the extra hit points from Song of Rest increase to 1d8.',
      automatic: true
    },

    // LEVEL 14
    {
      level: 14,
      name: 'Magical Secrets Improvement',
      description: 'At 14th level, you learn two additional spells from any class. These spells count as bard spells for you.',
      automatic: false,
      choices: [
        {
          type: 'spells',
          description: 'Choose two additional spells from any class as Magical Secrets.',
          count: 2
        }
      ]
    },

    // LEVEL 15
    {
      level: 15,
      name: 'Bardic Inspiration Improvement',
      description: 'At 15th level, your Bardic Inspiration die changes to a d10.',
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
      name: 'Song of Rest Improvement',
      description: 'At 17th level, the extra hit points from Song of Rest increase to 1d10.',
      automatic: true
    },

    // LEVEL 18
    {
      level: 18,
      name: 'Magical Secrets Improvement',
      description: 'At 18th level, you learn two additional spells from any class. These spells count as bard spells for you.',
      automatic: false,
      choices: [
        {
          type: 'spells',
          description: 'Choose two additional spells from any class as Magical Secrets.',
          count: 2
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
      name: 'Superior Inspiration Improvement',
      description: 'At 20th level, when an ally uses a Bardic Inspiration die and the roll is a 1 on the d20, they can keep the Inspiration die.',
      automatic: true
    }
  ]
};