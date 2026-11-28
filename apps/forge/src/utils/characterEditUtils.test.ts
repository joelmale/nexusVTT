import { describe, expect, it } from 'vitest';
import { draftToCreationData } from '@nexus/character-creator/adapters/draftAdapter';
import { getRecommendation } from '@nexus/character-creator/services/recommendationService';
import { calculateCharacterStats } from '@nexus/character-creator/utils/characterCreationUtils';
import {
  buildCompleteSpellcasting,
  deriveExistingCharacterEdit,
} from './characterEditUtils';

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

describe('deriveExistingCharacterEdit', () => {
  it.each([
    { armor: undefined, shields: [], before: 11, after: 14 },
    { armor: 'leather-armor', shields: [], before: 12, after: 15 },
    { armor: 'scale-mail', shields: [], before: 15, after: 16 },
    { armor: 'chain-mail', shields: [], before: 16, after: 16 },
    { armor: 'scale-mail', shields: ['shield'], before: 17, after: 18 },
  ])(
    'updates equipment AC from $before to $after with $armor and $shields',
    ({ armor, shields, before, after }) => {
      const draft = getRecommendation({
        classSlug: 'fighter',
        edition: '2024',
      }).draft;
      const character = calculateCharacterStats(draftToCreationData(draft));
      character.equippedArmor = armor;
      character.equippedWeapons = shields;
      character.abilities.DEX = { score: 12, modifier: 1 };
      character.armorClass = before;
      const result = deriveExistingCharacterEdit(character, {
        ...abilities,
        DEX: 18,
      });
      expect(result.hasCustomArmorClass).toBe(false);
      expect(result.armorClass).toBe(after);
      expect(character.armorClass).toBe(before);
    },
  );

  it('keeps a custom AC unless explicitly recalculated and updates casting numbers without spending resources', () => {
    const draft = getRecommendation({
      classSlug: 'wizard',
      edition: '2014',
    }).draft;
    const character = calculateCharacterStats(draftToCreationData(draft));
    character.equippedArmor = undefined;
    character.equippedWeapons = [];
    character.armorClass = 19;
    character.abilities.INT = { score: 16, modifier: 3 };
    const spellcasting = character.spellcasting!;
    spellcasting.usedSpellSlots = [0, 1];
    const next = { ...abilities, DEX: 18, INT: 18 };
    const result = deriveExistingCharacterEdit(character, next);
    expect(result.hasCustomArmorClass).toBe(true);
    expect(result.armorClass).toBe(19);
    expect(
      deriveExistingCharacterEdit(character, next, {}, true).armorClass,
    ).toBe(14);
    expect(result.spellcasting).toEqual({
      ...spellcasting,
      spellAttackBonus: spellcasting.spellAttackBonus + 1,
      spellSaveDC: spellcasting.spellSaveDC + 1,
    });
  });
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
