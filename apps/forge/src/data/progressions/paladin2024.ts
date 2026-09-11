/**
 * Paladin 2024 Class Progression (Levels 1-20)
 *
 * Complete level-by-level feature progression for the 2024 D&D Paladin class.
 * Includes all features, resources, and player choices required at each level.
 */

import { ClassProgression } from '../classProgression';

export const paladin2024Progression: ClassProgression = {
  classSlug: 'paladin',
  className: 'Paladin',
  edition: '2024',
  hitDie: 'd10',
  asiLevels: [4, 8, 12, 16, 19],
  subclassLevel: 3,
  features: [
    // LEVEL 1
    {
      level: 1,
      name: 'Divine Sense',
      description: 'The presence of strong evil registers on your senses like a noxious odor, and powerful good rings like heavenly music in your ears. As an action, you can open your awareness to detect such forces. Until the end of your next turn, you know the location of any celestial, fiend, or undead within 60 feet of you that is not behind total cover. You know the type (celestial, fiend, or undead) of any being whose presence you sense, but not its identity. Within the same radius, you also detect the presence of any place or object that has been consecrated or desecrated, as with the hallow spell. You can use this feature a number of times equal to 1 + your Charisma modifier. When you finish a long rest, you regain all expended uses.',
      automatic: true,
      resources: [
        {
          id: 'divine-sense',
          name: 'Divine Sense',
          description: 'Detect celestials, fiends, and undead within 60 feet',
          maxUses: 1, // Will be modified by CHA modifier
          rechargeType: 'long-rest'
        }
      ]
    },
    {
      level: 1,
      name: 'Lay on Hands',
      description: 'Your blessed touch can heal wounds. You have a pool of healing power that replenishes when you take a long rest. With that pool, you can restore a total number of hit points equal to your paladin level × 5. As an action, you can touch a creature and draw power from the pool to restore a number of hit points to that creature, up to the maximum amount remaining in your pool. Alternatively, you can expend 5 hit points from your pool of healing to cure the target of one disease or neutralize one poison affecting it. You can cure multiple diseases and neutralize multiple poisons with a single use of Lay on Hands, expending hit points separately for each one.',
      automatic: true,
      resources: [
        {
          id: 'lay-on-hands',
          name: 'Lay on Hands',
          description: 'Pool of healing equal to paladin level × 5 HP',
          maxUses: 5, // Will be modified by level
          rechargeType: 'long-rest'
        }
      ]
    },
    {
      level: 1,
      name: 'Weapon Mastery',
      description: 'Your training with weapons allows you to use the mastery property of two kinds of weapons of your choice. Whenever you finish a Long Rest, you can practice weapon drills and change one of those weapon choices.',
      automatic: true
    },

    // LEVEL 2
    {
      level: 2,
      name: 'Fighting Style',
      description: 'You adopt a particular style of fighting as your specialty. Choose one Fighting Style option.',
      automatic: false,
      choices: [
        {
          type: 'fighting-style',
          description: 'Choose a Fighting Style: Blessed Warrior, Blind Fighting, Defense, Dueling, Great Weapon Fighting, Interception, Protection, or Two-Weapon Fighting.',
          count: 1
        }
      ]
    },
    {
      level: 2,
      name: 'Spellcasting',
      description: 'By 2nd level, you have learned to draw on divine magic through meditation and prayer to cast spells as a cleric does.',
      automatic: true
    },
    {
      level: 2,
      name: 'Paladin Spells',
      description: 'You learn two paladin spells of your choice.',
      automatic: false,
      choices: [
        {
          type: 'spells',
          description: 'Choose 2 paladin spells to learn',
          count: 2
        }
      ]
    },
    {
      level: 2,
      name: 'Divine Smite',
      description: 'When you hit a creature with a melee weapon attack, you can expend one spell slot to deal radiant damage to the target, in addition to the weapon\'s damage. The extra damage is 2d8 for a 1st-level spell slot, plus 1d8 for each spell level higher than 1st, to a maximum of 5d8. The damage increases by 1d8 if the target is an undead or a fiend.',
      automatic: true
    },

    // LEVEL 3
    {
      level: 3,
      name: 'Paladin Subclass',
      description: 'Choose a Paladin subclass (also known as an Oath): Oath of the Ancients, Oath of Conquest, Oath of Devotion, Oath of the Crown, Oath of Glory, Oath of Redemption, Oath of Vengeance, etc.',
      automatic: false,
      choices: [
        {
          type: 'subclass',
          description: 'Choose your Paladin subclass to gain specialized abilities.',
          count: 1
        }
      ]
    },
    {
      level: 3,
      name: 'Aura of Protection',
      description: 'Whenever you or a friendly creature within 10 feet of you must make a saving throw, the creature gains a bonus to the saving throw equal to your Charisma modifier (with a minimum bonus of +1). You must be conscious to grant this bonus.',
      automatic: true
    },
    {
      level: 3,
      name: 'Paladin Spells',
      description: 'You learn two paladin spells of your choice.',
      automatic: false,
      choices: [
        {
          type: 'spells',
          description: 'Choose 2 paladin spells to learn',
          count: 2
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
    {
      level: 4,
      name: 'Paladin Spells',
      description: 'You learn one paladin spell of your choice.',
      automatic: false,
      choices: [
        {
          type: 'spells',
          description: 'Choose 1 paladin spell to learn',
          count: 1
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
      name: 'Paladin Spells',
      description: 'You learn two paladin spells of your choice.',
      automatic: false,
      choices: [
        {
          type: 'spells',
          description: 'Choose 2 paladin spells to learn',
          count: 2
        }
      ]
    },

    // LEVEL 6
    {
      level: 6,
      name: 'Aura of Protection Improvement',
      description: 'The range of your Aura of Protection increases to 30 feet.',
      automatic: true
    },

    // LEVEL 7
    {
      level: 7,
      name: 'Aura of Courage',
      description: 'You and friendly creatures within 10 feet of you can\'t be frightened while you are conscious.',
      automatic: true
    },
    {
      level: 7,
      name: 'Paladin Spells',
      description: 'You learn two paladin spells of your choice.',
      automatic: false,
      choices: [
        {
          type: 'spells',
          description: 'Choose 2 paladin spells to learn',
          count: 2
        }
      ]
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
      name: 'Subclass Feature',
      description: 'You gain a feature from your Paladin subclass.',
      automatic: true
    },
    {
      level: 9,
      name: 'Paladin Spells',
      description: 'You learn two paladin spells of your choice.',
      automatic: false,
      choices: [
        {
          type: 'spells',
          description: 'Choose 2 paladin spells to learn',
          count: 2
        }
      ]
    },

    // LEVEL 10
    {
      level: 10,
      name: 'Aura of Courage Improvement',
      description: 'The range of your Aura of Courage increases to 30 feet.',
      automatic: true
    },

    // LEVEL 11
    {
      level: 11,
      name: 'Improved Divine Smite',
      description: 'Your Divine Smite now deals an extra 1d8 radiant damage to undead and fiends.',
      automatic: true
    },
    {
      level: 11,
      name: 'Paladin Spells',
      description: 'You learn two paladin spells of your choice.',
      automatic: false,
      choices: [
        {
          type: 'spells',
          description: 'Choose 2 paladin spells to learn',
          count: 2
        }
      ]
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
      name: 'Subclass Feature',
      description: 'You gain a feature from your Paladin subclass.',
      automatic: true
    },
    {
      level: 13,
      name: 'Paladin Spells',
      description: 'You learn two paladin spells of your choice.',
      automatic: false,
      choices: [
        {
          type: 'spells',
          description: 'Choose 2 paladin spells to learn',
          count: 2
        }
      ]
    },

    // LEVEL 14
    {
      level: 14,
      name: 'Cleansing Touch',
      description: 'You can use your action to end one spell on yourself or on one willing creature that you touch. You can use this feature a number of times equal to your Charisma modifier (a minimum of once). You regain expended uses when you finish a long rest.',
      automatic: true,
      resources: [
        {
          id: 'cleansing-touch',
          name: 'Cleansing Touch',
          description: 'End one spell on yourself or a willing creature',
          maxUses: 1, // Will be modified by CHA modifier
          rechargeType: 'long-rest'
        }
      ]
    },

    // LEVEL 15
    {
      level: 15,
      name: 'Subclass Feature',
      description: 'You gain a feature from your Paladin subclass.',
      automatic: true
    },
    {
      level: 15,
      name: 'Paladin Spells',
      description: 'You learn two paladin spells of your choice.',
      automatic: false,
      choices: [
        {
          type: 'spells',
          description: 'Choose 2 paladin spells to learn',
          count: 2
        }
      ]
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
      name: 'Aura of Courage Improvement',
      description: 'The range of your Aura of Courage increases to the entire battlefield (no range limit).',
      automatic: true
    },
    {
      level: 17,
      name: 'Paladin Spells',
      description: 'You learn two paladin spells of your choice.',
      automatic: false,
      choices: [
        {
          type: 'spells',
          description: 'Choose 2 paladin spells to learn',
          count: 2
        }
      ]
    },

    // LEVEL 18
    {
      level: 18,
      name: 'Subclass Feature',
      description: 'You gain a feature from your Paladin subclass.',
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
    {
      level: 19,
      name: 'Paladin Spells',
      description: 'You learn two paladin spells of your choice.',
      automatic: false,
      choices: [
        {
          type: 'spells',
          description: 'Choose 2 paladin spells to learn',
          count: 2
        }
      ]
    },

    // LEVEL 20
    {
      level: 20,
      name: 'Subclass Feature',
      description: 'You gain a feature from your Paladin subclass.',
      automatic: true
    }
  ]
};