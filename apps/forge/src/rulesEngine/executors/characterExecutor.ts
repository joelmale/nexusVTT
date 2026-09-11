/**
 * Character Executor
 * Main entry point for evaluating a character through the rules engine
 *
 * PURE SEPARATION RULE: This orchestrates evaluation but contains NO game logic.
 * All logic comes from effect data passed in.
 */

import type { BaseFacts } from '../types/baseFacts';
import type { DerivedState } from '../types/derived';
import type { SourcedEffect, TemporaryEffect } from '../types/effects';
import { initializeDerivedState } from '../utils/initializeDerivedState';
import { applySourcedEffect } from '../evaluators/applyEffect';
import { EXECUTION_PHASES, groupEffectsByPhase, sortEffectsByPriority } from './phases';
import { finalizeDerivedState } from './finalizers';
import { evaluatePredicate } from '../evaluators/predicates';

/**
 * Evaluate a character through the rules engine
 *
 * @param facts - Base character facts (inputs)
 * @param effects - Array of sourced effects to apply
 * @param temporaryEffects - Optional temporary effects (spells, conditions)
 * @returns Complete derived state
 */
export function evaluateCharacter(
  facts: BaseFacts,
  effects: SourcedEffect[],
  temporaryEffects: TemporaryEffect[] = []
): DerivedState {
  // Initialize empty derived state
  const derived = initializeDerivedState(facts);

  // Group effects by phase
  const effectsByPhase = groupEffectsByPhase(effects);

  // Execute each phase in order
  for (const phase of EXECUTION_PHASES) {
    const phaseEffects = effectsByPhase[phase.name] || [];

    // Sort effects by priority within phase
    const sortedEffects = sortEffectsByPriority(phaseEffects);

    // Apply each effect
    for (const sourcedEffect of sortedEffects) {
      applySourcedEffect(facts, derived, sourcedEffect);
    }
  }

  // Apply temporary effects last (they have highest priority)
  for (const tempEffect of temporaryEffects) {
    applySourcedEffect(facts, derived, tempEffect);
  }

  // Collect pending choices from effects
  collectPendingChoices(facts, derived, effects);

  // Finalize all derived values (calculate final bonuses)
  finalizeDerivedState(derived);

  return derived;
}

/**
 * Collect pending choices from effects
 * Evaluates choice predicates and adds applicable choices to derived state
 */
function collectPendingChoices(
  facts: BaseFacts,
  derived: DerivedState,
  effects: SourcedEffect[]
): void {
  for (const sourcedEffect of effects) {
    if (!sourcedEffect.choice) {
      continue;
    }

    const choice = sourcedEffect.choice;

    // Evaluate choice predicate
    const predicates = choice.predicate || [];
    const allPredicatesMet = predicates.every((pred) => evaluatePredicate(pred, { facts, derived }));

    if (!allPredicatesMet) {
      continue;
    }

    // Choice is applicable - add to derived.choices
    derived.choices.push({
      id: choice.id,
      prompt: choice.prompt,
      type: choice.type,
      options: choice.options?.map((opt) => ({
        value: opt.value,
        label: opt.label,
        description: opt.description,
      })) || [],
      min: choice.min,
      max: choice.max,
    });
  }
}

/**
 * Feature flag for rules engine (for gradual rollout)
 */
export const USE_RULES_ENGINE = import.meta.env.VITE_USE_RULES_ENGINE === 'true' || false;
