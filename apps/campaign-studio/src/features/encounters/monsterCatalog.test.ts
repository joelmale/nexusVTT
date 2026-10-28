import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  listFixtureBundles,
  type CampaignFixtureBundle,
  type HomebrewMonster,
} from '@/demo/fixture-registry';

import {
  buildMonsterCatalog,
  catalogMonsterFromEntity,
  clearMonsterCatalogCache,
  componentFromMonster,
  crValue,
  fetchServerMonsterCatalog,
  filterMonsters,
  findMonster,
  formatCr,
  getFallbackMonsterCatalog,
  homebrewKey,
  matchMonsterByName,
  rateComposition,
  srdKey,
  storedDifficulty,
  useMonsterCatalog,
} from './monsterCatalog';

const HOMEBREW: HomebrewMonster = {
  id: 'hb-1',
  campaignId: 'c',
  name: 'Gloomwing',
  size: 'Medium',
  type: 'monstrosity',
  cr: '1/2',
  ac: 13,
  hp: 22,
  speed: 30,
  abilities: [10, 14, 12, 3, 10, 6],
  edition: '2024',
  notes: 'Shrieks',
};

describe('monster catalog', () => {
  const catalog = buildMonsterCatalog([HOMEBREW]);

  it('keeps canonical and homebrew apart by source and key', () => {
    const srd = findMonster(catalog, srdKey('goblin'))!;
    expect(srd).toMatchObject({ name: 'Goblin', source: 'canonical', cr: '1/4' });
    const custom = findMonster(catalog, homebrewKey('hb-1'))!;
    expect(custom).toMatchObject({ name: 'Gloomwing', source: 'homebrew' });
    expect(catalog.filter((monster) => monster.source === 'homebrew')).toHaveLength(1);
    expect(catalog.length).toBeGreaterThan(300);
  });

  it('filters by query and source, and sorts', () => {
    expect(
      filterMonsters(catalog, { source: 'homebrew' }).map((m) => m.name),
    ).toEqual(['Gloomwing']);
    const dragons = filterMonsters(catalog, { query: 'dragon', source: 'canonical' });
    expect(dragons.length).toBeGreaterThan(5);
    expect(dragons.every((m) => m.source === 'canonical')).toBe(true);
    const byCr = filterMonsters(catalog, { query: 'goblin', sort: 'cr' });
    expect(byCr[0].name).toBe('Goblin');
    const bySource = filterMonsters(catalog, { query: 'g', sort: 'source' });
    expect(bySource[0].source).toBe('homebrew');
  });

  it('matches legacy name-only components, preferring canonical', () => {
    expect(matchMonsterByName(catalog, 'goblin')?.key).toBe('srd:goblin');
    expect(matchMonsterByName(catalog, '  GLOOMWING ')?.source).toBe('homebrew');
    expect(matchMonsterByName(catalog, 'Mystery Beast')).toBeUndefined();
    const clash = buildMonsterCatalog([{ ...HOMEBREW, name: 'Goblin' }]);
    expect(matchMonsterByName(clash, 'Goblin')?.source).toBe('canonical');
  });

  it('builds a composition row from a catalog monster', () => {
    expect(componentFromMonster(findMonster(catalog, 'srd:goblin')!)).toEqual({
      name: 'Goblin',
      count: 1,
      ruleset: '2014-srd',
      role: '',
      monsterKey: 'srd:goblin',
      cr: '1/4',
    });
    expect(
      componentFromMonster(findMonster(catalog, 'homebrew:hb-1')!).ruleset,
    ).toBe('custom');
  });

  it('parses challenge ratings', () => {
    expect(crValue('1/8')).toBe(0.125);
    expect(crValue('10')).toBe(10);
    expect(crValue('')).toBeUndefined();
    expect(crValue('big')).toBeUndefined();
  });
});

