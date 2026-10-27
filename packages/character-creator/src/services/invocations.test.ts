import { describe, expect, it } from 'vitest';
import {
  creationDataToDraft,
  draftToCreationData,
} from '../adapters/draftAdapter';
import { createdCharacterToNexus } from '../adapters/nexusCharacter';
import { REFERENCE_BUILDS } from '../tests/fixtures/referenceBuilds';
import type { CharacterCreationData } from '../types/dnd';
import { calculateCharacterStats } from '../utils/characterCreationUtils';
import { classGrantErrors, masteryCount } from './classGrantChoices';
import {
  INVOCATIONS_2024,
  invocationCount,
  invocationFeatGrants,
  selectedInvocationCount,
} from './invocations';
import { invocationTargetOptions } from './invocationChoices';
import { getClassProgression } from '../utils/levelUpUtils';
import {
  getRequiredChoicesForLevel,
  requiresSubclass,
} from '../utils/highLevelCreationUtils';
import { CERTIFIED_SUPPORT_MANIFEST } from '../data/supportManifest';

const warlock = (level: number, choices: string[]): CharacterCreationData => ({
  ...REFERENCE_BUILDS.F24.creationData,
  classSlug: 'warlock',
  level,
  humanOriginFeat: 'alert',
  eldritchInvocations: choices,
  spellSelection: {
    selectedCantrips: ['eldritch-blast', 'chill-touch'],
    knownSpells: ['hex', 'charm-person'],
  },
});

// Independently transcribed SRD 5.2.1 p71, not generated from production tables.
const EXPECTED = [
  1, 3, 3, 3, 5, 5, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9, 10, 10, 10,
];
const LEGAL = [
  'eldritch-mind',
  'armor-of-shadows',
  'pact-of-the-blade',
  'pact-of-the-chain',
  'fiendish-vigor',
  'mask-of-many-faces',
  'misty-visions',
  'devils-sight',
  'otherworldly-leap',
  'gaze-of-two-minds',
];

