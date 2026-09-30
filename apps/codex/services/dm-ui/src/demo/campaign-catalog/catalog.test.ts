import { describe, expect, it } from 'vitest';

import {
  campaignCatalog,
  getCampaignCatalogEntry,
  getCampaignCatalogEntryBySlug,
  getCatalogSession,
  getVisibleCampaignCatalog,
  inspectCampaignCatalog,
} from './index';

describe('campaign catalog fixtures', () => {
  it('contains four campaigns with bounded showcase session sets', () => {
    expect(campaignCatalog).toHaveLength(4);
    expect(
      campaignCatalog.map((entry) => entry.showcaseSessions.length),
    ).toEqual([3, 1, 2, 3]);
    expect(campaignCatalog.map((entry) => entry.lifecycle)).toEqual([
      'active',
      'draft',
      'paused',
      'complete',
    ]);
  });

  it('keeps the full Ashes of Veyra fixture intact while cataloging a subset', () => {
    const ashes = getCampaignCatalogEntry('campaign-ashes-of-veyra');

    expect(ashes?.fixtureSource).toBe('full-demo');
    expect(ashes?.showcaseSessions.map((session) => session.number)).toEqual([
      11, 12, 13,
    ]);
  });

  it('provides a plan and mixed prep states for developer UI branches', () => {
    const catalogSessions = campaignCatalog.flatMap(
      (entry) => entry.showcaseSessions,
    );
    const readinessStates = catalogSessions.flatMap(
      (session) => session.plan?.readiness.map((item) => item.complete) ?? [],
    );

    expect(catalogSessions.every((session) => session.plan)).toBe(true);
    expect(readinessStates).toContain(true);
    expect(readinessStates).toContain(false);
    expect(new Set(catalogSessions.map((session) => session.status))).toEqual(
      new Set(['complete', 'draft', 'planned']),
    );
  });

  it('resolves campaigns and sessions by stable identifiers', () => {
    expect(
      getCampaignCatalogEntry('campaign-crown-of-cinders')?.campaign.name,
    ).toBe('Crown of Cinders');
    expect(
      getCatalogSession('campaign-stars-below-kharad-session-3')?.title,
    ).toBe('When the Deep Sky Opens');
    expect(getCatalogSession('missing-session')).toBeUndefined();
    expect(
      getCampaignCatalogEntryBySlug('lanterns-of-mourningfen')?.campaign.name,
    ).toBe('Lanterns of Mourningfen');
  });

  it('exposes all four example campaigns in every mode', () => {
    for (const mode of ['test', 'development', 'production']) {
      expect(getVisibleCampaignCatalog(mode)).toHaveLength(4);
    }
  });

  it('passes catalog integrity validation', () => {
    expect(inspectCampaignCatalog()).toEqual([]);
  });
});
