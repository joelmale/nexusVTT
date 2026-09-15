/**
 * Zod schemas for formulas
 */

import { z } from 'zod';

/**
 * Formula variable schema
 */
export const formulaVariableSchema = z.string().refine(
  (val) => {
    const validPrefixes = [
      '@abilities.',
      '@proficiencyBonus',
      '@level',
      '@classlevel.',
      '@spellslots.',
    ];
    return validPrefixes.some(prefix => val.startsWith(prefix));
  },
  {
    message: 'Formula variable must start with a valid prefix',
  }
);

/**
 * Formula schema
 */
export const formulaSchema = z.object({
  expression: z.string().min(1, 'Formula expression cannot be empty'),
  variables: z.array(formulaVariableSchema),
});

/**
 * Number or formula schema (for effect values)
 */
export const numberOrFormulaSchema = z.union([z.number(), formulaSchema]);
