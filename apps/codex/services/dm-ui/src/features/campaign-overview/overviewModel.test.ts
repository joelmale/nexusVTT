import { describe, expect, it } from 'vitest';

import {
  createEmptyBundle,
  listFixtureBundles,
  resolveEntity,
} from '@/demo/fixture-registry';

import { buildOverviewModel, pickUpcomingSession } from './overviewModel';

const bundles = listFixtureBundles('test');

describe('buildOverviewModel', () => {
  it('covers all four example campaigns', () => {
    expect(bundles.map((bundle) => bundle.slug).sort()).toEqual([
      'ashes-of-veyra',
      'crown-of-cinders',
      'lanterns-of-mourningfen',
      'stars-below-kharad',
    ]);
  });

  it.each(bundles.map((bundle) => [bundle.slug, bundle] as const))(
    '%s has dashboard-ready data that resolves to real entities',
    (_slug, bundle) => {
      const model = buildOverviewModel(bundle);

      expect(model.nextSession).not.toBeNull();
      expect(model.nextSession?.facts).toHaveLength(4);
      for (const { record } of model.nextSession?.facts ?? []) {
        expect(resolveEntity(bundle, record.id)?.href).toBe(record.href);
      }

      // Data parity: every example fills every dashboard panel.
      for (const panel of model.panels) {
        expect(panel.records.length, `${panel.id} panel`).toBeGreaterThanOrEqual(
          panel.id === 'party' ? 1 : 4,
        );
        if (panel.id === 'party') continue;
        for (const record of panel.records) {
          expect(record.href, record.id).toBeTruthy();
        }
      }
      expect(model.backlinks.length).toBeGreaterThanOrEqual(3);
      expect(model.recentEdits.length).toBeGreaterThanOrEqual(3);
      for (const record of [...model.backlinks, ...model.recentEdits]) {
        expect(record.href, record.id).toBeTruthy();
      }
    },
  );

  it('derives every label from the bundle rather than Ashes constants', () => {
    const crown = bundles.find((bundle) => bundle.slug === 'crown-of-cinders');
    const text = JSON.stringify(buildOverviewModel(crown!));
    expect(text).not.toContain('Glass Harbor');
    expect(text).not.toContain('Harbor Master');
    expect(text).not.toContain('2 hours ago');
  });

  it('derives the next session and backlinks when none are curated', () => {
    const ashes = bundles.find((bundle) => bundle.slug === 'ashes-of-veyra')!;
    // A server campaign carries no curated nextSession or activity.
    const uncurated = {
      ...ashes,
      campaign: {
        ...ashes.campaign,
        nextSession: {
          ...ashes.campaign.nextSession,
          sessionId: '',
          encounterId: '',
          npcId: '',
          locationId: '',
          questId: '',
        },
        activity: { backlinks: [], recentEdits: [] },
      },
    };
    const model = buildOverviewModel(uncurated);
    const expected = pickUpcomingSession(ashes.sessions, Date.now());
    expect(expected?.status).not.toBe('complete');
    expect(model.nextSession?.sessionId).toBe(expected?.id);
    expect(model.nextSession?.facts.length).toBeGreaterThan(0);
    expect(model.backlinks.length).toBeGreaterThan(0);
    for (const record of model.backlinks) {
      expect(record.href).toBeTruthy();
      expect(record.meta).toMatch(/^Linked from \d+ objects?$/);
    }
  });

  it('prefers the earliest upcoming dated session, else the lowest open number', () => {
    const now = Date.parse('2026-10-01T12:00:00Z');
    const base = bundles[0].sessions[0];
    const session = (
      id: string,
      number: number,
      status: 'complete' | 'draft' | 'planned',
      plannedDate?: string,
    ) => ({ ...base, id, number, status, plannedDate });
    expect(
      pickUpcomingSession(
        [
          session('done', 1, 'complete', '2026-10-05'),
          session('later', 2, 'planned', '2026-10-20'),
          session('sooner', 3, 'planned', '2026-10-08'),
          session('stale', 4, 'planned', '2026-01-01'),
        ],
        now,
      )?.id,
    ).toBe('sooner');
    expect(
      pickUpcomingSession(
        [session('b', 5, 'draft'), session('a', 4, 'draft')],
        now,
      )?.id,
    ).toBe('a');
    expect(
      pickUpcomingSession([session('done', 1, 'complete')], now),
    ).toBeUndefined();
  });

  it('shows server edit times as relative time', () => {
    const ashes = bundles.find((bundle) => bundle.slug === 'ashes-of-veyra')!;
    const [edit] = ashes.campaign.activity.recentEdits;
    const now = Date.parse('2026-10-01T12:00:00Z');
    const model = buildOverviewModel(
      {
        ...ashes,
        campaign: {
          ...ashes.campaign,
          activity: {
            backlinks: [],
            recentEdits: [{ ...edit, updatedAt: '2026-10-01T09:00:00Z' }],
          },
        },
      },
      now,
    );
    expect(model.recentEdits[0].meta).toBe('Edited 3 hours ago');
  });

  it('builds an honest empty model for a blank server campaign', () => {
    const model = buildOverviewModel(
      createEmptyBundle({
        createdAt: '2026-09-27T12:00:00Z',
        id: 'campaign-blank',
        name: 'Blank Slate',
        updatedAt: '2026-09-27T12:00:00Z',
      }),
    );
    expect(model.title).toBe('Blank Slate');
    expect(model.nextSession).toBeNull();
    expect(model.panels.every((panel) => panel.records.length === 0)).toBe(
      true,
    );
    expect(model.backlinks).toEqual([]);
    expect(model.recentEdits).toEqual([]);
  });
});
