import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWizardNavigation } from './useWizardNavigation';
import type { CharacterCreationData } from '../../../types/dnd';

const createBaseCreationData = (overrides: Partial<CharacterCreationData> = {}): CharacterCreationData =>
  ({
    name: 'Test Character',
    level: 1,
    speciesSlug: 'human-2024',
    classSlug: 'fighter',
    abilities: { STR: 15, DEX: 14, CON: 13, INT: 12, WIS: 10, CHA: 8 },
    abilityScoreMethod: 'standard-array',
    background: 'soldier-2024',
    alignment: 'Neutral Good',
    edition: '2024',
    selectedSkills: [],
    selectedMusicalInstruments: [],
    equipmentChoices: [],
    hpCalculationMethod: 'max',
    spellSelection: {
      selectedCantrips: [],
      knownSpells: [],
      preparedSpells: [],
    },
    ...overrides,
  } as unknown as CharacterCreationData);

describe('useWizardNavigation', () => {
  it('includes fighting style (step 7) for level 1 Fighter', () => {
    const data = createBaseCreationData({ classSlug: 'fighter', level: 1 });
    const { result } = renderHook(() =>
      useWizardNavigation(0, () => {}, data),
    );

    // Step 7 is Fighting Style
    expect(result.current.visibleStepIndices).toContain(7);
  });

  it('excludes fighting style (step 7) for level 1 Paladin or Ranger, but includes at level 2', () => {
    const paladinLevel1 = createBaseCreationData({ classSlug: 'paladin', level: 1 });
    const { result: resLevel1 } = renderHook(() =>
      useWizardNavigation(0, () => {}, paladinLevel1),
    );
    expect(resLevel1.current.visibleStepIndices).not.toContain(7);

    const paladinLevel2 = createBaseCreationData({ classSlug: 'paladin', level: 2 });
    const { result: resLevel2 } = renderHook(() =>
      useWizardNavigation(0, () => {}, paladinLevel2),
    );
    expect(resLevel2.current.visibleStepIndices).toContain(7);
  });

  it('excludes fighting style for non-fighting style classes like Wizard', () => {
    const wizard = createBaseCreationData({ classSlug: 'wizard', level: 1 });
    const { result } = renderHook(() =>
      useWizardNavigation(0, () => {}, wizard),
    );
    expect(result.current.visibleStepIndices).not.toContain(7);
  });
});
