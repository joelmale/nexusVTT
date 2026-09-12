import type { DiceRoll, DicePool } from '@/types/game';
import { v4 as uuidv4 } from 'uuid';

interface ParsedDiceExpression {
  pools: Array<{ count: number; sides: number }>;
  modifier: number;
}

/**
 * Parse complex dice expressions like:
 * - "2d6+3" (single die type with modifier)
 * - "3d4, 6d20" (multiple die types)
 * - "2d6+3d8+5" (multiple die types with modifier)
 * - "1d20, 2d6, 1d4+2" (mixed format)
 */
export function parseDiceExpression(
  expression: string,
): ParsedDiceExpression | null {
  const cleaned = expression.toLowerCase().replace(/\s/g, '');

  // Check for trailing operators (invalid expressions like "2d6+" or "1d20-")
  // eslint-disable-next-line no-useless-escape
  if (/[+\-]$/.test(cleaned)) {
    return null;
  }

  const pools: Array<{ count: number; sides: number }> = [];
  let modifier = 0;

  // Split by comma or plus/minus (but keep the sign)
  // Match patterns: XdY where X is optional count, Y is sides
  const dicePattern = /(\d*)d(\d+)/g;
  const matches = [...cleaned.matchAll(dicePattern)];

  if (matches.length === 0) return null;

  // Extract all dice pools
  for (const match of matches) {
    const count = match[1] ? parseInt(match[1]) : 1;
    const sides = parseInt(match[2]);

    if (count < 1 || count > 100 || sides < 2 || sides > 1000) {
      return null;
    }

    pools.push({ count, sides });
  }

  // Extract modifier (any number not part of a dice expression)
  // Remove all dice expressions first, then look for remaining numbers with +/-
  let withoutDice = cleaned.replace(/\d*d\d+/g, '');
  // Also remove commas
  withoutDice = withoutDice.replace(/,/g, '');

  // Now extract any remaining number with sign (this is the modifier)
  const modifierMatch = withoutDice.match(/([+-]\d+)/);
  if (modifierMatch) {
    modifier = parseInt(modifierMatch[1]);
    // Remove the matched modifier
    withoutDice = withoutDice.replace(modifierMatch[0], '');
  }

  // Remove all + signs (they're valid separators between dice)
  // We already checked for trailing operators above, so any + here is valid
  withoutDice = withoutDice.replace(/\+/g, '');

  // If anything remains (like a stray - or other characters), it's invalid
  if (withoutDice.length > 0) {
    return null;
  }

  return { pools, modifier };
}

/**
 * Legacy function for backwards compatibility
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

export function rollDice(count: number, sides: number): number[] {
  const results: number[] = [];
  for (let i = 0; i < count; i++) {
    results.push(Math.floor(Math.random() * sides) + 1);
  }
  return results;
}

export function createDiceRoll(
  expression: string,
  userId: string,
  userName: string,
  options: {
    isPrivate?: boolean;
    advantage?: boolean;
    disadvantage?: boolean;
  } = {},
): DiceRoll | null {
  const parsed = parseDiceExpression(expression);
  if (!parsed) return null;

  const rollSum = (rolls: number[]) => rolls.reduce((sum, r) => sum + r, 0);

  // Roll all dice pools
  const dicePools: DicePool[] = [];
  let allResults: number[] = [];
  let allAdvResults: number[] | undefined = undefined;

  const hasAdvantageDisadvantage = options.advantage || options.disadvantage;

  for (const poolDef of parsed.pools) {
    const results = rollDice(poolDef.count, poolDef.sides);
    let advResults: number[] | undefined = undefined;

    if (hasAdvantageDisadvantage) {
      advResults = rollDice(poolDef.count, poolDef.sides);
    }

    dicePools.push({
      count: poolDef.count,
      sides: poolDef.sides,
      results,
      advResults,
    });

    allResults = allResults.concat(results);
    if (advResults) {
      if (!allAdvResults) allAdvResults = [];
      allAdvResults = allAdvResults.concat(advResults);
    }
  }

  // Calculate total
  let total: number;

  if (hasAdvantageDisadvantage && allAdvResults) {
    const sum1 = rollSum(allResults);
    const sum2 = rollSum(allAdvResults);

    if (options.advantage) {
      total = Math.max(sum1, sum2) + parsed.modifier;
    } else {
      // Disadvantage
      total = Math.min(sum1, sum2) + parsed.modifier;
    }
  } else {
    total = rollSum(allResults) + parsed.modifier;
  }

  // Check for critical success/failure (single d20 only)
  let crit: 'success' | 'failure' | undefined = undefined;
  if (
    dicePools.length === 1 &&
    dicePools[0].count === 1 &&
    dicePools[0].sides === 20
  ) {
    if (dicePools[0].results[0] === 20) crit = 'success';
    if (dicePools[0].results[0] === 1) crit = 'failure';
  }

  return {
    id: uuidv4(),
    userId,
    userName,
    expression,
    pools: dicePools,
    modifier: parsed.modifier,
    results: allResults,
    advResults: allAdvResults,
    total,
    crit,
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
    const firstRollKept = sum1 >= sum2; // This will be correct for both adv/dis based on which was used

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
