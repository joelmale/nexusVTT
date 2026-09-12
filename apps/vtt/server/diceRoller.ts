import crypto from 'crypto';

/**
 * Server-side dice roller using cryptographically secure random number generation
 */

export interface DicePool {
  count: number;
  sides: number;
  results: number[];
  advResults?: number[];
}

export interface ServerDiceRoll {
  id: string;
  userId: string;
  userName: string;
  expression: string;
  pools: DicePool[];
  modifier: number;
  results: number[];
  advResults?: number[];
  total: number;
  timestamp: number;
  crit?: 'success' | 'failure';
  isPrivate?: boolean;
}

interface ParsedDiceExpression {
  pools: Array<{ count: number; sides: number }>;
  modifier: number;
}

/**
 * Parse dice expressions like "2d6+3", "3d4, 6d20", etc.
 */
function parseDiceExpression(expression: string): ParsedDiceExpression | null {
  const cleaned = expression.toLowerCase().replace(/\s/g, '');

  const pools: Array<{ count: number; sides: number }> = [];
  let modifier = 0;

  // Match all dice patterns: XdY
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

  // Extract modifier
  let withoutDice = cleaned.replace(/\d*d\d+/g, '');
  withoutDice = withoutDice.replace(/,/g, '');

  const modifierMatch = withoutDice.match(/([+-]\d+)/);
  if (modifierMatch) {
    modifier = parseInt(modifierMatch[1]);
  }

  return { pools, modifier };
}

/**
 * Generate a cryptographically secure random integer between min and max (inclusive)
 */
function secureRandomInt(min: number, max: number): number {
  const range = max - min + 1;
  const bytesNeeded = Math.ceil(Math.log2(range) / 8);
  const maxValue = Math.pow(256, bytesNeeded);
  const threshold = maxValue - (maxValue % range);

  let value: number;
  do {
    const randomBytes = crypto.randomBytes(bytesNeeded);
    value = 0;
    for (let i = 0; i < bytesNeeded; i++) {
      value = value * 256 + randomBytes[i];
    }
  } while (value >= threshold);

  return min + (value % range);
}

/**
 * Roll dice using cryptographically secure random numbers
 */
function rollDice(count: number, sides: number): number[] {
  const results: number[] = [];
  for (let i = 0; i < count; i++) {
    results.push(secureRandomInt(1, sides));
  }
  return results;
}

/**
 * Generate a unique roll ID
 */
function generateRollId(): string {
  return `roll-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Create a server-authoritative dice roll
 */
export function createServerDiceRoll(
  expression: string,
  userId: string,
  userName: string,
  options: {
    isPrivate?: boolean;
    advantage?: boolean;
    disadvantage?: boolean;
  } = {}
): ServerDiceRoll | null {
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
      total = Math.min(sum1, sum2) + parsed.modifier;
    }
  } else {
    total = rollSum(allResults) + parsed.modifier;
  }

  // Check for critical success/failure (single d20 only)
  let crit: 'success' | 'failure' | undefined = undefined;
  if (dicePools.length === 1 && dicePools[0].count === 1 && dicePools[0].sides === 20) {
    if (dicePools[0].results[0] === 20) crit = 'success';
    if (dicePools[0].results[0] === 1) crit = 'failure';
  }

  return {
    id: generateRollId(),
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

export interface DiceRollRequest {
  expression: string;
  isPrivate?: boolean;
  advantage?: boolean;
  disadvantage?: boolean;
}

/**
 * Validate a dice roll request
 */
export function validateDiceRollRequest(request: DiceRollRequest): {
  valid: boolean;
  error?: string;
} {
  if (!request.expression || typeof request.expression !== 'string') {
    return { valid: false, error: 'Invalid expression' };
  }

  if (request.expression.length > 100) {
    return { valid: false, error: 'Expression too long' };
  }

  const parsed = parseDiceExpression(request.expression);
  if (!parsed) {
    return { valid: false, error: 'Invalid dice expression format' };
  }

  // Check for reasonable limits
  const totalDice = parsed.pools.reduce((sum, pool) => sum + pool.count, 0);
  if (totalDice > 100) {
    return { valid: false, error: 'Too many dice (max 100)' };
  }

  return { valid: true };
}
