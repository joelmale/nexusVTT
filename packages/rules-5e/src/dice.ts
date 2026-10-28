/**
 * The one dice engine: parsing, validation, rolling and totals.
 *
 * The VTT server rolls with this and is the authority for shared rolls; the
 * VTT client, Forge and the character creator use the same code for previews
 * and local rolls, so a given expression can never mean different things in
 * different places. Randomness is injectable so every path is testable.
 *
 * Grammar (whitespace and case are ignored):
 *
 *   expression := term ( ("," | "+" | "-") term )*
 *   term       := dice | integer
 *   dice       := [count] "d" sides [ ("kh" | "kl") [keep] ]
 *
 * Dice terms are always added; subtracting dice is rejected rather than
 * silently treated as addition. Integers are summed into the modifier.
 */

/** Returns a number in [0, 1), like `Math.random`. */
export type Rng = () => number;

export const MAX_DICE_PER_POOL = 100;
export const MAX_TOTAL_DICE = 100;
export const MIN_SIDES = 2;
export const MAX_SIDES = 1000;

interface CryptoLike {
  getRandomValues(array: Uint32Array): Uint32Array;
}

/**
 * Cryptographically secure source with 53 bits of resolution, so the bias for
 * any die up to d1000 is far below anything measurable. Falls back to
 * `Math.random` only where `crypto` does not exist at all.
 */
export const secureRng: Rng = () => {
  const cryptoApi = (globalThis as { crypto?: CryptoLike }).crypto;
  if (!cryptoApi) return Math.random();
  const words = cryptoApi.getRandomValues(new Uint32Array(2));
  return (words[0] * 2 ** 21 + (words[1] >>> 11)) / 2 ** 53;
};

export interface DiceKeep {
  mode: 'highest' | 'lowest';
  count: number;
}

export interface DicePoolSpec {
  count: number;
  sides: number;
  keep?: DiceKeep;
}

export interface ParsedDiceExpression {
  pools: DicePoolSpec[];
  modifier: number;
}

const TERM = /(\d*)d(\d+)(?:(kh|kl)(\d*))?|(\d+)/y;

/** Parses an expression, or returns null when it is not valid. */
export function parseDiceExpression(
  expression: string,
): ParsedDiceExpression | null {
  if (typeof expression !== 'string') return null;
  const cleaned = expression.toLowerCase().replace(/\s/g, '');
  if (!cleaned || cleaned[0] === ',') return null;

  const pools: DicePoolSpec[] = [];
  let modifier = 0;
  let position = 0;
  let operator = '+';

  while (position < cleaned.length) {
    if (position > 0 || /[,+-]/.test(cleaned[0])) {
      operator = cleaned[position];
      if (!/[,+-]/.test(operator)) return null;
      position++;
    }

    TERM.lastIndex = position;
    const match = TERM.exec(cleaned);
    if (!match) return null;
    position = TERM.lastIndex;

    const [, countText, sidesText, keepMode, keepText, constantText] = match;
    if (constantText !== undefined) {
      // A comma separates dice pools, so it cannot introduce a constant.
      if (operator === ',') return null;
      const value = Number.parseInt(constantText, 10);
      modifier += operator === '-' ? -value : value;
      continue;
    }

    if (operator === '-') return null;
    const count = countText ? Number.parseInt(countText, 10) : 1;
    const sides = Number.parseInt(sidesText, 10);
    if (
      count < 1 ||
      count > MAX_DICE_PER_POOL ||
      sides < MIN_SIDES ||
      sides > MAX_SIDES
    ) {
      return null;
    }
    const pool: DicePoolSpec = { count, sides };
    if (keepMode) {
      const keepCount = keepText ? Number.parseInt(keepText, 10) : 1;
      if (keepCount < 1 || keepCount > count) return null;
      pool.keep = {
        mode: keepMode === 'kh' ? 'highest' : 'lowest',
        count: keepCount,
      };
    }
    pools.push(pool);
  }

  // A trailing operator leaves the loop with nothing to match, so it is
  // caught above; only an expression with no dice at all reaches here empty.
  if (pools.length === 0) return null;
  return { pools, modifier };
}

export function totalDiceCount(parsed: ParsedDiceExpression): number {
  return parsed.pools.reduce((sum, pool) => sum + pool.count, 0);
}

export type DiceValidation = { valid: true } | { valid: false; error: string };

/** Request-level validation with messages suitable for showing to a player. */
export function validateDiceExpression(expression: unknown): DiceValidation {
  if (!expression || typeof expression !== 'string') {
    return { valid: false, error: 'Invalid expression' };
  }
  if (expression.length > 100) {
    return { valid: false, error: 'Expression too long' };
  }
  const parsed = parseDiceExpression(expression);
  if (!parsed) {
    return { valid: false, error: 'Invalid dice expression format' };
  }
  if (totalDiceCount(parsed) > MAX_TOTAL_DICE) {
    return { valid: false, error: `Too many dice (max ${MAX_TOTAL_DICE})` };
  }
  return { valid: true };
}

