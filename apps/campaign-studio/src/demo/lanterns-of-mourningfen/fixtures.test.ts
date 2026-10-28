import { describe, expect, it } from 'vitest';

import { campaignCatalog } from '../campaign-catalog';
import {
  getMourningfenSessionFixture,
  inspectMourningfenFixtureIntegrity,
  lanternsOfMourningfen,
} from './index';

describe('Lanterns of Mourningfen fixtures', () => {
  it('keeps every cross-reference and normalized map coordinate valid', () => {
    expect(inspectMourningfenFixtureIntegrity()).toEqual([]);
  });

  it('contains the representative breadth of a full paused campaign', () => {
    const f = lanternsOfMourningfen;
    expect(f.acts).toHaveLength(3);
    expect(f.sessions).toHaveLength(4);
    expect(f.maps).toHaveLength(2);
    expect(f.pins).toHaveLength(9);
    expect(f.npcs.length).toBeGreaterThanOrEqual(15);
    expect(f.factions).toHaveLength(7);
    expect(f.quests).toHaveLength(10);
    expect(f.encounters.length).toBeGreaterThanOrEqual(13);
    expect(f.clues.length).toBeGreaterThanOrEqual(14);
    expect(f.handouts.length).toBeGreaterThanOrEqual(18);
    expect(f.locations).toHaveLength(17);
    expect(f.campaign.status).toBe('paused');
  });

  it('shows mixed quest, objective, and clue states from a mid-campaign stop', () => {
    const f = lanternsOfMourningfen;
    expect(new Set(f.quests.map((quest) => quest.status))).toEqual(
      new Set(['complete', 'active', 'on-hold', 'not-started']),
    );
    expect(f.objectives.some((o) => o.status === 'blocked')).toBe(true);
    expect(new Set(f.clues.map((clue) => clue.status)).size).toBe(3);
  });

  it('is a superset of the catalog entry without contradicting it', () => {
    const entry = campaignCatalog.find(
      (candidate) => candidate.slug === 'lanterns-of-mourningfen',
    );
    expect(entry).toBeDefined();
    expect(lanternsOfMourningfen.campaign.id).toBe(entry?.campaign.id);
    expect(lanternsOfMourningfen.campaign.title).toBe(entry?.campaign.name);
    expect(lanternsOfMourningfen.campaign.playerCharacters).toEqual(
      entry?.playerCharacters,
    );
    for (const catalogSession of entry?.showcaseSessions ?? []) {
      const session = getMourningfenSessionFixture(catalogSession.id);
      expect(session).toBeDefined();
      expect(session).toMatchObject({
        campaignId: catalogSession.campaignId,
        actId: catalogSession.actId,
        number: catalogSession.number,
        title: catalogSession.title,
        status: catalogSession.status,
        summary: catalogSession.summary,
        plannedDate: catalogSession.plannedDate,
        partyLevel: catalogSession.partyLevel,
        tags: catalogSession.tags,
      });
      expect(session?.plan?.steps.map((step) => step.title)).toEqual(
        expect.arrayContaining(
          catalogSession.plan?.steps.map((step) => step.title) ?? [],
        ),
      );
    }
    expect(lanternsOfMourningfen.campaign.currentSessionId).toBe(
      entry?.selectedSessionId,
    );
  });
});
