import { describe, expect, it } from 'vitest';

import { inspectKharadFixtureIntegrity, starsBelowKharad } from './index';

describe('Stars Below Kharad fixtures', () => {
  it('keeps every cross-reference and normalized map coordinate valid', () => {
    expect(inspectKharadFixtureIntegrity()).toEqual([]);
  });

  it('is a completed three-session campaign matching the catalog entry', () => {
    const f = starsBelowKharad;
    expect(f.campaign.id).toBe('campaign-stars-below-kharad');
    expect(f.campaign.status).toBe('complete');
    expect(f.sessions).toHaveLength(3);
    expect(f.sessions.every((s) => s.status === 'complete')).toBe(true);
    expect(f.sessions[2].title).toBe('When the Deep Sky Opens');
    expect(f.campaign.playerCharacters).toHaveLength(4);
    expect(f.campaign.sessionIds).toEqual(f.sessions.map((s) => s.id));
  });

  it('has campaign breadth comparable to the Ashes of Veyra fixture', () => {
    const f = starsBelowKharad;
    expect(f.npcs.length).toBeGreaterThanOrEqual(14);
    expect(f.factions.length).toBeGreaterThanOrEqual(8);
    expect(f.quests.length).toBeGreaterThanOrEqual(10);
    expect(f.objectives.length).toBeGreaterThanOrEqual(30);
    expect(f.encounters.length).toBeGreaterThanOrEqual(11);
    expect(f.clues.length).toBeGreaterThanOrEqual(12);
    expect(f.handouts.length).toBeGreaterThanOrEqual(14);
    expect(f.locations.length).toBeGreaterThanOrEqual(13);
    expect(f.pins.length).toBeGreaterThanOrEqual(13);
  });

  it('reports object counts that match the fixture records', () => {
    const f = starsBelowKharad;
    const counts = f.campaign.objectCounts;
    expect(counts.scenes).toBe(f.locations.length);
    expect(counts.encounters).toBe(f.encounters.length);
    expect(counts.npcs).toBe(f.npcs.length);
    expect(counts.lore).toBe(
      f.handouts.filter((h) => h.kind === 'lore').length,
    );
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

  it('shows a resolved campaign with no active or unstarted quests', () => {
    const f = starsBelowKharad;
    expect(
      f.quests.every((q) => q.status === 'complete' || q.status === 'on-hold'),
    ).toBe(true);
    expect(f.objectives.some((o) => o.status === 'active')).toBe(false);
  });

  it('keeps completed quests resolved and leaves lingering epilogue threads', () => {
    const f = starsBelowKharad;
    expect(
      f.quests
        .filter((q) => q.status === 'complete')
        .every((q) => (q.resolution ?? '').length > 0),
    ).toBe(true);
    const onHold = f.quests.filter((q) => q.status === 'on-hold');
    expect(onHold.length).toBeGreaterThanOrEqual(2);
    expect(onHold.length).toBeLessThanOrEqual(3);
    const open = f.clues.filter((c) => c.status !== 'resolved');
    expect(open.length).toBeGreaterThanOrEqual(2);
    expect(open.length).toBeLessThanOrEqual(4);
    expect(f.clues.filter((c) => c.status === 'resolved').length).toBeGreaterThan(
      open.length * 2,
    );
  });

  it('has a populated activity feed that resolves to real objects', () => {
    const { backlinks, recentEdits } = starsBelowKharad.campaign.activity;
    expect(backlinks.length).toBeGreaterThanOrEqual(6);
    expect(recentEdits.length).toBeGreaterThanOrEqual(6);
  });
});
