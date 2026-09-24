import { describe, it, expect } from 'vitest';
import {
  calculateMulticlassCasterLevel,
  getSlotsForCasterLevel,
  getPactMagicSlots,
} from '../src';

describe('D&D 5e Spell Slot & Multiclass Progression', () => {
  it('returns standard slots for full caster levels', () => {
    const lvl1Slots = getSlotsForCasterLevel(1);
    expect(lvl1Slots[1]).toBe(2);
    expect(lvl1Slots[2]).toBeUndefined();

    const lvl5Slots = getSlotsForCasterLevel(5);
    expect(lvl5Slots[1]).toBe(4);
    expect(lvl5Slots[2]).toBe(3);
    expect(lvl5Slots[3]).toBe(2);

    const lvl20Slots = getSlotsForCasterLevel(20);
    expect(lvl20Slots[9]).toBe(1);
    expect(lvl20Slots[8]).toBe(1);
  });

  it('calculates single-class caster level correctly', () => {
    expect(
      calculateMulticlassCasterLevel([{ classSlug: 'wizard', level: 5 }]),
    ).toBe(5);

    // Paladin 2014: floor(5 / 2) = 2
    expect(
      calculateMulticlassCasterLevel(
        [{ classSlug: 'paladin', level: 5 }],
        '2014',
      ),
    ).toBe(2);

    // Paladin 2024: ceil(5 / 2) = 3
    expect(
      calculateMulticlassCasterLevel(
        [{ classSlug: 'paladin', level: 5 }],
        '2024',
      ),
    ).toBe(3);
  });

  it('calculates multiclass combinations correctly', () => {
    // Wizard 3 + Cleric 2 = 5
    expect(
      calculateMulticlassCasterLevel([
        { classSlug: 'wizard', level: 3 },
        { classSlug: 'cleric', level: 2 },
      ]),
    ).toBe(5);

    // Paladin 4 (2014) + Sorcerer 3 = 2 + 3 = 5
    expect(
      calculateMulticlassCasterLevel(
        [
          { classSlug: 'paladin', level: 4 },
          { classSlug: 'sorcerer', level: 3 },
        ],
        '2014',
      ),
    ).toBe(5);

    // Eldritch Knight 6 = floor(6 / 3) = 2
    expect(
      calculateMulticlassCasterLevel([
        { classSlug: 'eldritch-knight', level: 6 },
      ]),
    ).toBe(2);

    // Artificer 3 = ceil(3 / 2) = 2
    expect(
      calculateMulticlassCasterLevel([{ classSlug: 'artificer', level: 3 }]),
    ).toBe(2);
  });

  it('calculates Warlock Pact Magic slot progression accurately', () => {
    expect(getPactMagicSlots(0)).toEqual({ slots: 0, slotLevel: 0 });
    expect(getPactMagicSlots(1)).toEqual({ slots: 1, slotLevel: 1 });
    expect(getPactMagicSlots(2)).toEqual({ slots: 2, slotLevel: 1 });
    expect(getPactMagicSlots(3)).toEqual({ slots: 2, slotLevel: 2 });
    expect(getPactMagicSlots(5)).toEqual({ slots: 2, slotLevel: 3 });
    expect(getPactMagicSlots(9)).toEqual({ slots: 2, slotLevel: 5 });
    expect(getPactMagicSlots(11)).toEqual({ slots: 3, slotLevel: 5 });
    expect(getPactMagicSlots(17)).toEqual({ slots: 4, slotLevel: 5 });
  });
});
