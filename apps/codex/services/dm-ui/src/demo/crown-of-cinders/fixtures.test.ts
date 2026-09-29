import { describe, expect, it } from 'vitest';

import { campaignCatalog } from '../campaign-catalog/catalog';
import {
  crownOfCinders,
  getCrownMapPins,
  getCrownSessionFixture,
  inspectCrownFixtureIntegrity,
} from './index';

describe('Crown of Cinders fixtures', () => {
  it('keeps every cross-reference and normalized map coordinate valid', () => {
    expect(inspectCrownFixtureIntegrity()).toEqual([]);
  });

  it('contains the representative campaign breadth for an early-prep draft', () => {
    expect(crownOfCinders.acts).toHaveLength(3);
    expect(crownOfCinders.sessions).toHaveLength(6);
    expect(crownOfCinders.pins).toHaveLength(7);
    expect(crownOfCinders.npcs).toHaveLength(9);
    expect(crownOfCinders.factions).toHaveLength(5);
    expect(crownOfCinders.quests).toHaveLength(4);
    expect(crownOfCinders.objectives).toHaveLength(10);
    expect(crownOfCinders.encounters).toHaveLength(5);
    expect(crownOfCinders.clues).toHaveLength(5);
    expect(crownOfCinders.handouts).toHaveLength(8);
    expect(crownOfCinders.locations).toHaveLength(8);
    expect(getCrownMapPins(crownOfCinders.maps[0].id)).toHaveLength(7);
  });

  it('has no completed history and leaves readiness items open', () => {
    expect(crownOfCinders.sessions.every((s) => s.status !== 'complete')).toBe(
      true,
    );
    expect(crownOfCinders.quests.every((q) => q.status === 'not-started')).toBe(
      true,
    );
    expect(
      crownOfCinders.objectives.every((o) => o.status !== 'complete'),
    ).toBe(true);
    const plan = crownOfCinders.sessions[0].plan;
    expect(plan?.readiness.some((item) => !item.complete)).toBe(true);
  });

  it('keeps object counts consistent with the fixture arrays', () => {
    const counts = crownOfCinders.campaign.objectCounts;
    expect(counts.npcs).toBe(crownOfCinders.npcs.length);
    expect(counts.encounters).toBe(crownOfCinders.encounters.length);
    expect(counts.lore).toBe(
      crownOfCinders.handouts.filter((h) => h.kind === 'lore').length,
    );
    expect(counts.handouts).toBe(
      crownOfCinders.handouts.filter((h) => h.kind === 'handout').length,
    );
  });

  it('agrees with the catalog entry', () => {
    const entry = campaignCatalog.find((e) => e.slug === 'crown-of-cinders');
    expect(entry).toBeDefined();
    expect(crownOfCinders.campaign.id).toBe(entry?.campaign.id);
    expect(crownOfCinders.campaign.title).toBe(entry?.campaign.name);
    expect(crownOfCinders.campaign.playerCharacters).toEqual(
      entry?.playerCharacters,
    );
    const catalogSession = entry?.showcaseSessions[0];
    const session = getCrownSessionFixture(catalogSession?.id ?? '');
    expect(session?.title).toBe(catalogSession?.title);
    expect(session?.status).toBe(catalogSession?.status);
    expect(session?.actId).toBe(catalogSession?.actId);
    expect(session?.plannedDate).toBe(catalogSession?.plannedDate);
    const catalogStepIds = catalogSession?.plan?.steps.map((s) => s.id);
    expect(session?.plan?.steps.slice(0, 4).map((s) => s.id)).toEqual(
      catalogStepIds,
    );
  });
});
