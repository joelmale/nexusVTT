/**
 * Monk 2024 Class Progression (Levels 1-20)
 *
 * Complete level-by-level feature progression for the 2024 D&D Monk class.
 * Includes all features, resources, and player choices required at each level.
 */

import { ClassProgression } from '../classProgression';

export const monk2024Progression: ClassProgression = {
  classSlug: 'monk',
  className: 'Monk',
  edition: '2024',
  hitDie: 'd8',
  asiLevels: [4, 8, 12, 16, 19],
  subclassLevel: 3,
  features: [
    // LEVEL 1
    {
      level: 1,
      name: 'Unarmored Defense',
      description: 'Beginning at 1st level, while you are wearing no armor and not wielding a shield, your AC equals 10 + your Dexterity modifier + your Wisdom modifier.',
      automatic: true
    },
    {
      level: 1,
      name: 'Martial Arts',
      description: 'At 1st level, your practice of martial arts gives you mastery of combat styles that use unarmed strikes and monk weapons, which are shortswords and any simple melee weapons that don\'t have the two-handed or heavy property. You gain the following benefits while you are unarmed or wielding only monk weapons and you aren\'t wearing armor or wielding a shield: You can use Dexterity instead of Strength for the attack and damage rolls of your unarmed strikes and monk weapons. You can roll a d4 in place of the normal damage of your unarmed strike or monk weapon.',
      automatic: true
    },

    // LEVEL 2
    {
      level: 2,
      name: 'Ki',
      description: 'Starting at 2nd level, your training allows you to harness the mystic energy of ki. Your access to this energy is represented by a number of ki points. Your monk level determines the number of points you have, as shown in the Ki Points column of the Monk table. You can spend these points to fuel various ki features. You start knowing three such features: Flurry of Blows, Patient Defense, and Step of the Wind. You learn more ki features as you gain levels in this class. When you spend a ki point, it is unavailable until you finish a short or long rest, at the end of which you draw all of your expended ki back into yourself. You must spend at least 30 minutes of the rest meditating to regain your ki points.',
      automatic: true,
      resources: [
        {
          id: 'ki',
          name: 'Ki Points',
          description: 'Mystic energy points for ki features',
          maxUses: 2, // Scales with level
          rechargeType: 'short-rest'
        }
      ]
    },
    {
      level: 2,
      name: 'Unarmored Movement',
      description: 'Starting at 2nd level, your speed increases by 10 feet while you are not wearing armor or wielding a shield. This bonus increases when you reach certain monk levels.',
      automatic: true
    },

    // LEVEL 3
    {
      level: 3,
      name: 'Monastic Tradition',
      description: 'When you reach 3rd level, you commit yourself to a monastic tradition. Choose one of the following options.',
      automatic: false,
      choices: [
        {
          type: 'subclass',
          description: 'Choose a Monastic Tradition: Way of the Open Hand, Way of Shadow, Way of the Four Elements, or Way of Mercy.',
          count: 1
        }
      ]
    },
    {
      level: 3,
      name: 'Deflect Missiles',
      description: 'Starting at 3rd level, you can use your reaction to deflect or catch the missile when you are hit by a ranged weapon attack. When you do so, the damage you take from the attack is reduced by 1d10 + your Dexterity modifier + your monk level.',
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
      name: 'Extra Attack',
      description: 'Beginning at 5th level, you can attack twice, instead of once, whenever you take the Attack action on your turn.',
      automatic: true
    },
    {
      level: 5,
      name: 'Stunning Strike',
      description: 'Starting at 5th level, you can interfere with the flow of ki in an opponent\'s body. When you hit another creature with a melee weapon attack, you can spend 1 ki point to attempt a stunning strike. The target must succeed on a Constitution saving throw or be stunned until the end of your next turn.',
      automatic: true
    },

    // LEVEL 6
    {
      level: 6,
      name: 'Ki-Empowered Strikes',
      description: 'Starting at 6th level, your unarmed strikes count as magical for the purpose of overcoming resistance and immunity to nonmagical attacks and damage.',
      automatic: true
    },

    // LEVEL 7
    {
      level: 7,
      name: 'Evasion',
      description: 'At 7th level, your instinctive agility lets you dodge out of the way of certain area effects. When you are subjected to an effect that allows you to make a Dexterity saving throw to take only half damage, you instead take no damage if you succeed on the saving throw, and only half damage if you fail.',
      automatic: true
    },
    {
      level: 7,
      name: 'Stillness of Mind',
      description: 'Starting at 7th level, you can use your action to end one effect on yourself that is causing you to be charmed or frightened.',
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
      name: 'Unarmored Movement Improvement',
      description: 'At 9th level, you gain the ability to move along vertical surfaces and across liquids on your turn without falling during the move.',
      automatic: true
    },

    // LEVEL 10
    {
      level: 10,
      name: 'Purity of Body',
      description: 'At 10th level, your mastery of the ki flowing through you makes you immune to disease and poison.',
      automatic: true
    },

    // LEVEL 11
    {
      level: 11,
      name: 'Tongue of the Sun and Moon',
      description: 'Starting at 11th level, you learn to touch the ki of other minds so that you understand all spoken languages. Moreover, any creature that can understand a language can understand what you say.',
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
      name: 'Diamond Soul',
      description: 'Beginning at 13th level, your mastery of ki grants you proficiency in all saving throws. Additionally, whenever you make a saving throw and fail, you can spend 1 ki point to reroll it and take the second result.',
      automatic: true
    },

    // LEVEL 14
    {
      level: 14,
      name: 'Empty Body',
      description: 'Beginning at 14th level, you can use your action to spend 4 ki points to become invisible for 1 minute. During that time, you also have resistance to all damage but force damage. Additionally, you can spend 8 ki points to cast the astral projection spell, without needing material components. When you do so, you can\'t take any other creatures with you.',
      automatic: true
    },

    // LEVEL 15
    {
      level: 15,
      name: 'Timeless Body',
      description: 'At 15th level, your ki sustains you so that you suffer none of the frailty of old age, and you can\'t be aged magically. You can still die of old age, however. In addition, you no longer need food or water.',
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
      name: 'Quivering Palm',
      description: 'At 17th level, you gain the ability to set up lethal vibrations in someone\'s body. When you hit a creature with an unarmed strike, you can spend 3 ki points to start these imperceptible vibrations, which last for a number of days equal to your monk level. The vibrations are harmless unless you use your action to end them. To do so, you and the target must be on the same plane of existence. When you use this action, the creature must make a Constitution saving throw. If it fails, it is reduced to 0 hit points. If it succeeds, it takes 10d10 necrotic damage. You can have only one creature under the effect of this feature at a time. You can choose to end the vibrations harmlessly without using an action.',
      automatic: true
    },

    // LEVEL 18
    {
      level: 18,
      name: 'Empty Body Improvement',
      description: 'At 18th level, you can use Empty Body while you have 0 ki points.',
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
      name: 'Perfect Self',
      description: 'At 20th level, when you roll for initiative and have no ki points remaining, you regain 4 ki points.',
      automatic: true
    }
  ]
};