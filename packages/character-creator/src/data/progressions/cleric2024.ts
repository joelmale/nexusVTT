/**
 * Cleric 2024 Class Progression (Levels 1-20)
 *
 * Complete level-by-level feature progression for the 2024 D&D Cleric class.
 * Includes all features, resources, and player choices required at each level.
 */

import { ClassProgression } from '../classProgression';

export const cleric2024Progression: ClassProgression = {
  classSlug: 'cleric',
  className: 'Cleric',
  edition: '2024',
  hitDie: 'd8',
  asiLevels: [4, 8, 12, 16, 19],
  subclassLevel: 1,
  features: [
    // LEVEL 1
    {
      level: 1,
      name: 'Spellcasting',
      description: 'As a conduit for divine power, you can cast cleric spells. See chapter 10 for the general rules of spellcasting and chapter 11 for the cleric spell list.',
      automatic: true
    },
    {
      level: 1,
      name: 'Divine Domain',
      description: 'Choose one domain related to your deity. Your domain grants you domain spells and other features when you choose it at 1st level. It also grants you additional ways to use Channel Divinity when you gain levels in this class, and a Divine Domain feature at 2nd level and a potent ability at 8th, 14th, and 17th levels.',
      automatic: false,
      choices: [
        {
          type: 'subclass',
          description: 'Choose a Divine Domain: Knowledge, Life, Light, Nature, Tempest, Trickery, or War.',
          count: 1
        }
      ]
    },

    // LEVEL 2
    {
      level: 2,
      name: 'Channel Divinity',
      description: 'At 2nd level, you gain the ability to channel divine energy directly from your deity, using that energy to fuel magical effects. You start with two such effects: Turn Undead and an effect determined by your domain. Some domains grant you additional effects as you advance in levels, as noted in the domain description. When you use your Channel Divinity, you choose which effect to create. You must then finish a short or long rest to use your Channel Divinity again. Some Channel Divinity effects require saving throws. When you use such an effect from this class, the DC equals your cleric spell save DC.',
      automatic: true,
      resources: [
        {
          id: 'channel-divinity',
          name: 'Channel Divinity',
          description: 'Channel divine energy for various effects',
          maxUses: 1,
          rechargeType: 'short-rest'
        }
      ]
    },

    // LEVEL 3
    {
      level: 3,
      name: 'Spellcasting Improvement',
      description: 'The spells you can cast as a 3rd-level cleric are expanded.',
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
      name: 'Destroy Undead',
      description: 'When an undead fails its saving throw against your Turn Undead feature, the undead is instantly destroyed if its challenge rating is at or below a certain threshold, as shown in the Destroy Undead table.',
      automatic: true
    },

    // LEVEL 6
    {
      level: 6,
      name: 'Channel Divinity Improvement',
      description: 'You can use your Channel Divinity twice between rests.',
      automatic: true
    },

    // LEVEL 7
    {
      level: 7,
      name: 'Spellcasting Improvement',
      description: 'The spells you can cast as a 7th-level cleric are expanded.',
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
      description: 'The spells you can cast as a 9th-level cleric are expanded.',
      automatic: true
    },

    // LEVEL 10
    {
      level: 10,
      name: 'Divine Intervention',
      description: 'Beginning at 10th level, you can call on your deity to intervene on your behalf when your need is great. Imploring your deity\'s aid requires you to use your action. Describe the assistance you seek, and the DM decides if the intervention occurs. If it does, the DM chooses the nature of the intervention. If your deity intervenes, you can\'t use this feature again for 7 days. Otherwise, you can use it again after you finish a long rest.',
      automatic: true,
      resources: [
        {
          id: 'divine-intervention',
          name: 'Divine Intervention',
          description: 'Call on your deity for aid',
          maxUses: 1,
          rechargeType: 'none' // Special recharge rules
        }
      ]
    },

    // LEVEL 11
    {
      level: 11,
      name: 'Destroy Undead Improvement',
      description: 'When an undead fails its saving throw against your Turn Undead feature, the undead is instantly destroyed if its challenge rating is at or below a certain threshold.',
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
      description: 'The spells you can cast as a 13th-level cleric are expanded.',
      automatic: true
    },

    // LEVEL 14
    {
      level: 14,
      name: 'Destroy Undead Improvement',
      description: 'When an undead fails its saving throw against your Turn Undead feature, the undead is instantly destroyed if its challenge rating is at or below a certain threshold.',
      automatic: true
    },

    // LEVEL 15
    {
      level: 15,
      name: 'Spellcasting Improvement',
      description: 'The spells you can cast as a 15th-level cleric are expanded.',
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
      name: 'Destroy Undead Improvement',
      description: 'When an undead fails its saving throw against your Turn Undead feature, the undead is instantly destroyed if its challenge rating is at or below a certain threshold.',
      automatic: true
    },
    {
      level: 17,
      name: 'Channel Divinity Improvement',
      description: 'You can use your Channel Divinity three times between rests.',
      automatic: true
    },

    // LEVEL 18
    {
      level: 18,
      name: 'Spellcasting Improvement',
      description: 'The spells you can cast as an 18th-level cleric are expanded.',
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
      name: 'Divine Intervention Improvement',
      description: 'At 20th level, your call for intervention succeeds automatically, but the DM still decides the nature of the intervention.',
      automatic: true
    }
  ]
};