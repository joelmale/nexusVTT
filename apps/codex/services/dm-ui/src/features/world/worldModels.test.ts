import { describe, expect, it } from 'vitest';

import {
  getFixtureBundle,
  listFixtureBundles,
  type CampaignLocation,
} from '@/demo/fixture-registry';

import {
  ancestorIds,
  breadcrumbFor,
  buildLocationTree,
  descendantIds,
  filterLocations,
  flattenTree,
  locationDraft,
  locationPatch,
  mapChipFor,
  nextSessionLocationIds,
  resolveOpenIds,
} from './worldModels';

function loc(
  id: string,
  parent?: string,
  extra: Partial<CampaignLocation> = {},
): CampaignLocation {
  return {
    id,
    campaignId: 'c',
    name: id.toUpperCase(),
    type: 'district',
    shortDescription: '',
    description: [],
    tags: [],
    parentLocationId: parent,
    npcIds: [],
    factionIds: [],
    encounterIds: [],
    questIds: [],
    handoutIds: [],
    notes: '',
    ...extra,
  };
}

describe('worldModels', () => {
  const list = [loc('b', 'a'), loc('a'), loc('c', 'a'), loc('d', 'b')];

  it('builds a name-sorted tree', () => {
    const tree = buildLocationTree(list);
    expect(tree.map((n) => n.location.id)).toEqual(['a']);
    expect(tree[0].children.map((n) => n.location.id)).toEqual(['b', 'c']);
    expect(tree[0].children[0].children[0].location.id).toBe('d');
  });

  it('falls back to a flat list without parents, orphans and cycles', () => {
    expect(
      buildLocationTree([loc('z'), loc('y')]).map((n) => n.location.id),
    ).toEqual(['y', 'z']);
    expect(buildLocationTree([loc('o', 'missing')]).length).toBe(1);
    const cyc = buildLocationTree([loc('x', 'y'), loc('y', 'x')]);
    const count = (nodes: typeof cyc): number =>
      nodes.reduce((n, node) => n + 1 + count(node.children), 0);
    expect(count(cyc)).toBe(2);
  });

  it('computes ancestors, descendants and breadcrumbs', () => {
    expect(ancestorIds(list, 'd')).toEqual(['b', 'a']);
    expect(descendantIds(list, 'a').sort()).toEqual(['b', 'c', 'd']);
    expect(breadcrumbFor(list, 'd')).toEqual(['A', 'B']);
    expect(ancestorIds([loc('x', 'y'), loc('y', 'x')], 'x')).toEqual(['y']);
  });

  it('resolves open ids and flattens visible rows', () => {
    const tree = buildLocationTree(list);
    const open = resolveOpenIds(list, undefined, undefined);
    expect([...open]).toEqual(['a']);
    expect(flattenTree(tree, open).map((r) => r.location.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
    const withSel = resolveOpenIds(list, undefined, 'd');
    expect(flattenTree(tree, withSel).map((r) => r.location.id)).toContain(
      'd',
    );
    const rows = flattenTree(tree, resolveOpenIds(list, 'a,b', undefined));
    expect(rows.map((r) => r.level)).toEqual([1, 2, 3, 2]);
    expect(rows[0]).toMatchObject({ hasChildren: true, expanded: true });
  });

  it('filters by text, type, tag and pin', () => {
    const data = [
      loc('a', undefined, { tags: ['Harbor'], mapId: 'm', pinId: 'p' }),
      loc('b', undefined, { type: 'tavern' }),
    ];
    expect(filterLocations(data, { q: 'harbor' }).map((l) => l.id)).toEqual([
      'a',
    ]);
    expect(filterLocations(data, { type: 'tavern' }).map((l) => l.id)).toEqual(
      ['b'],
    );
    expect(filterLocations(data, { tag: 'Harbor' })).toHaveLength(1);
    expect(filterLocations(data, { hasPin: true }).map((l) => l.id)).toEqual([
      'a',
    ]);
  });

  it('builds patches only for changed fields', () => {
    const l = loc('a', 'p', { description: ['one', 'two'], tags: ['x'] });
    const initial = locationDraft(l);
    expect(locationPatch({ ...initial }, initial)).toEqual({});
    expect(
      locationPatch(
        {
          ...initial,
          descriptionText: 'a\n\nb',
          tagsText: 'x, y',
          parentLocationId: '',
        },
        initial,
      ),
    ).toEqual({
      description: ['a', 'b'],
      tags: ['x', 'y'],
      parentLocationId: '',
    });
  });

  it('builds map chips and next-session ids from fixtures', () => {
    const ashes = getFixtureBundle('ashes-of-veyra');
    if (!ashes) throw new Error('missing fixture');
    const harbor = ashes.locations.find(
      (l) => l.id === 'location-glass-harbor',
    );
    if (!harbor) throw new Error('missing location');
    expect(mapChipFor(ashes, harbor)?.href).toBe(
      '/maps/map-glass-harbor?pin=pin-north-docks',
    );
    expect(mapChipFor(ashes, { ...harbor, mapId: undefined })).toBeUndefined();
    for (const bundle of listFixtureBundles('test')) {
      if (bundle.lifecycle !== 'active') {
        expect(nextSessionLocationIds(bundle).size).toBe(0);
      }
    }
  });
});
