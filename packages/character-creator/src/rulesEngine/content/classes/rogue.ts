/**
 * Rogue Class Effects
 * Pure data - no game logic in code
 *
 * Rogue is a versatile class focused on skills, stealth, and precision damage.
 * Key features: Sneak Attack, Expertise, Cunning Action, Evasion
 */

import type { SourcedEffect } from '../../types/effects';

/**
 * Rogue Proficiencies
 * Armor: Light armor
 * Weapons: Simple weapons, hand crossbows, longswords, rapiers, shortswords
 * Tools: Thieves' tools
 * Saves: DEX, INT
 * Skills: Choose 4 from Acrobatics, Athletics, Deception, Insight, Intimidation,
 *         Investigation, Perception, Performance, Persuasion, Sleight of Hand, Stealth
 */
export const rogueProficiencies: SourcedEffect = {
  sourceId: 'class:rogue',
  effectId: 'rogue-proficiencies',
  name: 'Rogue Proficiencies',
  description: 'You gain proficiency with light armor, simple weapons, and thieves\' tools.',
  effects: [
    {
      kind: 'grantProficiency',
      profType: 'armor',
      values: ['Light armor'],
    },
    {
      kind: 'grantProficiency',
      profType: 'weapon',
      values: ['Simple weapons', 'Hand crossbows', 'Longswords', 'Rapiers', 'Shortswords'],
    },
    {
      kind: 'grantProficiency',
      profType: 'tool',
      values: ['Thieves\' tools'],
    },
    {
      kind: 'grantProficiency',
      profType: 'savingThrow',
      values: ['DEX', 'INT'],
    },
  ],
};

/**
 * Sneak Attack
 * Level 1+: Deal extra damage when you have advantage or ally within 5 feet
 * Damage scales: 1d6 at level 1, +1d6 every 2 levels
 */
export const sneakAttack: SourcedEffect = {
  sourceId: 'class:rogue',
  effectId: 'sneak-attack',
  name: 'Sneak Attack',
  description: 'Once per turn, you can deal an extra 1d6 damage to one creature you hit with an attack if you have advantage on the attack roll. The attack must use a finesse or ranged weapon. You don\'t need advantage if another enemy of the target is within 5 feet of it. The sneak attack damage increases as you gain levels.',
  effects: [
    {
      kind: 'grantFeature',
      featureId: 'sneak-attack',
      name: 'Sneak Attack',
      description: 'Deal extra damage when you have advantage on attack rolls with finesse or ranged weapons.',
    },
    {
      kind: 'tag',
      tags: ['sneak-attack'],
    },
  ],
};

/**
 * Thieves' Cant
 * Level 1: Secret language known to all rogues
 */
export const thievesCant: SourcedEffect = {
  sourceId: 'class:rogue',
  effectId: 'thieves-cant',
  name: 'Thieves\' Cant',
  description: 'You know thieves\' cant, a secret mix of dialect, jargon, and code that allows you to hide messages in seemingly normal conversation.',
  effects: [
    {
      kind: 'grantProficiency',
      profType: 'language',
      values: ['Thieves\' Cant'],
      predicate: [{ type: 'classLevelAtLeast', classSlug: 'rogue', level: 1 }],
    },
    {
      kind: 'grantFeature',
      featureId: 'thieves-cant',
      name: 'Thieves\' Cant',
      description: 'You know a secret language used by rogues to communicate covertly.',
      predicate: [{ type: 'classLevelAtLeast', classSlug: 'rogue', level: 1 }],
    },
  ],
};

/**
 * Expertise
 * Level 1: Choose 2 skills, double proficiency bonus
 * Level 6: Choose 2 more skills
 */
