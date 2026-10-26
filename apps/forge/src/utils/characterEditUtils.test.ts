import { describe, expect, it } from 'vitest';
import { buildCompleteSpellcasting } from './characterEditUtils';

const abilities = { STR: 10, DEX: 10, CON: 10, INT: 16, WIS: 14, CHA: 8 };
const form = {
  ability: 'INT' as const,
  cantripsKnown: ['light'],
  spellsKnown: ['shield', 'sleep'],
};
const data = (cls: string, level = 3, extra = {}) => ({
  class: cls,
  level,
  abilities,
  proficiencyBonus: 2,
  ...extra,
});

describe('buildCompleteSpellcasting', () => {
  it('returns undefined without form data, a class or a level', () => {
    expect(
      buildCompleteSpellcasting(undefined, data('wizard')),
    ).toBeUndefined();
    expect(buildCompleteSpellcasting(form, data(''))).toBeUndefined();
    expect(buildCompleteSpellcasting(form, data('wizard', 0))).toBeUndefined();
  });

  it('returns undefined for classes that do not cast', () => {
    expect(buildCompleteSpellcasting(form, data('barbarian'))).toBeUndefined();
  });

  it('puts wizard spells in the spellbook and derives DC and attack bonus', () => {
    const result = buildCompleteSpellcasting(form, data('wizard'));
    expect(result).toMatchObject({
      ability: 'INT',
      spellcastingType: 'wizard',
      spellSaveDC: 8 + 2 + 3,
      spellAttackBonus: 2 + 3,
      cantripsKnown: ['light'],
      spellbook: ['shield', 'sleep'],
    });
    expect(result?.usedSpellSlots).toEqual(result?.spellSlots.map(() => 0));
  });

  it('puts prepared-caster spells in preparedSpells', () => {
    const result = buildCompleteSpellcasting(
      { ...form, ability: 'WIS' },
      data('cleric'),
    );
    expect(result?.spellcastingType).toBe('prepared');
    expect(result?.preparedSpells).toEqual(['shield', 'sleep']);
    expect(result?.spellSaveDC).toBe(8 + 2 + 2);
  });

  it('puts known-caster spells in spellsKnown', () => {
    const result = buildCompleteSpellcasting(
      { ...form, ability: 'INT' },
      data('sorcerer'),
    );
    expect(result?.spellcastingType).toBe('known');
    expect(result?.spellsKnown).toEqual(['shield', 'sleep']);
  });

  it('defaults a missing proficiency bonus to 2 and missing lists to empty', () => {
    const result = buildCompleteSpellcasting(
      {
        ability: 'INT',
        cantripsKnown: undefined,
        spellsKnown: undefined,
      } as never,
      data('wizard', 1, { proficiencyBonus: 0 }),
    );
    expect(result?.spellSaveDC).toBe(8 + 2 + 3);
    expect(result?.cantripsKnown).toEqual([]);
    expect(result?.spellbook).toEqual([]);
  });

  it('falls back to a single zero slot for unknown class levels', () => {
    const result = buildCompleteSpellcasting(form, data('wizard', 99));
    expect(result?.spellSlots).toEqual([0]);
  });
});
