import { describe, expect, it } from 'vitest';

import {
  createEmptyBundle,
  listFixtureBundles,
  resolveEntity,
} from '@/demo/fixture-registry';

import { buildOverviewModel } from './overviewModel';

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
