/**
 * Barbarian 2024 Class Progression (Levels 1-20)
 *
 * Complete level-by-level feature progression for the 2024 D&D Barbarian class.
 * Includes all features, resources, and player choices required at each level.
 */

import { ClassProgression } from '../classProgression';

export const barbarian2024Progression: ClassProgression = {
  classSlug: 'barbarian',
  className: 'Barbarian',
  edition: '2024',
  hitDie: 'd12',
  asiLevels: [4, 8, 12, 16, 19],
  subclassLevel: 3,
  features: [
    // LEVEL 1
    {
      level: 1,
      name: 'Rage',
      description: 'In battle, you fight with primal ferocity. On your turn, you can enter a rage as a bonus action. While raging, you gain several benefits. Your rage lasts for 1 minute. It ends early if you are knocked unconscious or if your turn ends and you haven\'t attacked a hostile creature since your last turn or taken damage since then. You can also end your rage on your turn as a bonus action. Once you have raged a number of times equal to your proficiency bonus, you must finish a long rest before you can rage again.',
      automatic: true,
      resources: [
        {
          id: 'rage',
          name: 'Rage',
          description: 'Enter a primal rage for combat bonuses',
          maxUses: 2, // Scales with proficiency bonus
          rechargeType: 'long-rest'
        }
      ]
    },
    {
      level: 1,
      name: 'Unarmored Defense',
      description: 'While you are not wearing any armor, your Armor Class equals 10 + your Dexterity modifier + your Constitution modifier. You can use a shield and still gain this benefit.',
      automatic: true
    },

    // LEVEL 2
    {
      level: 2,
      name: 'Danger Sense',
      description: 'You have advantage on Dexterity saving throws against effects that you can see, such as traps and spells. To gain this benefit, you can\'t be blinded, deafened, or incapacitated.',
      automatic: true
    },
    {
      level: 2,
      name: 'Reckless Attack',
      description: 'When you make your first attack on your turn, you can decide to attack recklessly, giving you advantage on melee weapon attack rolls using Strength during this turn, but attack rolls against you have advantage until your next turn.',
      automatic: true
    },

    // LEVEL 3
    {
      level: 3,
      name: 'Primal Path',
      description: 'You choose a path that shapes the nature of your rage. Choose one of the following options.',
      automatic: false,
      choices: [
        {
          type: 'subclass',
          description: 'Choose a Primal Path: Path of the Berserker, Path of the Totem Warrior, or Path of the Ancestral Guardian.',
          count: 1
        }
      ]
    },

    // LEVEL 4 - ASI
    {
      level: 4,
      name: 'Ability Score Improvement',
      description: 'You can increase one ability score by 2, or you can increase two ability scores by 1. As normal, you can\'t increase an ability score above 20 using this feature.',
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
      name: 'Extra Attack',
      description: 'You can attack twice, instead of once, whenever you take the Attack action on your turn.',
      automatic: true
    },
    {
      level: 5,
      name: 'Fast Movement',
      description: 'Your speed increases by 10 feet while you aren\'t wearing heavy armor.',
      automatic: true
    },

    // LEVEL 6
    {
      level: 6,
      name: 'Feral Instinct',
      description: 'Your instincts are so honed that you have advantage on initiative rolls. Additionally, if you are surprised at the beginning of combat and aren\'t incapacitated, you can act normally on your first turn, but only if you enter your rage before doing anything else on that turn.',
      automatic: true
    },

    // LEVEL 7
    {
      level: 7,
      name: 'Instinctive Pounce',
      description: 'As part of the bonus action you take to enter your rage, you can move up to half your speed.',
      automatic: true
    },

    // LEVEL 8 - ASI
    {
      level: 8,
      name: 'Ability Score Improvement',
      description: 'You can increase one ability score by 2, or you can increase two ability scores by 1. As normal, you can\'t increase an ability score above 20 using this feature.',
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
      name: 'Brutal Critical',
      description: 'You can roll one additional weapon damage die when determining the extra damage for a critical hit with a melee attack.',
      automatic: true
    },

    // LEVEL 10
    {
      level: 10,
      name: 'Relentless Rage',
      description: 'When you drop to 0 hit points while you\'re raging and don\'t die outright, you can make a DC 10 Constitution saving throw. If you succeed, you drop to 1 hit point instead. Each time you use this feature after the first, the DC increases by 5. When you finish a short or long rest, the DC resets to 10.',
      automatic: true
    },

    // LEVEL 11
    {
      level: 11,
      name: 'Relentless',
      description: 'Your rage can keep you fighting despite grievous wounds. If you drop to 0 hit points while you\'re raging and don\'t die outright, you can make a DC 10 Constitution saving throw. If you succeed, you drop to 1 hit point instead.',
      automatic: true
    },

    // LEVEL 12 - ASI
    {
      level: 12,
      name: 'Ability Score Improvement',
      description: 'You can increase one ability score by 2, or you can increase two ability scores by 1. As normal, you can\'t increase an ability score above 20 using this feature.',
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
      name: 'Improved Brutal Critical',
      description: 'You can roll two additional weapon damage dice when determining the extra damage for a critical hit with a melee attack.',
      automatic: true
    },

    // LEVEL 14
    {
      level: 14,
      name: 'Persistent Rage',
      description: 'Your rage is so fierce that it ends early only if you fall unconscious or if you choose to end it.',
      automatic: true
    },

    // LEVEL 15
    {
      level: 15,
      name: 'Improved Critical',
      description: 'Your weapon attacks score a critical hit on a roll of 19 or 20.',
      automatic: true
    },

    // LEVEL 16 - ASI
    {
      level: 16,
      name: 'Ability Score Improvement',
      description: 'You can increase one ability score by 2, or you can increase two ability scores by 1. As normal, you can\'t increase an ability score above 20 using this feature.',
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
      name: 'Indomitable Might',
      description: 'If your total for a Strength check is less than your Strength score, you can use that score in place of the total.',
      automatic: true
    },

    // LEVEL 18
    {
      level: 18,
      name: 'Unstoppable',
      description: 'When you are reduced to 0 hit points by damage, you can use your reaction to make one melee weapon attack.',
      automatic: true
    },

    // LEVEL 19 - ASI
    {
      level: 19,
      name: 'Ability Score Improvement',
      description: 'You can increase one ability score by 2, or you can increase two ability scores by 1. As normal, you can\'t increase an ability score above 20 using this feature.',
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
      name: 'Primal Champion',
      description: 'You embody the power of the wilds. Your Strength and Constitution scores increase by 4. Your maximum for those scores is now 24.',
      automatic: true
    }
  ]
};