/**
 * Condition Mechanics
 * Defines the mechanical effects of each condition
 */

import type { RollContext } from '../types/roll';
import type { ActiveCondition } from '../types/state';
import { addAdvantage, addDisadvantage } from './rollMechanics';

/**
 * Condition mechanical effects configuration
 */
export interface ConditionMechanics {
  /** Condition identifier */
  condition: string;

  /** Description of the condition */
  description: string;

  /** Effects on attack rolls made by the conditioned creature */
  attackRolls?: 'advantage' | 'disadvantage' | 'auto-fail';

  /** Effects on attack rolls against the conditioned creature */
  incomingAttacks?: 'advantage' | 'disadvantage';

  /** Effects on melee attacks against the conditioned creature */
  incomingMeleeAttacks?: 'advantage' | 'crit-on-hit';

  /** Effects on ability checks */
  abilityChecks?: 'disadvantage' | 'auto-fail';

  /** Effects on saving throws */
  savingThrows?: 'disadvantage' | 'auto-fail';

  /** Specific saving throw auto-fails */
  autoFailSaves?: Array<'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA'>;

  /** Speed is reduced to 0 */
  speedZero?: boolean;

  /** Cannot take actions */
  incapacitated?: boolean;

  /** Cannot move or speak */
  cannotMoveOrSpeak?: boolean;

  /** Automatically drops held items */
  dropsItems?: boolean;

  /** Falls prone when applied */
  fallsProne?: boolean;
}

/**
 * D&D 5e condition mechanics database
 */
export const CONDITION_MECHANICS: Record<string, ConditionMechanics> = {
  // Prone
  prone: {
    condition: 'prone',
    description: 'A prone creature\'s only movement option is to crawl. The creature has disadvantage on attack rolls. An attack roll against the creature has advantage if the attacker is within 5 feet of the creature. Otherwise, the attack roll has disadvantage.',
    attackRolls: 'disadvantage',
    incomingMeleeAttacks: 'advantage', // Within 5 feet only (simplified)
  },

  // Invisible
  invisible: {
    condition: 'invisible',
    description: 'An invisible creature is impossible to see without special senses. The creature has advantage on attack rolls, and attack rolls against the creature have disadvantage.',
    attackRolls: 'advantage',
    incomingAttacks: 'disadvantage',
  },

  // Poisoned
  poisoned: {
    condition: 'poisoned',
    description: 'A poisoned creature has disadvantage on attack rolls and ability checks.',
    attackRolls: 'disadvantage',
    abilityChecks: 'disadvantage',
  },

  // Frightened
  frightened: {
    condition: 'frightened',
    description: 'A frightened creature has disadvantage on ability checks and attack rolls while the source of its fear is within line of sight.',
    attackRolls: 'disadvantage',
    abilityChecks: 'disadvantage',
  },

  // Restrained
  restrained: {
    condition: 'restrained',
    description: 'A restrained creature\'s speed becomes 0. The creature has disadvantage on attack rolls and Dexterity saving throws. Attack rolls against the creature have advantage.',
    speedZero: true,
    attackRolls: 'disadvantage',
    savingThrows: 'disadvantage', // DEX only in real rules, simplified here
    incomingAttacks: 'advantage',
  },

  // Stunned
  stunned: {
    condition: 'stunned',
    description: 'A stunned creature is incapacitated, can\'t move, and can speak only falteringly. The creature automatically fails Strength and Dexterity saving throws. Attack rolls against the creature have advantage.',
    incapacitated: true,
    cannotMoveOrSpeak: true,
    speedZero: true,
    autoFailSaves: ['STR', 'DEX'],
    incomingAttacks: 'advantage',
  },

  // Paralyzed
  paralyzed: {
    condition: 'paralyzed',
    description: 'A paralyzed creature is incapacitated and can\'t move or speak. The creature automatically fails Strength and Dexterity saving throws. Attack rolls against the creature have advantage. Any attack that hits the creature is a critical hit if the attacker is within 5 feet of the creature.',
    incapacitated: true,
    cannotMoveOrSpeak: true,
    speedZero: true,
    autoFailSaves: ['STR', 'DEX'],
    incomingAttacks: 'advantage',
    incomingMeleeAttacks: 'crit-on-hit', // Within 5 feet only
  },

  // Unconscious
  unconscious: {
    condition: 'unconscious',
    description: 'An unconscious creature is incapacitated, can\'t move or speak, and is unaware of its surroundings. The creature drops whatever it\'s holding and falls prone. The creature automatically fails Strength and Dexterity saving throws. Attack rolls against the creature have advantage. Any attack that hits the creature is a critical hit if the attacker is within 5 feet of the creature.',
    incapacitated: true,
    cannotMoveOrSpeak: true,
    speedZero: true,
    autoFailSaves: ['STR', 'DEX'],
    incomingAttacks: 'advantage',
    incomingMeleeAttacks: 'crit-on-hit', // Within 5 feet only
    dropsItems: true,
    fallsProne: true,
  },

  // Charmed
  charmed: {
    condition: 'charmed',
    description: 'A charmed creature can\'t attack the charmer or target the charmer with harmful abilities or magical effects. The charmer has advantage on any ability check to interact socially with the creature.',
    // Note: Attack restriction is context-dependent (who is the charmer?)
    // Simplified: no mechanical effect on attack rolls in general
  },

  // Blinded
  blinded: {
    condition: 'blinded',
    description: 'A blinded creature can\'t see and automatically fails any ability check that requires sight. Attack rolls against the creature have advantage, and the creature\'s attack rolls have disadvantage.',
    attackRolls: 'disadvantage',
    incomingAttacks: 'advantage',
    abilityChecks: 'disadvantage', // Simplified: all checks, not just sight-based
  },

  // Deafened
  deafened: {
    condition: 'deafened',
    description: 'A deafened creature can\'t hear and automatically fails any ability check that requires hearing.',
    abilityChecks: 'disadvantage', // Simplified: all checks, not just hearing-based
  },

  // Grappled
  grappled: {
    condition: 'grappled',
    description: 'A grappled creature\'s speed becomes 0, and it can\'t benefit from any bonus to its speed.',
    speedZero: true,
  },

  // Petrified
  petrified: {
    condition: 'petrified',
    description: 'A petrified creature is transformed, along with any nonmagical object it is wearing or carrying, into a solid inanimate substance (usually stone). Its weight increases by a factor of ten, and it ceases aging. The creature is incapacitated, can\'t move or speak, and is unaware of its surroundings. Attack rolls against the creature have advantage. The creature automatically fails Strength and Dexterity saving throws. The creature has resistance to all damage. The creature is immune to poison and disease.',
    incapacitated: true,
    cannotMoveOrSpeak: true,
    speedZero: true,
    autoFailSaves: ['STR', 'DEX'],
    incomingAttacks: 'advantage',
  },
};

