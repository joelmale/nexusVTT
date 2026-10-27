import { describe, expect, it } from 'vitest';
import { REFERENCE_BUILDS } from '../tests/fixtures/referenceBuilds';
import { calculateCharacterStats } from './characterCreationUtils';
import { applyLevelUp, calculateLevelUpData } from './levelUpUtils';
import { classSpellSlots } from './classSpellSlots';

describe('level-up preservation and boundaries', () => {
  it('does not mutate the prior character and preserves damage and spent resources', () => {
    const character = calculateCharacterStats({
      ...REFERENCE_BUILDS.F24.creationData,
      level: 3,
    });
    character.hitPoints -= 5;
    character.resources!.find(
      (resource) => resource.id === 'second-wind',
    )!.currentUses = 0;
    const original = structuredClone(character);
    const level = calculateLevelUpData(character)!;
    const next = applyLevelUp(character, level, {
      hpGained: 8,
      asiChoices: [{ ability: 'CON', increase: 2 }],
    });
    expect(character).toEqual(original);
    expect(next.maxHitPoints - original.maxHitPoints).toBe(14); // 8 HP + Tough's 2 HP + retrospective CON modifier * 4 levels.
    expect(next.maxHitPoints - next.hitPoints).toBe(5);
    expect(
      next.resources!.find((resource) => resource.id === 'second-wind'),
    ).toMatchObject({ maxUses: 3, currentUses: 1 });
  });
  it('preserves expended Pact Magic when the slot rank advances', () => {
    const character = calculateCharacterStats(
      REFERENCE_BUILDS.WL24.creationData,
    );
    character.level = 2;
    character.spellcasting!.spellSlots = classSpellSlots('warlock', '2024', 2);
    character.spellcasting!.usedSpellSlots = [0, 2, 0, 0, 0, 0, 0, 0, 0, 0];
    const next = applyLevelUp(character, calculateLevelUpData(character)!, {
      hpGained: 5,
    });
    expect(next.spellcasting!.spellSlots[2]).toBe(2);
    expect(next.spellcasting!.usedSpellSlots.slice(1, 3)).toEqual([0, 2]);
    expect(character.spellcasting!.usedSpellSlots[1]).toBe(2);
  });
  it('rejects skipped levels, invalid HP and invalid ASIs without mutating the input', () => {
    const character = calculateCharacterStats({
      ...REFERENCE_BUILDS.F24.creationData,
      level: 3,
    });
    const level = calculateLevelUpData(character)!;
    const original = structuredClone(character);
    expect(() => applyLevelUp(character, { ...level, toLevel: 5 }, {})).toThrow(
      'exactly one',
    );
    for (const hpGained of [-1, 0, 1.5, 100, NaN])
      expect(() => applyLevelUp(character, level, { hpGained })).toThrow();
    expect(() =>
      applyLevelUp(character, level, { hpRoll: 11, hpGained: 13 }),
    ).toThrow();
    expect(() =>
      applyLevelUp(character, level, { hpRoll: 2, hpGained: 8 }),
    ).toThrow('match');
    expect(() =>
      applyLevelUp(character, level, {
        asiChoices: [{ ability: 'STR', increase: 3 }],
      }),
    ).toThrow();
    expect(() =>
      applyLevelUp(character, level, {
        asiChoices: [{ ability: 'STR', increase: 1 }],
      }),
    ).toThrow('two points');
    character.abilities.STR.score = 20;
    expect(() =>
      applyLevelUp(character, level, {
        asiChoices: [{ ability: 'STR', increase: 2 }],
      }),
    ).toThrow('maximum');
    character.abilities.STR.score = original.abilities.STR.score;
    expect(character).toEqual(original);
  });
});