describe('buildMonsterCatalog flex options', () => {
  it('accepts bundle objects with homebrewMonsters', () => {
    const fakeBundle = { homebrewMonsters: [HOMEBREW] };
    const result = buildMonsterCatalog(fakeBundle);
    expect(result.some((m) => m.key === 'homebrew:hb-1')).toBe(true);
  });

  it('accepts extraMonsters array merged with bundle', () => {
    const extra: HomebrewMonster = {
      ...HOMEBREW,
      id: 'hb-extra',
      name: 'Extra Fiend',
    };
    const result = buildMonsterCatalog([HOMEBREW], [extra]);
    expect(result.some((m) => m.key === 'homebrew:hb-extra')).toBe(true);
    expect(result.some((m) => m.key === 'homebrew:hb-1')).toBe(true);
  });

  it('accepts custom canonical monster list', () => {
    const customCanonical = [
      {
        key: 'srd:custom-goblin',
        name: 'Custom Goblin',
        cr: '1',
        type: 'humanoid',
        size: 'Small',
        ac: 15,
        hp: 12,
        speed: 30,
        abilities: [10, 14, 10, 10, 10, 10] as [number, number, number, number, number, number],
        source: 'canonical' as const,
        edition: '2024' as const,
      },
    ];
    const result = buildMonsterCatalog([], [], customCanonical);
    expect(result.length).toBe(1);
    expect(result[0].key).toBe('srd:custom-goblin');
  });

  it('handles null or undefined source gracefully', () => {
    const result = buildMonsterCatalog(null);
    expect(result.length).toBeGreaterThan(300);
  });
});

describe('formatCr and catalogMonsterFromEntity', () => {
  it('formats fractional and integer challenge ratings correctly', () => {
    expect(formatCr(0.125)).toBe('1/8');
    expect(formatCr(0.25)).toBe('1/4');
    expect(formatCr(0.5)).toBe('1/2');
    expect(formatCr(5)).toBe('5');
    expect(formatCr(' 1/4 ')).toBe('1/4');
    expect(formatCr(undefined)).toBe('0');
  });

  it('maps 2024 rules entity to CatalogMonster', () => {
    const entity = {
      id: 'dire-wolf',
      ruleset: '2024',
      data: {
        name: 'Dire Wolf',
        challengeRating: 1,
        type: 'beast',
        size: 'large',
        armorClass: [{ value: 14, source: 'natural armor' }],
        hitPoints: { average: 37, formula: '5d10+10' },
        speed: { walk: 50 },
        abilityScores: { str: 17, dex: 15, con: 15, int: 3, wis: 12, cha: 7 },
      },
    };

    const monster = catalogMonsterFromEntity(entity);
    expect(monster).toEqual({
      key: 'srd:dire-wolf',
      name: 'Dire Wolf',
      cr: '1',
      type: 'beast',
      size: 'Large',
      ac: 14,
      hp: 37,
      speed: 50,
      abilities: [17, 15, 15, 3, 12, 7],
      source: 'canonical',
      edition: '2024',
    });
  });

  it('maps entity with flat numeric ac/hp and array abilities', () => {
    const entity = {
      slug: 'ghoul',
      ruleset: '2014',
      data: {
        name: 'Ghoul',
        cr: '1',
        type: 'undead',
        size: 'Medium',
        ac: 12,
        hp: 22,
        speed: 30,
        abilities: [13, 15, 10, 7, 10, 6],
      },
    };

    const monster = catalogMonsterFromEntity(entity);
    expect(monster).toMatchObject({
      key: 'srd:ghoul',
      name: 'Ghoul',
      ac: 12,
      hp: 22,
      speed: 30,
      abilities: [13, 15, 10, 7, 10, 6],
      edition: '2014',
    });
  });

  it('returns undefined for invalid entity shapes', () => {
    expect(catalogMonsterFromEntity(null)).toBeUndefined();
    expect(catalogMonsterFromEntity({})).toBeUndefined();
    expect(catalogMonsterFromEntity({ data: { name: '' } })).toBeUndefined();
  });
});

