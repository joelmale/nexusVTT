import { describe, expect, it } from 'vitest';
import { REFERENCE_BUILDS } from '../tests/fixtures/referenceBuilds';
import { calculateCharacterStats } from '../utils/characterCreationUtils';
import {
  featProficiencyErrors,
  featProficiencyGrants,
  recommendedFeatProficiencies,
} from './featProficiencies';

describe('feat proficiency grants', () => {
  it('keeps two repeatable Skilled grants as six distinct proficiencies', () => {
    const data = {
      ...REFERENCE_BUILDS.F24.creationData,
      background: 'charlatan-2024',
      originFeat: 'skilled',
      humanOriginFeat: 'skilled',
    };
    expect(featProficiencyGrants(data)[0].count).toBe(6);
    const choices = recommendedFeatProficiencies(data);
    expect(new Set(choices.skilled.proficiencies as string[]).size).toBe(6);
    expect(featProficiencyErrors({ ...data, featChoices: choices })).toEqual(
      [],
    );
  });
  it('requires three distinct new Skilled proficiencies and applies skills and tools', () => {
    const data = {
      ...REFERENCE_BUILDS.F24.creationData,
      humanOriginFeat: 'skilled',
    };
    expect(featProficiencyErrors(data)).toHaveLength(1);
    const selected = {
      ...data,
      featChoices: {
        skilled: { proficiencies: ['Arcana', 'History', 'Lute'] },
      },
    };
    expect(featProficiencyErrors(selected)).toEqual([]);
    const character = calculateCharacterStats(selected);
    expect(character.skills.Arcana.proficient).toBe(true);
    expect(character.skills.History.proficient).toBe(true);
    expect(character.proficiencies?.tools).toContain('Lute');
    expect(
      featProficiencyErrors({
        ...data,
        featChoices: {
          skilled: { proficiencies: ['Arcana', 'Arcana', 'Athletics'] },
        },
      }),
    ).toHaveLength(1);
  });
  it.each(['crafter', 'musician'])(
    'offers only eligible %s tools and provides deterministic choices',
    (feat) => {
      const data = {
        ...REFERENCE_BUILDS.F24.creationData,
        humanOriginFeat: feat,
      };
      const grant = featProficiencyGrants(data)[0];
      expect(grant.options).not.toContain('Arcana');
      expect(grant.options).toContain(
        feat === 'crafter' ? "Alchemist's Supplies" : 'Lute',
      );
      expect(
        featProficiencyErrors({
          ...data,
          featChoices: recommendedFeatProficiencies(data),
        }),
      ).toEqual([]);
    },
  );
});
