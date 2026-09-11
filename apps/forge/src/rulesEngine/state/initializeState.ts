/**
 * Character State Initialization
 * Creates initial mutable state from static character data
 */

import type { CharacterState, TrackedResource, SpellSlots } from '../types/state';
import type { DerivedStats } from '../types/derived';

/**
 * Initialize character state from derived stats
 * Sets all current values to maximum, conditions to empty, etc.
 *
 * @param characterId - Unique character identifier
 * @param derived - Derived stats from evaluateCharacter
 * @returns Initial character state with defaults
 */
export function initializeCharacterState(
  characterId: string,
  derived: DerivedStats
): CharacterState {
  // Initialize resources with current = max
  const resources: Record<string, TrackedResource> = {};
  if (derived.resources) {
    for (const [resourceId, resourceData] of Object.entries(derived.resources)) {
      resources[resourceId] = {
        current: resourceData.max,
        max: resourceData.max,
        restorationType: resourceData.type,
      };
    }
  }

  // Initialize spell slots with current = max (if spellcaster)
  let spellSlots: SpellSlots | null = null;
  if (derived.spellcasting?.slots) {
    spellSlots = {};
    for (const [level, slotData] of Object.entries(derived.spellcasting.slots)) {
      const levelNum = parseInt(level, 10);
      spellSlots[levelNum] = {
        current: slotData.max,
        max: slotData.max,
      };
    }
  }

  // Get movement speed (default to 30 if not set)
  const movementSpeed = derived.speed?.walk || 30;

  return {
    characterId,

    // HP starts at maximum
    currentHP: derived.hitPoints,
    maxHP: derived.hitPoints,
    tempHP: 0,

    // Resources
    resources,
    spellSlots,

    // No active conditions
    conditions: [],

    // Not concentrating
    concentration: {
      activeEffect: null,
      source: null,
    },

    // Full action economy (start of turn)
    actionEconomy: {
      hasAction: true,
      hasBonusAction: true,
      hasReaction: true,
      movementRemaining: movementSpeed,
    },

    // No death saves (character is alive)
    deathSaveSuccesses: 0,
    deathSaveFailures: 0,

    // Not in combat
    initiative: null,

    // No exhaustion
    exhaustionLevel: 0,

    // No inspiration
    hasInspiration: false,
  };
}

/**
 * Create a deep copy of character state
 * Useful for immutable state updates
 *
 * @param state - State to clone
 * @returns Deep copy of state
 */
export function cloneCharacterState(state: CharacterState): CharacterState {
  // Deep clone resources
  const resources: Record<string, TrackedResource> = {};
  for (const [key, value] of Object.entries(state.resources)) {
    resources[key] = { ...value };
  }

  // Deep clone spell slots
  let spellSlots: SpellSlots | null = null;
  if (state.spellSlots) {
    spellSlots = {};
    for (const [level, slots] of Object.entries(state.spellSlots)) {
      spellSlots[parseInt(level, 10)] = { ...slots };
    }
  }

  return {
    ...state,
    resources,
    spellSlots,
    conditions: [...state.conditions],
    concentration: { ...state.concentration },
    actionEconomy: { ...state.actionEconomy },
  };
}

/**
 * Reset character state to full resources
 * Used for long rests or testing
 *
 * @param state - Current state
 * @returns State with all resources restored to max
 */
export function resetToFullResources(state: CharacterState): CharacterState {
  const newState = cloneCharacterState(state);

  // Restore all resources to max
  for (const resourceId in newState.resources) {
    newState.resources[resourceId].current = newState.resources[resourceId].max;
  }

  // Restore all spell slots to max
  if (newState.spellSlots) {
    for (const level in newState.spellSlots) {
      newState.spellSlots[level].current = newState.spellSlots[level].max;
    }
  }

  // Reset HP to max
  newState.currentHP = newState.maxHP;
  newState.tempHP = 0;

  // Clear death saves
  newState.deathSaveSuccesses = 0;
  newState.deathSaveFailures = 0;

  return newState;
}
