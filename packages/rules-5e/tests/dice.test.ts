import { describe, expect, it } from 'vitest';
import {
  keptDice,
  parseDiceExpression,
  rollDiceExpression,
  rollParsedDice,
  secureRng,
  validateDiceExpression,
  type Rng,
} from '../src/dice';

/** Deterministic source that returns the given faces for a die of `sides`. */
function faces(sides: number, ...values: number[]): Rng {
  const queue = [...values];
  return () => {
    const face = queue.shift();
    if (face === undefined) throw new Error('rng exhausted');
    return (face - 1) / sides + 0.0001;
  };
}

describe('parseDiceExpression', () => {
  it('parses single pools, modifiers and whitespace', () => {
    expect(parseDiceExpression('2d6+3')).toEqual({
      pools: [{ count: 2, sides: 6 }],
      modifier: 3,
    });
    expect(parseDiceExpression('d20')).toEqual({
      pools: [{ count: 1, sides: 20 }],
      modifier: 0,
    });
    expect(parseDiceExpression(' 2 D 8 - 4 ')).toEqual({
      pools: [{ count: 2, sides: 8 }],
      modifier: -4,
    });
  });

  it('parses several pools separated by commas or plus', () => {
    expect(parseDiceExpression('3d4, 6d20')?.pools).toHaveLength(2);
    expect(parseDiceExpression('1d20, 2d6, 1d4+2')).toEqual({
      pools: [
        { count: 1, sides: 20 },
        { count: 2, sides: 6 },
        { count: 1, sides: 4 },
      ],
      modifier: 2,
    });
    expect(parseDiceExpression('2d6+3d8+5')?.modifier).toBe(5);
  });

  it('sums every constant instead of keeping only the first', () => {
    expect(parseDiceExpression('1d20+3+2-1')?.modifier).toBe(4);
    expect(parseDiceExpression('5+1d4')?.modifier).toBe(5);
    expect(parseDiceExpression('-2+1d4')?.modifier).toBe(-2);
  });

  it('parses keep-highest and keep-lowest', () => {
    expect(parseDiceExpression('4d6kh3')?.pools[0].keep).toEqual({
      mode: 'highest',
      count: 3,
    });
    expect(parseDiceExpression('2d20kl')?.pools[0].keep).toEqual({
      mode: 'lowest',
      count: 1,
    });
    expect(parseDiceExpression('2d20kh3')).toBeNull();
    expect(parseDiceExpression('2d20kh0')).toBeNull();
  });

  it.each([
    '',
    'hello',
    '+5',
    '5',
    'd',
    '2d',
    '2d6+',
    '2d6-',
    ',2d6',
    '2d6,',
    '2d6,,1d4',
    '2d6++3',
    '2d6xyz',
    '1d20-1d4',
    '1d4,5',
    '0d6',
    '101d6',
    '1d1',
    '1d1001',
  ])('rejects %j', (input) => {
    expect(parseDiceExpression(input)).toBeNull();
  });

  it('rejects non-strings', () => {
    expect(parseDiceExpression(undefined as unknown as string)).toBeNull();
  });
});

describe('validateDiceExpression', () => {
  it('uses stable messages', () => {
    expect(validateDiceExpression(null)).toEqual({
      valid: false,
      error: 'Invalid expression',
    });
    expect(validateDiceExpression('1d6+'.repeat(40))).toEqual({
      valid: false,
      error: 'Expression too long',
    });
    expect(validateDiceExpression('nope')).toEqual({
      valid: false,
      error: 'Invalid dice expression format',
    });
    expect(validateDiceExpression('60d6, 50d6')).toEqual({
      valid: false,
      error: 'Too many dice (max 100)',
    });
    expect(validateDiceExpression('2d6, 1d4')).toEqual({ valid: true });
  });
});

describe('rolling', () => {
  it('totals dice plus modifier and reports flattened results', () => {
    const roll = rollDiceExpression('2d6+4', { rng: faces(6, 3, 5) })!;
    expect(roll.results).toEqual([3, 5]);
    expect(roll.total).toBe(12);
    expect(roll.crit).toBeUndefined();
    expect(roll.advResults).toBeUndefined();
  });

  it('applies keep-highest and keep-lowest to the total only', () => {
    const roll = rollDiceExpression('4d6kh3', { rng: faces(6, 1, 6, 4, 5) })!;
    expect(roll.pools[0].results).toEqual([1, 6, 4, 5]);
    expect(roll.total).toBe(15);
    expect(keptDice([1, 6, 4, 5], { mode: 'lowest', count: 2 })).toEqual([
      1, 4,
    ]);
  });

  it('keeps the higher total under advantage and the lower under disadvantage', () => {
    const adv = rollDiceExpression('1d20+2', {
      advantage: true,
      rng: faces(20, 7, 15),
    })!;
    expect(adv.total).toBe(17);
    expect(adv.keptRoll).toBe('second');
    expect(adv.advResults).toEqual([15]);

    const dis = rollDiceExpression('1d20+2', {
      disadvantage: true,
      rng: faces(20, 7, 15),
    })!;
    expect(dis.total).toBe(9);
    expect(dis.keptRoll).toBe('first');
  });

  it('cancels advantage and disadvantage', () => {
    const roll = rollDiceExpression('1d20', {
      advantage: true,
      disadvantage: true,
      rng: faces(20, 9),
    })!;
    expect(roll.total).toBe(9);
    expect(roll.advResults).toBeUndefined();
  });

  it('reports a natural 20 or 1 only for a lone d20, from the kept roll', () => {
    expect(rollDiceExpression('1d20', { rng: faces(20, 20) })!.crit).toBe(
      'success',
    );
    expect(rollDiceExpression('1d20', { rng: faces(20, 1) })!.crit).toBe(
      'failure',
    );
    expect(rollDiceExpression('2d20', { rng: faces(20, 20, 20) })!.crit).toBe(
      undefined,
    );
    // The natural 20 was rolled but discarded under disadvantage.
    const dis = rollDiceExpression('1d20', {
      disadvantage: true,
      rng: faces(20, 20, 4),
    })!;
    expect(dis.total).toBe(4);
    expect(dis.crit).toBeUndefined();
    const adv = rollDiceExpression('1d20', {
      advantage: true,
      rng: faces(20, 4, 20),
    })!;
    expect(adv.crit).toBe('success');
  });

  it('returns null for invalid expressions', () => {
    expect(rollDiceExpression('banana')).toBeNull();
  });
});

describe('distribution', () => {
  it('stays in range and covers every face with the secure source', () => {
    const parsed = parseDiceExpression('1d6')!;
    const seen = new Set<number>();
    for (let i = 0; i < 600; i++) {
      const value = rollParsedDice(parsed, { rng: secureRng }).total;
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(6);
      seen.add(value);
    }
    expect(seen.size).toBe(6);
  });

  it('never returns a face outside the die for edge random values', () => {
    expect(
      rollParsedDice(parseDiceExpression('1d20')!, { rng: () => 0 }).total,
    ).toBe(1);
    expect(
      rollParsedDice(parseDiceExpression('1d20')!, { rng: () => 0.999999999 })
        .total,
    ).toBe(20);
  });
});
