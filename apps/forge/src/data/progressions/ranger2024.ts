/**
 * Ranger 2024 Class Progression (Levels 1-20)
 *
 * Complete level-by-level feature progression for the 2024 D&D Ranger class.
 * Includes all features, resources, and player choices required at each level.
 */

import { ClassProgression } from '../classProgression';

export const ranger2024Progression: ClassProgression = {
  classSlug: 'ranger',
  className: 'Ranger',
  edition: '2024',
  hitDie: 'd10',
  asiLevels: [4, 8, 12, 16, 19],
  subclassLevel: 3,
  features: [
    // LEVEL 1
    {
      level: 1,
      name: 'Favored Enemy',
      description: 'You have significant experience studying, tracking, hunting, and even talking to a certain type of enemy. Choose a type of favored enemy: beasts, fey, humanoids, monstrosities, or undead. You gain a +2 bonus to damage rolls with weapon attacks against creatures of the chosen type. Additionally, you have advantage on Wisdom (Survival) checks to track your favored enemies, as well as on Intelligence checks to recall information about them.',
      automatic: false,
      choices: [
        {
          type: 'favored-enemy',
          description: 'Choose a favored enemy type.',
          count: 1
        }
      ]
    },
    {
      level: 1,
      name: 'Natural Explorer',
      description: 'You are particularly familiar with one type of natural environment and are adept at traveling and surviving in such regions. Choose one type of favored terrain: arctic, coast, desert, forest, grassland, mountain, swamp, or the Underdark. When you make an Intelligence or Wisdom check related to your favored terrain, your proficiency bonus is doubled if you are using a skill that you\'re proficient in. While traveling for an hour or more in your favored terrain, you gain the following benefits: difficult terrain doesn\'t slow your group\'s travel, your group can\'t become lost except by magical means, even when you are engaged in another activity while traveling (such as foraging, navigating, or tracking), you remain alert to danger even if you are engaged in another activity, if you are traveling alone, you can move stealthily at a normal pace, and when you forage, you find twice as much food as you normally would.',
      automatic: false,
      choices: [
        {
          type: 'natural-explorer',
          description: 'Choose a favored terrain type.',
          count: 1
        }
      ]
    },
    {
      level: 1,
      name: 'Weapon Mastery',
      description: 'Your training with weapons allows you to use the mastery property of two kinds of simple or martial weapons of your choice. Whenever you finish a Long Rest, you can practice weapon drills and change one of those weapon choices.',
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
          description: 'Choose a Fighting Style: Archery, Defense, Dueling, Great Weapon Fighting, Protection, or Two-Weapon Fighting.',
          count: 1
        }
      ]
    },
    {
      level: 2,
      name: 'Spellcasting',
      description: 'You have learned to use the magical essence of nature to cast spells, much as a druid does.',
      automatic: true
    },

    // LEVEL 3
    {
      level: 3,
      name: 'Ranger Subclass',
      description: 'Choose a Ranger subclass (also known as a Ranger Conclave): Beast Master, Fey Wanderer, Gloom Stalker, Hunter, etc.',
      automatic: false,
      choices: [
        {
          type: 'subclass',
          description: 'Choose your Ranger subclass to gain specialized abilities.',
          count: 1
        }
      ]
    },
    {
      level: 3,
      name: 'Primeval Awareness',
      description: 'You can use your action and expend one ranger spell slot to focus your awareness on the region around you. For 1 minute per level of the spell slot you expend, you can sense whether the following types of creatures are present within 1 mile of you (or within up to 6 miles if you are in your favored terrain): aberrations, celestials, dragons, elementals, fey, fiends, and undead. This feature doesn\'t reveal the creatures\' location or number.',
      automatic: true
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

    // LEVEL 6
    {
      level: 6,
      name: 'Favored Enemy Improvement',
      description: 'You choose one additional favored enemy, as well as one language of your choice that is spoken by your favored enemy or creatures associated with it.',
      automatic: false,
      choices: [
        {
          type: 'favored-enemy',
          description: 'Choose an additional favored enemy type.',
          count: 1
        }
      ]
    },

    // LEVEL 7
    {
      level: 7,
      name: 'Natural Explorer Improvement',
      description: 'You choose one additional favored terrain.',
      automatic: false,
      choices: [
        {
          type: 'natural-explorer',
          description: 'Choose an additional favored terrain type.',
          count: 1
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
      name: 'Invisibility',
      description: 'You can use the Hide action as a bonus action on your turn. Also, you can\'t be tracked by nonmagical means, unless you choose to leave a trail.',
      automatic: true
    },

    // LEVEL 10
    {
      level: 10,
      name: 'Natural Explorer Improvement',
      description: 'You choose one additional favored terrain.',
      automatic: false,
      choices: [
        {
          type: 'natural-explorer',
          description: 'Choose an additional favored terrain type.',
          count: 1
        }
      ]
    },

    // LEVEL 11
    {
      level: 11,
      name: 'Combat Style',
      description: 'You gain the benefits of one of the following combat styles: Archery, Defense, or Dueling.',
      automatic: false,
      choices: [
        {
          type: 'fighting-style',
          description: 'Choose a combat style.',
          count: 1
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
      name: 'Favored Enemy Improvement',
      description: 'You choose one additional favored enemy.',
      automatic: false,
      choices: [
        {
          type: 'favored-enemy',
          description: 'Choose an additional favored enemy type.',
          count: 1
        }
      ]
    },

    // LEVEL 14
    {
      level: 14,
      name: 'Vanish',
      description: 'You can use the Hide action as a bonus action on your turn. Also, you can\'t be tracked by nonmagical means, unless you choose to leave a trail.',
      automatic: true
    },

    // LEVEL 15
    {
      level: 15,
      name: 'Natural Explorer Improvement',
      description: 'You choose one additional favored terrain.',
      automatic: false,
      choices: [
        {
          type: 'natural-explorer',
          description: 'Choose an additional favored terrain type.',
          count: 1
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
      name: 'Relentless Hunter',
      description: 'When you roll initiative, you can regain one use of your Favored Enemy ability.',
      automatic: true
    },

    // LEVEL 18
    {
      level: 18,
      name: 'Feral Senses',
      description: 'When you attack a creature you can\'t see, your inability to see it doesn\'t impose disadvantage on your attack rolls against it. You are also aware of the location of any invisible creature within 30 feet of you, provided that the creature isn\'t hidden from you and you aren\'t blinded or deafened.',
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
      name: 'Foe Slayer',
      description: 'Once on each of your turns, you can add your Wisdom modifier to the attack roll or the damage roll of an attack you make against one of your favored enemies. You can choose to use this feature before or after the roll, but before any effects of the roll are applied.',
      automatic: true
    }
  ]
};