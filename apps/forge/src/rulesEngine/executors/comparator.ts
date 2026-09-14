/**
 * Comparison harness for old vs new rules engine
 * Used during migration to ensure no regressions
 */

import type { Character } from '../../types/dnd';
import type { DerivedState } from '../types/derived';

/**
 * Severity levels for differences
 */
export type DifferenceSeverity = 'error' | 'warning' | 'info';

/**
 * Difference between old and new implementations
 */
export interface Difference {
  path: string; // e.g., 'saves.INT.bonus', 'skills.Stealth.value'
  oldValue: unknown;
  newValue: unknown;
  severity: DifferenceSeverity;
  message?: string;
}

/**
 * Result of comparing old vs new implementations
 */
export interface ComparisonResult {
  characterId: string;
  characterName: string;
  level: number;
  class: string;
  edition: '2014' | '2024';
  differences: Difference[];
  warnings: string[];
  success: boolean; // true if no errors, only warnings/info
}

/**
 * Options for comparison
 */
export interface ComparisonOptions {
  /**
   * Paths to compare (if not specified, compares all standard fields)
   */
  paths?: string[];

  /**
   * Tolerance for numeric differences (default: 0)
   */
  tolerance?: number;

  /**
   * Whether to treat warnings as errors (default: false)
   */
  strictMode?: boolean;

  /**
   * Whether to log detailed differences (default: true)
   */
  verbose?: boolean;
}

/**
 * Default paths to compare between old and new systems
 */
const DEFAULT_COMPARISON_PATHS = [
  // Ability scores
  'abilities.STR.score',
  'abilities.STR.modifier',
  'abilities.DEX.score',
  'abilities.DEX.modifier',
  'abilities.CON.score',
  'abilities.CON.modifier',
  'abilities.INT.score',
  'abilities.INT.modifier',
  'abilities.WIS.score',
  'abilities.WIS.modifier',
  'abilities.CHA.score',
  'abilities.CHA.modifier',

  // Saving throws
  'saves.STR',
  'saves.DEX',
  'saves.CON',
  'saves.INT',
  'saves.WIS',
  'saves.CHA',

  // Skills
  'skills.Acrobatics',
  'skills.Animal Handling',
  'skills.Arcana',
  'skills.Athletics',
  'skills.Deception',
  'skills.History',
  'skills.Insight',
  'skills.Intimidation',
  'skills.Investigation',
  'skills.Medicine',
  'skills.Nature',
  'skills.Perception',
  'skills.Performance',
  'skills.Persuasion',
  'skills.Religion',
  'skills.Sleight of Hand',
  'skills.Stealth',
  'skills.Survival',

  // Combat stats
  'armorClass',
  'initiative',

  // Proficiencies
  'proficiencies.armor',
  'proficiencies.weapons',
  'proficiencies.tools',
  'languages',

  // Spellcasting (if applicable)
  'spellcasting.saveDC',
  'spellcasting.attackBonus',
];

/**
 * Get a nested value from an object by path
 */
function getByPath(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Compare two values and determine severity
 */
function compareValues(
  path: string,
  oldValue: unknown,
  newValue: unknown,
  options: ComparisonOptions
): Difference | null {
  // If both undefined, no difference
  if (oldValue === undefined && newValue === undefined) {
    return null;
  }

  // If one is undefined, that's a warning
  if (oldValue === undefined || newValue === undefined) {
    return {
      path,
      oldValue,
      newValue,
      severity: 'warning',
      message: `Value ${oldValue === undefined ? 'missing in old' : 'missing in new'} implementation`,
    };
  }

  // For numbers, check tolerance
  if (typeof oldValue === 'number' && typeof newValue === 'number') {
    const tolerance = options.tolerance ?? 0;
    const diff = Math.abs(oldValue - newValue);
    if (diff > tolerance) {
      return {
        path,
        oldValue,
        newValue,
        severity: 'error',
        message: `Numeric difference: ${diff} (tolerance: ${tolerance})`,
      };
    }
    return null;
  }

  // For arrays, deep compare
  if (Array.isArray(oldValue) && Array.isArray(newValue)) {
    const oldSorted = [...oldValue].sort();
    const newSorted = [...newValue].sort();

    if (JSON.stringify(oldSorted) !== JSON.stringify(newSorted)) {
      return {
        path,
        oldValue,
        newValue,
        severity: 'warning',
        message: 'Array contents differ',
      };
    }
    return null;
  }

  // For objects, flag for manual inspection
  if (typeof oldValue === 'object' && typeof newValue === 'object') {
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      return {
        path,
        oldValue,
        newValue,
        severity: 'info',
        message: 'Object contents differ - inspect manually',
      };
    }
    return null;
  }

  // For primitives, strict equality
  if (oldValue !== newValue) {
    return {
      path,
      oldValue,
      newValue,
      severity: 'error',
      message: 'Value mismatch',
    };
  }

  return null;
}