describe('fetchServerMonsterCatalog (CS-43)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('queries /api/rules/catalog/entities?type=monster and returns parsed CatalogMonster array', async () => {
    let requestedUrl = '';
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      requestedUrl = url;
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            catalogVersion: 1,
            entities: [
              {
                id: 'm-2024-1',
                ruleset: '2024',
                data: {
                  name: 'Apex Predator',
                  challengeRating: 3,
                  type: 'monstrosity',
                  size: 'large',
                  armorClass: [{ value: 16 }],
                  hitPoints: { average: 52 },
                  speed: { walk: 40 },
                  abilityScores: { str: 18, dex: 14, con: 16, int: 4, wis: 12, cha: 8 },
                },
              },
            ],
          }),
      } as Response);
    });

    const result = await fetchServerMonsterCatalog('2024');
    expect(requestedUrl).toBe('/api/rules/catalog/entities?type=monster&ruleset=2024');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      key: 'srd:m-2024-1',
      name: 'Apex Predator',
      cr: '3',
      edition: '2024',
    });
  });

  it('falls back to SRD_MONSTERS on HTTP error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Error',
    } as Response);

    const result = await fetchServerMonsterCatalog('2014');
    expect(result.length).toBeGreaterThan(300);
    expect(result[0].source).toBe('canonical');
  });

  it('falls back to SRD_MONSTERS on empty response or network throw', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

    const result = await fetchServerMonsterCatalog('2024');
    expect(result.length).toBeGreaterThan(300);
    expect(result.every((m) => m.edition === '2024')).toBe(true);
  });
});

describe('getFallbackMonsterCatalog', () => {
  it('returns SRD monsters with specified edition', () => {
    const fallback2024 = getFallbackMonsterCatalog('2024');
    expect(fallback2024.length).toBeGreaterThan(300);
    expect(fallback2024.every((m) => m.edition === '2024')).toBe(true);
    expect(fallback2024[0].source).toBe('canonical');

    const fallback2014 = getFallbackMonsterCatalog('2014');
    expect(fallback2014.every((m) => m.edition === '2014')).toBe(true);
  });
});

