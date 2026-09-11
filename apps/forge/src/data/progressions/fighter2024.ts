/**
 * Fighter 2024 Class Progression (Levels 1-20)
 *
 * Complete level-by-level feature progression for the 2024 D&D Fighter class.
 * Includes all features, resources, and player choices required at each level.
 */

import { ClassProgression } from '../classProgression';

export const fighter2024Progression: ClassProgression = {
  classSlug: 'fighter',
  className: 'Fighter',
  edition: '2024',
  hitDie: 'd10',
  asiLevels: [4, 6, 8, 12, 14, 16, 19],
  subclassLevel: 3,
  features: [
    // LEVEL 1
    {
      level: 1,
      name: 'Fighting Style',
      description: 'You adopt a particular style of fighting as your specialty. Choose one Fighting Style option.',
      automatic: false,
      choices: [
        {
          type: 'fighting-style',
          description: 'Choose a Fighting Style: Archery, Defense, Dueling, Great Weapon Fighting, Protection, or Two-Weapon Fighting.',
          count: 1
        }
      ]
    },
    {
      level: 1,
      name: 'Second Wind',
      description: 'You have a limited well of stamina that you can draw on to protect yourself from harm. On your turn, you can use a bonus action to regain hit points equal to 1d10 + your fighter level. You can use this feature twice, regaining expended uses when you finish a short or long rest.',
      automatic: true,
      resources: [
        {
          id: 'second-wind',
          name: 'Second Wind',
          description: 'Regain 1d10 + fighter level HP as a bonus action',
          maxUses: 2,
          rechargeType: 'short-rest'
        }
      ]
    },
    {
      level: 1,
      name: 'Weapon Mastery',
      description: 'Your training with weapons allows you to use the mastery property of three kinds of simple or martial weapons of your choice. Whenever you finish a long rest, you can change which weapons you have mastery with.',
      automatic: true
    },

    // LEVEL 2
    {
      level: 2,
      name: 'Action Surge',
      description: 'You can push yourself beyond your normal limits for a moment. On your turn, you can take one additional action. Once you use this feature, you must finish a short or long rest before you can use it again.',
      automatic: true,
      resources: [
        {
          id: 'action-surge',
          name: 'Action Surge',
          description: 'Take one additional action on your turn',
          maxUses: 1,
          rechargeType: 'short-rest'
        }
      ]
    },
    {
      level: 2,
      name: 'Tactical Mind',
      description: 'You have developed the ability to quickly assess tactical situations. When you fail an ability check, you can expend a use of your Second Wind to push yourself toward success. Rather than regaining hit points, you roll 1d10 and add the number rolled to the ability check, potentially turning it into a success.',
      automatic: true
    },

    // LEVEL 3
    {
      level: 3,
      name: 'Fighter Subclass',
      description: 'Choose a Fighter subclass (also known as a Martial Archetype): Battle Master, Champion, Eldritch Knight, etc.',
      automatic: false,
      choices: [
        {
          type: 'subclass',
          description: 'Choose your Fighter subclass to gain specialized abilities.',
          count: 1
        }
      ]
    },

    // LEVEL 4 - ASI/FEAT
    {
      level: 4,
      name: 'Ability Score Improvement',
      description: 'You can increase one ability score by 2, or you can increase two ability scores by 1. Alternatively, you can take a feat.',
      automatic: false,
      choices: [
        {
          type: 'asi',
          description: 'Increase ability scores by a total of 2 points, or choose a feat.',
          count: 2
        }
      ]
    },

    // LEVEL 5
    {
      level: 5,
      name: 'Extra Attack',
      description: 'You can attack twice, instead of once, whenever you take the Attack action on your turn.',
      automatic: true
    },
    {
      level: 5,
      name: 'Tactical Shift',
      description: 'Whenever you activate your Second Wind with a bonus action, you can move up to half your speed without provoking opportunity attacks.',
      automatic: true
    },

    // LEVEL 6 - ASI/FEAT
    {
      level: 6,
      name: 'Ability Score Improvement',
      description: 'You can increase one ability score by 2, or you can increase two ability scores by 1. Alternatively, you can take a feat.',
      automatic: false,
      choices: [
        {
          type: 'asi',
          description: 'Increase ability scores by a total of 2 points, or choose a feat.',
          count: 2
        }
      ]
    },

    // LEVEL 7
    {
      level: 7,
      name: 'Subclass Feature',
      description: 'You gain a feature from your Fighter subclass.',
      automatic: true
    },

    // LEVEL 8 - ASI/FEAT
    {
      level: 8,
      name: 'Ability Score Improvement',
      description: 'You can increase one ability score by 2, or you can increase two ability scores by 1. Alternatively, you can take a feat.',
      automatic: false,
      choices: [
        {
          type: 'asi',
          description: 'Increase ability scores by a total of 2 points, or choose a feat.',
          count: 2
        }
      ]
    },

    // LEVEL 9
    {
      level: 9,
      name: 'Indomitable',
      description: 'You can reroll a saving throw that you fail. If you do so, you must use the new roll. You can use this feature once, regaining the ability to do so when you finish a long rest.',
      automatic: true,
      resources: [
        {
          id: 'indomitable',
          name: 'Indomitable',
          description: 'Reroll a failed saving throw',
          maxUses: 1,
          rechargeType: 'long-rest'
        }
      ]
    },
    {
      level: 9,
      name: 'Master of Armaments',
      description: 'You gain mastery with two additional kinds of weapons of your choice (for a total of five kinds of weapons).',
      automatic: true
    },

    // LEVEL 10
    {
      level: 10,
      name: 'Subclass Feature',
      description: 'You gain a feature from your Fighter subclass.',
      automatic: true
    },

    // LEVEL 11
    {
      level: 11,
      name: 'Extra Attack (2)',
      description: 'You can attack three times, instead of twice, whenever you take the Attack action on your turn.',
      automatic: true
    },

    // LEVEL 12 - ASI/FEAT
    {
      level: 12,
      name: 'Ability Score Improvement',
      description: 'You can increase one ability score by 2, or you can increase two ability scores by 1. Alternatively, you can take a feat.',
      automatic: false,
      choices: [
        {
          type: 'asi',
          description: 'Increase ability scores by a total of 2 points, or choose a feat.',
          count: 2
        }
      ]
    },

    // LEVEL 13
    {
      level: 13,
      name: 'Indomitable (2 uses)',
      description: 'You can use Indomitable twice between long rests.',
      automatic: true,
      resources: [
        {
          id: 'indomitable',
          name: 'Indomitable',
          description: 'Reroll a failed saving throw',
          maxUses: 2,
          rechargeType: 'long-rest'
        }
      ]
    },
    {
      level: 13,
      name: 'Studied Attacks',
      description: 'You study your opponents and learn from each attack you make. If you make an attack roll against a creature and miss, you have advantage on your next attack roll against that creature before the end of your next turn.',
      automatic: true
    },

    // LEVEL 14 - ASI/FEAT
    {
      level: 14,
      name: 'Ability Score Improvement',
      description: 'You can increase one ability score by 2, or you can increase two ability scores by 1. Alternatively, you can take a feat.',
      automatic: false,
      choices: [
        {
          type: 'asi',
          description: 'Increase ability scores by a total of 2 points, or choose a feat.',
          count: 2
        }
      ]
    },

    // LEVEL 15
    {
      level: 15,
      name: 'Subclass Feature',
      description: 'You gain a feature from your Fighter subclass.',
      automatic: true
    },

    // LEVEL 16 - ASI/FEAT
    {
      level: 16,
      name: 'Ability Score Improvement',
      description: 'You can increase one ability score by 2, or you can increase two ability scores by 1. Alternatively, you can take a feat.',
      automatic: false,
      choices: [
        {
          type: 'asi',
          description: 'Increase ability scores by a total of 2 points, or choose a feat.',
          count: 2
        }
      ]
    },

    // LEVEL 17
    {
      level: 17,
      name: 'Action Surge (2 uses)',
      description: 'You can use Action Surge twice before a rest, but only once on the same turn.',
      automatic: true,
      resources: [
        {
          id: 'action-surge',
          name: 'Action Surge',
          description: 'Take one additional action on your turn',
          maxUses: 2,
          rechargeType: 'short-rest'
        }
      ]
    },
    {
      level: 17,
      name: 'Indomitable (3 uses)',
      description: 'You can use Indomitable three times between long rests.',
      automatic: true,
      resources: [
        {
          id: 'indomitable',
          name: 'Indomitable',
          description: 'Reroll a failed saving throw',
          maxUses: 3,
          rechargeType: 'long-rest'
        }
      ]
    },

    // LEVEL 18
    {
      level: 18,
      name: 'Subclass Feature',
      description: 'You gain a feature from your Fighter subclass.',
      automatic: true
    },

    // LEVEL 19 - ASI/FEAT
    {
      level: 19,
      name: 'Ability Score Improvement',
      description: 'You can increase one ability score by 2, or you can increase two ability scores by 1. Alternatively, you can take a feat.',
      automatic: false,
      choices: [
        {
          type: 'asi',
          description: 'Increase ability scores by a total of 2 points, or choose a feat.',
          count: 2
        }
      ]
    },
    {
      level: 19,
      name: 'Epic Boon',
      description: 'You gain one Epic Boon feat of your choice, representing a supernatural gift from your adventuring experiences.',
      automatic: false,
      choices: [
        {
          type: 'feat',
          description: 'Choose an Epic Boon feat.',
          count: 1
        }
      ]
    },

    // LEVEL 20
    {
      level: 20,
      name: 'Extra Attack (3)',
      description: 'You can attack four times, instead of three times, whenever you take the Attack action on your turn.',
      automatic: true
    }
  ]
};
