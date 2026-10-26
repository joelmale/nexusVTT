import { describe, expect, it } from 'vitest';
import { resolveCatalogEntitlements } from './catalogResolver';
import { creationDataToDraft } from '../adapters/draftAdapter';
import { REFERENCE_BUILDS } from '../tests/fixtures/referenceBuilds';

describe('catalogResolver (CC-202)', () => {
  it('enforces an explicit strict source policy and blocks excluded species', () => {
    const draft = creationDataToDraft(REFERENCE_BUILDS.F24.creationData);
    expect(
      resolveCatalogEntitlements(draft, { strictEntitlements: true }).map(
        (issue) => issue.id,
      ),
    ).toContain('MISSING_SOURCE_POLICY');
    expect(
      resolveCatalogEntitlements(draft, { allowedSources: ['SRD 2024'] }).map(
        (issue) => issue.id,
      ),
    ).toContain('DISALLOWED_SPECIES_SOURCE');
  });
  it('certifies valid reference build F24 with zero error issues', () => {
    const f24 = REFERENCE_BUILDS.F24.creationData;
    const draft = creationDataToDraft(f24);
    const issues = resolveCatalogEntitlements(draft);

    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors).toEqual([]);
  });

  it('detects missing species, class, and background', () => {
    const emptyDraft = creationDataToDraft({
      ...REFERENCE_BUILDS.F14.creationData,
      speciesSlug: '',
      classSlug: '',
      background: '',
    });
    const issues = resolveCatalogEntitlements(emptyDraft);

    expect(issues.some((i) => i.id === 'MISSING_SPECIES')).toBe(true);
    expect(issues.some((i) => i.id === 'MISSING_CLASS')).toBe(true);
    expect(issues.some((i) => i.id === 'MISSING_BACKGROUND')).toBe(true);
  });

  it('detects invalid 2024 ability bonus allocation', () => {
    const draft = creationDataToDraft({
      ...REFERENCE_BUILDS.F24.creationData,
      backgroundAbilityChoices: {
        method: '2/1',
        bonuses: { STR: 1, DEX: 1 }, // Invalid for 2/1 (must be 2 and 1)
      },
    });
    const issues = resolveCatalogEntitlements(draft);

    expect(issues.some((i) => i.id === 'INVALID_2_1_BONUS_ALLOCATION')).toBe(
      true,
    );
  });

  it('detects missing Fighter fighting style', () => {
    const draft = creationDataToDraft({
      ...REFERENCE_BUILDS.F24.creationData,
      fightingStyle: undefined,
      selectedFightingStyle: null,
    });
    const issues = resolveCatalogEntitlements(draft);

    expect(issues.some((i) => i.id === 'MISSING_FIGHTING_STYLE')).toBe(true);
  });

  it('detects under-entitled skills for Rogue', () => {
    const draft = creationDataToDraft({
      ...REFERENCE_BUILDS.R14.creationData,
      selectedSkills: ['Stealth'], // Rogue requires 4 skills
    });
    const issues = resolveCatalogEntitlements(draft);

    expect(issues.some((i) => i.id === 'UNDER_ENTITLED_SKILLS')).toBe(true);
  });
});
