/**
 * Status Conditions
 * Pure data - no game logic in code
 *
 * D&D 5e has 13 standard conditions that affect creatures
 */

import type { SourcedEffect } from '../../types/effects';

/**
 * Blinded Condition
 * - Automatically fail sight-based ability checks
 * - Disadvantage on attack rolls
 * - Attack rolls against you have advantage
 */
export const blindedCondition: SourcedEffect = {
  sourceId: 'condition:blinded',
  effectId: 'blinded-effects',
  name: 'Blinded',
  description: 'A blinded creature cannot see and automatically fails any ability check that requires sight. Attack rolls against the creature have advantage, and the creature\'s attack rolls have disadvantage.',
  effects: [
    {
      kind: 'condition',
      condition: 'blinded',
    },
    {
      kind: 'tag',
      tags: ['condition:blinded', 'cannot-see'],
    },
  ],
};

/**
 * Charmed Condition
 * - Cannot attack the charmer
 * - Charmer has advantage on social checks
 */
export const charmedCondition: SourcedEffect = {
  sourceId: 'condition:charmed',
  effectId: 'charmed-effects',
  name: 'Charmed',
  description: 'A charmed creature can\'t attack the charmer or target the charmer with harmful abilities or magical effects. The charmer has advantage on ability checks to interact socially with the creature.',
  effects: [
    {
      kind: 'condition',
      condition: 'charmed',
    },
    {
      kind: 'tag',
      tags: ['condition:charmed'],
    },
  ],
};

/**
 * Deafened Condition
 * - Cannot hear
 * - Automatically fail hearing-based checks
 */
export const deafenedCondition: SourcedEffect = {
  sourceId: 'condition:deafened',
  effectId: 'deafened-effects',
  name: 'Deafened',
  description: 'A deafened creature can\'t hear and automatically fails any ability check that requires hearing.',
  effects: [
    {
      kind: 'condition',
      condition: 'deafened',
    },
    {
      kind: 'tag',
      tags: ['condition:deafened', 'cannot-hear'],
    },
  ],
};

/**
 * Frightened Condition
 * - Disadvantage on ability checks and attack rolls while source is in sight
 * - Cannot willingly move closer to source
 */
export const frightenedCondition: SourcedEffect = {
  sourceId: 'condition:frightened',
  effectId: 'frightened-effects',
  name: 'Frightened',
  description: 'A frightened creature has disadvantage on ability checks and attack rolls while the source of its fear is within line of sight. The creature can\'t willingly move closer to the source of its fear.',
  effects: [
    {
      kind: 'condition',
      condition: 'frightened',
    },
    {
      kind: 'tag',
      tags: ['condition:frightened'],
    },
  ],
};

/**
 * Grappled Condition
 * - Speed becomes 0
 * - Cannot benefit from speed bonuses
 */
export const grappledCondition: SourcedEffect = {
  sourceId: 'condition:grappled',
  effectId: 'grappled-effects',
  name: 'Grappled',
  description: 'A grappled creature\'s speed becomes 0, and it can\'t benefit from any bonus to its speed. The condition ends if the grappler is incapacitated.',
  effects: [
    {
      kind: 'condition',
      condition: 'grappled',
    },
    {
      kind: 'speed',
      movementType: 'walk',
      value: 0,
      priority: 'flag', // Condition forces speed to 0
    },
    {
      kind: 'tag',
      tags: ['condition:grappled', 'speed-zero'],
    },
  ],
};

/**
 * Incapacitated Condition
 * - Cannot take actions or reactions
 */
export const incapacitatedCondition: SourcedEffect = {
  sourceId: 'condition:incapacitated',
  effectId: 'incapacitated-effects',
  name: 'Incapacitated',
  description: 'An incapacitated creature can\'t take actions or reactions.',
  effects: [
    {
      kind: 'condition',
      condition: 'incapacitated',
    },
    {
      kind: 'tag',
      tags: ['condition:incapacitated', 'cannot-act'],
    },
  ],
};

/**
 * Invisible Condition
 * - Cannot be seen without special senses
 * - Advantage on attack rolls
 * - Attack rolls against you have disadvantage
 * - For purposes of hiding, heavily obscured
 */
