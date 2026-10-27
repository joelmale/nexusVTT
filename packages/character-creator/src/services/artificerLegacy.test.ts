import { describe, expect, it } from 'vitest';
import { calculatePreparationLimit } from '@nexus/rules-5e';
import {
  ARTIFICER_LEGACY_INFUSIONS,
  ARTIFICER_LEGACY_ITEMS,
  ARTIFICER_LEGACY_CANTRIPS,
  artificer2014Progression,
} from '../data/progressions/artificer2014';
import { loadClasses } from './dataService';
import { classResourceDefinitions } from './classResources';
import { calculateCharacterStats } from '../utils/characterCreationUtils';
import { REFERENCE_BUILDS } from '../tests/fixtures/referenceBuilds';
import { recoverCharacterResource } from '@nexus/character-contracts';

describe('user-provided legacy Artificer reference', () => {
  it('keeps the legacy feature timeline and excludes revised replacement features', () => {
    expect(
      artificer2014Progression.features
        .filter((feature) => [2, 6, 7, 11, 14, 18, 20].includes(feature.level))
        .map((feature) => [feature.level, feature.name]),
    ).toEqual([
      [2, 'Infuse Item'],
      [6, 'Tool Expertise'],
      [7, 'Flash of Genius'],
      [11, 'Spell-Storing Item'],
      [14, 'Magic Item Savant'],
      [18, 'Magic Item Master'],
      [20, 'Soul of Artifice'],
    ]);
    expect(artificer2014Progression.asiLevels).toEqual([4, 8, 12, 16, 19]);
    expect(ARTIFICER_LEGACY_INFUSIONS).toEqual([
      0, 4, 4, 4, 4, 6, 6, 6, 6, 8, 8, 8, 8, 10, 10, 10, 10, 12, 12, 12,
    ]);
    expect(ARTIFICER_LEGACY_ITEMS).toEqual([
      0, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6,
    ]);
    expect(ARTIFICER_LEGACY_CANTRIPS).toEqual([
      2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4,
    ]);
  });
  it('uses actual Intelligence for uses and preserves capacities across rests', () => {
    const character = calculateCharacterStats(
      REFERENCE_BUILDS.F14.creationData,
    );
    character.class = 'artificer';
    character.classSlug = 'artificer';
    character.level = 11;
    character.abilities.INT = { score: 18, modifier: 4 };
    const resources = classResourceDefinitions(character);
    expect(
      resources.find((resource) => resource.id === 'flash-of-genius'),
    ).toMatchObject({ maxUses: 4, recovery: { longRest: 'full' } });
    expect(
      resources.find((resource) => resource.id === 'spell-storing-item'),
    ).toMatchObject({ maxUses: 8, recovery: {} });
    const capacity = resources.find(
      (resource) => resource.id === 'infused-item-capacity',
    )!;
    expect(capacity.maxUses).toBe(4);
    expect(
      recoverCharacterResource({ ...capacity, currentUses: 1 }, 'long-rest')
        .currentUses,
    ).toBe(1);
    expect(capacity.provenance?.source).toContain('wikidot.com/artificer');
  });
  it('uses legacy preparation math and excludes the spurious Survival class choice', () => {
    expect(calculatePreparationLimit('artificer', 1, 3, '2014')).toBe(3);
    expect(calculatePreparationLimit('artificer', 5, 2, '2014')).toBe(4);
    expect(
      loadClasses('2014').find((entry) => entry.slug === 'artificer')!
        .skill_proficiencies,
    ).not.toContain('Survival');
  });
});
