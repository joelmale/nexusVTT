import { describe, expect, it } from 'vitest';
import { REFERENCE_BUILDS } from '../tests/fixtures/referenceBuilds';
import type { CharacterCreationData } from '../types/dnd';
import { getRequiredChoicesForLevel } from '../utils/highLevelCreationUtils';
import { classGrantErrors } from './classGrantChoices';
import {
  legacyInvocationCount,
  legacyInvocationErrors,
} from './legacyInvocations';

const COUNTS = [0, 2, 2, 2, 3, 3, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8];
const LEGAL = [
  'armor-of-shadows',
  'beast-speech',
  'beguiling-influence',
  'devils-sight',
  'eldritch-sight',
  'eyes-of-the-rune-keeper',
  'fiendish-vigor',
  'mask-of-many-faces',
];
const data = (level: number): CharacterCreationData => ({
  ...REFERENCE_BUILDS.WL14.creationData,
  level,
  pactBoon: level >= 3 ? 'blade' : undefined,
  eldritchInvocations: LEGAL.slice(0, COUNTS[level - 1]),
});

describe('legacy Warlock invocations, SRD 5.1 pp46–49', () => {
  it.each(COUNTS.map((count, index) => [index + 1, count]))(
    'validates level %i entitlement of %i and accumulated progression choices',
    (level, count) => {
      expect(legacyInvocationCount(level)).toBe(count);
      expect(classGrantErrors(data(level))).toEqual([]);
      const accumulated = getRequiredChoicesForLevel('warlock', '2014', level)
        .filter((entry) => entry.choice.type === 'invocation')
        .reduce((sum, entry) => sum + (entry.choice.count ?? 0), 0);
      expect(accumulated).toBe(count);
      expect(
        classGrantErrors({
          ...data(level),
          eldritchInvocations: [
            ...data(level).eldritchInvocations!,
            'misty-visions',
          ],
        }).join(),
      ).toContain(`Choose ${count}`);
    },
  );
  it('enforces cantrip, level and Pact prerequisites without erasing stale selections', () => {
    expect(
      legacyInvocationErrors({
        ...data(2),
        spellSelection: { selectedCantrips: [], knownSpells: [] },
        eldritchInvocations: ['agonizing-blast', 'armor-of-shadows'],
      }).join(),
    ).toContain('Requires eldritch-blast');
    expect(
      legacyInvocationErrors({
        ...data(4),
        eldritchInvocations: ['thirsting-blade', 'armor-of-shadows'],
      }).join(),
    ).toContain('level 5');
    expect(
      legacyInvocationErrors({
        ...data(5),
        pactBoon: 'tome',
        eldritchInvocations: [
          'thirsting-blade',
          'armor-of-shadows',
          'beast-speech',
        ],
      }).join(),
    ).toContain('Pact of the blade');
    expect(
      legacyInvocationErrors({
        ...data(5),
        eldritchInvocations: [
          'thirsting-blade',
          'armor-of-shadows',
          'beast-speech',
        ],
      }),
    ).toEqual([]);
    expect(
      legacyInvocationErrors({ ...data(3), pactBoon: undefined }).join(),
    ).toContain('Choose a legacy Pact Boon');
    expect(
      legacyInvocationErrors({ ...data(2), pactBoon: 'blade' }).join(),
    ).toContain('requires Warlock level 3');
  });
  it('rejects unknown and duplicate legacy identities, while accepting retained prefixed IDs', () => {
    expect(
      legacyInvocationErrors({
        ...data(2),
        eldritchInvocations: [
          'armor-of-shadows',
          'eldritch-invocation-armor-of-shadows',
        ],
      }).join(),
    ).toContain('different');
    expect(
      legacyInvocationErrors({
        ...data(2),
        eldritchInvocations: ['unknown', 'armor-of-shadows'],
      }).join(),
    ).toContain('Unknown');
    expect(
      legacyInvocationErrors({
        ...data(2),
        eldritchInvocations: [
          'eldritch-invocation-armor-of-shadows',
          'beast-speech',
        ],
      }),
    ).toEqual([]);
    expect(legacyInvocationErrors({ ...data(2), edition: '2024' })).toEqual([]);
    for (const level of [0, 21, NaN, 1.5])
      expect(legacyInvocationCount(level)).toBe(0);
  });
});
