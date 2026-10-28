import { describe, expect, it } from 'vitest';
import {
  calculateMulticlassCasterLevel,
  getPactMagicSlots,
  getSlotsForCasterLevel,
} from '../src';

/**
 * Literal "Multiclass Spellcaster: Spell Slots per Spell Level" table, SRD 5.2.1
 * p25-26 (identical to SRD 5.1). Each row is the slots for spell levels 1-9.
 */
const TABLE: number[][] = [
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

describe('multiclass spell slots', () => {
  it.each(TABLE.map((row, index) => [index + 1, row] as const))(
    'caster level %i grants the SRD slots',
    (level, row) => {
      const slots = getSlotsForCasterLevel(level);
      const actual = Array.from({ length: 9 }, (_, i) => slots[i + 1] ?? 0);
      expect(actual).toEqual(Array.from({ length: 9 }, (_, i) => row[i] ?? 0));
    },
  );

  it('counts full casters in full and Paladin/Ranger as half, rounded up in 2024', () => {
    // SRD 5.2.1 worked example: Ranger 4 / Sorcerer 3 is caster level 5.
    expect(
      calculateMulticlassCasterLevel(
        [
          { classSlug: 'ranger', level: 4 },
          { classSlug: 'sorcerer', level: 3 },
        ],
        '2024',
      ),
    ).toBe(5);
    expect(
      calculateMulticlassCasterLevel(
        [
          { classSlug: 'paladin', level: 3 },
          { classSlug: 'wizard', level: 1 },
        ],
        '2024',
      ),
    ).toBe(3); // ceil(3 / 2) + 1
  });

  it('rounds Paladin/Ranger levels down in 2014', () => {
    expect(
      calculateMulticlassCasterLevel(
        [
          { classSlug: 'paladin', level: 3 },
          { classSlug: 'wizard', level: 1 },
        ],
        '2014',
      ),
    ).toBe(2); // floor(3 / 2) + 1
    expect(
      calculateMulticlassCasterLevel(
        [{ classSlug: 'ranger', level: 1 }],
        '2014',
      ),
    ).toBe(0); // a level-1 Ranger has no shared slots yet
  });

  it('keeps Warlock Pact Magic out of the shared slot calculation', () => {
    expect(
      calculateMulticlassCasterLevel(
        [
          { classSlug: 'warlock', level: 5 },
          { classSlug: 'cleric', level: 2 },
        ],
        '2024',
      ),
    ).toBe(2);
    // Pact Magic slots are tracked separately: Warlock 5 has two 3rd-level slots.
    expect(getPactMagicSlots(5)).toMatchObject({ slots: 2, slotLevel: 3 });
  });

  it('counts classes without spellcasting for nothing', () => {
    expect(
      calculateMulticlassCasterLevel(
        [
          { classSlug: 'fighter', level: 5 },
          { classSlug: 'barbarian', level: 3 },
          { classSlug: 'monk', level: 2 },
        ],
        '2024',
      ),
    ).toBe(0);
  });
});
