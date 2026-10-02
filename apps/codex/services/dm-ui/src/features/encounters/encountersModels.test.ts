import { describe, expect, it } from 'vitest';

import { getFixtureBundle } from '@/demo/fixture-registry';

import {
  buildEncountersModel,
  canDeploy,
  encounterSummaryStats,
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

  it('supports trap kind, labels, and includes traps in summary stats when present', () => {
    const trapEncounter = {
      ...ashes.encounters[0],
      id: 'enc-spiked-ceiling',
      title: 'Lowering Spiked Ceiling',
      kind: 'trap' as const,
      composition: [],
      trapDetails: {
        complexity: 'complex' as const,
        detectionDc: 16,
        disarmDc: 18,
        initiativeOrTimer: 'Initiative 20 & 10 (4 rounds)',
        countermeasures: 'Jam gears with iron spikes; solve zodiac runes',
      },
    };
    const bundleWithTrap = {
      ...ashes,
      encounters: [...ashes.encounters, trapEncounter],
    };

    const traps = buildEncountersModel(bundleWithTrap, { kind: 'trap' });
    expect(traps).toHaveLength(1);
    expect(traps[0].encounter.title).toBe('Lowering Spiked Ceiling');
    expect(traps[0].total).toBe(0);

    const stats = encounterSummaryStats(bundleWithTrap);
    const trapStat = stats.find((s) => s.label === 'Traps');
    expect(trapStat).toBeDefined();
    expect(trapStat?.value).toBe(1);
  });
});
