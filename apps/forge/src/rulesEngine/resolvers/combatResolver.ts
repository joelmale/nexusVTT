/**
 * Combat Resolver
 * Orchestrates attack rolls, damage, and combat state changes
 */

import type { CharacterState } from '../types/state';
import type { RollContext, RollResult } from '../types/roll';
import { createRollContext, makeD20Roll } from '../mechanics/rollMechanics';
import {
  applyConditionsToRoll,
  checkAutoCrit,
  checkAutoFailSave,
} from '../mechanics/conditionMechanics';
import { takeDamage } from '../state/resourceOperations';

/**
 * Attack action details
 */
export interface AttackAction {
  /** Attacker's character state */
  attacker: CharacterState;
  /** Defender's character state */
  defender: CharacterState;
  /** Attack bonus (ability mod + proficiency) */
  attackBonus: number;
  /** Damage dice notation (e.g., "1d8+3") */
  damageDice: string;
  /** Damage type */
  damageType: string;
  /** Is this a melee attack within 5 feet? */
  isMeleeWithin5Feet: boolean;
  /** Critical hit damage dice (usually double) */
  criticalDamageDice?: string;
}

/**
 * Damage roll result
 */
export interface DamageRoll {
  /** Individual die rolls */
  rolls: number[];
  /** Damage type */
  damageType: string;
  /** Total damage */
  total: number;
  /** Was this a critical hit? */
  isCritical: boolean;
}

/**
 * Attack result with all combat resolution details
 */
export interface AttackResult {
  /** Attack roll result */
  attackRoll: RollResult;
  /** Was the attack a hit? */
  isHit: boolean;
  /** Target's AC */
  targetAC: number;
  /** Damage roll (if hit) */
  damageRoll?: DamageRoll;
  /** Updated defender state (if hit) */
  defenderState?: CharacterState;
  /** Combat log messages */
  log: string[];
}

/**
 * Parse a dice notation string (e.g., "2d6+3")
 * @param notation - Dice notation
 * @returns Parsed dice info
 */
function parseDiceNotation(notation: string): {
  count: number;
  sides: number;
  modifier: number;
} {
  const match = notation.match(/^(\d+)d(\d+)(?:([+-]\d+))?$/);
  if (!match) {
    throw new Error(`Invalid dice notation: ${notation}`);
  }

  return {
    count: parseInt(match[1], 10),
    sides: parseInt(match[2], 10),
    modifier: match[3] ? parseInt(match[3], 10) : 0,
  };
}

/**
 * Roll damage dice
 * @param notation - Dice notation (e.g., "1d8+3")
 * @param isCritical - Is this a critical hit?
 * @param damageType - Type of damage
 * @param rng - Optional RNG for testing
 * @returns Damage roll result
 */
export function rollDamage(
  notation: string,
  isCritical: boolean,
  damageType: string,
  rng?: () => number
): DamageRoll {
  const { count, sides, modifier } = parseDiceNotation(notation);

  // Roll dice (double for crits)
  const diceCount = isCritical ? count * 2 : count;
  const rolls: number[] = [];

  for (let i = 0; i < diceCount; i++) {
    const roll = rng ? Math.floor(rng() * sides) + 1 : Math.floor(Math.random() * sides) + 1;
    rolls.push(roll);
  }

  // Calculate total
  const diceTotal = rolls.reduce((sum, roll) => sum + roll, 0);
  const total = Math.max(0, diceTotal + modifier);

  return {
    rolls,
    damageType,
    total,
    isCritical,
  };
}

/**
 * Resolve an attack action
 * @param action - Attack action details
 * @param defenderAC - Defender's armor class
 * @param rng - Optional RNG for testing
 * @returns Attack result
 */
export function resolveAttack(
  action: AttackAction,
  defenderAC: number,
  rng?: () => number
): AttackResult {
  const log: string[] = [];

  // Create attack roll context
  let rollContext: RollContext = createRollContext('attack', [action.attackBonus]);

  // Apply attacker's conditions
  rollContext = applyConditionsToRoll(rollContext, action.attacker.conditions, false);

  // Apply defender's conditions (affects incoming attacks)
  rollContext = applyConditionsToRoll(rollContext, action.defender.conditions, true);

  // Make the attack roll
  const attackRoll = makeD20Roll(rollContext, rng);
  log.push(
    `Attack roll: ${attackRoll.finalRoll} + ${action.attackBonus} = ${attackRoll.total} (${attackRoll.rollState})`
  );

  // Check for auto-crit from conditions
  const isAutoCrit = checkAutoCrit(action.defender.conditions, action.isMeleeWithin5Feet);
  const isCriticalHit = attackRoll.isCriticalHit || isAutoCrit;

  // Determine if attack hits
  const isHit = attackRoll.total >= defenderAC || isCriticalHit;

  if (!isHit) {
    log.push(`Miss! (AC ${defenderAC})`);
    return {
      attackRoll,
      isHit: false,
      targetAC: defenderAC,
      log,
    };
  }

  // Attack hits - roll damage
  if (isCriticalHit) {
    log.push(`Critical hit!`);
  } else {
    log.push(`Hit! (AC ${defenderAC})`);
  }

  const damageRoll = rollDamage(action.damageDice, isCriticalHit, action.damageType, rng);
  log.push(`Damage: ${damageRoll.total} ${damageRoll.damageType}`);

  // Apply damage to defender
  const damageResult = takeDamage(action.defender, damageRoll.total);

  if (damageResult.changes) {
    log.push(...damageResult.changes);
  }

  return {
    attackRoll,
    isHit: true,
    targetAC: defenderAC,
    damageRoll,
    defenderState: damageResult.state,
    log,
  };
}