export const invisibleCondition: SourcedEffect = {
  sourceId: 'condition:invisible',
  effectId: 'invisible-effects',
  name: 'Invisible',
  description: 'An invisible creature is impossible to see without the aid of magic or a special sense. The creature has advantage on attack rolls, and attack rolls against the creature have disadvantage.',
  effects: [
    {
      kind: 'condition',
      condition: 'invisible',
    },
    {
      kind: 'tag',
      tags: ['condition:invisible', 'cannot-be-seen'],
    },
  ],
};

/**
 * Paralyzed Condition
 * - Incapacitated
 * - Cannot move or speak
 * - Automatically fail STR and DEX saves
 * - Attack rolls against you have advantage
 * - Any attack that hits is a critical hit (if within 5 feet)
 */
export const paralyzedCondition: SourcedEffect = {
  sourceId: 'condition:paralyzed',
  effectId: 'paralyzed-effects',
  name: 'Paralyzed',
  description: 'A paralyzed creature is incapacitated and can\'t move or speak. The creature automatically fails Strength and Dexterity saving throws. Attack rolls against the creature have advantage. Any attack that hits the creature is a critical hit if the attacker is within 5 feet of the creature.',
  effects: [
    {
      kind: 'condition',
      condition: 'paralyzed',
    },
    {
      kind: 'speed',
      movementType: 'walk',
      value: 0,
      priority: 'flag', // Condition forces speed to 0
    },
    {
      kind: 'tag',
      tags: ['condition:paralyzed', 'condition:incapacitated', 'cannot-move', 'cannot-speak', 'auto-fail-str-dex-saves'],
    },
  ],
};

/**
 * Petrified Condition
 * - Transformed into solid stone
 * - Incapacitated
 * - Cannot move or speak
 * - Unaware of surroundings
 * - Automatically fail STR and DEX saves
 * - Resistance to all damage
 * - Immune to poison and disease
 */
export const petrifiedCondition: SourcedEffect = {
  sourceId: 'condition:petrified',
  effectId: 'petrified-effects',
  name: 'Petrified',
  description: 'A petrified creature is transformed, along with any nonmagical object it is wearing or carrying, into a solid inanimate substance (usually stone). Its weight increases by a factor of ten, and it ceases aging. The creature is incapacitated, can\'t move or speak, and is unaware of its surroundings. The creature has resistance to all damage and is immune to poison and disease.',
  effects: [
    {
      kind: 'condition',
      condition: 'petrified',
    },
    {
      kind: 'speed',
      movementType: 'walk',
      value: 0,
      priority: 'flag', // Condition forces speed to 0
    },
    {
      kind: 'tag',
      tags: [
        'condition:petrified',
        'condition:incapacitated',
        'cannot-move',
        'cannot-speak',
        'unaware',
        'resistance:all-damage',
        'immune:poison',
        'immune:disease',
      ],
    },
  ],
};

/**
 * Poisoned Condition
 * - Disadvantage on attack rolls and ability checks
 */
export const poisonedCondition: SourcedEffect = {
  sourceId: 'condition:poisoned',
  effectId: 'poisoned-effects',
  name: 'Poisoned',
  description: 'A poisoned creature has disadvantage on attack rolls and ability checks.',
  effects: [
    {
      kind: 'condition',
      condition: 'poisoned',
    },
    {
      kind: 'tag',
      tags: ['condition:poisoned'],
    },
  ],
};

/**
 * Prone Condition
 * - Can only crawl or stand up (costs half movement)
 * - Disadvantage on attack rolls
 * - Attack rolls against you have advantage (within 5 feet)
 * - Attack rolls against you have disadvantage (beyond 5 feet)
 */
export const proneCondition: SourcedEffect = {
  sourceId: 'condition:prone',
  effectId: 'prone-effects',
  name: 'Prone',
  description: 'A prone creature\'s only movement option is to crawl, unless it stands up. The creature has disadvantage on attack rolls. An attack roll against the creature has advantage if the attacker is within 5 feet of the creature. Otherwise, the attack roll has disadvantage.',
  effects: [
    {
      kind: 'condition',
      condition: 'prone',
    },
    {
      kind: 'tag',
      tags: ['condition:prone', 'can-only-crawl'],
    },
  ],
};

/**
 * Restrained Condition
 * - Speed becomes 0
 * - Disadvantage on attack rolls and DEX saves
 * - Attack rolls against you have advantage
 */
