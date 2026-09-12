/**
 * Resource Operations
 * Functions to consume and restore character resources
 */

import type { CharacterState, StateUpdateResult, ResourceError } from '../types/state';
import { cloneCharacterState } from './initializeState';

/**
 * Consume a resource (spend uses)
 *
 * @param state - Current character state
 * @param resourceId - Resource identifier (e.g., 'rage', 'bardic-inspiration')
 * @param amount - Amount to consume (default 1)
 * @returns State update result with new state or error
 */
export function consumeResource(
  state: CharacterState,
  resourceId: string,
  amount: number = 1
): StateUpdateResult {
  // Check if resource exists
  if (!state.resources[resourceId]) {
    return {
      state,
      success: false,
      error: `Resource '${resourceId}' does not exist on character`,
    };
  }

  const resource = state.resources[resourceId];
  const newCurrent = resource.current - amount;

  // Check if spending would go below 0
  if (newCurrent < 0) {
    const error: ResourceError = {
      resourceId,
      current: resource.current,
      max: resource.max,
      attempted: amount,
      message: `Cannot consume ${amount} of resource '${resourceId}': only ${resource.current} available (max ${resource.max})`,
    };

    return {
      state,
      success: false,
      error: error.message,
    };
  }

  // Create new state with updated resource
  const newState = cloneCharacterState(state);
  newState.resources[resourceId].current = newCurrent;

  return {
    state: newState,
    success: true,
    changes: [`Consumed ${amount} ${resourceId} (${resource.current} → ${newCurrent})`],
  };
}

/**
 * Restore a resource (regain uses)
 *
 * @param state - Current character state
 * @param resourceId - Resource identifier
 * @param amount - Amount to restore, or 'max' to restore to maximum
 * @returns State update result with new state or error
 */
export function restoreResource(
  state: CharacterState,
  resourceId: string,
  amount: number | 'max' = 'max'
): StateUpdateResult {
  // Check if resource exists
  if (!state.resources[resourceId]) {
    return {
      state,
      success: false,
      error: `Resource '${resourceId}' does not exist on character`,
    };
  }

  const resource = state.resources[resourceId];
  let newCurrent: number;

  if (amount === 'max') {
    newCurrent = resource.max;
  } else {
    newCurrent = Math.min(resource.current + amount, resource.max);
  }

  // No change needed
  if (newCurrent === resource.current) {
    return {
      state,
      success: true,
      changes: [`Resource '${resourceId}' already at ${resource.current}/${resource.max}`],
    };
  }

  // Create new state with updated resource
  const newState = cloneCharacterState(state);
  newState.resources[resourceId].current = newCurrent;

  return {
    state: newState,
    success: true,
    changes: [`Restored ${resourceId} (${resource.current} → ${newCurrent})`],
  };
}

/**
 * Consume a spell slot
 *
 * @param state - Current character state
 * @param level - Spell slot level (1-9)
 * @returns State update result with new state or error
 */
export function consumeSpellSlot(
  state: CharacterState,
  level: number
): StateUpdateResult {
  // Check if character has spellcasting
  if (!state.spellSlots) {
    return {
      state,
      success: false,
      error: 'Character does not have spellcasting',
    };
  }

  // Check if spell slot level exists
  if (!state.spellSlots[level]) {
    return {
      state,
      success: false,
      error: `Character does not have spell slots of level ${level}`,
    };
  }

  const slot = state.spellSlots[level];

  // Check if slots available
  if (slot.current <= 0) {
    return {
      state,
      success: false,
      error: `No level ${level} spell slots remaining (0/${slot.max})`,
    };
  }

  // Create new state with updated spell slot
  const newState = cloneCharacterState(state);
  newState.spellSlots![level].current = slot.current - 1;

  return {
    state: newState,
    success: true,
    changes: [`Consumed level ${level} spell slot (${slot.current} → ${slot.current - 1})`],
  };
}

/**
 * Restore spell slots
 *
 * @param state - Current character state
 * @param level - Spell slot level to restore, or 'all' for all levels
 * @param amount - Amount to restore, or 'max' to restore to maximum
 * @returns State update result with new state or error
 */
