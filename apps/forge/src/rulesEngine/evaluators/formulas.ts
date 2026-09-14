/**
 * Formula Evaluation System
 * Evaluates formula expressions with variable substitution
 *
 * PURE SEPARATION RULE: This module contains NO game-specific logic.
 * All formulas come from effect data. This is purely a calculator.
 */

import type { Formula, FormulaContext } from '../types/formulas';
import type { Ability, MovementType } from '../types/common';

/**
 * Evaluate a formula expression with variable substitution
 *
 * @param formula - Formula object with expression and variables
 * @param context - Context with values for variable substitution
 * @returns Evaluated numeric result
 */
export function evaluateFormula(
  formula: Formula,
  context: FormulaContext
): number {
  let expression = formula.expression;

  // Substitute all variables
  for (const variable of formula.variables) {
    const value = resolveVariable(variable, context);
    // Replace variable with its numeric value
    expression = expression.replace(variable, String(value));
  }

  // Evaluate the mathematical expression
  try {
    // Provide Math functions in scope for formulas
    const result = Function('min', 'max', 'floor', 'ceil', 'round', `"use strict"; return (${expression})`)(
      Math.min,
      Math.max,
      Math.floor,
      Math.ceil,
      Math.round
    );
    return typeof result === 'number' ? result : 0;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Formula evaluation failed:', formula.expression, error);
    return 0;
  }
}

/**
 * Resolve a variable to its numeric value
 *
 * @param variable - Variable reference (e.g., "@abilities.WIS.modifier")
 * @param context - Context with values
 * @returns Numeric value
 */
function resolveVariable(
  variable: string,
  context: FormulaContext
): number {
  // Remove leading @ if present
  const path = variable.startsWith('@') ? variable.slice(1) : variable;

  // Parse the path
  const parts = path.split('.');

  if (parts[0] === 'abilities' && parts.length >= 2) {
    const ability = parts[1] as Ability;
    const abilityData = context.abilities[ability];

    if (!abilityData) {
      // eslint-disable-next-line no-console
      console.warn(`Ability ${ability} not found in context`);
      return 0;
    }

    if (parts.length === 2) {
      // @abilities.WIS (the score itself)
      return abilityData.score;
    }

    if (parts[2] === 'score') {
      // @abilities.WIS.score
      return abilityData.score;
    }

    if (parts[2] === 'modifier') {
      // @abilities.WIS.modifier
      return abilityData.modifier;
    }

    // eslint-disable-next-line no-console
    console.warn(`Unknown ability property: ${parts[2]}`);
    return 0;
  }

  if (parts[0] === 'proficiencyBonus') {
    return context.proficiencyBonus ?? 0;
  }

  if (parts[0] === 'level') {
    return context.level ?? 0;
  }

  if (parts[0] === 'classLevel' && parts.length >= 2) {
    const classSlug = parts[1];
    return context.classLevel?.[classSlug] ?? context.classLevels?.[classSlug] ?? 0;
  }

  if (parts[0] === 'speed' && parts.length >= 2) {
    const movement = parts[1] as MovementType;
    return context.speed?.[movement] ?? 0;
  }

  // eslint-disable-next-line no-console
  console.warn(`Unknown variable: ${variable}`);
  return 0;
}

/**
 * Create a formula context from base facts and derived state
 *
 * @param facts - Base character facts
 * @param derived - Derived state
 * @returns Formula context
 */
export function createFormulaContext(
  facts: { level: number; classLevel: Record<string, number> },
  derived: { abilities: Record<Ability, { score: number; modifier: number }>; proficiencyBonus: number; speed?: Record<string, number> }
): FormulaContext {
  return {
    abilities: derived.abilities,
    proficiencyBonus: derived.proficiencyBonus,
    level: facts.level,
    classLevel: facts.classLevel,
    classLevels: facts.classLevel,
    speed: derived.speed,
  };
}
