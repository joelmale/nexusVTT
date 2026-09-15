/**
 * Predicate Evaluation System
 * Determines whether effects should be applied based on character state
 *
 * PURE SEPARATION RULE: This module contains NO game-specific logic.
 * All rules come from predicates passed in as data.
 */

import type { Predicate, SimplePredicate, CompositePredicate } from '../types/predicates';
import type { BaseFacts } from '../types/baseFacts';
import type { DerivedState } from '../types/derived';

/**
 * Evaluation context for predicates
 */
export interface PredicateContext {
  facts: BaseFacts;
  derived: Partial<DerivedState>;
}

/**
 * Evaluate a single predicate against character state
 *
 * @param predicate - The predicate to evaluate
 * @param context - Character state (facts + partial derived)
 * @returns true if predicate passes, false otherwise
 */
export function evaluatePredicate(
  predicate: Predicate,
  context: PredicateContext
): boolean {
  // Dispatch to composite or simple evaluation
  if (isCompositePredicate(predicate)) {
    return evaluateCompositePredicate(predicate, context);
  }
  return evaluateSimplePredicate(predicate, context);
}

/**
 * Evaluate multiple predicates (AND logic)
 *
 * @param predicates - Array of predicates to evaluate
 * @param context - Character state
 * @returns true if ALL predicates pass, false otherwise
 */
export function evaluatePredicates(
  predicates: Predicate[],
  context: PredicateContext
): boolean {
  // Empty array = no restrictions, always passes
  if (predicates.length === 0) {
    return true;
  }

  // All predicates must pass (AND logic)
  return predicates.every(pred => evaluatePredicate(pred, context));
}

/**
 * Evaluate a simple predicate
 */
function evaluateSimplePredicate(
  predicate: SimplePredicate,
  context: PredicateContext
): boolean {
  const { facts, derived } = context;

  switch (predicate.type) {
    case 'levelAtLeast':
      return facts.level >= predicate.value;

    case 'levelAtMost':
      return facts.level <= predicate.value;

    case 'edition':
      return facts.edition === predicate.value;

    case 'classIs':
      return facts.classSlug === predicate.slug;

    case 'classLevelAtLeast': {
      const classLevelValue = facts.classLevel[predicate.classSlug] ?? 0;
      return classLevelValue >= predicate.level;
    }

    case 'speciesIs':
      return facts.speciesSlug === predicate.slug;

    case 'abilityAtLeast': {
      const abilityData = derived.abilities?.[predicate.ability];
      if (!abilityData) {
        // Ability not yet computed, check base facts
        return facts.abilities[predicate.ability] >= predicate.value;
      }
      return abilityData.score >= predicate.value;
    }

    case 'hasFeat':
      return facts.feats.includes(predicate.featSlug);

    case 'hasFeature': {
      const features = derived.features ?? [];
      return features.some(f => f.id === predicate.featureSlug);
    }

    case 'hasProficiency': {
      const profTypeMap: Record<string, keyof DerivedState['proficiencies']> = {
        armor: 'armor',
        weapon: 'weapons',
        tool: 'tools',
        language: 'languages',
        savingThrow: 'savingThrows',
        skill: 'skills',
      };
      const profType = profTypeMap[predicate.profType];
      const profs = profType ? derived.proficiencies?.[profType] : undefined;
      if (!profs || !Array.isArray(profs)) {
        return false;
      }
      return profs.includes(predicate.value);
    }

    case 'equipped': {
      // Check if any equipped item has the specified tag
      return derived.tags?.includes(`item:${predicate.itemTag}`) ?? false;
    }

    case 'hasCondition':
      return facts.conditions.includes(predicate.condition);

    case 'hasTag':
      return derived.tags?.includes(predicate.tag) ?? false;

    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = predicate;
      // eslint-disable-next-line no-console
      console.warn('Unknown predicate type:', _exhaustive);
      return false;
    }
  }
}

/**
 * Evaluate a composite predicate (AND/OR/NOT)
 */
function evaluateCompositePredicate(
  predicate: CompositePredicate,
  context: PredicateContext
): boolean {
  switch (predicate.type) {
    case 'and':
      // All nested predicates must pass
      return predicate.predicates.every(p => evaluatePredicate(p, context));

    case 'or':
      // At least one nested predicate must pass
      return predicate.predicates.some(p => evaluatePredicate(p, context));

    case 'not':
      // Nested predicate must fail
      if (Array.isArray(predicate.predicate)) {
        return !evaluatePredicates(predicate.predicate, context);
      }
      return !evaluatePredicate(predicate.predicate, context);

    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = predicate;
      // eslint-disable-next-line no-console
      console.warn('Unknown composite predicate type:', _exhaustive);
      return false;
    }
  }
}

/**
 * Type guard for composite predicates
 */
function isCompositePredicate(predicate: Predicate): predicate is CompositePredicate {
  return predicate.type === 'and' || predicate.type === 'or' || predicate.type === 'not';
}
