import { describe, expect, it } from 'vitest';
import { REFERENCE_BUILDS } from '../tests/fixtures/referenceBuilds';
import { calculateCharacterStats } from '../utils/characterCreationUtils';
import { featEntitlementErrors } from './featEntitlements';
import { originChoiceErrors } from './originChoices';

describe('feat prerequisites and legacy grants', () => {
  it('blocks unknown feats, unmet species prerequisites, and disallowed sources', () => {
    const data = {
      ...REFERENCE_BUILDS.F24.creationData,
      level: 4,
      selectedFeats: ['invented-feat', 'elven-accuracy'],
      featChoices: { 'elven-accuracy': { abilityChoice: 'DEX' } },
    };
    const messages = featEntitlementErrors(
      data,
      calculateCharacterStats(data),
      ['SRD 2024'],
    );
    expect(messages.join()).toContain('unavailable');
    expect(messages.join()).toContain('Elf');
    expect(messages.join()).toContain('does not permit');
  });
  it('blocks general feats before their level and missing ability choices', () => {
    const data = {
      ...REFERENCE_BUILDS.F24.creationData,
      selectedFeats: ['actor', 'athlete'],
    };
    expect(
      featEntitlementErrors(data, calculateCharacterStats(data)).join(),
    ).toContain('level 4');
    expect(
      featEntitlementErrors(data, calculateCharacterStats(data)).join(),
    ).toContain('ability increase');
  });
  it('applies Variant Human increases, skill and feat once without standard Human bonuses', () => {
    const data = {
      ...REFERENCE_BUILDS.F14.creationData,
      selectedSpeciesVariant: 'variant',
      variantAbilityBonuses: { STR: 1, DEX: 0, CON: 1, INT: 0, WIS: 0, CHA: 0 },
      variantSkillProficiency: 'Perception' as const,
      variantFeat: 'actor',
    };
    const character = calculateCharacterStats(data);
    expect(character.abilities.STR.score).toBe(16);
    expect(character.abilities.DEX.score).toBe(13);
    expect(character.abilities.CON.score).toBe(15);
    expect(character.abilities.CHA.score).toBe(11);
    expect(character.skills.Perception.proficient).toBe(true);
    expect(character.selectedFeats).toContain('actor');
    expect(originChoiceErrors(data)).toEqual([]);
    expect(featEntitlementErrors(data, character)).toEqual([]);
  });
});