describe('revised Warlock invocation progression (SRD 5.2.1 pp71–74)', () => {
  it.each(EXPECTED.map((count, index) => [index + 1, count]))(
    'validates the exact entitlement at level %i (%i invocations)',
    (level, count) => {
      expect(invocationCount(level)).toBe(count);
      const accumulated = getRequiredChoicesForLevel('warlock', '2024', level)
        .filter((entry) => entry.choice.type === 'invocation')
        .reduce((sum, entry) => sum + (entry.choice.count ?? 0), 0);
      expect(accumulated).toBe(count);
      const data = warlock(level, LEGAL.slice(0, count));
      expect(classGrantErrors(data)).toEqual([]);
      expect(
        classGrantErrors({
          ...data,
          eldritchInvocations: LEGAL.slice(0, count - 1),
        }).join(),
      ).toContain(`Choose ${count}`);
      expect(
        classGrantErrors({
          ...data,
          eldritchInvocations: [
            ...data.eldritchInvocations!,
            'pact-of-the-tome',
          ],
        }).join(),
      ).toContain(`Choose ${count}`);
    },
  );
  it.each([0, -1, 1.5, 21, Number.NaN])(
    'rejects an invalid class level %s',
    (level) => {
      expect(invocationCount(level)).toBe(0);
      expect(classGrantErrors(warlock(level, []))).not.toEqual([]);
    },
  );
  it('rejects unknown and duplicate IDs at higher levels while preserving imported legacy selections', () => {
    expect(classGrantErrors(warlock(20, ['invented'])).join()).toContain(
      'not available',
    );
    expect(
      classGrantErrors(
        warlock(2, ['eldritch-mind', 'eldritch-mind', 'armor-of-shadows']),
      ).join(),
    ).toContain('different');
    const legacy: CharacterCreationData = {
      ...warlock(2, ['legacy-custom']),
      edition: '2014',
    };
    expect(classGrantErrors(legacy).join()).toContain(
      'Unknown legacy invocation',
    );
    expect(
      draftToCreationData(creationDataToDraft(legacy)).eldritchInvocations,
    ).toEqual(['legacy-custom']);
  });
  it.each([
    ['eldritch-smite', 5, 'pact-of-the-blade'],
    ['thirsting-blade', 5, 'pact-of-the-blade'],
    ['devouring-blade', 12, 'thirsting-blade'],
    ['gift-of-the-protectors', 9, 'pact-of-the-tome'],
    ['investment-of-the-chain-master', 5, 'pact-of-the-chain'],
    ['lifedrinker', 9, 'pact-of-the-blade'],
  ] as const)(
    '%s requires its invocation prerequisite',
    (id, level, required) => {
      expect(classGrantErrors(warlock(level, [id])).join()).toContain(
        `requires ${required}`,
      );
      expect(
        classGrantErrors(warlock(level, [id, required])).join(),
      ).not.toContain(`${id} requires`);
      expect(
        classGrantErrors(warlock(level - 1, [id, required])).join(),
      ).toContain(`Invocation '${id}' is not available`);
    },
  );
  it('counts repeatable selections by distinct eligible target and rejects stale targets', () => {
    const data = warlock(2, ['eldritch-mind', 'agonizing-blast']);
    data.featChoices = {
      'invocation:agonizing-blast': {
        targets: ['eldritch-blast', 'chill-touch'],
      },
    };
    expect(selectedInvocationCount(data)).toBe(3);
    expect(classGrantErrors(data)).toEqual([]);
    for (const targets of [
      [],
      ['mage-hand'],
      ['eldritch-blast', 'eldritch-blast'],
    ]) {
      expect(
        classGrantErrors({
          ...data,
          featChoices: { 'invocation:agonizing-blast': { targets } },
        }).join(),
      ).toContain('eligible targets');
    }
    data.spellSelection.selectedCantrips = ['mage-hand'];
    expect(classGrantErrors(data).join()).toContain('eligible targets');
  });
  it('requires ranged and attack targets according to the chosen invocation', () => {
    const data = warlock(2, []);
    const spear = INVOCATIONS_2024.find(
      (entry) => entry.id === 'eldritch-spear',
    )!;
    const blast = INVOCATIONS_2024.find(
      (entry) => entry.id === 'repelling-blast',
    )!;
    expect(
      invocationTargetOptions(data, spear).map((entry) => entry.id),
    ).toEqual(['eldritch-blast']);
    expect(
      invocationTargetOptions(data, blast).map((entry) => entry.id),
    ).toEqual(expect.arrayContaining(['eldritch-blast', 'chill-touch']));
  });
  it('permits a damaging Tome cantrip as a Warlock spell, until the Tome grant is removed', () => {
    const data = warlock(2, ['pact-of-the-tome']);
    data.additionalCastingSources = [
      {
        id: 'class:warlock:pact-of-the-tome',
        sourceType: 'class',
        sourceSlug: 'pact-of-the-tome',
        ability: 'CHA',
        cantrips: ['sacred-flame'],
        knownSpells: [],
        preparedSpells: [],
      },
    ];
    const damage = INVOCATIONS_2024.find(
      (entry) => entry.id === 'agonizing-blast',
    )!;
    const attack = INVOCATIONS_2024.find(
      (entry) => entry.id === 'repelling-blast',
    )!;
    expect(
      invocationTargetOptions(data, damage).map((entry) => entry.id),
    ).toContain('sacred-flame');
    expect(
      invocationTargetOptions(data, attack).map((entry) => entry.id),
    ).not.toContain('sacred-flame');
    data.eldritchInvocations = [];
    expect(
      invocationTargetOptions(data, damage).map((entry) => entry.id),
    ).not.toContain('sacred-flame');
  });
  it('applies Lessons feats once and retains targets through draft, character and host serialization', () => {
    const data = warlock(2, [
      'eldritch-mind',
      'armor-of-shadows',
      'lessons-of-the-first-ones',
    ]);
    data.featChoices = {
      'invocation:lessons-of-the-first-ones': { targets: ['tough'] },
    };
    expect(classGrantErrors(data)).toEqual([]);
    expect(invocationFeatGrants(data)).toEqual(['tough']);
    const restored = draftToCreationData(creationDataToDraft(data));
    const character = calculateCharacterStats(restored);
    const without = calculateCharacterStats({
      ...data,
      eldritchInvocations: ['eldritch-mind', 'armor-of-shadows'],
    });
    expect(character.maxHitPoints - without.maxHitPoints).toBe(4);
    expect(character.selectedFeats).toContain('tough');
    const saved = JSON.parse(
      JSON.stringify(createdCharacterToNexus(character)),
    );
    expect(saved.featChoices).toEqual(data.featChoices);
    expect(saved.eldritchInvocations).toEqual(data.eldritchInvocations);
    expect(character.featuresAndTraits.classFeatures.join()).toContain(
      'Lessons of the First Ones (tough)',
    );
    expect(invocationFeatGrants({ ...data, classSlug: 'fighter' })).toEqual([]);
  });
  it('rejects a second copy of a nonrepeatable feat and a non-Origin feat', () => {
    const data = warlock(2, [
      'eldritch-mind',
      'armor-of-shadows',
      'lessons-of-the-first-ones',
    ]);
    data.featChoices = {
      'invocation:lessons-of-the-first-ones': { targets: ['alert'] },
    };
    expect(classGrantErrors(data).join()).toContain('different Origin feat');
    data.featChoices = {
      'invocation:lessons-of-the-first-ones': { targets: ['grappler'] },
    };
    expect(classGrantErrors(data).join()).toContain('eligible targets');
  });
  it('uses the revised subclass and Epic Boon choices without a separate pact boon', () => {
    const progression = getClassProgression('warlock', '2024')!;
    expect(progression.subclassLevel).toBe(3);
    expect(
      getRequiredChoicesForLevel('warlock', '2024', 2).some(
        (entry) => entry.choice.type === 'subclass',
      ),
    ).toBe(false);
    expect(
      getRequiredChoicesForLevel('warlock', '2024', 3).filter(
        (entry) => entry.choice.type === 'subclass',
      ),
    ).toHaveLength(1);
    expect(
      progression.features.some((entry) =>
        entry.choices?.some((choice) => choice.type === 'pact-boon'),
      ),
    ).toBe(false);
    expect(
      progression.features.find((entry) => entry.level === 19)?.choices?.[0]
        .type,
    ).toBe('feat');
    expect(
      progression.features.find((entry) => entry.level === 20)?.resources,
    ).toBeUndefined();
  });
});

