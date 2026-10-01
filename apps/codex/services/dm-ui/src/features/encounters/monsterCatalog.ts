import {
  evaluateEncounterDifficulty,
  type EncounterDifficultyRating,
  type EncounterDifficultyResult,
  type RulesEdition,
} from '@nexus/rules-5e';

import { SRD_MONSTERS } from '@/data/srdMonsters';
import type {
  CampaignEncounter,
  CampaignFixtureBundle,
  HomebrewMonster,
} from '@/demo/fixture-registry';

export type MonsterSource = 'canonical' | 'homebrew';
export type EncounterComponent = CampaignEncounter['composition'][number];

export interface CatalogMonster {
  /** `srd:<index>` or `homebrew:<object id>`. Stored on composition rows. */
  key: string;
  name: string;
  cr: string;
  type: string;
  size: string;
  ac: number;
  hp: number;
  speed: number;
  abilities: [number, number, number, number, number, number];
  source: MonsterSource;
  edition: RulesEdition;
}

export const SRD_EDITION: RulesEdition = '2014';

export function srdKey(id: string): string {
  return `srd:${id}`;
}

export function homebrewKey(id: string): string {
  return `homebrew:${id}`;
}

/** Canonical SRD monsters plus the campaign's homebrew, one list. */
export function buildMonsterCatalog(
  homebrew: readonly HomebrewMonster[] = [],
): CatalogMonster[] {
  const canonical: CatalogMonster[] = SRD_MONSTERS.map((monster) => ({
    ...monster,
    key: srdKey(monster.id),
    source: 'canonical',
    edition: SRD_EDITION,
  }));
  const custom: CatalogMonster[] = homebrew.map((monster) => ({
    key: homebrewKey(monster.id),
    name: monster.name,
    cr: monster.cr,
    type: monster.type,
    size: monster.size,
    ac: monster.ac,
    hp: monster.hp,
    speed: monster.speed,
    abilities: monster.abilities,
    source: 'homebrew',
    edition: monster.edition,
  }));
  return [...canonical, ...custom];
}

/** '1/4' -> 0.25, '5' -> 5. Undefined for anything that is not a CR. */
export function crValue(cr: string | undefined): number | undefined {
  if (!cr) return undefined;
  const fraction = /^(\d+)\/(\d+)$/.exec(cr.trim());
  const value = fraction
    ? Number(fraction[1]) / Number(fraction[2])
    : Number(cr);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

export type MonsterSort = 'name' | 'cr' | 'source';

export interface MonsterFilter {
  query?: string;
  source?: MonsterSource | 'all';
  sort?: MonsterSort;
}

/** Filters and sorts the catalog; homebrew sorts first under `source`. */
export function filterMonsters(
  catalog: readonly CatalogMonster[],
  { query = '', source = 'all', sort = 'name' }: MonsterFilter = {},
): CatalogMonster[] {
  const needle = query.trim().toLowerCase();
  const rows = catalog.filter(
    (monster) =>
      (source === 'all' || monster.source === source) &&
      (!needle ||
        monster.name.toLowerCase().includes(needle) ||
        monster.type.toLowerCase().includes(needle)),
  );
  const byName = (a: CatalogMonster, b: CatalogMonster) =>
    a.name.localeCompare(b.name);
  return rows.sort((a, b) => {
    if (sort === 'cr') {
      return (crValue(a.cr) ?? 0) - (crValue(b.cr) ?? 0) || byName(a, b);
    }
    if (sort === 'source' && a.source !== b.source) {
      return a.source === 'homebrew' ? -1 : 1;
    }
    return byName(a, b);
  });
}

export function findMonster(
  catalog: readonly CatalogMonster[],
  key: string | undefined,
): CatalogMonster | undefined {
  return key ? catalog.find((monster) => monster.key === key) : undefined;
}

/** Exact, case-insensitive name match; canonical wins over homebrew. */
export function matchMonsterByName(
  catalog: readonly CatalogMonster[],
  name: string,
): CatalogMonster | undefined {
  const wanted = name.trim().toLowerCase();
  if (!wanted) return undefined;
  const matches = catalog.filter(
    (monster) => monster.name.toLowerCase() === wanted,
  );
  return matches.find((monster) => monster.source === 'canonical') ?? matches[0];
}

export function componentFromMonster(monster: CatalogMonster): EncounterComponent {
  return {
    name: monster.name,
    count: 1,
    ruleset:
      monster.source === 'homebrew'
        ? 'custom'
        : monster.edition === '2024'
          ? '2024'
          : '2014-srd',
    role: '',
    monsterKey: monster.key,
    cr: monster.cr,
  };
}

/** 2014 SRD wording ('5.1') maps to the 2014 rules; everything else is 2024. */
export function editionOfBundle(bundle: CampaignFixtureBundle): RulesEdition {
  return /2014|5\.1/.test(bundle.catalog?.edition ?? '') ? '2014' : '2024';
}

export function partyLevelsOf(bundle: CampaignFixtureBundle): number[] {
  return (bundle.campaign?.playerCharacters ?? []).map(
    (character) => character.level,
  );
}

/** The CR of a composition row: its stored CR, else its catalog entry's. */
function componentCr(
  component: EncounterComponent,
  catalog: readonly CatalogMonster[],
): string | undefined {
  return (
    component.cr ??
    findMonster(catalog, component.monsterKey)?.cr ??
    matchMonsterByName(catalog, component.name)?.cr
  );
}

export interface CompositionRating {
  result: EncounterDifficultyResult | null;
  /** Names of rows with no resolvable CR; the rating excludes them. */
  unrated: string[];
}

export function rateComposition(
  composition: readonly EncounterComponent[],
  catalog: readonly CatalogMonster[],
  partyLevels: number[],
  edition: RulesEdition,
): CompositionRating {
  const groups: { challengeRating: string; count: number }[] = [];
  const unrated: string[] = [];
  for (const component of composition) {
    // Hazards and lair actions have no challenge rating and are not rated.
    if (component.nonCreature) continue;
    const cr = componentCr(component, catalog);
    if (cr !== undefined && crValue(cr) !== undefined) {
      groups.push({ challengeRating: cr, count: component.count });
    } else if (component.count > 0) {
      unrated.push(component.name);
    }
  }
  return {
    result: evaluateEncounterDifficulty({ edition, groups, partyLevels }),
    unrated,
  };
}

/** Collapses the five-step rating onto the encounter's three stored levels. */
export function storedDifficulty(
  rating: EncounterDifficultyRating,
): CampaignEncounter['difficulty'] {
  if (rating === 'trivial' || rating === 'low') return 'low';
  if (rating === 'moderate') return 'moderate';
  return 'high';
}
