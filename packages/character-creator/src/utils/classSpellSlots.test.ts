import { describe, expect, it } from 'vitest';
import { classSpellSlots } from './classSpellSlots';

describe('normalized class spell slot progression', () => {
  // Literal rows transcribed from SRD 5.1/5.2.1 class tables, independent of production tables.
  it.each(['2014', '2024'] as const)(
    'matches full-caster boundary rows for %s',
    (edition) => {
      const rows: Record<number, number[]> = {
        1: [2],
        3: [4, 2],
        5: [4, 3, 2],
        9: [4, 3, 3, 3, 1],
        17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
        20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
      };
      for (const classSlug of ['bard', 'cleric', 'druid', 'sorcerer', 'wizard'])
        for (const [level, expected] of Object.entries(rows))
          expect(
            classSpellSlots(classSlug, edition, Number(level)).slice(1),
          ).toEqual([
            ...expected,
            ...Array<number>(9 - expected.length).fill(0),
          ]);
    },
  );
  it('starts revised Paladin and Ranger at level one while legacy starts at two', () => {
    for (const classSlug of ['paladin', 'ranger']) {
      expect(classSpellSlots(classSlug, '2014', 1)).toEqual(Array(10).fill(0));
      expect(classSpellSlots(classSlug, '2024', 1).slice(1, 3)).toEqual([2, 0]);
      expect(classSpellSlots(classSlug, '2014', 5).slice(1, 4)).toEqual([
        4, 2, 0,
      ]);
    }
    expect(classSpellSlots('artificer', '2014', 1)[1]).toBe(2);
  });
  it('keeps Pact Magic in its current slot rank without adding Arcanum slots', () => {
    for (const [level, rank, count] of [
      [1, 1, 1],
      [2, 1, 2],
      [3, 2, 2],
      [9, 5, 2],
      [11, 5, 3],
      [17, 5, 4],
    ] as const) {
      const row = classSpellSlots('warlock', '2024', level);
      expect(row[rank]).toBe(count);
      expect(row.reduce((sum, value) => sum + value, 0)).toBe(count);
    }
  });
  it('returns no slots for invalid levels and martial classes', () => {
    for (const level of [0, 21, NaN, 2.5])
      expect(classSpellSlots('wizard', '2024', level)).toEqual(
        Array(10).fill(0),
      );
    expect(classSpellSlots('fighter', '2024', 20)).toEqual(Array(10).fill(0));
  });
});
