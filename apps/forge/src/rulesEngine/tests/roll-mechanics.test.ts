/**
 * Roll Mechanics Tests
 * Tests for roll_001_advantage_cancellation
 */

import { describe, it, expect } from 'vitest';
import {
  determineRollState,
  makeD20Roll,
  createRollContext,
  addAdvantage,
  addDisadvantage,
} from '../mechanics/rollMechanics';

describe('Roll Mechanics', () => {
  describe('determineRollState', () => {
    it('should return advantage when only advantage sources exist (A=1, D=0)', () => {
      const state = determineRollState(
        [{ source: 'invisible' }],
        []
      );

      expect(state).toBe('advantage');
    });

    it('should return advantage when multiple advantage sources exist (A=2, D=0)', () => {
      const state = determineRollState(
        [{ source: 'invisible' }, { source: 'help-action' }],
        []
      );

      expect(state).toBe('advantage');
    });

    it('should return disadvantage when only disadvantage sources exist (A=0, D=1)', () => {
      const state = determineRollState(
        [],
        [{ source: 'prone' }]
      );

      expect(state).toBe('disadvantage');
    });

    it('should return disadvantage when multiple disadvantage sources exist (A=0, D=2)', () => {
      const state = determineRollState(
        [],
        [{ source: 'prone' }, { source: 'poisoned' }]
      );

      expect(state).toBe('disadvantage');
    });

    it('should return normal when both advantage and disadvantage exist (A=1, D=1)', () => {
      const state = determineRollState(
        [{ source: 'invisible' }],
        [{ source: 'prone' }]
      );

      expect(state).toBe('normal');
    });

    it('should return normal when multiple of each exist (A=2, D=1)', () => {
      const state = determineRollState(
        [{ source: 'invisible' }, { source: 'help-action' }],
        [{ source: 'prone' }]
      );

      expect(state).toBe('normal');
    });

    it('should return normal when multiple of each exist (A=1, D=2)', () => {
      const state = determineRollState(
        [{ source: 'invisible' }],
        [{ source: 'prone' }, { source: 'poisoned' }]
      );

      expect(state).toBe('normal');
    });

    it('should return normal when neither exist (A=0, D=0)', () => {
      const state = determineRollState([], []);

      expect(state).toBe('normal');
    });
  });

  describe('makeD20Roll', () => {
    // Seeded RNG for deterministic testing
    // Returns values that will produce specific d20 results when used with Math.floor(rng() * 20) + 1
    const createSeededRNG = (desiredRolls: number[]) => {
      let index = 0;
      return () => {
        const desired = desiredRolls[index % desiredRolls.length];
        index++;
        // To get desired roll X, we need (X-1)/20 so that floor((X-1)/20 * 20) + 1 = X
        return (desired - 1) / 20;
      };
    };

    it('should roll with advantage and take higher value', () => {
      const context = createRollContext('attack', [5]);
      context.advantageSources.push({ source: 'invisible' });

      // Rolls will be 10 and 15
      const rng = createSeededRNG([10, 15]);
      const result = makeD20Roll(context, rng);

      expect(result.rollState).toBe('advantage');
      expect(result.rolls).toEqual([10, 15]);
      expect(result.finalRoll).toBe(15); // Takes higher
      expect(result.total).toBe(20); // 15 + 5 bonus
    });

    it('should roll with disadvantage and take lower value', () => {
      const context = createRollContext('attack', [5]);
      context.disadvantageSources.push({ source: 'prone' });

      // Rolls will be 10 and 5
      const rng = createSeededRNG([10, 5]);
      const result = makeD20Roll(context, rng);

      expect(result.rollState).toBe('disadvantage');
      expect(result.rolls).toEqual([10, 5]);
      expect(result.finalRoll).toBe(5); // Takes lower
      expect(result.total).toBe(10); // 5 + 5 bonus
    });

    it('should roll normally when advantage and disadvantage cancel', () => {
      const context = createRollContext('attack', [3]);
      context.advantageSources.push({ source: 'invisible' });
      context.disadvantageSources.push({ source: 'prone' });

      // Only one roll when normal
      const rng = createSeededRNG([12]);
      const result = makeD20Roll(context, rng);

      expect(result.rollState).toBe('normal');
      expect(result.rolls).toEqual([12]);
      expect(result.finalRoll).toBe(12);
      expect(result.total).toBe(15); // 12 + 3 bonus
    });

    it('should detect natural 20', () => {
      const context = createRollContext('attack');
      const rng = createSeededRNG([20]);
      const result = makeD20Roll(context, rng);

      expect(result.isNaturalTwenty).toBe(true);
      expect(result.isCriticalHit).toBe(true);
      expect(result.isNaturalOne).toBe(false);
    });

    it('should detect natural 1', () => {
      const context = createRollContext('attack');
      const rng = createSeededRNG([1]);
      const result = makeD20Roll(context, rng);

      expect(result.isNaturalOne).toBe(true);
      expect(result.isNaturalTwenty).toBe(false);
      expect(result.isCriticalHit).toBe(false);
    });

    it('should apply multiple bonuses', () => {
      const context = createRollContext('attack', [2, 3, 1]);
      const rng = createSeededRNG([10]);
      const result = makeD20Roll(context, rng);

      expect(result.bonuses).toEqual([2, 3, 1]);
      expect(result.total).toBe(16); // 10 + 2 + 3 + 1
    });

    it('should handle negative bonuses', () => {
      const context = createRollContext('attack', [5, -2]);
      const rng = createSeededRNG([10]);
      const result = makeD20Roll(context, rng);

      expect(result.total).toBe(13); // 10 + 5 - 2
    });

    it('should preserve advantage/disadvantage sources in result', () => {
      const context = createRollContext('attack');
      context.advantageSources.push(
        { source: 'invisible', reason: 'Attacker is invisible' },
        { source: 'help-action', reason: 'Ally used Help action' }
      );
      context.disadvantageSources.push(
        { source: 'prone', reason: 'Attacker is prone' }
      );

      const rng = createSeededRNG([10]);
      const result = makeD20Roll(context, rng);

      expect(result.advantageSources).toHaveLength(2);
      expect(result.disadvantageSources).toHaveLength(1);
      expect(result.advantageSources[0].source).toBe('invisible');
      expect(result.disadvantageSources[0].source).toBe('prone');
    });
  });

  describe('createRollContext', () => {
    it('should create empty context with no bonuses', () => {
      const context = createRollContext('attack');

      expect(context.rollType).toBe('attack');
      expect(context.advantageSources).toEqual([]);
      expect(context.disadvantageSources).toEqual([]);
      expect(context.bonuses).toEqual([]);
    });

    it('should create context with bonuses', () => {
      const context = createRollContext('save', [2, 3]);

      expect(context.rollType).toBe('save');
      expect(context.bonuses).toEqual([2, 3]);
    });
  });

  describe('addAdvantage', () => {
    it('should add advantage source to context', () => {
      const context = createRollContext('attack');
      const updated = addAdvantage(context, 'invisible', 'Attacker is invisible');

      expect(updated.advantageSources).toHaveLength(1);
      expect(updated.advantageSources[0].source).toBe('invisible');
      expect(updated.advantageSources[0].reason).toBe('Attacker is invisible');
    });

    it('should preserve existing advantage sources', () => {
      let context = createRollContext('attack');
      context = addAdvantage(context, 'invisible');
      context = addAdvantage(context, 'help-action');

      expect(context.advantageSources).toHaveLength(2);
    });
  });

  describe('addDisadvantage', () => {
    it('should add disadvantage source to context', () => {
      const context = createRollContext('attack');
      const updated = addDisadvantage(context, 'prone', 'Attacker is prone');

      expect(updated.disadvantageSources).toHaveLength(1);
      expect(updated.disadvantageSources[0].source).toBe('prone');
      expect(updated.disadvantageSources[0].reason).toBe('Attacker is prone');
    });

    it('should preserve existing disadvantage sources', () => {
      let context = createRollContext('attack');
      context = addDisadvantage(context, 'prone');
      context = addDisadvantage(context, 'poisoned');

      expect(context.disadvantageSources).toHaveLength(2);
    });
  });
});
