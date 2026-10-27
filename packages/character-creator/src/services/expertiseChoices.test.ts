import { describe, expect, it } from 'vitest';
import { REFERENCE_BUILDS } from '../tests/fixtures/referenceBuilds';
import type { CharacterCreationData } from '../types/dnd';
import {
  classExpertiseCount,
  classExpertiseOptions,
  classExpertiseErrors,
} from './expertiseChoices';

describe('edition-specific Expertise entitlements', () => {
  it.each([
    ['rogue', '2014', 1, 2],
    ['rogue', '2024', 6, 4],
    ['bard', '2014', 2, 0],
    ['bard', '2014', 3, 2],
    ['bard', '2014', 10, 4],
    ['bard', '2024', 2, 2],
    ['bard', '2024', 9, 4],
    ['ranger', '2014', 9, 0],
    ['ranger', '2024', 2, 1],
    ['ranger', '2024', 9, 3],
    ['wizard', '2024', 2, 1],
    ['wizard', '2014', 2, 0],
  ] as const)(
    '%s %s at level %i grants %i choices',
    (classSlug, edition, level, expected) => {
      expect(classExpertiseCount({ classSlug, edition, level })).toBe(expected);
    },
  );
  it('restricts revised Rogue to skills while preserving legacy tool Expertise', () => {
    const legacy = REFERENCE_BUILDS.R14.creationData;
    expect(classExpertiseOptions(legacy)).toContain("Thieves' Tools");
    expect(classExpertiseOptions({ ...legacy, edition: '2024' })).not.toContain(
      "Thieves' Tools",
    );
  });
  it('rejects duplicates, missing choices and Expertise without proficiency', () => {
    const base: CharacterCreationData = {
      ...REFERENCE_BUILDS.R14.creationData,
      selectedSkills: ['Stealth', 'Acrobatics'],
    };
    expect(
      classExpertiseErrors({
        ...base,
        expertiseSkills: ['Stealth', 'Acrobatics'],
      }),
    ).toEqual([]);
    for (const choices of [[], ['Stealth', 'Stealth'], ['Stealth', 'Arcana']])
      expect(
        classExpertiseErrors({ ...base, expertiseSkills: choices }),
      ).not.toEqual([]);
  });
  it('limits Scholar to a proficient knowledge skill', () => {
    const data: CharacterCreationData = {
      ...REFERENCE_BUILDS.W24.creationData,
      level: 2,
      selectedSkills: ['Arcana', 'Stealth'],
    };
    expect(classExpertiseOptions(data)).toContain('Arcana');
    expect(classExpertiseOptions(data)).not.toContain('Stealth');
    expect(
      classExpertiseCount({ ...data, selectedFeats: ['skill-expert'] }),
    ).toBe(2);
  });
});