export const expertiseLevel1: SourcedEffect = {
  sourceId: 'class:rogue',
  effectId: 'expertise-1',
  name: 'Expertise (Level 1)',
  description: 'Choose two of your skill proficiencies. Your proficiency bonus is doubled for any ability check you make that uses either of the chosen proficiencies.',
  choice: {
    id: 'rogue-expertise-1',
    prompt: 'Choose 2 skills to gain expertise',
    type: 'multiselect',
    min: 2,
    max: 2,
    predicate: [{ type: 'classLevelAtLeast', classSlug: 'rogue', level: 1 }],
    options: [
      { value: 'Acrobatics', label: 'Acrobatics', description: 'Double proficiency for Acrobatics checks', effects: [{ kind: 'skillExpertise', skill: 'Acrobatics' }] },
      { value: 'Athletics', label: 'Athletics', description: 'Double proficiency for Athletics checks', effects: [{ kind: 'skillExpertise', skill: 'Athletics' }] },
      { value: 'Deception', label: 'Deception', description: 'Double proficiency for Deception checks', effects: [{ kind: 'skillExpertise', skill: 'Deception' }] },
      { value: 'Insight', label: 'Insight', description: 'Double proficiency for Insight checks', effects: [{ kind: 'skillExpertise', skill: 'Insight' }] },
      { value: 'Intimidation', label: 'Intimidation', description: 'Double proficiency for Intimidation checks', effects: [{ kind: 'skillExpertise', skill: 'Intimidation' }] },
      { value: 'Investigation', label: 'Investigation', description: 'Double proficiency for Investigation checks', effects: [{ kind: 'skillExpertise', skill: 'Investigation' }] },
      { value: 'Perception', label: 'Perception', description: 'Double proficiency for Perception checks', effects: [{ kind: 'skillExpertise', skill: 'Perception' }] },
      { value: 'Performance', label: 'Performance', description: 'Double proficiency for Performance checks', effects: [{ kind: 'skillExpertise', skill: 'Performance' }] },
      { value: 'Persuasion', label: 'Persuasion', description: 'Double proficiency for Persuasion checks', effects: [{ kind: 'skillExpertise', skill: 'Persuasion' }] },
      { value: 'Sleight of Hand', label: 'Sleight of Hand', description: 'Double proficiency for Sleight of Hand checks', effects: [{ kind: 'skillExpertise', skill: 'Sleight of Hand' }] },
      { value: 'Stealth', label: 'Stealth', description: 'Double proficiency for Stealth checks', effects: [{ kind: 'skillExpertise', skill: 'Stealth' }] },
    ],
  },
};

/**
 * Cunning Action
 * Level 2: Bonus action to Dash, Disengage, or Hide
 */
export const cunningAction: SourcedEffect = {
  sourceId: 'class:rogue',
  effectId: 'cunning-action',
  name: 'Cunning Action',
  description: 'You can take a bonus action on each of your turns in combat to take the Dash, Disengage, or Hide action.',
  effects: [
    {
      kind: 'grantFeature',
      featureId: 'cunning-action',
      name: 'Cunning Action',
      description: 'Use a bonus action to Dash, Disengage, or Hide.',
      predicate: [{ type: 'classLevelAtLeast', classSlug: 'rogue', level: 2 }],
    },
    {
      kind: 'tag',
      tags: ['cunning-action', 'bonus-action-dash', 'bonus-action-disengage', 'bonus-action-hide'],
      predicate: [{ type: 'classLevelAtLeast', classSlug: 'rogue', level: 2 }],
    },
  ],
};

/**
 * Roguish Archetype
 * Level 3: Choose a rogue subclass
 */
export const roguishArchetype: SourcedEffect = {
  sourceId: 'class:rogue',
  effectId: 'roguish-archetype',
  name: 'Roguish Archetype',
  description: 'You choose a roguish archetype that defines your specialization.',
  effects: [
    {
      kind: 'grantFeature',
      featureId: 'roguish-archetype',
      name: 'Roguish Archetype',
      description: 'Choose your Rogue subclass.',
      predicate: [{ type: 'classLevelAtLeast', classSlug: 'rogue', level: 3 }],
    },
    {
      kind: 'tag',
      tags: ['roguish-archetype', 'subclass-choice'],
      predicate: [{ type: 'classLevelAtLeast', classSlug: 'rogue', level: 3 }],
    },
  ],
};