export function restoreSpellSlots(
  state: CharacterState,
  level: number | 'all',
  amount: number | 'max' = 'max'
): StateUpdateResult {
  // Check if character has spellcasting
  if (!state.spellSlots) {
    return {
      state,
      success: false,
      error: 'Character does not have spellcasting',
    };
  }

  const newState = cloneCharacterState(state);
  const spellSlots = newState.spellSlots;
  if (!spellSlots) {
    return {
      state,
      success: false,
      error: 'Character does not have spellcasting',
    };
  }
  const changes: string[] = [];

  if (level === 'all') {
    // Restore all spell slot levels
    for (const slotLevel in spellSlots) {
      const slotLevelNum = Number(slotLevel);
      const slot = spellSlots[slotLevelNum];
      if (!slot) {
        continue;
      }
      const oldCurrent = slot.current;

      if (amount === 'max') {
        slot.current = slot.max;
      } else {
        slot.current = Math.min(slot.current + amount, slot.max);
      }

      if (slot.current !== oldCurrent) {
        changes.push(`Restored level ${slotLevel} slots (${oldCurrent} → ${slot.current})`);
      }
    }
  } else {
    // Restore specific level
    if (!spellSlots[level]) {
      return {
        state,
        success: false,
        error: `Character does not have spell slots of level ${level}`,
      };
    }

    const slot = spellSlots[level];
    const oldCurrent = slot.current;

    if (amount === 'max') {
      slot.current = slot.max;
    } else {
      slot.current = Math.min(slot.current + amount, slot.max);
    }

    if (slot.current !== oldCurrent) {
      changes.push(`Restored level ${level} slots (${oldCurrent} → ${slot.current})`);
    }
  }

  return {
    state: newState,
    success: true,
    changes: changes.length > 0 ? changes : ['Spell slots already at maximum'],
  };
}

/**
 * Take damage (reduce HP)
 *
 * @param state - Current character state
 * @param damage - Amount of damage to take
 * @returns State update result with new state
 */
export function takeDamage(
  state: CharacterState,
  damage: number
): StateUpdateResult {
  if (damage <= 0) {
    return {
      state,
      success: true,
      changes: ['No damage taken'],
    };
  }

  const newState = cloneCharacterState(state);
  const changes: string[] = [];
  let remainingDamage = damage;

  // Temporary HP absorbs damage first
  if (newState.tempHP > 0) {
    const tempHPLost = Math.min(newState.tempHP, remainingDamage);
    newState.tempHP -= tempHPLost;
    remainingDamage -= tempHPLost;
    changes.push(`Lost ${tempHPLost} temporary HP (${state.tempHP} → ${newState.tempHP})`);
  }

  // Apply remaining damage to current HP
  if (remainingDamage > 0) {
    const oldHP = newState.currentHP;
    newState.currentHP = Math.max(0, newState.currentHP - remainingDamage);
    changes.push(`Took ${remainingDamage} damage (${oldHP} → ${newState.currentHP} HP)`);
  }

  return {
    state: newState,
    success: true,
    changes,
  };
}

/**
 * Heal (restore HP)
 *
 * @param state - Current character state
 * @param healing - Amount of healing
 * @returns State update result with new state
 */
export function heal(
  state: CharacterState,
  healing: number
): StateUpdateResult {
  if (healing <= 0) {
    return {
      state,
      success: true,
      changes: ['No healing applied'],
    };
  }

  const newState = cloneCharacterState(state);
  const oldHP = newState.currentHP;
  newState.currentHP = Math.min(newState.currentHP + healing, newState.maxHP);

  const actualHealing = newState.currentHP - oldHP;

  return {
    state: newState,
    success: true,
    changes: actualHealing > 0
      ? [`Healed ${actualHealing} HP (${oldHP} → ${newState.currentHP})`]
      : ['Already at maximum HP'],
  };
}

/**
 * Gain temporary HP
 *
 * @param state - Current character state
 * @param amount - Amount of temporary HP to gain
 * @returns State update result with new state
 */
export function gainTempHP(
  state: CharacterState,
  amount: number
): StateUpdateResult {
  if (amount <= 0) {
    return {
      state,
      success: true,
      changes: ['No temporary HP gained'],
    };
  }

  const newState = cloneCharacterState(state);
  const oldTempHP = newState.tempHP;

  // Temp HP doesn't stack, take the higher value
  newState.tempHP = Math.max(newState.tempHP, amount);

  return {
    state: newState,
    success: true,
    changes: newState.tempHP > oldTempHP
      ? [`Gained ${amount} temporary HP (${oldTempHP} → ${newState.tempHP})`]
      : [`Temporary HP not changed (current ${oldTempHP} >= new ${amount})`],
  };
}
