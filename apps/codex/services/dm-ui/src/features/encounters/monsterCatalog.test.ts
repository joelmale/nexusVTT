import { describe, expect, it } from 'vitest';

import {
  listFixtureBundles,
  type HomebrewMonster,
} from '@/demo/fixture-registry';

import {
  buildMonsterCatalog,
  componentFromMonster,
  crValue,
  filterMonsters,
  findMonster,
  homebrewKey,
  matchMonsterByName,
  rateComposition,
  srdKey,
  storedDifficulty,
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
