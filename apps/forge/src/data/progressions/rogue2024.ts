/**
 * Rogue 2024 Class Progression (Levels 1-20)
 *
 * Complete level-by-level feature progression for the 2024 D&D Rogue class.
 * Includes all features, resources, and player choices required at each level.
 */

import { ClassProgression } from '../classProgression';

export const rogue2024Progression: ClassProgression = {
  classSlug: 'rogue',
  className: 'Rogue',
  edition: '2024',
  hitDie: 'd8',
  asiLevels: [4, 8, 10, 12, 16, 19],
  subclassLevel: 3,
  features: [
    // LEVEL 1
    {
      level: 1,
      name: 'Expertise',
      description: 'At 1st level, choose two of your skill proficiencies, or one of your skill proficiencies and your proficiency with thieves\' tools. Your proficiency bonus is doubled for any ability check you make that uses either of the chosen proficiencies. At 6th level, you can choose two more of your proficiencies (in skills or thieves\' tools) to gain this benefit.',
      automatic: false,
      choices: [
        {
          type: 'skill-expertise',
          description: 'Choose two skills or one skill and thieves\' tools for Expertise.',
          count: 2
        }
      ]
    },
    {
      level: 1,
      name: 'Sneak Attack',
      description: 'Beginning at 1st level, you know how to strike subtly and exploit a foe\'s distraction. Once per turn, you can deal an extra 1d6 damage to one creature you hit with an attack if you have advantage on the attack roll. The attack must use a finesse or a ranged weapon. You don\'t need advantage on the attack roll if another enemy of the target is within 5 feet of it, that enemy isn\'t incapacitated, and you don\'t have disadvantage on the attack roll. The amount of the extra damage increases as you gain levels in this class, as shown in the Sneak Attack column of the Rogue table.',
      automatic: true,
      resources: [
        {
          id: 'sneak-attack',
          name: 'Sneak Attack',
          description: 'Extra damage on attacks with advantage or ally nearby',
          maxUses: 1,
          rechargeType: 'none'
        }
      ]
    },
    {
      level: 1,
      name: 'Thieves\' Cant',
      description: 'During your rogue training you learned thieves\' cant, a secret mix of dialect, jargon, and code that allows you to hide messages in seemingly normal conversation. Only another creature that knows thieves\' cant understands such messages. It takes four times longer to convey such a message than it does to speak the same idea plainly. In addition, you understand a set of secret signs and symbols used to convey short, simple messages, such as whether an area is dangerous or the territory of a thieves\' guild, whether loot is nearby, or whether the people in an area are easy marks or will provide a safe house for thieves on the run.',
      automatic: true
    },

    // LEVEL 2
    {
      level: 2,
      name: 'Cunning Action',
      description: 'Starting at 2nd level, your quick thinking and agility allow you to move and act quickly. You can take a bonus action on each of your turns in combat. This action can be used only to take the Dash, Disengage, or Hide action.',
      automatic: true
    },

    // LEVEL 3
    {
      level: 3,
      name: 'Roguish Archetype',
      description: 'At 3rd level, you choose an archetype that you emulate in the exercise of your rogue abilities. Choose one of the following options.',
      automatic: false,
      choices: [
        {
          type: 'subclass',
          description: 'Choose a Roguish Archetype: Thief, Assassin, Arcane Trickster, or Mastermind.',
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
      name: 'Uncanny Dodge',
      description: 'Starting at 5th level, when an attacker that you can see hits you with an attack, you can use your reaction to halve the attack\'s damage against you.',
      automatic: true
    },

    // LEVEL 6
    {
      level: 6,
      name: 'Expertise Improvement',
      description: 'At 6th level, you can choose two more of your proficiencies (in skills or thieves\' tools) to gain the benefit of Expertise.',
      automatic: false,
      choices: [
        {
          type: 'skill-expertise',
          description: 'Choose two additional skills or thieves\' tools for Expertise.',
          count: 2
        }
      ]
    },

    // LEVEL 7
    {
      level: 7,
      name: 'Evasion',
      description: 'Beginning at 7th level, you can nimbly dodge out of the way of certain area effects. When you are subjected to an effect that allows you to make a Dexterity saving throw to take only half damage, you instead take no damage if you succeed on the saving throw, and only half damage if you fail.',
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
      name: 'Supreme Sneak',
      description: 'Starting at 9th level, you have advantage on a Dexterity (Stealth) check if you move no more than half your speed on the same turn.',
      automatic: true
    },

    // LEVEL 10 - ASI
    {
      level: 10,
      name: 'Ability Score Improvement',
      description: 'When you reach 10th level, you can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1. As normal, you can\'t increase an ability score above 20 using this feature.',
      automatic: false,
      choices: [
        {
          type: 'asi',
          description: 'Increase one ability score by 2, or two ability scores by 1 each.',
          count: 2
        }
      ]
    },

    // LEVEL 11
    {
      level: 11,
      name: 'Reliable Talent',
      description: 'By 11th level, you have refined your chosen skills until they approach perfection. Whenever you make an ability check that lets you add your proficiency bonus, you can treat a d20 roll of 9 or lower as a 10.',
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
      name: 'Blindsense',
      description: 'Starting at 13th level, if you are able to hear, you are aware of the location of any hidden or invisible creature within 10 feet of you.',
      automatic: true
    },

    // LEVEL 14
    {
      level: 14,
      name: 'Deft Strike',
      description: 'At 14th level, you can strike with precision. Whenever you hit a creature with a weapon attack, you can choose to forgo your Sneak Attack damage to impose one of the following effects on the target: It has disadvantage on the next attack roll it makes before the end of its next turn. It takes 1d10 force damage. It is unable to take reactions until the end of its next turn.',
      automatic: true
    },

    // LEVEL 15
    {
      level: 15,
      name: 'Slippery Mind',
      description: 'By 15th level, you have acquired greater mental strength. You gain proficiency in Wisdom saving throws.',
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
      name: 'Elusive',
      description: 'Beginning at 17th level, you are so evasive that attackers rarely gain the upper hand against you. No attack roll has advantage against you while you aren\'t incapacitated.',
      automatic: true
    },

    // LEVEL 18
    {
      level: 18,
      name: 'Stroke of Luck',
      description: 'At 18th level, you have an uncanny knack for succeeding when you need to. If your attack misses a target within range, you can turn the miss into a hit. Alternatively, if you fail an ability check, you can treat the d20 roll as a 20. Once you use this feature, you can\'t use it again until you finish a short or long rest.',
      automatic: true,
      resources: [
        {
          id: 'stroke-of-luck',
          name: 'Stroke of Luck',
          description: 'Turn a miss into a hit or failed check into a success',
          maxUses: 1,
          rechargeType: 'short-rest'
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
      name: 'Blinding Speed',
      description: 'Starting at 20th level, you can use the bonus action granted by your Cunning Action to take the Dash or Disengage action. Additionally, your walking speed increases by 30 feet.',
      automatic: true
    }
  ]
};