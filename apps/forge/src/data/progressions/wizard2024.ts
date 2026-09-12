/**
 * Wizard 2024 Class Progression (Levels 1-20)
 *
 * Complete level-by-level feature progression for the 2024 D&D Wizard class.
 * Includes all features, spell choices, cantrip gains, and player choices required at each level.
 */

import { ClassProgression } from '../classProgression';

export const wizard2024Progression: ClassProgression = {
  classSlug: 'wizard',
  className: 'Wizard',
  edition: '2024',
  hitDie: 'd6',
  asiLevels: [4, 8, 12, 16, 19],
  subclassLevel: 3,
  features: [
    // LEVEL 1
    {
      level: 1,
      name: 'Spellcasting',
      description: 'As a student of arcane magic, you have a spellbook containing 6 1st-level wizard spells of your choice.',
      automatic: true
    },
    {
      level: 1,
      name: 'Wizard Spells',
      description: 'Choose 6 level 1 wizard spells for your spellbook.',
      automatic: false,
      choices: [
        {
          type: 'spells',
          description: 'Choose 6 level 1 wizard spells',
          count: 6
        }
      ]
    },
    {
      level: 1,
      name: 'Wizard Cantrips',
      description: 'You know 3 cantrips of your choice from the wizard spell list.',
      automatic: false,
      choices: [
        {
          type: 'spells',
          description: 'Choose 3 cantrips',
          count: 3
        }
      ]
    },
    {
      level: 1,
      name: 'Ritual Adept',
      description: 'You can cast any spell as a Ritual if that spell has the Ritual tag and the spell is in your spellbook. You needn\'t have the spell prepared, but you must read from the book to cast a spell in this way.',
      automatic: true
    },
    {
      level: 1,
      name: 'Arcane Recovery',
      description: 'You can regain some of your magical energy by studying your spellbook. When you finish a Short Rest, you can choose expended spell slots to recover. The spell slots can have a combined level equal to no more than half your Wizard level (round up), and none of the slots can be level 6 or higher.',
      automatic: true,
      resources: [
        {
          id: 'arcane-recovery',
          name: 'Arcane Recovery',
          description: 'Recover spell slots during Short Rest',
          maxUses: 1,
          rechargeType: 'short-rest'
        }
      ]
    },

    // LEVEL 2
    {
      level: 2,
      name: 'Scholar',
      description: 'While studying magic, you also specialized in another field of study. Choose one of the following skills in which you have proficiency: Arcana, History, Investigation, Medicine, Nature, or Religion. You have Expertise in the chosen skill.',
      automatic: false,
      choices: [
        {
          type: 'skill-expertise',
          description: 'Choose a skill for Expertise: Arcana, History, Investigation, Medicine, Nature, or Religion',
          count: 1
        }
      ]
    },
    {
      level: 2,
      name: 'Wizard Spells',
      description: 'Add two wizard spells of your choice to your spellbook.',
      automatic: false,
      choices: [
        {
          type: 'spells',
          description: 'Choose 2 wizard spells',
          count: 2
        }
      ]
    },

    // LEVEL 3
    {
      level: 3,
      name: 'Wizard Subclass',
      description: 'You gain a Wizard subclass of your choice. A subclass is a specialization that grants you features at certain Wizard levels.',
      automatic: false,
      choices: [
        {
          type: 'subclass',
          description: 'Choose your Wizard subclass (Arcane Tradition)',
          count: 1
        }
      ]
    },
    {
      level: 3,
      name: 'Wizard Spells',
      description: 'Add two wizard spells of your choice to your spellbook.',
      automatic: false,
      choices: [
        {
          type: 'spells',
          description: 'Choose 2 wizard spells',
          count: 2
        }
      ]
    },

    // LEVEL 4 - ASI/FEAT + Cantrip
    {
      level: 4,
      name: 'Ability Score Improvement',
      description: 'You can increase one ability score by 2, or you can increase two ability scores by 1. Alternatively, you can take a feat.',
      automatic: false,
      choices: [
        {
          type: 'asi',
          description: 'Increase ability scores by a total of 2 points, or choose a feat',
          count: 2
        }
      ]
    },
    {
      level: 4,
      name: 'Wizard Cantrips',
      description: 'You learn one additional wizard cantrip of your choice.',
      automatic: false,
      choices: [
        {
          type: 'spells',
          description: 'Choose 1 cantrip',
          count: 1
        }
      ]
    },
    {
      level: 4,
      name: 'Wizard Spells',
      description: 'Add two wizard spells of your choice to your spellbook.',
      automatic: false,
      choices: [
        {
          type: 'spells',
          description: 'Choose 2 wizard spells',
          count: 2
        }
      ]
    },

    // LEVEL 5
    {
      level: 5,
      name: 'Memorize Spell',
      description: 'Whenever you finish a Short Rest, you can study your spellbook and replace one of the level 1+ Wizard spells you have prepared for your Spellcasting feature with another level 1+ spell from the book.',
      automatic: true
    },
    {
      level: 5,
      name: 'Wizard Spells',
      description: 'Add two wizard spells of your choice to your spellbook.',
      automatic: false,
      choices: [
        {
          type: 'spells',
          description: 'Choose 2 wizard spells',
          count: 2
        }
      ]
    },

    // LEVEL 6
    {
      level: 6,
      name: 'Subclass Feature',
      description: 'You gain a feature from your Wizard subclass.',
      automatic: true
    },
    {
      level: 6,
      name: 'Wizard Spells',
      description: 'Add two wizard spells of your choice to your spellbook.',
      automatic: false,
      choices: [
        {
          type: 'spells',
          description: 'Choose 2 wizard spells',
          count: 2
        }
      ]
    },

    // LEVEL 7
    {
      level: 7,
      name: 'Wizard Spells',
      description: 'Add two wizard spells of your choice to your spellbook.',
      automatic: false,
      choices: [
        {
          type: 'spells',
          description: 'Choose 2 wizard spells',
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
          description: 'Increase ability scores by a total of 2 points, or choose a feat',
          count: 2
        }
      ]
    },
    {
      level: 8,
      name: 'Wizard Spells',
      description: 'Add two wizard spells of your choice to your spellbook.',
      automatic: false,
      choices: [
        {
          type: 'spells',
          description: 'Choose 2 wizard spells',
          count: 2
        }
      ]
    },

    // LEVEL 9
    {
      level: 9,
      name: 'Wizard Spells',
      description: 'Add two wizard spells of your choice to your spellbook.',
      automatic: false,
      choices: [
        {
          type: 'spells',
          description: 'Choose 2 wizard spells',
          count: 2
        }
      ]
    },

    // LEVEL 10 - Cantrip
    {
      level: 10,
      name: 'Subclass Feature',
      description: 'You gain a feature from your Wizard subclass.',
      automatic: true
    },
    {
      level: 10,
      name: 'Wizard Cantrips',
      description: 'You learn one additional wizard cantrip of your choice.',
      automatic: false,
      choices: [
        {
          type: 'spells',
          description: 'Choose 1 cantrip',
          count: 1
        }
      ]
    },
    {
      level: 10,
      name: 'Wizard Spells',
      description: 'Add two wizard spells of your choice to your spellbook.',
      automatic: false,
      choices: [
        {
          type: 'spells',
          description: 'Choose 2 wizard spells',
          count: 2
        }
      ]
    },

    // LEVEL 11
    {
      level: 11,
      name: 'Wizard Spells',
      description: 'Add two wizard spells of your choice to your spellbook.',
      automatic: false,
      choices: [
        {
          type: 'spells',
          description: 'Choose 2 wizard spells',
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
          description: 'Increase ability scores by a total of 2 points, or choose a feat',
          count: 2
        }
      ]
    },
    {
      level: 12,
      name: 'Wizard Spells',
      description: 'Add two wizard spells of your choice to your spellbook.',
      automatic: false,
      choices: [
        {
          type: 'spells',
          description: 'Choose 2 wizard spells',
          count: 2
        }
      ]
    },

    // LEVEL 13
    {
      level: 13,
      name: 'Wizard Spells',
      description: 'Add two wizard spells of your choice to your spellbook.',
      automatic: false,
      choices: [
        {
          type: 'spells',
          description: 'Choose 2 wizard spells',
          count: 2
        }
      ]
    },

    // LEVEL 14
    {
      level: 14,
      name: 'Subclass Feature',
      description: 'You gain a feature from your Wizard subclass.',
      automatic: true
    },
    {
      level: 14,
      name: 'Wizard Spells',
      description: 'Add two wizard spells of your choice to your spellbook.',
      automatic: false,
      choices: [
        {
          type: 'spells',
          description: 'Choose 2 wizard spells',
          count: 2
        }
      ]
    },

    // LEVEL 15
    {
      level: 15,
      name: 'Wizard Spells',
      description: 'Add two wizard spells of your choice to your spellbook.',
      automatic: false,
      choices: [
        {
          type: 'spells',
          description: 'Choose 2 wizard spells',
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
          description: 'Increase ability scores by a total of 2 points, or choose a feat',
          count: 2
        }
      ]
    },
    {
      level: 16,
      name: 'Wizard Spells',
      description: 'Add two wizard spells of your choice to your spellbook.',
      automatic: false,
      choices: [
        {
          type: 'spells',
          description: 'Choose 2 wizard spells',
          count: 2
        }
      ]
    },

    // LEVEL 17
    {
      level: 17,
      name: 'Wizard Spells',
      description: 'Add two wizard spells of your choice to your spellbook.',
      automatic: false,
      choices: [
        {
          type: 'spells',
          description: 'Choose 2 wizard spells',
          count: 2
        }
      ]
    },

    // LEVEL 18
    {
      level: 18,
      name: 'Spell Mastery',
      description: 'You have achieved such mastery over certain spells that you can cast them at will. Choose a level 1 and a level 2 spell in your spellbook that have a casting time of an action. You always have those spells prepared, and you can cast them at their lowest level without expending a spell slot.',
      automatic: false,
      choices: [
        {
          type: 'spell-mastery',
          description: 'Choose 1 level 1 and 1 level 2 spell for Spell Mastery',
          count: 2
        }
      ]
    },
    {
      level: 18,
      name: 'Wizard Spells',
      description: 'Add two wizard spells of your choice to your spellbook.',
      automatic: false,
      choices: [
        {
          type: 'spells',
          description: 'Choose 2 wizard spells',
          count: 2
        }
      ]
    },

    // LEVEL 19 - ASI/FEAT
    {
      level: 19,
      name: 'Epic Boon',
      description: 'You gain an Epic Boon feat or another feat of your choice for which you qualify.',
      automatic: false,
      choices: [
        {
          type: 'feat',
          description: 'Choose an Epic Boon feat',
          count: 1
        }
      ]
    },
    {
      level: 19,
      name: 'Wizard Spells',
      description: 'Add two wizard spells of your choice to your spellbook.',
      automatic: false,
      choices: [
        {
          type: 'spells',
          description: 'Choose 2 wizard spells',
          count: 2
        }
      ]
    },

    // LEVEL 20
    {
      level: 20,
      name: 'Signature Spells',
      description: 'Choose two level 3 spells in your spellbook as your signature spells. You always have these spells prepared, and you can cast each of them once at level 3 without expending a spell slot.',
      automatic: false,
      choices: [
        {
          type: 'signature-spells',
          description: 'Choose 2 level 3 spells for Signature Spells',
          count: 2
        }
      ]
    }
  ]
};