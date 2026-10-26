import { describe, expect, it } from 'vitest';
import { REFERENCE_BUILDS } from '../tests/fixtures/referenceBuilds';
import { calculateCharacterStats } from '../utils/characterCreationUtils';
import { originChoiceErrors } from './originChoices';

// Independent expectations: D&D 2024 Basic Rules, Character Origins:
// https://www.dndbeyond.com/sources/dnd/br-2024/character-origins
describe('species grants and required choices', () => {
  it('rejects malformed Variant Human abilities and duplicate skill grants', () => {
    const data = {
      ...REFERENCE_BUILDS.F14.creationData,
      selectedSpeciesVariant: 'variant',
      variantFeat: 'tough',
      variantAbilityBonuses: { STR: 1, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0, LUCK: 1 },
      variantSkillProficiency: 'Athletics' as const,
    };
    expect(originChoiceErrors(data)).toHaveLength(2);
  });
  it('requires a Human skill and exactly one legal Origin feat', () => {
    const data = {
      ...REFERENCE_BUILDS.F24.creationData,
      speciesSkillProficiency: undefined,
      humanOriginFeat: undefined,
    };
    expect(originChoiceErrors(data)).toHaveLength(2);
    expect(originChoiceErrors({ ...data, humanOriginFeat: 'actor' })).toContain(
      'Choose the Origin feat granted by Human Versatile.',
    );
    expect(originChoiceErrors(REFERENCE_BUILDS.F24.creationData)).toEqual([]);
  });
  it('rejects species skills already granted or outside Keen Senses', () => {
    expect(
      originChoiceErrors({
        ...REFERENCE_BUILDS.F24.creationData,
        speciesSkillProficiency: 'Athletics',
      }),
    ).toHaveLength(1);
    expect(
      originChoiceErrors({
        ...REFERENCE_BUILDS.W24.creationData,
        speciesSkillProficiency: 'Athletics',
      }),
    ).toHaveLength(1);
  });
  it('rejects conflicting Human feat aliases rather than granting extra feats', () => {
    expect(
      originChoiceErrors({
        ...REFERENCE_BUILDS.F24.creationData,
        speciesFeat: 'alert',
      }).join(),
    ).toContain('conflicting');
  });
  it('accepts lineage display names and preserves Wood Elf speed and source spells', () => {
    const character = calculateCharacterStats({
      ...REFERENCE_BUILDS.R24.creationData,
      selectedLineage: 'Wood Elf',
    });
    expect(character.speed).toBe(35);
    expect(
      character.castingSources?.find(
        (source) => source.sourceType === 'species',
      )?.cantrips,
    ).toEqual(['druidcraft']);
  });
  it('applies one Tough grant and one Human skill through compatibility aliases', () => {
    const character = calculateCharacterStats({
      ...REFERENCE_BUILDS.F24.creationData,
      speciesFeat: 'tough',
      humanVersatileFeat: 'tough',
    });
    expect(character.maxHitPoints).toBe(14);
    expect(
      character.selectedFeats?.filter((feat) => feat === 'tough'),
    ).toHaveLength(1);
    expect(character.skills.Perception).toMatchObject({
      proficient: true,
      value: 3,
    });
  });
});