describe('edition-specific subclass entry boundaries', () => {
  it.each(CERTIFIED_SUPPORT_MANIFEST.map((entry) => entry.classSlug))(
    '%s gains its revised subclass at level three',
    (classSlug) => {
      expect(requiresSubclass(classSlug, '2024', 2)).toEqual({
        required: false,
        subclassLevel: 3,
      });
      expect(requiresSubclass(classSlug, '2024', 3)).toEqual({
        required: true,
        subclassLevel: 3,
      });
      expect(getClassProgression(classSlug, '2024')?.subclassLevel).toBe(3);
    },
  );
  it.each([
    ['cleric', 1],
    ['sorcerer', 1],
    ['warlock', 1],
    ['druid', 2],
    ['wizard', 2],
    ['fighter', 3],
  ] as const)('preserves legacy %s timing', (classSlug, level) => {
    expect(requiresSubclass(classSlug, '2014', level - 1)).toEqual({
      required: false,
      subclassLevel: level,
    });
    expect(requiresSubclass(classSlug, '2014', level)).toEqual({
      required: true,
      subclassLevel: level,
    });
  });
});

describe('revised weapon mastery progression (SRD 5.2.1 pp28,47)', () => {
  it.each([
    ['fighter', [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6]],
    ['barbarian', [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]],
  ] as const)('enforces every %s level boundary', (classSlug, counts) => {
    counts.forEach((count, index) => {
      const data = {
        ...REFERENCE_BUILDS.F24.creationData,
        classSlug,
        level: index + 1,
        weaponMastery: [
          'Dagger',
          'Handaxe',
          'Greatsword',
          'Greataxe',
          'Mace',
          'Spear',
        ].slice(0, count),
      };
      expect(masteryCount(data)).toBe(count);
      expect(classGrantErrors(data)).toEqual([]);
      expect(
        classGrantErrors({
          ...data,
          weaponMastery: [...data.weaponMastery, 'Club'],
        }).join(),
      ).toContain(`Choose ${count}`);
    });
  });
});