export function rollDie(sides: number, rng: Rng = secureRng): number {
  return Math.floor(rng() * sides) + 1;
}

export function rollDice(
  count: number,
  sides: number,
  rng: Rng = secureRng,
): number[] {
  const results: number[] = [];
  for (let i = 0; i < count; i++) results.push(rollDie(sides, rng));
  return results;
}

/** The dice that count toward the total after keep-highest/lowest. */
export function keptDice(
  results: readonly number[],
  keep?: DiceKeep,
): number[] {
  if (!keep) return [...results];
  const sorted = [...results].sort((a, b) =>
    keep.mode === 'highest' ? b - a : a - b,
  );
  return sorted.slice(0, keep.count);
}

export interface DicePoolResult extends DicePoolSpec {
  results: number[];
  advResults?: number[];
}

export interface DiceEvaluation {
  pools: DicePoolResult[];
  modifier: number;
  /** Every die from the first roll, in pool order. */
  results: number[];
  /** Every die from the second roll when advantage or disadvantage applies. */
  advResults?: number[];
  total: number;
  /** Which roll set the total came from, when two were rolled. */
  keptRoll?: 'first' | 'second';
  /** Natural 20 or 1 on a lone d20 (the kept one under advantage). */
  crit?: 'success' | 'failure';
}

export interface RollOptions {
  advantage?: boolean;
  disadvantage?: boolean;
  rng?: Rng;
}

const sum = (values: readonly number[]) =>
  values.reduce((total, value) => total + value, 0);

/**
 * Rolls a parsed expression. Advantage and disadvantage roll the whole
 * expression twice and keep the higher or lower total; if both are set they
 * cancel, as in the rules.
 */
export function rollParsedDice(
  parsed: ParsedDiceExpression,
  options: RollOptions = {},
): DiceEvaluation {
  const rng = options.rng ?? secureRng;
  const twoRolls = Boolean(options.advantage) !== Boolean(options.disadvantage);

  const pools: DicePoolResult[] = parsed.pools.map((spec) => ({
    ...spec,
    results: rollDice(spec.count, spec.sides, rng),
    ...(twoRolls ? { advResults: rollDice(spec.count, spec.sides, rng) } : {}),
  }));

  const firstTotal = sum(
    pools.flatMap((pool) => keptDice(pool.results, pool.keep)),
  );
  const results = pools.flatMap((pool) => pool.results);

  if (!twoRolls) {
    return finish(
      pools,
      parsed.modifier,
      results,
      undefined,
      firstTotal,
      'first',
    );
  }

  const advResults = pools.flatMap((pool) => pool.advResults ?? []);
  const secondTotal = sum(
    pools.flatMap((pool) => keptDice(pool.advResults ?? [], pool.keep)),
  );
  const second = options.advantage
    ? secondTotal > firstTotal
    : secondTotal < firstTotal;
  return finish(
    pools,
    parsed.modifier,
    results,
    advResults,
    second ? secondTotal : firstTotal,
    second ? 'second' : 'first',
  );
}

function finish(
  pools: DicePoolResult[],
  modifier: number,
  results: number[],
  advResults: number[] | undefined,
  diceTotal: number,
  kept: 'first' | 'second',
): DiceEvaluation {
  const evaluation: DiceEvaluation = {
    pools,
    modifier,
    results,
    total: diceTotal + modifier,
  };
  if (advResults) {
    evaluation.advResults = advResults;
    evaluation.keptRoll = kept;
  }
  const only = pools.length === 1 ? pools[0] : undefined;
  if (only && only.count === 1 && only.sides === 20 && !only.keep) {
    const natural =
      kept === 'second' ? (only.advResults ?? [])[0] : only.results[0];
    if (natural === 20) evaluation.crit = 'success';
    else if (natural === 1) evaluation.crit = 'failure';
  }
  return evaluation;
}

/** Parses then rolls; null when the expression is invalid. */
export function rollDiceExpression(
  expression: string,
  options: RollOptions = {},
): DiceEvaluation | null {
  const parsed = parseDiceExpression(expression);
  return parsed ? rollParsedDice(parsed, options) : null;
}

/** Detects a natural 20 or 1 on a single d20. */
export function detectCritical(
  value: number,
  sides: number,
): 'success' | 'failure' | undefined {
  if (sides !== 20) return undefined;
  if (value === 20) return 'success';
  if (value === 1) return 'failure';
  return undefined;
}
