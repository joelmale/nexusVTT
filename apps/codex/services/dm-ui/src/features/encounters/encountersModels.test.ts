import { describe, expect, it } from 'vitest';

import { getFixtureBundle } from '@/demo/fixture-registry';

import {
  buildEncountersModel,
  canDeploy,
  isInNextSession,
  participantTotal,
} from './encountersModels';

const ashes = getFixtureBundle('ashes-of-veyra')!;

describe('encountersModels', () => {
  it('sums composition counts', () => {
    const encounter = ashes.encounters[0];
    expect(participantTotal(encounter)).toBe(
      encounter.composition.reduce((n, c) => n + c.count, 0),
    );
    expect(participantTotal({ ...encounter, composition: [] })).toBe(0);
  });

  it('filters by kind and search and sorts by title', () => {
    const titles = buildEncountersModel(ashes).map((r) => r.encounter.title);
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));
    const combat = buildEncountersModel(ashes, { kind: 'combat' });
    expect(combat.every((r) => r.encounter.kind === 'combat')).toBe(true);
    expect(buildEncountersModel(ashes, { q: 'zzzz' })).toHaveLength(0);
  });

  it('marks next-session encounters only for active campaigns', () => {
    const rows = buildEncountersModel(ashes, { sort: 'next' });
    const any = rows.some((r) => r.inNextSession);
    if (any) expect(rows[0].inNextSession).toBe(true);
    const complete = getFixtureBundle('stars-below-kharad')!;
    expect(complete.encounters.some((e) => isInNextSession(complete, e))).toBe(
      false,
    );
  });

  it('hides deploy only when complete', () => {
    expect(canDeploy(ashes)).toBe(true);
    expect(canDeploy(getFixtureBundle('stars-below-kharad')!)).toBe(false);
    expect(canDeploy(getFixtureBundle('crown-of-cinders')!)).toBe(true);
  });
});
