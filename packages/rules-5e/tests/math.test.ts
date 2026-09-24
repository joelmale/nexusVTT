import { describe, it, expect } from 'vitest';
import {
  getAbilityModifier,
  getProficiencyBonus,
  getPassiveScore,
  calculateSpellSaveDC,
  calculateSpellAttackBonus,
  getCrExperiencePoints,
  getLevelFromExperience,
  calculateAverageHitPoints,
} from '../src';

describe('D&D 5e Math Formulas', () => {
  it('calculates correct ability modifiers for standard and extreme scores', () => {
    expect(getAbilityModifier(10)).toBe(0);
    expect(getAbilityModifier(11)).toBe(0);
    expect(getAbilityModifier(12)).toBe(1);
    expect(getAbilityModifier(18)).toBe(4);
    expect(getAbilityModifier(20)).toBe(5);
    expect(getAbilityModifier(30)).toBe(10);
    expect(getAbilityModifier(8)).toBe(-1);
    expect(getAbilityModifier(9)).toBe(-1);
    expect(getAbilityModifier(1)).toBe(-5);
  });

  it('calculates proficiency bonus according to level tier', () => {
    expect(getProficiencyBonus(0)).toBe(2);
    expect(getProficiencyBonus(1)).toBe(2);
    expect(getProficiencyBonus(4)).toBe(2);
    expect(getProficiencyBonus(5)).toBe(3);
    expect(getProficiencyBonus(8)).toBe(3);
    expect(getProficiencyBonus(9)).toBe(4);
    expect(getProficiencyBonus(12)).toBe(4);
    expect(getProficiencyBonus(13)).toBe(5);
    expect(getProficiencyBonus(16)).toBe(5);
    expect(getProficiencyBonus(17)).toBe(6);
    expect(getProficiencyBonus(20)).toBe(6);
  });

  it('calculates passive scores with and without proficiency and advantage', () => {
    // 10 + 2 (mod) = 12
    expect(getPassiveScore(2, false, 3)).toBe(12);
    // 10 + 2 (mod) + 3 (prof) = 15
    expect(getPassiveScore(2, true, 3)).toBe(15);
    // with advantage (+5)
    expect(getPassiveScore(2, true, 3, 5)).toBe(20);
    // with disadvantage (-5)
    expect(getPassiveScore(2, true, 3, -5)).toBe(10);
  });

  it('calculates spell save DC and attack bonus', () => {
    // 8 + 4 (mod) + 3 (prof) = 15
    expect(calculateSpellSaveDC(4, 3)).toBe(15);
    // 8 + 4 + 3 + 1 (bonus wand) = 16
    expect(calculateSpellSaveDC(4, 3, 1)).toBe(16);

    // 4 + 3 = 7
    expect(calculateSpellAttackBonus(4, 3)).toBe(7);
    // 4 + 3 + 2 = 9
    expect(calculateSpellAttackBonus(4, 3, 2)).toBe(9);
  });

  it('correctly maps Challenge Rating to XP', () => {
    expect(getCrExperiencePoints(0)).toBe(10);
    expect(getCrExperiencePoints('1/4')).toBe(50);
    expect(getCrExperiencePoints(0.25)).toBe(50);
    expect(getCrExperiencePoints('1/2')).toBe(100);
    expect(getCrExperiencePoints(1)).toBe(200);
    expect(getCrExperiencePoints(10)).toBe(5900);
    expect(getCrExperiencePoints(20)).toBe(25000);
    expect(getCrExperiencePoints(999)).toBe(0);
  });

  it('derives character level from XP thresholds', () => {
    expect(getLevelFromExperience(0)).toBe(1);
    expect(getLevelFromExperience(299)).toBe(1);
    expect(getLevelFromExperience(300)).toBe(2);
    expect(getLevelFromExperience(6500)).toBe(5);
    expect(getLevelFromExperience(355000)).toBe(20);
    expect(getLevelFromExperience(500000)).toBe(20);
  });

  it('calculates average hit points progression across levels', () => {
    // Level 1 d10 with CON +3 = 13
    expect(calculateAverageHitPoints(10, 1, 3)).toBe(13);
    // Level 2 d10 with CON +3 = 13 + (6 + 3) = 22
    expect(calculateAverageHitPoints(10, 2, 3)).toBe(22);
    // Level 5 d8 with CON +2 = (8 + 2) + 4 * (5 + 2) = 10 + 28 = 38
    expect(calculateAverageHitPoints(8, 5, 2)).toBe(38);
    // Minimum 1 HP per level even with negative CON
    expect(calculateAverageHitPoints(6, 1, -10)).toBe(1);
  });
});
