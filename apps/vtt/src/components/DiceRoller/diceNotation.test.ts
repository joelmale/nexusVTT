import { describe, it, expect } from 'vitest';
import {
  DIE_TYPES,
  emptyCounters,
  countersToNotation,
  formatModifier,
  d20Expression,
  formatRollBreakdown,
} from './diceNotation';

describe('diceNotation', () => {
  it('lists the seven shelf dice in order', () => {
    expect(DIE_TYPES).toEqual(['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']);
  });

  it('formats modifiers with an explicit sign', () => {
    expect(formatModifier(0)).toBe('+0');
    expect(formatModifier(3)).toBe('+3');
    expect(formatModifier(-2)).toBe('-2');
  });

  it('builds pool notation from counters and modifier', () => {
    const counters = { ...emptyCounters(), d8: 2, d6: 1 };
    expect(countersToNotation(counters, 3)).toBe('1d6 + 2d8 + 3');
    expect(countersToNotation(counters, -2)).toBe('1d6 + 2d8 - 2');
    expect(countersToNotation(counters, 0)).toBe('1d6 + 2d8');
  });

  it('orders dice by first-queued order when given', () => {
    const counters = { ...emptyCounters(), d8: 2, d6: 1 };
    expect(countersToNotation(counters, 3, ['d8', 'd6'])).toBe(
      '2d8 + 1d6 + 3',
    );
    expect(countersToNotation(counters, 0, ['d20', 'd6', 'd8'])).toBe(
      '1d6 + 2d8',
    );
  });

  it('returns an empty string when no dice are queued', () => {
    expect(countersToNotation(emptyCounters(), 5)).toBe('');
  });

  it('builds the d20 expression', () => {
    expect(d20Expression(0)).toBe('1d20');
    expect(d20Expression(3)).toBe('1d20+3');
    expect(d20Expression(-2)).toBe('1d20-2');
  });

  it('formats roll breakdowns', () => {
    expect(
      formatRollBreakdown({
        expression: '2d8',
        results: [2, 2],
        modifier: 0,
        total: 4,
      }),
    ).toBe('2d8 [2, 2] = 4');
    expect(
      formatRollBreakdown({
        expression: '2d8',
        results: [2, 2],
        modifier: 3,
        total: 7,
      }),
    ).toBe('2d8 [2, 2] +3 = 7');
  });

  it('does not repeat a modifier already present in the expression', () => {
    expect(
      formatRollBreakdown({
        expression: '1d20+3',
        results: [14],
        modifier: 3,
        total: 17,
      }),
    ).toBe('1d20+3 [14] = 17');
  });

  it('shows both sets for advantage rolls', () => {
    expect(
      formatRollBreakdown({
        expression: '1d20',
        results: [4],
        advResults: [17],
        modifier: 0,
        total: 17,
      }),
    ).toBe('1d20 [4] | [17] = 17');
  });
});
