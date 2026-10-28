import {
  createComplexRoll,
  parseDiceExpression,
  type DiceRoll,
  type ParsedDiceExpression,
} from '../services/diceService';

// Re-exports so existing imports keep working; the parser and roller are the
// shared engine in @nexus/rules-5e, reached through the character creator.
export { parseDiceExpression };
export type { DiceRoll, ParsedDiceExpression };

/**
 * Rolls an arbitrary expression (several pools, keep-highest/lowest, constants)
 * and returns a Forge roll record.
 */
export function createComplexDiceRoll(
  expression: string,
  label: string,
  type: DiceRoll['type'] = 'complex',
): DiceRoll {
  if (!parseDiceExpression(expression)) {
    throw new Error('Invalid dice expression');
  }
  return { ...createComplexRoll(label, expression), type };
}
