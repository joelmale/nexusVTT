import { describe, expect, it } from 'vitest';
import { REFERENCE_BUILDS } from '../tests/fixtures/referenceBuilds';
import { calculateCharacterStats } from '../utils/characterCreationUtils';
import {
  applyLevelUp,
  calculateLevelUpData,
  getLevelUpSteps,
} from '../utils/levelUpUtils';
import { levelUpExpertise, levelUpExpertiseErrors } from './levelUpExpertise';

describe('level-up Expertise choice application', () => {
  it('retains the legacy Rogue option for proficient Thieves Tools', () => {
    const character = calculateCharacterStats({
      ...REFERENCE_BUILDS.R14.creationData,
      level: 5,
    });
    character.proficiencies = {
      ...character.proficiencies,
      tools: ["Thieves' tools"],
    };
    character.skills.Arcana.proficient = true;
    expect(levelUpExpertise(character).options).toContain("Thieves' Tools");
    expect(
      levelUpExpertiseErrors(character, ["Thieves' Tools", 'Arcana']),
    ).toEqual([]);
  });
  it('retains prior Expertise and applies two new Rogue choices exactly once', () => {
    const character = calculateCharacterStats({
      ...REFERENCE_BUILDS.R24.creationData,
      level: 5,
    });
    for (const skill of ['Acrobatics', 'Athletics'] as const) {
      character.skills[skill] = {
        proficient: true,
        expertise: false,
        value:
          character.abilities[skill === 'Athletics' ? 'STR' : 'DEX'].modifier +
          3,
      };
    }
    const original = structuredClone(character);
    const data = calculateLevelUpData(character)!;
    expect(getLevelUpSteps(data)).toContain('expertise');
    expect(levelUpExpertise(character).count).toBe(2);
    const next = applyLevelUp(character, data, {
      expertiseChosen: ['Acrobatics', 'Athletics'],
    });
    expect(next.skills.Athletics.value).toBe(
      character.abilities.STR.modifier + 6,
    );
    expect(next.skills.Acrobatics.value).toBe(
      character.abilities.DEX.modifier + 6,
    );
    expect(next.skills.Athletics.expertise).toBe(true);
    expect(next.expertiseSkills).toEqual([
      ...(character.expertiseSkills ?? []),
      'Acrobatics',
      'Athletics',
    ]);
    expect(next.levelHistory?.[next.levelHistory.length - 1]).toMatchObject({
      expertiseChosen: ['Acrobatics', 'Athletics'],
      hpGained: next.maxHitPoints - character.maxHitPoints,
    });
    expect(character).toEqual(original);
    expect(() => applyLevelUp(character, data, {})).toThrow('2 new');
    expect(() =>
      applyLevelUp(character, data, {
        expertiseChosen: ['Acrobatics', 'Acrobatics'],
      }),
    ).toThrow();
  });
  it('restricts revised Scholar to a proficient knowledge skill', () => {
    const character = calculateCharacterStats(
      REFERENCE_BUILDS.W24.creationData,
    );
    character.skills.Arcana = { proficient: true, expertise: false, value: 5 };
    character.skills.Stealth = { proficient: true, expertise: false, value: 2 };
    expect(levelUpExpertise(character).options).toContain('Arcana');
    expect(levelUpExpertise(character).options).not.toContain('Stealth');
    const next = applyLevelUp(character, calculateLevelUpData(character)!, {
      expertiseChosen: ['Arcana'],
      spellsLearned: ['burning-hands', 'comprehend-languages'],
    });
    expect(next.skills.Arcana.value).toBe(7);
    expect(levelUpExpertiseErrors(character, ['Stealth'])).not.toEqual([]);
  });
  it('rejects Expertise when no new entitlement is granted', () => {
    const character = calculateCharacterStats(
      REFERENCE_BUILDS.F24.creationData,
    );
    expect(levelUpExpertiseErrors(character)).toEqual([]);
    expect(levelUpExpertiseErrors(character, ['Athletics'])).not.toEqual([]);
  });
});