/**
 * Uncanny Dodge
 * Level 5: Use reaction to halve damage from one attack
 */
export const uncannyDodge: SourcedEffect = {
  sourceId: 'class:rogue',
  effectId: 'uncanny-dodge',
  name: 'Uncanny Dodge',
  description: 'When an attacker that you can see hits you with an attack, you can use your reaction to halve the attack\'s damage against you.',
  effects: [
    {
      kind: 'grantFeature',
      featureId: 'uncanny-dodge',
      name: 'Uncanny Dodge',
      description: 'Use your reaction to halve damage from one attack.',
      predicate: [{ type: 'classLevelAtLeast', classSlug: 'rogue', level: 5 }],
    },
    {
      kind: 'tag',
      tags: ['uncanny-dodge', 'reaction-damage-reduction'],
      predicate: [{ type: 'classLevelAtLeast', classSlug: 'rogue', level: 5 }],
    },
  ],
};

/**
 * Evasion
 * Level 7: No damage on successful DEX save, half damage on failed save
 */
export const evasion: SourcedEffect = {
  sourceId: 'class:rogue',
  effectId: 'evasion',
  name: 'Evasion',
  description: 'When you are subjected to an effect that allows you to make a Dexterity saving throw to take only half damage, you instead take no damage if you succeed on the saving throw, and only half damage if you fail.',
  effects: [
    {
      kind: 'grantFeature',
      featureId: 'evasion',
      name: 'Evasion',
      description: 'Take no damage on successful DEX save, half damage on failed save.',
      predicate: [{ type: 'classLevelAtLeast', classSlug: 'rogue', level: 7 }],
    },
    {
      kind: 'tag',
      tags: ['evasion'],
      predicate: [{ type: 'classLevelAtLeast', classSlug: 'rogue', level: 7 }],
    },
  ],
};

/**
 * Reliable Talent
 * Level 11: Minimum roll of 10 on any ability check with proficiency
 */
export const reliableTalent: SourcedEffect = {
  sourceId: 'class:rogue',
  effectId: 'reliable-talent',
  name: 'Reliable Talent',
  description: 'Whenever you make an ability check that lets you add your proficiency bonus, you can treat a d20 roll of 9 or lower as a 10.',
  effects: [
    {
      kind: 'grantFeature',
      featureId: 'reliable-talent',
      name: 'Reliable Talent',
      description: 'Minimum roll of 10 on ability checks with proficiency.',
      predicate: [{ type: 'classLevelAtLeast', classSlug: 'rogue', level: 11 }],
    },
    {
      kind: 'tag',
      tags: ['reliable-talent'],
      predicate: [{ type: 'classLevelAtLeast', classSlug: 'rogue', level: 11 }],
    },
  ],
};

/**
 * Blindsense
 * Level 14: Detect invisible/hidden creatures within 10 feet
 */
export const blindsense: SourcedEffect = {
  sourceId: 'class:rogue',
  effectId: 'blindsense',
  name: 'Blindsense',
  description: 'If you are able to hear, you are aware of the location of any hidden or invisible creature within 10 feet of you.',
  effects: [
    {
      kind: 'sense',
      senseType: 'blindsight',
      range: 10,
      predicate: [{ type: 'classLevelAtLeast', classSlug: 'rogue', level: 14 }],
    },
    {
      kind: 'grantFeature',
      featureId: 'blindsense',
      name: 'Blindsense',
      description: 'Detect hidden/invisible creatures within 10 feet.',
      predicate: [{ type: 'classLevelAtLeast', classSlug: 'rogue', level: 14 }],
    },
    {
      kind: 'tag',
      tags: ['blindsense'],
      predicate: [{ type: 'classLevelAtLeast', classSlug: 'rogue', level: 14 }],
    },
  ],
};

