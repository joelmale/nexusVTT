/**
 * Resource Operations Tests
 * Tests for res_001_resource_consumption
 */

import { describe, it, expect } from 'vitest';
import { initializeCharacterState } from '../state/initializeState';
import {
  consumeResource,
  restoreResource,
  consumeSpellSlot,
  restoreSpellSlots,
  takeDamage,
  heal,
  gainTempHP,
} from '../state/resourceOperations';
import type { DerivedStats } from '../types/derived';

describe('Resource Operations', () => {
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
      'bardic-inspiration': {
        id: 'bardic-inspiration',
        max: 3,
        current: 3,
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

  describe('consumeResource', () => {
    it('should consume resource successfully', () => {
      const state = initializeCharacterState('char-1', mockDerived);
      const result = consumeResource(state, 'rage', 1);

      expect(result.success).toBe(true);
      expect(result.state.resources.rage.current).toBe(1);
      expect(result.changes).toContain('Consumed 1 rage (2 → 1)');
    });

    it('should consume multiple uses', () => {
      const state = initializeCharacterState('char-1', mockDerived);
      const result = consumeResource(state, 'bardic-inspiration', 2);

      expect(result.success).toBe(true);
      expect(result.state.resources['bardic-inspiration'].current).toBe(1);
    });

    it('should fail when spending beyond current', () => {
      const state = initializeCharacterState('char-1', mockDerived);
      const result = consumeResource(state, 'rage', 3);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot consume 3');
      expect(result.error).toContain('only 2 available');
      expect(result.state.resources.rage.current).toBe(2); // Unchanged
    });

    it('should fail when resource does not exist', () => {
      const state = initializeCharacterState('char-1', mockDerived);
      const result = consumeResource(state, 'nonexistent', 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not exist');
    });

    it('should not allow spending below 0', () => {
      const state = initializeCharacterState('char-1', mockDerived);
      state.resources.rage.current = 0;

      const result = consumeResource(state, 'rage', 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('only 0 available');
    });

    it('should include resourceId, current, max in error', () => {
      const state = initializeCharacterState('char-1', mockDerived);
      const result = consumeResource(state, 'rage', 10);

      expect(result.error).toContain('rage');
      expect(result.error).toContain('2'); // current/max
    });
  });

  describe('restoreResource', () => {
    it('should restore resource to max by default', () => {
      const state = initializeCharacterState('char-1', mockDerived);
      state.resources.rage.current = 0;

      const result = restoreResource(state, 'rage');

      expect(result.success).toBe(true);
      expect(result.state.resources.rage.current).toBe(2);
      expect(result.changes).toContain('Restored rage (0 → 2)');
    });

    it('should restore partial amount', () => {
      const state = initializeCharacterState('char-1', mockDerived);
      state.resources['bardic-inspiration'].current = 0;

      const result = restoreResource(state, 'bardic-inspiration', 2);

      expect(result.success).toBe(true);
      expect(result.state.resources['bardic-inspiration'].current).toBe(2);
    });

    it('should clamp to max when restoring', () => {
      const state = initializeCharacterState('char-1', mockDerived);
      state.resources.rage.current = 1;

      const result = restoreResource(state, 'rage', 5);

      expect(result.success).toBe(true);
      expect(result.state.resources.rage.current).toBe(2); // Clamped to max
    });

    it('should handle already at max', () => {
      const state = initializeCharacterState('char-1', mockDerived);

      const result = restoreResource(state, 'rage', 1);

      expect(result.success).toBe(true);
      expect(result.changes![0]).toContain('already at 2/2');
    });

    it('should fail when resource does not exist', () => {
      const state = initializeCharacterState('char-1', mockDerived);
      const result = restoreResource(state, 'nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not exist');
    });
  });

  describe('consumeSpellSlot', () => {
    it('should consume spell slot successfully', () => {
      const state = initializeCharacterState('char-1', mockDerived);
      const result = consumeSpellSlot(state, 1);

      expect(result.success).toBe(true);
      expect(result.state.spellSlots![1].current).toBe(2);
      expect(result.changes).toContain('Consumed level 1 spell slot (3 → 2)');
    });

    it('should fail when no slots remaining', () => {
      const state = initializeCharacterState('char-1', mockDerived);
      state.spellSlots![1].current = 0;

      const result = consumeSpellSlot(state, 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No level 1 spell slots remaining');
    });

    it('should fail when character is not a spellcaster', () => {
      const nonCasterDerived: DerivedStats = {
        ...mockDerived,
        spellcasting: undefined,
      };
      const state = initializeCharacterState('char-2', nonCasterDerived);

      const result = consumeSpellSlot(state, 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not have spellcasting');
    });

    it('should fail when spell slot level does not exist', () => {
      const state = initializeCharacterState('char-1', mockDerived);
      const result = consumeSpellSlot(state, 5);

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not have spell slots of level 5');
    });
  });

  describe('restoreSpellSlots', () => {
    it('should restore all spell slots to max', () => {
      const state = initializeCharacterState('char-1', mockDerived);
      state.spellSlots![1].current = 1;
      state.spellSlots![2].current = 0;

      const result = restoreSpellSlots(state, 'all');

      expect(result.success).toBe(true);
      expect(result.state.spellSlots![1].current).toBe(3);
      expect(result.state.spellSlots![2].current).toBe(2);
      expect(result.changes?.length).toBe(2);
    });

    it('should restore specific level to max', () => {
      const state = initializeCharacterState('char-1', mockDerived);
      state.spellSlots![1].current = 0;

      const result = restoreSpellSlots(state, 1);

      expect(result.success).toBe(true);
      expect(result.state.spellSlots![1].current).toBe(3);
      expect(result.state.spellSlots![2].current).toBe(2); // Unchanged
    });

    it('should restore partial amount', () => {
      const state = initializeCharacterState('char-1', mockDerived);
      state.spellSlots![1].current = 0;

      const result = restoreSpellSlots(state, 1, 2);

      expect(result.success).toBe(true);
      expect(result.state.spellSlots![1].current).toBe(2); // 0 + 2
    });

    it('should fail when character is not a spellcaster', () => {
      const nonCasterDerived: DerivedStats = {
        ...mockDerived,
        spellcasting: undefined,
      };
      const state = initializeCharacterState('char-2', nonCasterDerived);

      const result = restoreSpellSlots(state, 'all');

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not have spellcasting');
    });
  });

  describe('takeDamage', () => {
    it('should reduce current HP', () => {
      const state = initializeCharacterState('char-1', mockDerived);
      const result = takeDamage(state, 10);

      expect(result.success).toBe(true);
      expect(result.state.currentHP).toBe(15);
      expect(result.changes).toContain('Took 10 damage (25 → 15 HP)');
    });

    it('should consume temp HP first', () => {
      const state = initializeCharacterState('char-1', mockDerived);
      state.tempHP = 5;

      const result = takeDamage(state, 8);

      expect(result.success).toBe(true);
      expect(result.state.tempHP).toBe(0);
      expect(result.state.currentHP).toBe(22); // 25 - 3 (after 5 temp absorbed)
      expect(result.changes?.length).toBe(2); // Both temp HP and regular HP
    });

    it('should not go below 0 HP', () => {
      const state = initializeCharacterState('char-1', mockDerived);
      const result = takeDamage(state, 100);

      expect(result.success).toBe(true);
      expect(result.state.currentHP).toBe(0);
    });

    it('should handle 0 or negative damage', () => {
      const state = initializeCharacterState('char-1', mockDerived);
      const result = takeDamage(state, 0);

      expect(result.success).toBe(true);
      expect(result.state.currentHP).toBe(25); // Unchanged
    });
  });

  describe('heal', () => {
    it('should restore HP', () => {
      const state = initializeCharacterState('char-1', mockDerived);
      state.currentHP = 10;

      const result = heal(state, 8);

      expect(result.success).toBe(true);
      expect(result.state.currentHP).toBe(18);
      expect(result.changes).toContain('Healed 8 HP (10 → 18)');
    });

    it('should not exceed max HP', () => {
      const state = initializeCharacterState('char-1', mockDerived);
      state.currentHP = 20;

      const result = heal(state, 10);

      expect(result.success).toBe(true);
      expect(result.state.currentHP).toBe(25); // Capped at max
      expect(result.changes).toContain('Healed 5 HP (20 → 25)');
    });

    it('should handle already at max HP', () => {
      const state = initializeCharacterState('char-1', mockDerived);

      const result = heal(state, 10);

      expect(result.success).toBe(true);
      expect(result.state.currentHP).toBe(25);
      expect(result.changes).toContain('Already at maximum HP');
    });

    it('should handle 0 or negative healing', () => {
      const state = initializeCharacterState('char-1', mockDerived);
      state.currentHP = 10;

      const result = heal(state, 0);

      expect(result.success).toBe(true);
      expect(result.state.currentHP).toBe(10); // Unchanged
    });
  });

  describe('gainTempHP', () => {
    it('should gain temporary HP', () => {
      const state = initializeCharacterState('char-1', mockDerived);
      const result = gainTempHP(state, 10);

      expect(result.success).toBe(true);
      expect(result.state.tempHP).toBe(10);
      expect(result.changes![0]).toContain('Gained 10 temporary HP');
    });

    it('should take higher value when temp HP does not stack', () => {
      const state = initializeCharacterState('char-1', mockDerived);
      state.tempHP = 15;

      const result = gainTempHP(state, 10);

      expect(result.success).toBe(true);
      expect(result.state.tempHP).toBe(15); // Keeps higher value
      expect(result.changes![0]).toContain('not changed');
    });

    it('should replace lower temp HP with higher', () => {
      const state = initializeCharacterState('char-1', mockDerived);
      state.tempHP = 5;

      const result = gainTempHP(state, 12);

      expect(result.success).toBe(true);
      expect(result.state.tempHP).toBe(12);
      expect(result.changes).toContain('Gained 12 temporary HP (5 → 12)');
    });

    it('should handle 0 or negative temp HP', () => {
      const state = initializeCharacterState('char-1', mockDerived);
      const result = gainTempHP(state, 0);

      expect(result.success).toBe(true);
      expect(result.state.tempHP).toBe(0);
    });
  });
});