/**
 * Apply condition effects to a roll context
 *
 * @param context - Roll context to modify
 * @param conditions - Active conditions on the creature making the roll
 * @param isDefender - Is this creature the target of an attack? (affects incoming attack rules)
 * @returns Modified roll context
 */
export function applyConditionsToRoll(
  context: RollContext,
  conditions: ActiveCondition[],
  isDefender: boolean = false
): RollContext {
  let modifiedContext = { ...context };

  for (const activeCondition of conditions) {
    const mechanics = CONDITION_MECHANICS[activeCondition.condition];
    if (!mechanics) {
      continue; // Unknown condition, skip
    }

    // Apply effects based on roll type and whether this is the attacker or defender
    if (!isDefender) {
      // Creature making the roll (attacker/actor)
      if (context.rollType === 'attack' && mechanics.attackRolls === 'disadvantage') {
        modifiedContext = addDisadvantage(
          modifiedContext,
          activeCondition.condition,
          mechanics.description
        );
      }

      if (context.rollType === 'attack' && mechanics.attackRolls === 'advantage') {
        modifiedContext = addAdvantage(
          modifiedContext,
          activeCondition.condition,
          mechanics.description
        );
      }

      if (context.rollType === 'check' && mechanics.abilityChecks === 'disadvantage') {
        modifiedContext = addDisadvantage(
          modifiedContext,
          activeCondition.condition,
          mechanics.description
        );
      }

      if (context.rollType === 'save' && mechanics.savingThrows === 'disadvantage') {
        modifiedContext = addDisadvantage(
          modifiedContext,
          activeCondition.condition,
          mechanics.description
        );
      }
    } else {
      // Creature being targeted (defender)
      if (context.rollType === 'attack' && mechanics.incomingAttacks === 'advantage') {
        modifiedContext = addAdvantage(
          modifiedContext,
          `target-${activeCondition.condition}`,
          `Target is ${activeCondition.condition}`
        );
      }

      if (context.rollType === 'attack' && mechanics.incomingAttacks === 'disadvantage') {
        modifiedContext = addDisadvantage(
          modifiedContext,
          `target-${activeCondition.condition}`,
          `Target is ${activeCondition.condition}`
        );
      }

      // Melee attacks have special rules for some conditions
      if (
        context.rollType === 'attack' &&
        mechanics.incomingMeleeAttacks === 'advantage'
      ) {
        // In real game, would check if attack is melee and within 5 feet
        modifiedContext = addAdvantage(
          modifiedContext,
          `target-${activeCondition.condition}-melee`,
          `Target is ${activeCondition.condition} (melee advantage)`
        );
      }
    }
  }

  return modifiedContext;
}

/**
 * Check if a creature auto-fails a saving throw due to conditions
 *
 * @param conditions - Active conditions
 * @param ability - Ability being used for the save
 * @returns True if save auto-fails
 */
export function checkAutoFailSave(
  conditions: ActiveCondition[],
  ability: 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA'
): boolean {
  for (const activeCondition of conditions) {
    const mechanics = CONDITION_MECHANICS[activeCondition.condition];
    if (!mechanics) {
      continue;
    }

    // Check for general save auto-fail
    if (mechanics.savingThrows === 'auto-fail') {
      return true;
    }

    // Check for specific ability auto-fail
    if (mechanics.autoFailSaves?.includes(ability)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a creature is incapacitated by any condition
 *
 * @param conditions - Active conditions
 * @returns True if incapacitated
 */
export function isIncapacitated(conditions: ActiveCondition[]): boolean {
  return conditions.some((c) => CONDITION_MECHANICS[c.condition]?.incapacitated);
}

/**
 * Check if an attack against a creature should be a critical hit
 *
 * @param conditions - Active conditions on the target
 * @param isMeleeWithin5Feet - Is this a melee attack within 5 feet?
 * @returns True if attack is auto-crit
 */
export function checkAutoCrit(
  conditions: ActiveCondition[],
  isMeleeWithin5Feet: boolean
): boolean {
  if (!isMeleeWithin5Feet) {
    return false;
  }

  return conditions.some(
    (c) => CONDITION_MECHANICS[c.condition]?.incomingMeleeAttacks === 'crit-on-hit'
  );
}
