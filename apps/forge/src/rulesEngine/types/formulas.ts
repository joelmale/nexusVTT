/**
 * Formula system for dynamic value calculation
 * Formulas allow effects to reference character state (abilities, level, proficiency, etc.)
 */

import type { Ability } from './common';

/**
 * Formula variables that can be referenced in expressions
 */
export type FormulaVariable =
  | `@abilities.${Ability}.modifier`
  | `@abilities.${Ability}.score`
  | '@proficiencyBonus'
  | '@level'
  | `@classlevel.${string}`
  | `@classLevel.${string}`
  | '@speed.walk'
  | '@speed.fly'
  | '@speed.swim'
  | '@speed.climb'
  | '@speed.burrow'
  | `@spellslots.${number}.max`
  | `@spellslots.${number}.used`;

/**
 * Formula definition with expression and required variables
 */
export interface Formula {
  /**
   * Mathematical expression using variables
   * Examples:
   * - "8 + @abilities.INT.modifier + @proficiencyBonus"
   * - "@level * 2"
   * - "10 + @abilities.DEX.modifier"
   */
  expression: string;

  /**
   * List of variables used in the expression
   * Used for validation and dependency tracking
   */
  variables: FormulaVariable[];
}

/**
 * Context for formula evaluation
 * Contains all values that can be referenced in formulas
 */
export interface FormulaContext {
  abilities: Record<Ability, { score: number; modifier: number }>;
  proficiencyBonus: number;
  level: number;
  classLevels: Record<string, number>;
  classLevel?: Record<string, number>;
  speed?: Record<string, number>;
  spellSlots?: Record<number, { max: number; used: number }>;
}

/**
 * Result of formula evaluation
 */
export interface FormulaResult {
  value: number;
  expression: string;
  resolvedExpression: string; // Expression with variables replaced
  variables: Record<string, number>; // Variable values used
}

/**
 * Type guard to check if a value is a Formula
 */
export function isFormula(value: unknown): value is Formula {
  return (
    typeof value === 'object' &&
    value !== null &&
    'expression' in value &&
    'variables' in value
  );
}
