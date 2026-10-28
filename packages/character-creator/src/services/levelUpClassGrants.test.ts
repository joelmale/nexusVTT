import { describe, expect, it } from 'vitest';
import { REFERENCE_BUILDS } from '../tests/fixtures/referenceBuilds';
import { calculateCharacterStats } from '../utils/characterCreationUtils';
import { applyLevelUp, calculateLevelUpData } from '../utils/levelUpUtils';
import type { LevelUpChoices } from '../types/dnd';

const levelUp = (
  id: string,
  startLevel: number,
  choices: LevelUpChoices,
  tweak?: (character: ReturnType<typeof calculateCharacterStats>) => void,
) => {
  const character = calculateCharacterStats({
    ...REFERENCE_BUILDS[id].creationData,
    level: startLevel,
  });
  tweak?.(character);
  const data = calculateLevelUpData(character)!;
  return {
    character,
    updated: applyLevelUp(character, data, {
      hpGained: data.averageHpGain,
      // A Warlock also learns one new spell at level 2.
      ...(id.startsWith('WL') ? { spellsLearned: ['hellish-rebuke'] } : {}),
      ...choices,
    }),
  };
};

describe('level-up Eldritch Invocation choices (2024)', () => {
  // SRD 5.2.1 Warlock table: 1 invocation at level 1, 3 at level 2.
  const valid: LevelUpChoices = {
    eldritchInvocationsChosen: [
      'eldritch-mind',
      'armor-of-shadows',
      'agonizing-blast',
    ],
    featChoices: {
      'invocation:agonizing-blast': { targets: ['eldritch-blast'] },
    },
  };

  it('records a full new selection and recomputes cantrip effects', () => {
    const { character, updated } = levelUp('WL24', 1, valid);
    expect(character.eldritchInvocations).toEqual(['eldritch-mind']);
    expect(updated.eldritchInvocations).toEqual(
      valid.eldritchInvocationsChosen,
    );
    expect(updated.featChoices?.['invocation:agonizing-blast']).toEqual({
      targets: ['eldritch-blast'],
    });
    expect(updated.classMechanics?.cantripEffects['eldritch-blast']).toEqual({
      damageBonus: updated.abilities.CHA.modifier,
    });
  });

  it('lets a level-up swap an earlier pick for another of the same count', () => {
    const { updated } = levelUp('WL24', 1, {
      ...valid,
      eldritchInvocationsChosen: [
        'devils-sight',
        'armor-of-shadows',
        'agonizing-blast',
      ],
    });
    expect(updated.eldritchInvocations).not.toContain('eldritch-mind');
    expect(updated.eldritchInvocations).toContain('devils-sight');
  });

  it('rejects a selection with the wrong count', () => {
    expect(() =>
      levelUp('WL24', 1, {
        ...valid,
        eldritchInvocationsChosen: ['eldritch-mind', 'armor-of-shadows'],
      }),
    ).toThrow(/Choose 3 Eldritch Invocations at Warlock level 2/);
  });

  it('rejects an invocation above the Warlock level', () => {
    expect(() =>
      levelUp('WL24', 1, {
        eldritchInvocationsChosen: [
          'eldritch-mind',
          'armor-of-shadows',
          'ascendant-step',
        ],
      }),
    ).toThrow(/'ascendant-step' is not available at this level/);
  });

  it('rejects duplicate picks', () => {
    expect(() =>
      levelUp('WL24', 1, {
        eldritchInvocationsChosen: [
          'eldritch-mind',
          'eldritch-mind',
          'armor-of-shadows',
        ],
      }),
    ).toThrow(/different Eldritch Invocations/);
  });

  it('rejects a cantrip invocation with no eligible target', () => {
    expect(() =>
      levelUp('WL24', 1, {
        eldritchInvocationsChosen: valid.eldritchInvocationsChosen,
        featChoices: {
          'invocation:agonizing-blast': { targets: ['minor-illusion'] },
        },
      }),
    ).toThrow(/eligible targets for Agonizing Blast/);
  });

  it('does not apply a rejected choice to the original character', () => {
    const character = calculateCharacterStats(
      REFERENCE_BUILDS.WL24.creationData,
    );
    const before = structuredClone(character);
    expect(() =>
      applyLevelUp(character, calculateLevelUpData(character)!, {
        hpGained: 5,
        eldritchInvocationsChosen: ['nonsense'],
      }),
    ).toThrow();
    expect(character).toEqual(before);
  });

  it('is limited to Warlocks and to the 2024 rules', () => {
    expect(() =>
      levelUp('F24', 3, { eldritchInvocationsChosen: ['eldritch-mind'] }),
    ).toThrow(/Only Warlocks/);
    expect(() =>
      levelUp('WL14', 1, { eldritchInvocationsChosen: ['agonizing-blast'] }),
    ).toThrow(/only supported for the 2024 rules/);
  });

  it('leaves invocations alone when the player did not touch them', () => {
    const { updated } = levelUp('WL24', 1, {});
    expect(updated.eldritchInvocations).toEqual(['eldritch-mind']);
  });
});

describe('level-up weapon mastery choices (2024)', () => {
  // SRD 5.2.1 Fighter: three masteries through level 3, four from level 4.
  const four = ['Greatsword', 'Flail', 'Javelin', 'Longsword'];

  it('records the new full mastery list when the count grows', () => {
    const { updated } = levelUp('F24', 3, { weaponMasteriesChosen: four });
    expect(updated.weaponMastery).toEqual(four);
  });

  it('rejects the wrong number of masteries', () => {
    expect(() =>
      levelUp('F24', 3, { weaponMasteriesChosen: four.slice(0, 3) }),
    ).toThrow(/Choose 4 different weapon masteries at level 4/);
  });

  it('rejects duplicates and unknown weapons', () => {
    expect(() =>
      levelUp('F24', 3, {
        weaponMasteriesChosen: ['Greatsword', 'Greatsword', 'Flail', 'Javelin'],
      }),
    ).toThrow(/different weapon masteries/);
    expect(() =>
      levelUp('F24', 3, {
        weaponMasteriesChosen: ['Greatsword', 'Flail', 'Javelin', 'Lightsaber'],
      }),
    ).toThrow(/only for weapons this class is proficient with/);
  });

  it('is not available for classes without Weapon Mastery or under 2014', () => {
    expect(() => levelUp('F14', 3, { weaponMasteriesChosen: four })).toThrow(
      /only available under the 2024 rules/,
    );
  });

  it('keeps existing masteries when the player did not change them', () => {
    const { character, updated } = levelUp('F24', 3, {});
    expect(updated.weaponMastery).toEqual(character.weaponMastery);
  });
});
