/**
 * Roll Mechanics
 * Advantage/Disadvantage aggregation and d20 roll resolution
 */

import type {
  RollContext,
  RollState,
  RollResult,
  AdvantageSource,
  DisadvantageSource,
} from '../types/roll';

/**
 * Determine final roll state from advantage/disadvantage sources
 *
 * Rules:
 * - Any number of advantage sources + 0 disadvantage sources = advantage
 * - 0 advantage sources + any number of disadvantage sources = disadvantage
 * - Any number of advantage sources + any number of disadvantage sources = normal (they cancel)
 *
 * @param advantageSources - Sources granting advantage
 * @param disadvantageSources - Sources granting disadvantage
 * @returns Final roll state
 */
export function determineRollState(
  advantageSources: AdvantageSource[],
  disadvantageSources: DisadvantageSource[]
): RollState {
  const hasAdvantage = advantageSources.length > 0;
  const hasDisadvantage = disadvantageSources.length > 0;

  // Cancel rule: if both exist, they cancel to normal
  if (hasAdvantage && hasDisadvantage) {
    return 'normal';
  }

  // Only advantage
  if (hasAdvantage) {
    return 'advantage';
  }

  // Only disadvantage
  if (hasDisadvantage) {
    return 'disadvantage';
  }

  // Neither
  return 'normal';
}

/**
 * Roll a d20 (for testing, can be mocked with seeded RNG)
 *
 * @param rng - Optional RNG function (for deterministic testing)
 * @returns Number between 1 and 20
 */
export function rollD20(rng?: () => number): number {
  if (rng) {
    // Use provided RNG (for testing)
    return Math.floor(rng() * 20) + 1;
  }
  // Default: random
  return Math.floor(Math.random() * 20) + 1;
}

/**
 * Make a d20 roll with advantage/disadvantage
 *
 * @param context - Roll context with advantage/disadvantage sources
 * @param rng - Optional RNG function (for deterministic testing)
 * @returns Roll result with final value and metadata
 */
export function makeD20Roll(
  context: RollContext,
  rng?: () => number
): RollResult {
  const rollState = determineRollState(
    context.advantageSources,
    context.disadvantageSources
  );

  let rolls: [number] | [number, number];
  let finalRoll: number;

  if (rollState === 'advantage') {
    // Roll twice, take higher
    const roll1 = rollD20(rng);
    const roll2 = rollD20(rng);
    rolls = [roll1, roll2];
    finalRoll = Math.max(roll1, roll2);
  } else if (rollState === 'disadvantage') {
    // Roll twice, take lower
    const roll1 = rollD20(rng);
    const roll2 = rollD20(rng);
    rolls = [roll1, roll2];
    finalRoll = Math.min(roll1, roll2);
  } else {
    // Normal: roll once
    const roll = rollD20(rng);
    rolls = [roll];
    finalRoll = roll;
  }

  // Calculate total bonuses
  const totalBonus = context.bonuses.reduce((sum, bonus) => sum + bonus, 0);
  const total = finalRoll + totalBonus;

  // Check for natural 20 or natural 1
  const isNaturalTwenty = finalRoll === 20;
  const isNaturalOne = finalRoll === 1;

  return {
    rolls,
    finalRoll,
    total,
    bonuses: context.bonuses,
    rollState,
    advantageSources: context.advantageSources,
    disadvantageSources: context.disadvantageSources,
    isNaturalTwenty,
    isNaturalOne,
    // Critical hit determination can be enhanced with features like Champion Fighter
    isCriticalHit: isNaturalTwenty,
  };
}

/**
 * Create a basic roll context
 *
 * @param rollType - Type of roll
 * @param bonuses - Flat bonuses to apply
 * @returns Empty roll context
 */
export function createRollContext(
  rollType: 'attack' | 'save' | 'check' | 'initiative',
  bonuses: number[] = []
): RollContext {
  return {
    rollType,
    advantageSources: [],
    disadvantageSources: [],
    bonuses,
  };
}

/**
 * Add advantage to a roll context
 *
 * @param context - Roll context
 * @param source - Source of advantage
 * @param reason - Optional reason
 * @returns Updated context
 */
export function addAdvantage(
  context: RollContext,
  source: string,
  reason?: string
): RollContext {
  return {
    ...context,
    advantageSources: [
      ...context.advantageSources,
      { source, reason },
    ],
  };
}

/**
 * Add disadvantage to a roll context
 *
 * @param context - Roll context
 * @param source - Source of disadvantage
 * @param reason - Optional reason
 * @returns Updated context
 */
export function addDisadvantage(
  context: RollContext,
  source: string,
  reason?: string
): RollContext {
  return {
    ...context,
    disadvantageSources: [
      ...context.disadvantageSources,
      { source, reason },
    ],
  };
}