describe('useMonsterCatalog hook (CS-43)', () => {
  beforeEach(() => {
    clearMonsterCatalogCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearMonsterCatalogCache();
  });

  it('fetches server monsters and caches results', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        entities: [
          {
            id: 'server-orc',
            ruleset: '2024',
            data: {
              name: 'Server Orc',
              challengeRating: 0.5,
              type: 'humanoid',
              size: 'medium',
              armorClass: [{ value: 13 }],
              hitPoints: { average: 15 },
              speed: { walk: 30 },
              abilityScores: { str: 16, dex: 12, con: 14, int: 7, wis: 11, cha: 10 },
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() =>
      useMonsterCatalog([HOMEBREW], { ruleset: '2024' }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.canonical.length).toBe(1);
    expect(result.current.canonical[0].name).toBe('Server Orc');
    expect(result.current.catalog.some((m) => m.name === 'Server Orc')).toBe(true);
    expect(result.current.catalog.some((m) => m.name === 'Gloomwing')).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second render should use cache
    const { result: secondResult } = renderHook(() =>
      useMonsterCatalog([HOMEBREW], { ruleset: '2024' }),
    );
    expect(secondResult.current.canonical[0].name).toBe('Server Orc');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('supports offlineOnly mode without fetching', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() =>
      useMonsterCatalog([HOMEBREW], { offlineOnly: true }),
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.isFallback).toBe(true);
    expect(result.current.catalog.length).toBeGreaterThan(300);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('infers ruleset edition from bundle when options.ruleset is omitted', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ entities: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const bundle2024 = {
      catalog: { edition: '2024' },
      homebrewMonsters: [],
    } as unknown as CampaignFixtureBundle;

    const { result } = renderHook(() => useMonsterCatalog(bundle2024));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.ruleset).toBe('2024');
  });

  it('allows manual fallback switch and reload', async () => {
    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        ok: true,
        json: async () => ({
          entities: [
            {
              id: `beast-${callCount}`,
              ruleset: '2024',
              data: {
                name: `Beast ${callCount}`,
                challengeRating: 1,
                type: 'beast',
                size: 'medium',
                ac: 12,
                hp: 10,
                speed: 30,
              },
            },
          ],
        }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() =>
      useMonsterCatalog([HOMEBREW], { ruleset: '2024' }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.canonical[0].name).toBe('Beast 1');

    act(() => {
      result.current.useFallbackCatalog();
    });
    expect(result.current.isFallback).toBe(true);

    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.canonical[0].name).toBe('Beast 2');
  });
});

describe('example campaign encounters', () => {
  const catalog = buildMonsterCatalog();

  it('name a real SRD monster in every creature row, and mark hazards as such', () => {
    for (const bundle of listFixtureBundles('test')) {
      for (const encounter of bundle.encounters) {
        for (const part of encounter.composition) {
          if (part.nonCreature) continue;
          expect(
            matchMonsterByName(catalog, part.name),
            `${bundle.slug} / ${encounter.title} / ${part.name}`,
          ).toBeDefined();
        }
      }
    }
  });

  it('rates every example encounter that has creatures', () => {
    for (const bundle of listFixtureBundles('test')) {
      for (const encounter of bundle.encounters) {
        const { unrated } = rateComposition(
          encounter.composition,
          catalog,
          [3, 3, 3, 3],
          '2014',
        );
        expect(unrated, `${bundle.slug} / ${encounter.title}`).toEqual([]);
      }
    }
  });

  it('leaves hazards out of the rating and the participant count', () => {
    const { result, unrated } = rateComposition(
      [
        { name: 'Goblin', count: 2, ruleset: '2014-srd', role: '' },
        {
          name: 'Grasping Tide',
          count: 1,
          ruleset: 'custom',
          role: '',
          nonCreature: true,
        },
      ],
      catalog,
      [3, 3, 3, 3],
      '2014',
    );
    expect(unrated).toEqual([]);
    expect(result?.rawXp).toBe(100);
  });
});

describe('rateComposition', () => {
  const catalog = buildMonsterCatalog([HOMEBREW]);
  const party = [3, 3, 3, 3];

  it('rates linked, name-matched and homebrew rows, and flags unrated ones', () => {
    const { result, unrated } = rateComposition(
      [
        { name: 'Goblin', count: 4, ruleset: '2014-srd', role: '', monsterKey: 'srd:goblin' },
        { name: 'Gloomwing', count: 1, ruleset: 'custom', role: '', monsterKey: 'homebrew:hb-1' },
        { name: 'Ogre', count: 1, ruleset: 'custom', role: '' },
        { name: 'Mystery Beast', count: 2, ruleset: 'custom', role: '' },
      ],
      catalog,
      party,
      '2014',
    );
    expect(unrated).toEqual(['Mystery Beast']);
    // 4 x 50 + 100 + 450 = 750 raw; 6 rated monsters -> x2 = 1500
    expect(result).toMatchObject({ rawXp: 750, xp: 1500, rating: 'high' });
  });

  it('returns no rating without a party', () => {
    expect(
      rateComposition(
        [{ name: 'Goblin', count: 1, ruleset: '2014-srd', role: '' }],
        catalog,
        [],
        '2024',
      ).result,
    ).toBeNull();
  });

  it('collapses ratings onto the stored three levels', () => {
    expect(storedDifficulty('trivial')).toBe('low');
    expect(storedDifficulty('low')).toBe('low');
    expect(storedDifficulty('moderate')).toBe('moderate');
    expect(storedDifficulty('high')).toBe('high');
    expect(storedDifficulty('deadly')).toBe('high');
  });
});
