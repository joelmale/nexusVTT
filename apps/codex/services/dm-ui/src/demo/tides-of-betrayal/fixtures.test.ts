import { describe, expect, it } from 'vitest';

import { campaignCatalog } from '../campaign-catalog/catalog';
import { inspectTidesFixtureIntegrity, tidesOfBetrayal } from './index';

describe('Tides of Betrayal fixtures', () => {
  it('keeps every cross-reference and normalized map coordinate valid', () => {
    expect(inspectTidesFixtureIntegrity()).toEqual([]);
  });

  it('is an eight-chapter campaign, two chapters played', () => {
    const f = tidesOfBetrayal;
    expect(f.campaign.status).toBe('active');
    expect(f.acts).toHaveLength(3);
    expect(f.sessions).toHaveLength(8);
    expect(f.campaign.sessionIds).toEqual(f.sessions.map((s) => s.id));
    expect(f.sessions.map((s) => s.status)).toEqual([
      'complete',
      'complete',
      'planned',
      'planned',
      'draft',
      'draft',
      'draft',
      'draft',
    ]);
    expect(f.sessions.map((s) => s.partyLevel)).toEqual([1, 2, 3, 3, 4, 4, 5, 5]);
    expect(f.campaign.currentSessionId).toBe(f.sessions[2].id);
  });

  it('fleshes out every chapter with a run plan', () => {
    for (const session of tidesOfBetrayal.sessions) {
      const plan = session.plan!;
      expect(plan.steps.length, session.title).toBeGreaterThanOrEqual(6);
      expect(plan.steps.some((s) => s.kind === 'encounter'), session.title).toBe(true);
      expect(plan.playerFacingSummary.length, session.title).toBeGreaterThan(0);
      expect(session.encounterIds.length, session.title).toBeGreaterThan(0);
      expect(session.handoutIds.length, session.title).toBeGreaterThan(0);
    }
  });

  it('reports object counts that match the fixture records', () => {
    const f = tidesOfBetrayal;
    const counts = f.campaign.objectCounts;
    expect(counts.scenes).toBe(f.locations.length);
    expect(counts.encounters).toBe(f.encounters.length);
    expect(counts.npcs).toBe(f.npcs.length);
    expect(counts.lore).toBe(f.handouts.filter((h) => h.kind === 'lore').length);
    expect(counts.handouts).toBe(
      f.handouts.filter((h) => h.kind === 'handout').length,
    );
    expect(counts.all).toBe(
      counts.scenes +
        counts.encounters +
        counts.npcs +
        counts.lore +
        counts.handouts +
        f.quests.length +
        f.factions.length +
        f.clues.length,
    );
  });

  it('resolves completed quests and keeps one map pin per pinned location', () => {
    const f = tidesOfBetrayal;
    expect(
      f.quests
        .filter((q) => q.status === 'complete')
        .every((q) => (q.resolution ?? '').length > 0),
    ).toBe(true);
    for (const location of f.locations.filter((l) => l.pinId)) {
      const pin = f.pins.find((p) => p.id === location.pinId);
      expect(pin?.locationId, location.id).toBe(location.id);
    }
  });

  it('agrees with the catalog entry', () => {
    const entry = campaignCatalog.find((e) => e.slug === 'tides-of-betrayal');
    expect(entry).toBeDefined();
    expect(entry?.campaign.id).toBe(tidesOfBetrayal.campaign.id);
    expect(entry?.campaign.name).toBe(tidesOfBetrayal.campaign.title);
    expect(entry?.lifecycle).toBe(tidesOfBetrayal.campaign.status);
    expect(entry?.selectedSessionId).toBe(tidesOfBetrayal.campaign.currentSessionId);
    expect(entry?.showcaseSessions).toEqual(tidesOfBetrayal.sessions.slice(0, 3));
  });
});
