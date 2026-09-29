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
    expect(f.npcs.length).toBeGreaterThanOrEqual(6);
    expect(f.factions.length).toBeGreaterThanOrEqual(5);
    expect(f.quests.length).toBeGreaterThanOrEqual(6);
    expect(f.objectives.length).toBeGreaterThanOrEqual(15);
    expect(f.encounters.length).toBeGreaterThanOrEqual(6);
    expect(f.clues.length).toBeGreaterThanOrEqual(6);
    expect(f.handouts.length).toBeGreaterThanOrEqual(6);
    expect(f.locations.length).toBeGreaterThanOrEqual(6);
    expect(f.pins.length).toBeGreaterThanOrEqual(6);
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
});
