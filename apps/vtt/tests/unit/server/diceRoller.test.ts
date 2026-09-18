import { describe, it, expect } from 'vitest';
import {
  createServerDiceRoll,
  validateDiceRollRequest,
} from '../../../server/diceRoller.js';

describe('diceRoller', () => {
  describe('validateDiceRollRequest', () => {
    it('rejects missing or non-string expressions', () => {
      // @ts-expect-error testing invalid type
      expect(validateDiceRollRequest({ expression: null })).toEqual({
        valid: false,
        error: 'Invalid expression',
      });
      // @ts-expect-error testing invalid type
      expect(validateDiceRollRequest({ expression: 123 })).toEqual({
        valid: false,
        error: 'Invalid expression',
      });
      expect(validateDiceRollRequest({ expression: '' })).toEqual({
        valid: false,
        error: 'Invalid expression',
      });
    });

    it('rejects expressions exceeding 100 characters', () => {
      const longExpr = 'd20+'.repeat(30);
      expect(validateDiceRollRequest({ expression: longExpr })).toEqual({
        valid: false,
        error: 'Expression too long',
      });
    });

    it('rejects invalid dice expression formats', () => {
      expect(validateDiceRollRequest({ expression: 'hello' })).toEqual({
        valid: false,
        error: 'Invalid dice expression format',
      });
      expect(validateDiceRollRequest({ expression: '+5' })).toEqual({
        valid: false,
        error: 'Invalid dice expression format',
      });
      // Dice count < 1 or sides < 2 or sides > 1000
      expect(validateDiceRollRequest({ expression: '1d1' })).toEqual({
        valid: false,
        error: 'Invalid dice expression format',
      });
      expect(validateDiceRollRequest({ expression: '1d1001' })).toEqual({
        valid: false,
        error: 'Invalid dice expression format',
      });
    });

    it('rejects pools with more than 100 total dice', () => {
      expect(validateDiceRollRequest({ expression: '101d6' })).toEqual({
        valid: false,
        error: 'Invalid dice expression format', // count > 100 caught in parser
      });
      expect(validateDiceRollRequest({ expression: '60d6, 50d6' })).toEqual({
        valid: false,
        error: 'Too many dice (max 100)', // parser allows <= 100 per pool, total is 110
      });
    });

    it('validates correct expressions', () => {
      expect(validateDiceRollRequest({ expression: 'd20' })).toEqual({
        valid: true,
      });
      expect(validateDiceRollRequest({ expression: '2d6+3' })).toEqual({
        valid: true,
      });
      expect(validateDiceRollRequest({ expression: '1d8 - 2' })).toEqual({
        valid: true,
      });
      expect(validateDiceRollRequest({ expression: '2d6, 1d4' })).toEqual({
        valid: true,
      });
    });
  });

  describe('createServerDiceRoll', () => {
    it('returns null for invalid expression', () => {
      const result = createServerDiceRoll('not-dice', 'user-1', 'Alice');
      expect(result).toBeNull();
    });

    it('creates standard roll with correct ranges and modifiers', () => {
      const roll = createServerDiceRoll('2d6+4', 'u1', 'PlayerOne');
      expect(roll).not.toBeNull();
      if (!roll) return;

      expect(roll.userId).toBe('u1');
      expect(roll.userName).toBe('PlayerOne');
      expect(roll.expression).toBe('2d6+4');
      expect(roll.modifier).toBe(4);
      expect(roll.pools).toHaveLength(1);
      expect(roll.pools[0].count).toBe(2);
      expect(roll.pools[0].sides).toBe(6);
      expect(roll.results).toHaveLength(2);
      expect(roll.results[0]).toBeGreaterThanOrEqual(1);
      expect(roll.results[0]).toBeLessThanOrEqual(6);
      expect(roll.results[1]).toBeGreaterThanOrEqual(1);
      expect(roll.results[1]).toBeLessThanOrEqual(6);
      expect(roll.total).toBe(roll.results[0] + roll.results[1] + 4);
      expect(roll.isPrivate).toBe(false);
      expect(roll.crit).toBeUndefined();
      expect(roll.id).toMatch(/^roll-\d+-[a-f0-9]+$/);
    });

    it('handles negative modifiers and multiple pools', () => {
      const roll = createServerDiceRoll('1d4, 1d6 - 2', 'u1', 'PlayerOne');
      expect(roll).not.toBeNull();
      if (!roll) return;

      expect(roll.modifier).toBe(-2);
      expect(roll.pools).toHaveLength(2);
      expect(roll.results).toHaveLength(2);
      expect(roll.total).toBe(roll.results[0] + roll.results[1] - 2);
    });

    it('handles private rolls', () => {
      const roll = createServerDiceRoll('1d20', 'u1', 'PlayerOne', {
        isPrivate: true,
      });
      expect(roll).not.toBeNull();
      expect(roll?.isPrivate).toBe(true);
    });

    it('rolls with advantage', () => {
      const roll = createServerDiceRoll('1d20+2', 'u1', 'PlayerOne', {
        advantage: true,
      });
      expect(roll).not.toBeNull();
      if (!roll) return;

      expect(roll.advResults).toBeDefined();
      expect(roll.advResults).toHaveLength(1);
      expect(roll.pools[0].advResults).toBeDefined();
      const sum1 = roll.results[0];
      const sum2 = roll.advResults![0];
      expect(roll.total).toBe(Math.max(sum1, sum2) + 2);
    });

    it('rolls with disadvantage', () => {
      const roll = createServerDiceRoll('1d20+1', 'u1', 'PlayerOne', {
        disadvantage: true,
      });
      expect(roll).not.toBeNull();
      if (!roll) return;

      expect(roll.advResults).toBeDefined();
      expect(roll.advResults).toHaveLength(1);
      const sum1 = roll.results[0];
      const sum2 = roll.advResults![0];
      expect(roll.total).toBe(Math.min(sum1, sum2) + 1);
    });

    it('detects critical hit and failure for single d20', () => {
      // Roll multiple times or verify structure
      let foundSuccess = false;
      let foundFailure = false;
      // Since it's crypto random, run a few iterations to ensure crit branch runs without error
      for (let i = 0; i < 100; i++) {
        const roll = createServerDiceRoll('1d20', 'u1', 'PlayerOne');
        if (roll?.results[0] === 20) {
          expect(roll.crit).toBe('success');
          foundSuccess = true;
        } else if (roll?.results[0] === 1) {
          expect(roll.crit).toBe('failure');
          foundFailure = true;
        } else {
          expect(roll?.crit).toBeUndefined();
        }
        if (foundSuccess && foundFailure) break;
      }
    });

    it('does not assign crits to non-d20 or multi-dice rolls', () => {
      for (let i = 0; i < 20; i++) {
        const roll2d20 = createServerDiceRoll('2d20', 'u1', 'PlayerOne');
        expect(roll2d20?.crit).toBeUndefined();

        const roll1d12 = createServerDiceRoll('1d12', 'u1', 'PlayerOne');
        expect(roll1d12?.crit).toBeUndefined();
      }
    });
  });
});
