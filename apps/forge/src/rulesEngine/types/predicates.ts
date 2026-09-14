/**
 * Predicate system for conditional effects
 * Predicates determine when effects should be applied based on character state
 */

import type { Ability } from './common';

/**
 * Base predicate types for simple conditions
 */
export type SimplePredicate =
  | {
      type: 'levelAtLeast';
      value: number;
    }
  | {
      type: 'levelAtMost';
      value: number;
    }
  | {
      type: 'hasTag';
      tag: string;
    }
  | {
      type: 'edition';
      value: '2014' | '2024';
    }
  | {
      type: 'classIs';
      slug: string;
    }
  | {
      type: 'classLevelAtLeast';
      classSlug: string;
      level: number;
    }
  | {
      type: 'speciesIs';
      slug: string;
    }
  | {
      type: 'abilityAtLeast';
      ability: Ability;
      value: number;
    }
  | {
      type: 'hasFeat';
      featSlug: string;
    }
  | {
      type: 'hasFeature';
      featureSlug: string;
    }
  | {
      type: 'hasProficiency';
      profType: 'armor' | 'weapon' | 'tool' | 'language' | 'savingThrow' | 'skill';
      value: string;
    }
  | {
      type: 'equipped';
      itemTag: string;
    }
  | {
      type: 'hasCondition';
      condition: string;
    };

/**
 * Composite predicates for boolean logic
 */
export type CompositePredicate =
  | {
      type: 'and';
      predicates: Predicate[];
    }
  | {
      type: 'or';
      predicates: Predicate[];
    }
  | {
      type: 'not';
      predicate: Predicate | Predicate[];
    };

/**
 * Union type for all predicates
 */
export type Predicate = SimplePredicate | CompositePredicate;

/**
 * Type guard to check if a predicate is composite
 */
export function isCompositePredicate(pred: Predicate): pred is CompositePredicate {
  return pred.type === 'and' || pred.type === 'or' || pred.type === 'not';
}

/**
 * Type guard to check if a predicate is simple
 */
export function isSimplePredicate(pred: Predicate): pred is SimplePredicate {
  return !isCompositePredicate(pred);
}