/**
 * Saving throw action
 */
export interface SavingThrowAction {
  /** Character making the save */
  character: CharacterState;
  /** Save DC */
  saveDC: number;
  /** Ability used for save */
  ability: 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';
  /** Save bonus (ability mod + proficiency if proficient) */
  saveBonus: number;
  /** Damage on failure */
  damageOnFail?: string;
  /** Damage on success (usually half) */
  damageOnSuccess?: string;
  /** Damage type */
  damageType?: string;
}

/**
 * Saving throw result
 */
export interface SavingThrowResult {
  /** Save roll result */
  saveRoll: RollResult;
  /** Did the save succeed? */
  success: boolean;
  /** Save DC */
  saveDC: number;
  /** Auto-fail due to conditions? */
  autoFail: boolean;
  /** Damage roll (if any) */
  damageRoll?: DamageRoll;
  /** Updated character state (if damage applied) */
  characterState?: CharacterState;
  /** Combat log messages */
  log: string[];
}

/**
 * Resolve a saving throw
 * @param action - Saving throw action
 * @param rng - Optional RNG for testing
 * @returns Saving throw result
 */
export function resolveSavingThrow(
  action: SavingThrowAction,
  rng?: () => number
): SavingThrowResult {
  const log: string[] = [];

  // Check for auto-fail from conditions
  const autoFail = checkAutoFailSave(action.character.conditions, action.ability);

  if (autoFail) {
    log.push(`${action.ability} save auto-fails due to conditions`);

    // Apply failure damage if specified
    if (action.damageOnFail && action.damageType) {
      const damageRoll = rollDamage(action.damageOnFail, false, action.damageType, rng);
      log.push(`Damage: ${damageRoll.total} ${damageRoll.damageType}`);

      const damageResult = takeDamage(action.character, damageRoll.total);
      if (damageResult.changes) {
        log.push(...damageResult.changes);
      }

      return {
        saveRoll: {
          rolls: [0],
          finalRoll: 0,
          total: 0,
          bonuses: [],
          rollState: 'normal',
          advantageSources: [],
          disadvantageSources: [],
          isNaturalTwenty: false,
          isNaturalOne: false,
          isCriticalHit: false,
        },
        success: false,
        saveDC: action.saveDC,
        autoFail: true,
        damageRoll,
        characterState: damageResult.state,
        log,
      };
    }

    return {
      saveRoll: {
        rolls: [0],
        finalRoll: 0,
        total: 0,
        bonuses: [],
        rollState: 'normal',
        advantageSources: [],
        disadvantageSources: [],
        isNaturalTwenty: false,
        isNaturalOne: false,
        isCriticalHit: false,
      },
      success: false,
      saveDC: action.saveDC,
      autoFail: true,
      log,
    };
  }

  // Create save roll context
  let rollContext: RollContext = createRollContext('save', [action.saveBonus]);

  // Apply conditions
  rollContext = applyConditionsToRoll(rollContext, action.character.conditions, false);

  // Make the save roll
  const saveRoll = makeD20Roll(rollContext, rng);
  log.push(
    `${action.ability} save: ${saveRoll.finalRoll} + ${action.saveBonus} = ${saveRoll.total} (${saveRoll.rollState})`
  );

  const success = saveRoll.total >= action.saveDC;
  log.push(success ? `Success! (DC ${action.saveDC})` : `Failure! (DC ${action.saveDC})`);

  // Apply damage if specified
  const damageNotation = success ? action.damageOnSuccess : action.damageOnFail;
  if (damageNotation && action.damageType) {
    const damageRoll = rollDamage(damageNotation, false, action.damageType, rng);
    log.push(`Damage: ${damageRoll.total} ${damageRoll.damageType}`);

    const damageResult = takeDamage(action.character, damageRoll.total);
    if (damageResult.changes) {
      log.push(...damageResult.changes);
    }

    return {
      saveRoll,
      success,
      saveDC: action.saveDC,
      autoFail: false,
      damageRoll,
      characterState: damageResult.state,
      log,
    };
  }

  return {
    saveRoll,
    success,
    saveDC: action.saveDC,
    autoFail: false,
    log,
  };
}
