import { describe, it, expect } from 'vitest';
import { getHighestSpellSlotLevel, normalizeSpellSlots } from './spellSlotUtils';

describe('spellSlotUtils', () => {
  it('normalizes cantrip-prefixed slot arrays', () => {
    const raw = [4, 3, 0, 0, 0, 0, 0, 0, 0];
    const normalized = normalizeSpellSlots('sorcerer', raw);

    expect(normalized.slice(0, 4)).toEqual([0, 3, 0, 0]);
    expect(getHighestSpellSlotLevel('sorcerer', raw)).toBe(1);
  });

  it('shifts zero-based slot arrays (bard) to include the cantrip placeholder', () => {
    const raw = [2, 0, 0, 0, 0, 0, 0, 0, 0];
    const normalized = normalizeSpellSlots('bard', raw);

    expect(normalized.slice(0, 3)).toEqual([0, 2, 0]);
    expect(getHighestSpellSlotLevel('bard', raw)).toBe(1);
  });
});
