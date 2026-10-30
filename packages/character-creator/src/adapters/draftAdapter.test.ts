import { describe, expect, it } from 'vitest';
import {
  creationDataToDraft,
  draftToCreationData,
  isPristineDraft,
} from './draftAdapter';
import { initialCreationData } from '../components/CharacterCreationWizard/constants/wizard.constants';
import { REFERENCE_BUILDS } from '../tests/fixtures/referenceBuilds';

describe('draftAdapter (CC-201)', () => {
  it('converts F24 CharacterCreationData to CreationDraft preserving raw scores and metadata', () => {
    const f24 = REFERENCE_BUILDS.F24.creationData;
    const draft = creationDataToDraft(f24, {
      draftId: 'draft-f24-test',
      characterId: 'char-f24-test',
      provenance: 'player',
    });

    expect(draft.draftVersion).toBe(1);
    expect(draft.draftId).toBe('draft-f24-test');
    expect(draft.characterId).toBe('char-f24-test');
    expect(draft.edition).toBe('2024');
    expect(draft.level).toBe(1);
    expect(draft.classSlug).toBe('fighter');
    expect(draft.backgroundSlug).toBe('soldier-2024');
    expect(draft.rawAbilityScores).toEqual(f24.abilities);
    expect(draft.abilityBonuses.method).toBe('2/1');
    expect(draft.abilityBonuses.bonuses).toEqual({ STR: 2, CON: 1 });
    expect(draft.fightingStyle).toBe('defense');
    expect(draft.originFeat).toBe('savage-attacker');
    expect(draft.speciesFeat).toBe('tough');
    expect(draft.provenance.species).toBe('player');
  });

  it('round-trips between CharacterCreationData and CreationDraft without data loss', () => {
    const w24 = REFERENCE_BUILDS.W24.creationData;
    const draft = creationDataToDraft(w24);
    const convertedBack = draftToCreationData(draft);

    expect(convertedBack.name).toBe(w24.name);
    expect(convertedBack.edition).toBe(w24.edition);
    expect(convertedBack.classSlug).toBe(w24.classSlug);
    expect(convertedBack.background).toBe(w24.background);
    expect(convertedBack.abilities).toEqual(w24.abilities);
    expect(convertedBack.backgroundAbilityChoices?.bonuses).toEqual(
      w24.backgroundAbilityChoices?.bonuses
    );
    expect(convertedBack.spellSelection.selectedCantrips).toEqual(
      w24.spellSelection.selectedCantrips
    );
    expect(convertedBack.spellSelection.spellbook).toEqual(w24.spellSelection.spellbook);
  });

  it('maps abilityScoreMethod variants to draft abilityMethod', () => {
    const f14 = { ...REFERENCE_BUILDS.F14.creationData, abilityScoreMethod: 'point-buy' as const };
    const draftPb = creationDataToDraft(f14);
    expect(draftPb.abilityMethod).toBe('point-buy');

    const f14Roll = { ...REFERENCE_BUILDS.F14.creationData, abilityScoreMethod: 'standard-roll' as const };
    const draftRoll = creationDataToDraft(f14Roll);
    expect(draftRoll.abilityMethod).toBe('manual');
  });
});

describe('prepared spells survive a draft round trip', () => {
  const roundTrip = (data: typeof initialCreationData) =>
    draftToCreationData(creationDataToDraft(data));

  it('keeps a Warlock pick even though dailyPrepared is an empty array', () => {
    const data = {
      ...initialCreationData,
      edition: '2024',
      classSlug: 'warlock',
      level: 5,
      spellSelection: {
        ...initialCreationData.spellSelection,
        dailyPrepared: [],
        preparedSpells: ['hex'],
      },
    } as typeof initialCreationData;
    expect(roundTrip(data).spellSelection.preparedSpells).toEqual(['hex']);
  });

  it('keeps a Wizard deselection instead of resurrecting the stale copy', () => {
    const data = {
      ...initialCreationData,
      edition: '2024',
      classSlug: 'wizard',
      level: 5,
      spellSelection: {
        ...initialCreationData.spellSelection,
        spellbook: ['shield'],
        dailyPrepared: [],
        preparedSpells: ['shield'],
      },
    } as typeof initialCreationData;
    expect(roundTrip(data).spellSelection.dailyPrepared).toEqual([]);
  });
});

describe('isPristineDraft', () => {
  it('is true for the blank starting draft', () => {
    expect(
      isPristineDraft(
        creationDataToDraft(initialCreationData, {
          provenance: 'recommended',
        }),
      ),
    ).toBe(true);
  });

  it('is false once the player or an import supplied anything', () => {
    expect(isPristineDraft(creationDataToDraft(initialCreationData))).toBe(
      false,
    );
  });

  it('is false for a recommendation-built draft that carries a choice', () => {
    const draft = creationDataToDraft(initialCreationData, {
      provenance: 'recommended',
    });
    expect(isPristineDraft({ ...draft, classSlug: 'fighter' })).toBe(false);
    expect(isPristineDraft({ ...draft, name: 'Ember' })).toBe(false);
  });
});