/**
 * Slippery Mind
 * Level 15: Proficiency in WIS saves
 */
export const slipperyMind: SourcedEffect = {
  sourceId: 'class:rogue',
  effectId: 'slippery-mind',
  name: 'Slippery Mind',
  description: 'You have acquired greater mental strength. You gain proficiency in Wisdom saving throws.',
  effects: [
    {
      kind: 'grantProficiency',
      profType: 'savingThrow',
      values: ['WIS'],
      predicate: [{ type: 'classLevelAtLeast', classSlug: 'rogue', level: 15 }],
    },
    {
      kind: 'grantFeature',
      featureId: 'slippery-mind',
      name: 'Slippery Mind',
      description: 'You gain proficiency in Wisdom saving throws.',
      predicate: [{ type: 'classLevelAtLeast', classSlug: 'rogue', level: 15 }],
    },
  ],
};

/**
 * Elusive
 * Level 18: No attack has advantage against you while you're not incapacitated
 */
export const elusive: SourcedEffect = {
  sourceId: 'class:rogue',
  effectId: 'elusive',
  name: 'Elusive',
  description: 'You are so evasive that attackers rarely gain the upper hand against you. No attack roll has advantage against you while you aren\'t incapacitated.',
  effects: [
    {
      kind: 'grantFeature',
      featureId: 'elusive',
      name: 'Elusive',
      description: 'No attack has advantage against you while not incapacitated.',
      predicate: [{ type: 'classLevelAtLeast', classSlug: 'rogue', level: 18 }],
    },
    {
      kind: 'tag',
      tags: ['elusive', 'no-advantage-against'],
      predicate: [{ type: 'classLevelAtLeast', classSlug: 'rogue', level: 18 }],
    },
  ],
};

/**
 * Rogue Subclass Effects (2024)
 * These are feature grants tied to subclass selection and rogue levels.
 */
