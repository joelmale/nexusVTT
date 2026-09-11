// Import required functions first
import { rollDice, generateUUID, type DiceRoll } from '../services/diceService';

// Re-export DiceRoll type from diceService for compatibility
export type { DiceRoll };

// Add complex dice expression support
export interface ParsedDiceExpression {
  pools: Array<{ count: number; sides: number }>;
  modifier: number;
}

export function parseDiceExpression(expression: string): ParsedDiceExpression | null {
  // Remove spaces and handle basic validation
  const cleanExpression = expression.replace(/\s+/g, '');

  // Match dice pools like 2d6, 1d20, etc.
  const diceRegex = /(\d+)d(\d+)/g;
  const modifierMatch = cleanExpression.match(/([+-]\d+)$/);

  const pools: Array<{ count: number; sides: number }> = [];
  let match;

  while ((match = diceRegex.exec(cleanExpression)) !== null) {
    const count = parseInt(match[1]);
    const sides = parseInt(match[2]);

    // Basic validation
    if (count < 1 || count > 100 || sides < 2 || sides > 1000) {
      return null;
    }

    pools.push({ count, sides });
  }

  const modifier = modifierMatch ? parseInt(modifierMatch[1]) : 0;

  return pools.length > 0 ? { pools, modifier } : null;
}

export function createComplexDiceRoll(expression: string, label: string, type: DiceRoll['type'] = 'complex'): DiceRoll {
  const parsed = parseDiceExpression(expression);
  if (!parsed) throw new Error('Invalid dice expression');

  // Generate results for each pool
  const allResults: number[] = [];
  let total = parsed.modifier;

  for (const pool of parsed.pools) {
    const results = rollDice(pool.count, pool.sides);
    allResults.push(...results);
    total += results.reduce((sum, val) => sum + val, 0);
  }

  // Check for critical hits (only for d20 rolls)
  let critical: 'success' | 'failure' | undefined;
  if (parsed.pools.length === 1 && parsed.pools[0].sides === 20 && parsed.pools[0].count === 1) {
    const result = allResults[0];
    if (result === 20) critical = 'success';
    else if (result === 1) critical = 'failure';
  }

  return {
    id: generateUUID(),
    type,
    label,
    notation: expression,
    diceResults: allResults,
    modifier: parsed.modifier,
    total,
    critical,
    timestamp: Date.now(),
    pools: parsed.pools.map((pool, i) => ({
      ...pool,
      results: allResults.slice(
        parsed.pools.slice(0, i).reduce((sum, p) => sum + p.count, 0),
        parsed.pools.slice(0, i + 1).reduce((sum, p) => sum + p.count, 0)
      )
    }))
  };
}