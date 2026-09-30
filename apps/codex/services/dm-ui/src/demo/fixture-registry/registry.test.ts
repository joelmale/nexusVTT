import { describe, expect, it } from 'vitest';

import { campaignCatalog } from '../campaign-catalog/catalog';
import { inspectFixtureIntegrity } from '../ashes-of-veyra';
import { inspectBundleIntegrity } from './integrity';
import {
  bundleFromCatalogEntry,
  createEmptyBundle,
  getFixtureBundle,
  listFixtureBundles,
} from './registry';

const SLUGS = [
  'ashes-of-veyra',
  'crown-of-cinders',
  'lanterns-of-mourningfen',
  'stars-below-kharad',
];

describe('fixture registry', () => {
  it('passes the generic integrity check for every visible bundle', () => {
    const bundles = listFixtureBundles('test');
    expect(bundles.map((bundle) => bundle.slug)).toEqual(SLUGS);
    for (const bundle of bundles) {
      expect({
        slug: bundle.slug,
        issues: inspectBundleIntegrity(bundle),
      }).toEqual({ slug: bundle.slug, issues: [] });
    }
  });

  it('keeps the Ashes wrapper green', () => {
    expect(inspectFixtureIntegrity()).toEqual([]);
  });

  it('registers all four campaigns as full fixtures with matching lifecycles', () => {
    for (const bundle of listFixtureBundles('test')) {
      expect(bundle.source).toBe('fixture');
      expect(bundle.campaign.status).toBe(bundle.lifecycle);
      expect(bundle.campaignId).toBe(bundle.catalog.campaign.id);
      expect(bundle.sessions.length).toBeGreaterThan(0);
    }
    expect(getFixtureBundle('crown-of-cinders', 'test')?.lifecycle).toBe(
      'draft',
    );
    expect(getFixtureBundle('lanterns-of-mourningfen', 'test')?.lifecycle).toBe(
      'paused',
    );
    expect(getFixtureBundle('stars-below-kharad', 'test')?.lifecycle).toBe(
      'complete',
    );
  });

  it('only enables session-plan publishing for Ashes', () => {
    for (const bundle of listFixtureBundles('test')) {
      expect(bundle.features.publishSessionPlans).toBe(
        bundle.slug === 'ashes-of-veyra',
      );
    }
  });

  it('exposes scene templates that replace the hard-coded scene ids', () => {
    const ashes = getFixtureBundle('ashes-of-veyra', 'test');
    expect(ashes?.sceneTemplates.map((template) => template.id)).toEqual([
      'scene-glass-harbor-docks',
      'scene-harbor-warehouse-template',
      'scene-salty-mast-cellar',
    ]);
    expect(
      getFixtureBundle('crown-of-cinders', 'test')?.sceneTemplates,
    ).toHaveLength(3);
  });

  it('builds the Ashes location hierarchy under Glass Harbor', () => {
    const ashes = getFixtureBundle('ashes-of-veyra', 'test');
    const roots = ashes?.locations.filter((l) => !l.parentLocationId) ?? [];
    expect(roots.map((l) => l.id)).toEqual(['location-glass-harbor']);
  });

  it('exposes every example campaign in production builds', () => {
    expect(listFixtureBundles('production').map((b) => b.slug)).toEqual([
      'ashes-of-veyra',
      'crown-of-cinders',
      'lanterns-of-mourningfen',
      'stars-below-kharad',
    ]);
    expect(getFixtureBundle('crown-of-cinders', 'production')).toBeDefined();
    expect(getFixtureBundle('crown-of-cinders', 'development')).toBeDefined();
    expect(getFixtureBundle('unknown-slug', 'test')).toBeUndefined();
  });

  it('returns stable singletons', () => {
    expect(getFixtureBundle('ashes-of-veyra', 'test')).toBe(
      getFixtureBundle('ashes-of-veyra', 'development'),
    );
  });

  it('bundleFromCatalogEntry keeps sessions and empties everything else', () => {
    const entry = campaignCatalog[1]!;
    const bundle = bundleFromCatalogEntry(entry);
    expect(bundle.source).toBe('catalog-only');
    expect(bundle.sessions).toBe(entry.showcaseSessions);
    expect(bundle.campaign.playerCharacters).toBe(entry.playerCharacters);
    for (const key of [
      'acts',
      'npcs',
      'factions',
      'quests',
      'objectives',
      'encounters',
      'clues',
      'handouts',
      'locations',
      'maps',
      'pins',
      'libraryObjects',
      'folders',
      'sceneTemplates',
    ] as const) {
      expect(bundle[key]).toEqual([]);
    }
    expect(bundle.features.publishSessionPlans).toBe(false);
  });

  it('createEmptyBundle yields an empty draft server bundle', () => {
    const bundle = createEmptyBundle({
      id: 'campaign-blank',
      name: 'Blank',
      description: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(bundle.lifecycle).toBe('draft');
    expect(bundle.source).toBe('server-empty');
    expect(bundle.campaignId).toBe('campaign-blank');
    expect(bundle.sessions).toEqual([]);
    expect(bundle.features.publishSessionPlans).toBe(false);
    expect(inspectBundleIntegrity(bundle)).toEqual([]);
  });
});