/**
 * Compare old character data with new derived state
 *
 * @param character - The original character (with old calculations)
 * @param derived - The new derived state from rules engine
 * @param options - Comparison options
 * @returns Comparison result with differences
 */
export function compareOldVsNew(
  character: Character,
  derived: DerivedState,
  options: ComparisonOptions = {}
): ComparisonResult {
  const differences: Difference[] = [];
  const warnings: string[] = [];

  const paths = options.paths ?? DEFAULT_COMPARISON_PATHS;

  // Compare each path
  for (const path of paths) {
    const oldValue = getByPath(character as unknown as Record<string, unknown>, path);
    const newValue = getByPath(derived as unknown as Record<string, unknown>, path);

    const diff = compareValues(path, oldValue, newValue, options);
    if (diff) {
      differences.push(diff);

      if (options.verbose) {
        const severity = diff.severity.toUpperCase();
        const msg = `[${severity}] ${path}: ${JSON.stringify(oldValue)} -> ${JSON.stringify(newValue)}`;
        if (diff.message) {
          warnings.push(`${msg} (${diff.message})`);
        } else {
          warnings.push(msg);
        }
      }
    }
  }

  // Determine success
  const hasErrors = differences.some(d => d.severity === 'error');
  const hasWarnings = differences.some(d => d.severity === 'warning');
  const success = options.strictMode ? !hasErrors && !hasWarnings : !hasErrors;

  return {
    characterId: character.id,
    characterName: character.name,
    level: character.level,
    class: character.class,
    edition: character.edition,
    differences,
    warnings,
    success,
  };
}

/**
 * Compare multiple characters
 */
export function compareMultiple(
  characters: Character[],
  derivedStates: DerivedState[],
  options: ComparisonOptions = {}
): ComparisonResult[] {
  if (characters.length !== derivedStates.length) {
    throw new Error('Character and derived state arrays must have same length');
  }

  return characters.map((char, index) =>
    compareOldVsNew(char, derivedStates[index], options)
  );
}

/**
 * Generate a summary report from comparison results
 */
export function generateSummaryReport(results: ComparisonResult[]): string {
  const lines: string[] = [];

  lines.push('='.repeat(80));
  lines.push('RULES ENGINE COMPARISON REPORT');
  lines.push('='.repeat(80));
  lines.push('');

  const totalCharacters = results.length;
  const successful = results.filter(r => r.success).length;
  const failed = totalCharacters - successful;

  lines.push(`Total Characters: ${totalCharacters}`);
  lines.push(`Successful: ${successful}`);
  lines.push(`Failed: ${failed}`);
  lines.push('');

  // Detail each character
  for (const result of results) {
    const status = result.success ? '✓' : '✗';
    lines.push(`${status} ${result.characterName} (Level ${result.level} ${result.class}, ${result.edition})`);

    if (result.differences.length > 0) {
      const errors = result.differences.filter(d => d.severity === 'error').length;
      const warnings = result.differences.filter(d => d.severity === 'warning').length;
      const info = result.differences.filter(d => d.severity === 'info').length;

      lines.push(`  Errors: ${errors}, Warnings: ${warnings}, Info: ${info}`);

      // Show first 5 differences
      const topDiffs = result.differences.slice(0, 5);
      for (const diff of topDiffs) {
        const severity = diff.severity[0].toUpperCase();
        lines.push(`  [${severity}] ${diff.path}: ${JSON.stringify(diff.oldValue)} -> ${JSON.stringify(diff.newValue)}`);
      }

      if (result.differences.length > 5) {
        lines.push(`  ... and ${result.differences.length - 5} more`);
      }
    }

    lines.push('');
  }

  lines.push('='.repeat(80));

  return lines.join('\n');
}