export const rogueSubclassEffects: SourcedEffect[] = [
  {
    sourceId: 'subclass:arcane-trickster',
    effectId: 'arcane-trickster-features',
    name: 'Arcane Trickster Features',
    description: 'Magical infiltrator features for the Arcane Trickster subclass.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'arcane-trickster-spellcasting',
        name: 'Spellcasting',
        description: 'Wizard spellcasting (one-third progression) focused on illusion and enchantment; Mage Hand is a required cantrip.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:arcane-trickster' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 3 },
        ],
      },
      {
        kind: 'grantFeature',
        featureId: 'arcane-trickster-mage-hand-legerdemain',
        name: 'Mage Hand Legerdemain',
        description: 'You gain an invisible Mage Hand that can manipulate objects, pick locks, disarm traps, and steal at range; you can use it as a bonus action.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:arcane-trickster' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 3 },
        ],
      },
      {
        kind: 'grantFeature',
        featureId: 'arcane-trickster-magical-ambush',
        name: 'Magical Ambush',
        description: 'While hidden, creatures have disadvantage on saving throws against your spells, enabling strong control setups.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:arcane-trickster' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 9 },
        ],
      },
      {
        kind: 'grantFeature',
        featureId: 'arcane-trickster-versatile-trickster',
        name: 'Versatile Trickster',
        description: 'Use your Mage Hand to grant yourself advantage on attack rolls, enabling reliable Sneak Attack.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:arcane-trickster' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 13 },
        ],
      },
      {
        kind: 'grantFeature',
        featureId: 'arcane-trickster-spell-thief',
        name: 'Spell Thief',
        description: 'When a creature casts a spell at you, you can negate it and steal it to cast later.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:arcane-trickster' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 17 },
        ],
      },
    ],
  },
  {
    sourceId: 'subclass:assassin',
    effectId: 'assassin-features',
    name: 'Assassin Features',
    description: 'Professional killer features for the Assassin subclass.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'assassin-bonus-proficiencies',
        name: 'Bonus Proficiencies',
        description: 'Gain proficiency with the disguise kit and poisoner\'s kit.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:assassin' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 3 },
        ],
      },
      {
        kind: 'grantFeature',
        featureId: 'assassin-assassinate',
        name: 'Assassinate',
        description: 'You have advantage against creatures that haven\'t acted, and any hit against a surprised creature is a critical hit.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:assassin' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 3 },
        ],
      },
      {
        kind: 'grantFeature',
        featureId: 'assassin-infiltration-expertise',
        name: 'Infiltration Expertise',
        description: 'Create convincing false identities with detailed backstories for long-term infiltration.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:assassin' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 9 },
        ],
      },
      {
        kind: 'grantFeature',
        featureId: 'assassin-impostor',
        name: 'Impostor',
        description: 'Mimic speech, writing, and behavior after brief observation.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:assassin' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 13 },
        ],
      },
      {
        kind: 'grantFeature',
        featureId: 'assassin-death-strike',
        name: 'Death Strike',
        description: 'When you surprise a creature and hit it, it makes a Constitution save; on a failure, the damage is doubled again.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:assassin' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 17 },
        ],
      },
    ],
  },
  {
    sourceId: 'subclass:thief',
    effectId: 'thief-features',
    name: 'Thief Features',
    description: 'Classic rogue features for the Thief subclass.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'thief-fast-hands',
        name: 'Fast Hands',
        description: 'Use an Object as a bonus action, including thieves\' tools and certain items.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:thief' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 3 },
        ],
      },
      {
        kind: 'grantFeature',
        featureId: 'thief-second-story-work',
        name: 'Second-Story Work',
        description: 'Climbing no longer costs extra movement, and your long jumps improve.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:thief' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 3 },
        ],
      },
      {
        kind: 'grantFeature',
        featureId: 'thief-supreme-sneak',
        name: 'Supreme Sneak',
        description: 'You have advantage on Stealth checks when moving slowly.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:thief' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 9 },
        ],
      },
      {
        kind: 'grantFeature',
        featureId: 'thief-use-magic-device',
        name: 'Use Magic Device',
        description: 'Ignore class, race, and level requirements for magic items, and use scrolls without failure.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:thief' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 13 },
        ],
      },
      {
        kind: 'grantFeature',
        featureId: 'thief-thiefs-reflexes',
        name: 'Thief\'s Reflexes',
        description: 'You take two turns in the first round of combat.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:thief' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 17 },
        ],
      },
    ],
  },
  {
    sourceId: 'subclass:inquisitive',
    effectId: 'inquisitive-features',
    name: 'Inquisitive Features',
    description: 'Investigator features for the Inquisitive subclass.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'inquisitive-ear-for-deceit',
        name: 'Ear for Deceit',
        description: 'Treat Insight rolls below 8 as an 8 when determining if someone is lying.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:inquisitive' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 3 },
        ],
      },
      {
        kind: 'grantFeature',
        featureId: 'inquisitive-eye-for-detail',
        name: 'Eye for Detail',
        description: 'Use a bonus action to spot hidden creatures or notice clues.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:inquisitive' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 3 },
        ],
      },
      {
        kind: 'grantFeature',
        featureId: 'inquisitive-insightful-fighting',
        name: 'Insightful Fighting',
        description: 'Use Insight vs Deception to enable Sneak Attack without advantage or allies.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:inquisitive' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 3 },
        ],
      },
      {
        kind: 'grantFeature',
        featureId: 'inquisitive-steady-eye',
        name: 'Steady Eye',
        description: 'Gain advantage on Perception and Investigation checks when moving slowly.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:inquisitive' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 9 },
        ],
      },
      {
        kind: 'grantFeature',
        featureId: 'inquisitive-unerring-eye',
        name: 'Unerring Eye',
        description: 'Detect illusions and shapeshifters a limited number of times per day.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:inquisitive' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 13 },
        ],
      },
      {
        kind: 'grantFeature',
        featureId: 'inquisitive-eye-for-weakness',
        name: 'Eye for Weakness',
        description: 'Deal extra damage equal to your Wisdom modifier once per turn.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:inquisitive' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 17 },
        ],
      },
    ],
  },
  {
    sourceId: 'subclass:mastermind',
    effectId: 'mastermind-features',
    name: 'Mastermind Features',
    description: 'Tactical coordinator features for the Mastermind subclass.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'mastermind-master-of-intrigue',
        name: 'Master of Intrigue',
        description: 'Gain bonus proficiencies, languages, and the ability to mimic speech patterns.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:mastermind' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 3 },
        ],
      },
      {
        kind: 'grantFeature',
        featureId: 'mastermind-master-of-tactics',
        name: 'Master of Tactics',
        description: 'Use the Help action as a bonus action and from up to 30 feet away.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:mastermind' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 3 },
        ],
      },
      {
        kind: 'grantFeature',
        featureId: 'mastermind-insightful-manipulator',
        name: 'Insightful Manipulator',
        description: 'Study a creature to learn its capabilities after brief observation.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:mastermind' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 9 },
        ],
      },
      {
        kind: 'grantFeature',
        featureId: 'mastermind-misdirection',
        name: 'Misdirection',
        description: 'Redirect an attack from you to another creature when the attacker is within range.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:mastermind' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 13 },
        ],
      },
      {
        kind: 'grantFeature',
        featureId: 'mastermind-soul-of-deceit',
        name: 'Soul of Deceit',
        description: 'Your thoughts can\'t be read, and you can present false thoughts under scrutiny.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:mastermind' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 17 },
        ],
      },
    ],
  },
  {
    sourceId: 'subclass:scout',
    effectId: 'scout-features',
    name: 'Scout Features',
    description: 'Skirmisher features for the Scout subclass.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'scout-skirmisher',
        name: 'Skirmisher',
        description: 'When an enemy ends its turn within 5 feet of you, you can move away as a reaction without provoking opportunity attacks.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:scout' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 3 },
        ],
      },
      {
        kind: 'grantFeature',
        featureId: 'scout-survivalist',
        name: 'Survivalist',
        description: 'Gain proficiency or expertise in Nature and Survival.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:scout' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 3 },
        ],
      },
      {
        kind: 'grantFeature',
        featureId: 'scout-superior-mobility',
        name: 'Superior Mobility',
        description: 'Your walking speed increases by 10 feet.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:scout' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 9 },
        ],
      },
      {
        kind: 'grantFeature',
        featureId: 'scout-ambush-master',
        name: 'Ambush Master',
        description: 'You gain advantage on initiative, and the first target you hit grants advantage to your allies\' attacks.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:scout' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 13 },
        ],
      },
      {
        kind: 'grantFeature',
        featureId: 'scout-sudden-strike',
        name: 'Sudden Strike',
        description: 'You can make an additional Sneak Attack as a bonus action against a different target.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:scout' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 17 },
        ],
      },
    ],
  },
  {
    sourceId: 'subclass:swashbuckler',
    effectId: 'swashbuckler-features',
    name: 'Swashbuckler Features',
    description: 'Duelist features for the Swashbuckler subclass.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'swashbuckler-fancy-footwork',
        name: 'Fancy Footwork',
        description: 'Creatures you attack can\'t make opportunity attacks against you for the rest of the turn.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:swashbuckler' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 3 },
        ],
      },
      {
        kind: 'grantFeature',
        featureId: 'swashbuckler-rakish-audacity',
        name: 'Rakish Audacity',
        description: 'Add your Charisma modifier to initiative, and you can Sneak Attack in solo melee.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:swashbuckler' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 3 },
        ],
      },
      {
        kind: 'grantFeature',
        featureId: 'swashbuckler-panache',
        name: 'Panache',
        description: 'Charm or goad a creature through social or combat pressure.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:swashbuckler' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 9 },
        ],
      },
      {
        kind: 'grantFeature',
        featureId: 'swashbuckler-elegant-maneuver',
        name: 'Elegant Maneuver',
        description: 'Use a bonus action to gain advantage on Acrobatics or Athletics checks.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:swashbuckler' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 13 },
        ],
      },
      {
        kind: 'grantFeature',
        featureId: 'swashbuckler-master-duelist',
        name: 'Master Duelist',
        description: 'Reroll a missed attack once per turn.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:swashbuckler' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 17 },
        ],
      },
    ],
  },
  {
    sourceId: 'subclass:phantom',
    effectId: 'phantom-features',
    name: 'Phantom Features',
    description: 'Death-touched features for the Phantom subclass.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'phantom-whispers-of-the-dead',
        name: 'Whispers of the Dead',
        description: 'Gain a floating skill or tool proficiency after each rest.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:phantom' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 3 },
        ],
      },
      {
        kind: 'grantFeature',
        featureId: 'phantom-wails-from-the-grave',
        name: 'Wails from the Grave',
        description: 'After Sneak Attack, deal necrotic damage to a second target; scales with proficiency bonus.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:phantom' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 3 },
        ],
      },
      {
        kind: 'grantFeature',
        featureId: 'phantom-tokens-of-the-departed',
        name: 'Tokens of the Departed',
        description: 'Collect soul trinkets from the dying to fuel subclass abilities.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:phantom' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 9 },
        ],
      },
      {
        kind: 'grantFeature',
        featureId: 'phantom-ghost-walk',
        name: 'Ghost Walk',
        description: 'Become partially incorporeal, gaining flight and damage resistance for a time.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:phantom' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 13 },
        ],
      },
      {
        kind: 'grantFeature',
        featureId: 'phantom-death-knell',
        name: 'Death Knell',
        description: 'Deal extra necrotic damage to low-HP enemies.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:phantom' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 17 },
        ],
      },
    ],
  },
  {
    sourceId: 'subclass:soulknife',
    effectId: 'soulknife-features',
    name: 'Soulknife Features',
    description: 'Psionic assassin features for the Soulknife subclass.',
    effects: [
      {
        kind: 'grantFeature',
        featureId: 'soulknife-psychic-blades',
        name: 'Psychic Blades',
        description: 'Summon finesse/thrown psychic weapons, including a bonus-action off-hand attack.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:soulknife' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 3 },
        ],
      },
      {
        kind: 'grantFeature',
        featureId: 'soulknife-psionic-power',
        name: 'Psionic Power',
        description: 'Gain psionic dice to fuel special abilities.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:soulknife' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 3 },
        ],
      },
      {
        kind: 'grantFeature',
        featureId: 'soulknife-soul-blades',
        name: 'Soul Blades',
        description: 'Add psionic dice to failed checks and teleport via psychic blades.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:soulknife' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 9 },
        ],
      },
      {
        kind: 'grantFeature',
        featureId: 'soulknife-psychic-veil',
        name: 'Psychic Veil',
        description: 'Become invisible for up to 1 hour without concentration.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:soulknife' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 13 },
        ],
      },
      {
        kind: 'grantFeature',
        featureId: 'soulknife-rend-mind',
        name: 'Rend Mind',
        description: 'After Sneak Attack, you can attempt to stun the target.',
        predicate: [
          { type: 'edition', value: '2024' },
          { type: 'hasTag', tag: 'subclass:soulknife' },
          { type: 'classLevelAtLeast', classSlug: 'rogue', level: 17 },
        ],
      },
    ],
  },
];

/**
 * All Rogue effects
 */
export const rogueEffects: SourcedEffect[] = [
  rogueProficiencies,
  sneakAttack,
  thievesCant,
  expertiseLevel1,
  cunningAction,
  roguishArchetype,
  uncannyDodge,
  evasion,
  reliableTalent,
  blindsense,
  slipperyMind,
  elusive,
  ...rogueSubclassEffects,
];