export const restrainedCondition: SourcedEffect = {
  sourceId: 'condition:restrained',
  effectId: 'restrained-effects',
  name: 'Restrained',
  description: 'A restrained creature\'s speed becomes 0, and it can\'t benefit from any bonus to its speed. Attack rolls against the creature have advantage, and the creature\'s attack rolls have disadvantage. The creature has disadvantage on Dexterity saving throws.',
  effects: [
    {
      kind: 'condition',
      condition: 'restrained',
    },
    {
      kind: 'speed',
      movementType: 'walk',
      value: 0,
      priority: 'flag', // Condition forces speed to 0
    },
    {
      kind: 'tag',
      tags: ['condition:restrained', 'speed-zero'],
    },
  ],
};

/**
 * Stunned Condition
 * - Incapacitated
 * - Cannot move
 * - Can speak falteringly
 * - Automatically fail STR and DEX saves
 * - Attack rolls against you have advantage
 */
export const stunnedCondition: SourcedEffect = {
  sourceId: 'condition:stunned',
  effectId: 'stunned-effects',
  name: 'Stunned',
  description: 'A stunned creature is incapacitated, can\'t move, and can speak only falteringly. The creature automatically fails Strength and Dexterity saving throws. Attack rolls against the creature have advantage.',
  effects: [
    {
      kind: 'condition',
      condition: 'stunned',
    },
    {
      kind: 'speed',
      movementType: 'walk',
      value: 0,
      priority: 'flag', // Condition forces speed to 0
    },
    {
      kind: 'tag',
      tags: ['condition:stunned', 'condition:incapacitated', 'cannot-move', 'auto-fail-str-dex-saves'],
    },
  ],
};

/**
 * Unconscious Condition
 * - Incapacitated
 * - Cannot move or speak
 * - Unaware of surroundings
 * - Drops whatever it's holding and falls prone
 * - Automatically fail STR and DEX saves
 * - Attack rolls against you have advantage
 * - Any attack that hits is a critical hit (if within 5 feet)
 */
export const unconsciousCondition: SourcedEffect = {
  sourceId: 'condition:unconscious',
  effectId: 'unconscious-effects',
  name: 'Unconscious',
  description: 'An unconscious creature is incapacitated, can\'t move or speak, and is unaware of its surroundings. The creature drops whatever it\'s holding and falls prone. The creature automatically fails Strength and Dexterity saving throws. Attack rolls against the creature have advantage. Any attack that hits the creature is a critical hit if the attacker is within 5 feet of the creature.',
  effects: [
    {
      kind: 'condition',
      condition: 'unconscious',
    },
    {
      kind: 'speed',
      movementType: 'walk',
      value: 0,
      priority: 'flag', // Condition forces speed to 0
    },
    {
      kind: 'tag',
      tags: [
        'condition:unconscious',
        'condition:incapacitated',
        'condition:prone',
        'cannot-move',
        'cannot-speak',
        'unaware',
        'auto-fail-str-dex-saves',
      ],
    },
  ],
};

/**
 * Exhaustion Condition (Level 1)
 * - Disadvantage on ability checks
 */
export const exhaustion1Condition: SourcedEffect = {
  sourceId: 'condition:exhaustion-1',
  effectId: 'exhaustion-1-effects',
  name: 'Exhaustion (Level 1)',
  description: 'Disadvantage on ability checks.',
  effects: [
    {
      kind: 'condition',
      condition: 'exhaustion-1',
    },
    {
      kind: 'tag',
      tags: ['condition:exhaustion', 'exhaustion:level-1'],
    },
  ],
};

/**
 * Exhaustion Condition (Level 2)
 * - Speed halved
 * - Includes level 1 effects
 */
export const exhaustion2Condition: SourcedEffect = {
  sourceId: 'condition:exhaustion-2',
  effectId: 'exhaustion-2-effects',
  name: 'Exhaustion (Level 2)',
  description: 'Speed halved.',
  effects: [
    {
      kind: 'condition',
      condition: 'exhaustion-2',
    },
    {
      kind: 'tag',
      tags: ['condition:exhaustion', 'exhaustion:level-2', 'speed-halved'],
    },
  ],
};

/**
 * All condition effects
 */
export const allConditions: SourcedEffect[] = [
  blindedCondition,
  charmedCondition,
  deafenedCondition,
  frightenedCondition,
  grappledCondition,
  incapacitatedCondition,
  invisibleCondition,
  paralyzedCondition,
  petrifiedCondition,
  poisonedCondition,
  proneCondition,
  restrainedCondition,
  stunnedCondition,
  unconsciousCondition,
  exhaustion1Condition,
  exhaustion2Condition,
];
