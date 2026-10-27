import { describe, expect, it } from 'vitest';
import { REFERENCE_BUILDS } from '../tests/fixtures/referenceBuilds';
import { calculateCharacterStats } from '../utils/characterCreationUtils';
import { applyLevelUp, calculateLevelUpData } from '../utils/levelUpUtils';
import { levelUpCasting, levelUpCastingErrors } from './levelUpCasting';

describe('edition-aware level-up spell choices', () => {
  it.each([
    [
      'paladin',
      'CHA',
      ['bless', 'cure-wounds', 'detect-magic', 'shield-of-faith'],
    ],
    ['ranger', 'WIS', ['cure-wounds', 'longstrider']],
  ] as const)(
    'initializes %s spellcasting at the legacy level-two boundary',
    (classSlug, ability, spells) => {
      const character = calculateCharacterStats(
        REFERENCE_BUILDS.F14.creationData,
      );
      character.class = classSlug;
      character.classSlug = classSlug;
      character.abilities[ability] = { score: 16, modifier: 3 };
      delete character.spellcasting;
      const next = applyLevelUp(character, calculateLevelUpData(character)!, {
        spellsLearned: [...spells],
        fightingStyleChosen: classSlug === 'paladin' ? 'Defense' : 'Archery',
      });
      expect(next.spellcasting).toMatchObject({
        ability,
        spellSaveDC: 13,
        spellAttackBonus: 5,
        spellSlots: [0, 2, 0, 0, 0, 0, 0, 0, 0, 0],
        usedSpellSlots: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      });
      expect(
        classSlug === 'paladin'
          ? next.spellcasting!.preparedSpells
          : next.spellcasting!.spellsKnown,
      ).toEqual(spells);
      expect(character.spellcasting).toBeUndefined();
    },
  );
  it('requires two Wizard book spells and rejects duplicate, known, wrong-class and too-high spells', () => {
    const character = calculateCharacterStats(
      REFERENCE_BUILDS.W24.creationData,
    );
    expect(levelUpCasting(character)).toMatchObject({
      cantrips: 0,
      spells: 2,
      maxLevel: 1,
    });
    expect(
      levelUpCastingErrors(character, [
        'burning-hands',
        'comprehend-languages',
      ]),
    ).toEqual([]);
    for (const spells of [
      [],
      ['burning-hands', 'burning-hands'],
      ['shield', 'burning-hands'],
      ['cure-wounds', 'burning-hands'],
      ['fireball', 'burning-hands'],
      ['unknown', 'burning-hands'],
    ])
      expect(levelUpCastingErrors(character, spells)).not.toEqual([]);
  });
  it('separates cantrip and book learning at a Wizard cantrip transition', () => {
    const character = calculateCharacterStats({
      ...REFERENCE_BUILDS.W24.creationData,
      level: 3,
    });
    const data = calculateLevelUpData(character)!;
    expect(
      data.choices.filter((choice) => choice.type === 'spells'),
    ).toMatchObject([{ count: 1 }, { count: 2 }]);
    const next = applyLevelUp(character, data, {
      cantripsLearned: ['light'],
      spellsLearned: ['burning-hands', 'comprehend-languages'],
    });
    expect(next.spellcasting!.cantripsKnown).toContain('light');
    expect(next.spellcasting!.spellbook).toEqual([
      ...(character.spellcasting!.spellbook ?? []),
      'burning-hands',
      'comprehend-languages',
    ]);
    expect(character.spellcasting!.cantripsKnown).not.toContain('light');
  });
  it('saves revised Warlock additions in prepared spells and preserves Pact expenditure', () => {
    const character = calculateCharacterStats(
      REFERENCE_BUILDS.WL24.creationData,
    );
    character.spellcasting!.usedSpellSlots[1] = 1;
    expect(levelUpCasting(character)).toMatchObject({
      cantrips: 0,
      spells: 1,
      maxLevel: 1,
    });
    const next = applyLevelUp(character, calculateLevelUpData(character)!, {
      spellsLearned: ['comprehend-languages'],
    });
    expect(next.spellcasting!.preparedSpells).toEqual([
      'charm-person',
      'hex',
      'comprehend-languages',
    ]);
    expect(next.spellcasting!.usedSpellSlots[1]).toBe(1);
    expect(next.spellcasting!.spellsKnown).toEqual(
      character.spellcasting!.spellsKnown,
    );
  });
  it('uses the legacy Ranger table beyond the old four-spell cap', () => {
    const character = calculateCharacterStats(
      REFERENCE_BUILDS.WL14.creationData,
    );
    character.class = 'ranger';
    character.classSlug = 'ranger';
    character.level = 16;
    character.spellcasting!.spellsKnown = Array.from(
      { length: 9 },
      (_, index) => `previous-${index}`,
    );
    expect(levelUpCasting(character)).toMatchObject({ spells: 1, maxLevel: 5 });
  });
});
