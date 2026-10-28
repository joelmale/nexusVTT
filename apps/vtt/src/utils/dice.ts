import type { DiceRoll } from '@/types/game';
import {
  parseDiceExpression,
  rollDice,
  rollParsedDice,
  type ParsedDiceExpression,
  type Rng,
} from '@nexus/rules-5e';
import { v4 as uuidv4 } from 'uuid';

/**
 * Client-side dice. Parsing and rolling are the shared engine in
 * `@nexus/rules-5e`; shared rolls are made by the server, and this module is
 * for previews and local rolls with the same rules.
 */
export { parseDiceExpression, rollDice };
export type { ParsedDiceExpression };

/**
 * Legacy single-pool form of {@link parseDiceExpression}.
 */
export function parseDiceExpressionLegacy(expression: string): {
  count: number;
  sides: number;
  modifier: number;
} | null {
  const result = parseDiceExpression(expression);
  if (!result || result.pools.length !== 1) return null;

  return {
    count: result.pools[0].count,
    sides: result.pools[0].sides,
    modifier: result.modifier,
  };
}

export function createDiceRoll(
  expression: string,
  userId: string,
  userName: string,
  options: {
    isPrivate?: boolean;
    advantage?: boolean;
    disadvantage?: boolean;
    rng?: Rng;
  } = {},
): DiceRoll | null {
  const parsed = parseDiceExpression(expression);
  if (!parsed) return null;

  const evaluation = rollParsedDice(parsed, {
    advantage: options.advantage,
    disadvantage: options.disadvantage,
    rng: options.rng,
  });

  return {
    id: uuidv4(),
    userId,
    userName,
    expression,
    pools: evaluation.pools,
    modifier: evaluation.modifier,
    results: evaluation.results,
    advResults: evaluation.advResults,
    keptRoll: evaluation.keptRoll,
    total: evaluation.total,
    crit: evaluation.crit,
    timestamp: Date.now(),
    isPrivate: options.isPrivate || false,
  };
}

export function formatDiceRoll(roll: DiceRoll): string {
  const { expression, pools, modifier, total, crit } = roll;

  if (pools.length === 0) return `${expression} = ${total}`;

  let resultText: string;
  const critClass =
    crit === 'success'
      ? 'crit-success'
      : crit === 'failure'
        ? 'crit-failure'
        : '';

  // Handle advantage/disadvantage
  if (roll.advResults && roll.advResults.length > 0) {
    const sum1 = roll.results.reduce((s, r) => s + r, 0);
    const sum2 = roll.advResults.reduce((s, r) => s + r, 0);

    // Determine which set was kept (higher for advantage, lower for disadvantage)
    const firstRollKept = roll.keptRoll ? roll.keptRoll === 'first' : sum1 >= sum2;

    const formatRollSet = (rolls: number[], kept: boolean) =>
      `<span class="${kept ? 'kept-roll' : 'discarded-roll'}">[${rolls.join(', ')}]</span>`;

    resultText = `${expression}: ${formatRollSet(roll.results, firstRollKept)} | ${formatRollSet(roll.advResults, !firstRollKept)}`;
  } else {
    // Normal rolls - show each pool separately
    resultText = `${expression}: `;

    const poolTexts: string[] = [];
    for (const pool of pools) {
      const poolLabel = `${pool.count}d${pool.sides}`;
      const poolResults = `[${pool.results.join(', ')}]`;
      poolTexts.push(
        `<span class="dice-pool"><span class="pool-label">${poolLabel}</span><span class="${critClass}">${poolResults}</span></span>`,
      );
    }

    resultText += poolTexts.join(' + ');
  }

  if (modifier !== 0) {
    resultText += ` ${modifier >= 0 ? '+' : ''}${modifier}`;
  }

  resultText += ` = <strong class="roll-total ${critClass}">${total}</strong>`;

  return resultText;
}

// Common dice expressions for quick access
export const COMMON_DICE = [
  'd4',
  'd6',
  'd8',
  'd10',
  'd12',
  'd20',
  'd100',
  '2d6',
  '3d6',
  '4d6',
  // Complex formulas
  '1d20+1d6',
  '2d6+1d4',
  '3d4+2d6',
];
