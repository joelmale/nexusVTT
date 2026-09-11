/**
 * Character State Initialization Tests
 * Tests for state_001_character_state_model
 */

import { describe, it, expect } from 'vitest';
import { initializeCharacterState, cloneCharacterState, resetToFullResources } from '../state/initializeState';
import type { DerivedStats } from '../types/derived';

describe('Character State Initialization', () => {
  const mockDerived: DerivedStats = {
    hitPoints: 25,
    proficiencyBonus: 2,
    speed: { walk: 30 },
    proficiencies: {
      armor: [],
      weapons: [],
      tools: [],
      savingThrows: ['STR', 'CON'],
      skills: [],
      languages: [],
    },
    resources: {
      rage: {
        id: 'rage',
        max: 2,
        current: 2,
        type: 'perLongRest',
        sources: [],
      },
      'ki-points': {
        id: 'ki-points',
        max: 5,
        current: 5,
        type: 'perShortRest',
        sources: [],
      },
    },
    spellcasting: {
      ability: 'INT',
      saveDC: 0,
      attackBonus: 0,
      slots: {
        1: { max: 3, used: 0 },
        2: { max: 2, used: 0 },
      },
      spellsKnown: [],
      spellsPrepared: [],
      spellsAlwaysPrepared: [],
      cantrips: [],
    },
    features: [],
    tags: [],
  };

  describe('initializeCharacterState', () => {
    it('should initialize currentHP to maxHP', () => {
      const state = initializeCharacterState('char-1', mockDerived);

      expect(state.currentHP).toBe(25);
      expect(state.maxHP).toBe(25);
      expect(state.tempHP).toBe(0);
    });

    it('should initialize resources current to max', () => {
      const state = initializeCharacterState('char-1', mockDerived);

      expect(state.resources.rage.current).toBe(2);
      expect(state.resources.rage.max).toBe(2);
      expect(state.resources.rage.restorationType).toBe('perLongRest');

      expect(state.resources['ki-points'].current).toBe(5);
      expect(state.resources['ki-points'].max).toBe(5);
      expect(state.resources['ki-points'].restorationType).toBe('perShortRest');
    });

    it('should initialize spell slots current to max', () => {
      const state = initializeCharacterState('char-1', mockDerived);

      expect(state.spellSlots).not.toBeNull();
      expect(state.spellSlots![1].current).toBe(3);
      expect(state.spellSlots![1].max).toBe(3);
      expect(state.spellSlots![2].current).toBe(2);
      expect(state.spellSlots![2].max).toBe(2);
    });

    it('should initialize conditions to empty array', () => {
      const state = initializeCharacterState('char-1', mockDerived);

      expect(state.conditions).toEqual([]);
    });

    it('should initialize concentration to null', () => {
      const state = initializeCharacterState('char-1', mockDerived);

      expect(state.concentration.activeEffect).toBeNull();
      expect(state.concentration.source).toBeNull();
    });

    it('should initialize action economy to full', () => {
      const state = initializeCharacterState('char-1', mockDerived);

      expect(state.actionEconomy.hasAction).toBe(true);
      expect(state.actionEconomy.hasBonusAction).toBe(true);
      expect(state.actionEconomy.hasReaction).toBe(true);
      expect(state.actionEconomy.movementRemaining).toBe(30);
    });

    it('should initialize death saves to 0', () => {
      const state = initializeCharacterState('char-1', mockDerived);

      expect(state.deathSaveSuccesses).toBe(0);
      expect(state.deathSaveFailures).toBe(0);
    });

    it('should initialize exhaustion to 0', () => {
      const state = initializeCharacterState('char-1', mockDerived);

      expect(state.exhaustionLevel).toBe(0);
    });

    it('should initialize inspiration to false', () => {
      const state = initializeCharacterState('char-1', mockDerived);

      expect(state.hasInspiration).toBe(false);
    });

    it('should handle non-spellcasters (null spell slots)', () => {
      const nonCasterDerived: DerivedStats = {
        ...mockDerived,
        spellcasting: undefined,
      };

      const state = initializeCharacterState('char-2', nonCasterDerived);

      expect(state.spellSlots).toBeNull();
    });

    it('should use default speed of 30 if not specified', () => {
      const noSpeedDerived: DerivedStats = {
        ...mockDerived,
        speed: undefined,
      };

      const state = initializeCharacterState('char-3', noSpeedDerived);

      expect(state.actionEconomy.movementRemaining).toBe(30);
    });
  });

  describe('cloneCharacterState', () => {
    it('should create a deep copy of state', () => {
      const original = initializeCharacterState('char-1', mockDerived);
      const clone = cloneCharacterState(original);

      // Should be equal but not same reference
      expect(clone).toEqual(original);
      expect(clone).not.toBe(original);

      // Mutating clone should not affect original
      clone.currentHP = 10;
      expect(original.currentHP).toBe(25);

      clone.resources.rage.current = 1;
      expect(original.resources.rage.current).toBe(2);

      clone.conditions.push({
        condition: 'prone',
        source: 'test',
      });
      expect(original.conditions.length).toBe(0);
    });
  });

  describe('resetToFullResources', () => {
    it('should restore all resources to max', () => {
      const state = initializeCharacterState('char-1', mockDerived);

      // Deplete resources
      state.resources.rage.current = 0;
      state.resources['ki-points'].current = 1;

      const restored = resetToFullResources(state);

      expect(restored.resources.rage.current).toBe(2);
      expect(restored.resources['ki-points'].current).toBe(5);
    });

    it('should restore all spell slots to max', () => {
      const state = initializeCharacterState('char-1', mockDerived);

      // Deplete spell slots
      state.spellSlots![1].current = 0;
      state.spellSlots![2].current = 1;

      const restored = resetToFullResources(state);

      expect(restored.spellSlots![1].current).toBe(3);
      expect(restored.spellSlots![2].current).toBe(2);
    });

    it('should restore HP to max and clear temp HP', () => {
      const state = initializeCharacterState('char-1', mockDerived);

      // Take damage and gain temp HP
      state.currentHP = 10;
      state.tempHP = 5;

      const restored = resetToFullResources(state);

      expect(restored.currentHP).toBe(25);
      expect(restored.tempHP).toBe(0);
    });

    it('should clear death saves', () => {
      const state = initializeCharacterState('char-1', mockDerived);

      // Add death saves
      state.deathSaveSuccesses = 2;
      state.deathSaveFailures = 1;

      const restored = resetToFullResources(state);

      expect(restored.deathSaveSuccesses).toBe(0);
      expect(restored.deathSaveFailures).toBe(0);
    });

    it('should not mutate original state', () => {
      const state = initializeCharacterState('char-1', mockDerived);
      state.resources.rage.current = 0;

      const restored = resetToFullResources(state);

      // Original should still be depleted
      expect(state.resources.rage.current).toBe(0);
      // Restored should be full
      expect(restored.resources.rage.current).toBe(2);
    });
  });
});
