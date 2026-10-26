import { describe, expect, it } from 'vitest';
import { draftToCreationData } from '../adapters/draftAdapter';
import { calculateCharacterStats } from '../utils/characterCreationUtils';
import { getRecommendation } from './recommendationService';
import { classGrantErrors, masteryOptions } from './classGrantChoices';

// Expected effects checked against the 2024 Basic Rules, Divine/Primal Order.
describe('class grant validation and effects', () => {
  it('limits Rogue martial masteries to finesse or light weapons and excludes nets', () => {
    const names = masteryOptions({ edition: '2024', classSlug: 'rogue' }).map(
      (weapon) => weapon.name,
    );
    expect(names).toContain('Rapier');
    expect(names).not.toContain('Greatsword');
    expect(
      masteryOptions({ edition: '2024', classSlug: 'fighter' }).map(
        (weapon) => weapon.name,
      ),
    ).not.toContain('Net');
  });
  it('requires different proficient masteries and rejects unknown weapons', () => {
    const data = draftToCreationData(
      getRecommendation({ classSlug: 'fighter', edition: '2024' }).draft,
    );
    expect(classGrantErrors(data)).toEqual([]);
    expect(classGrantErrors({ ...data, weaponMastery: [] }).join()).toContain(
      '3 different',
    );
    expect(
      classGrantErrors({
        ...data,
        weaponMastery: ['Dagger', 'Dagger', 'Greatsword'],
      }).join(),
    ).toContain('different');
    expect(
      classGrantErrors({
        ...data,
        weaponMastery: ['Made up', 'Dagger', 'Greatsword'],
      }).join(),
    ).toContain('proficient');
  });
  it.each(['cleric', 'druid'])('requires a valid %s order', (classSlug) => {
    const data = draftToCreationData(
      getRecommendation({ classSlug, edition: '2024' }).draft,
    );
    expect(classGrantErrors(data)).toEqual([]);
    expect(
      classGrantErrors({
        ...data,
        divineOrder: undefined,
        primalOrder: undefined,
      }),
    ).toHaveLength(1);
  });
  it('adds the Wisdom order skill bonus once and martial training only for the chosen order', () => {
    const data = draftToCreationData(
      getRecommendation({ classSlug: 'cleric', edition: '2024' }).draft,
    );
    const protector = calculateCharacterStats({
      ...data,
      divineOrder: 'protector',
    });
    const thaumaturge = calculateCharacterStats({
      ...data,
      divineOrder: 'thaumaturge',
    });
    expect(
      thaumaturge.skills.Arcana.value - protector.skills.Arcana.value,
    ).toBe(3);
    expect(
      thaumaturge.skills.Religion.value - protector.skills.Religion.value,
    ).toBe(3);
    expect(protector.proficiencies?.armor).toContain('Heavy armor');
    expect(protector.proficiencies?.weapons).toContain('Martial Weapons');
  });
});
