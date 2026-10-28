import crypto from 'crypto';
import {
  parseDiceExpression,
  rollParsedDice,
  secureRng,
  validateDiceExpression,
  type Rng,
} from '@nexus/rules-5e';

/**
 * Server-authoritative dice rolls. Parsing, validation and rolling live in
 * `@nexus/rules-5e` so every client previews with the same rules; this module
 * only adds identity (roll id, user, timestamp) and the wire shape.
 */

export interface DicePool {
  count: number;
  sides: number;
  results: number[];
  advResults?: number[];
  keep?: { mode: 'highest' | 'lowest'; count: number };
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
  /** Which roll set the total came from when advantage/disadvantage applied. */
  keptRoll?: 'first' | 'second';
  total: number;
  timestamp: number;
  crit?: 'success' | 'failure';
  isPrivate?: boolean;
}

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
    rng?: Rng;
  } = {},
): ServerDiceRoll | null {
  const parsed = parseDiceExpression(expression);
  if (!parsed) return null;

  const evaluation = rollParsedDice(parsed, {
    advantage: options.advantage,
    disadvantage: options.disadvantage,
    rng: options.rng ?? secureRng,
  });

  return {
    id: generateRollId(),
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
  const result = validateDiceExpression(request.expression);
  return result.valid ? { valid: true } : result;
}
