import { useCallback, useEffect, useState } from 'react';
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Format CR number or fraction to string label ('0', '1/8', '1/4', '1/2', '1', ...) */
export function formatCr(cr: unknown): string {
  if (typeof cr === 'string') return cr.trim();
  if (typeof cr === 'number') {
    if (cr === 0.125) return '1/8';
    if (cr === 0.25) return '1/4';
    if (cr === 0.5) return '1/2';
    return String(cr);
  }
  return '0';
}

/** Maps a rules entity from `/api/rules/catalog/entities` to CatalogMonster */
export function catalogMonsterFromEntity(
  entity: unknown,
  fallbackRuleset: RulesEdition = '2014',
): CatalogMonster | undefined {
  if (!isRecord(entity)) return undefined;
  const data = isRecord(entity.data) ? entity.data : entity;
  const id =
    typeof entity.id === 'string'
      ? entity.id
      : typeof entity.slug === 'string'
        ? entity.slug
        : '';
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (!name) return undefined;

  const ruleset: RulesEdition =
    entity.ruleset === '2024' || data.ruleset === '2024'
      ? '2024'
      : entity.ruleset === '2014' || data.ruleset === '2014'
        ? '2014'
        : fallbackRuleset;

  const cr = formatCr(data.challengeRating ?? data.cr);
  const type = typeof data.type === 'string' ? data.type : 'monstrosity';
  const size =
    typeof data.size === 'string'
      ? data.size.charAt(0).toUpperCase() + data.size.slice(1).toLowerCase()
      : 'Medium';

  let ac = 10;
  if (typeof data.ac === 'number') {
    ac = data.ac;
  } else if (typeof data.armorClass === 'number') {
    ac = data.armorClass;
  } else if (Array.isArray(data.armorClass) && data.armorClass.length > 0) {
    const firstAc = data.armorClass[0];
    if (isRecord(firstAc) && typeof firstAc.value === 'number') {
      ac = firstAc.value;
    } else if (typeof firstAc === 'number') {
      ac = firstAc;
    }
  }

  let hp = 10;
  if (typeof data.hp === 'number') {
    hp = data.hp;
  } else if (isRecord(data.hitPoints) && typeof data.hitPoints.average === 'number') {
    hp = data.hitPoints.average;
  } else if (typeof data.hitPoints === 'number') {
    hp = data.hitPoints;
  }

  let speed = 30;
  if (typeof data.speed === 'number') {
    speed = data.speed;
  } else if (isRecord(data.speed) && typeof data.speed.walk === 'number') {
    speed = data.speed.walk;
  }

  let abilities: [number, number, number, number, number, number] = [10, 10, 10, 10, 10, 10];
  if (
    Array.isArray(data.abilities) &&
    data.abilities.length === 6 &&
    data.abilities.every((n) => typeof n === 'number')
  ) {
    abilities = [
      data.abilities[0] as number,
      data.abilities[1] as number,
      data.abilities[2] as number,
      data.abilities[3] as number,
      data.abilities[4] as number,
      data.abilities[5] as number,
    ];
  } else if (isRecord(data.abilityScores)) {
    abilities = [
      typeof data.abilityScores.str === 'number' ? data.abilityScores.str : 10,
      typeof data.abilityScores.dex === 'number' ? data.abilityScores.dex : 10,
      typeof data.abilityScores.con === 'number' ? data.abilityScores.con : 10,
      typeof data.abilityScores.int === 'number' ? data.abilityScores.int : 10,
      typeof data.abilityScores.wis === 'number' ? data.abilityScores.wis : 10,
      typeof data.abilityScores.cha === 'number' ? data.abilityScores.cha : 10,
    ];
  }

  const finalId = id || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return {
    key: srdKey(finalId),
    name,
    cr,
    type,
    size,
    ac,
    hp,
    speed,
    abilities,
    source: 'canonical',
    edition: ruleset,
  };
}

export function getFallbackMonsterCatalog(
  ruleset: RulesEdition = SRD_EDITION,
): CatalogMonster[] {
  return SRD_MONSTERS.map((monster) => ({
    ...monster,
    key: srdKey(monster.id),
    source: 'canonical' as const,
    edition: ruleset,
  }));
}

interface CachedMonsterCatalog {
  monsters: CatalogMonster[];
  fetchedAt: number;
  isFallback: boolean;
}

const monsterCatalogCache = new Map<RulesEdition, CachedMonsterCatalog>();

export function clearMonsterCatalogCache(): void {
  monsterCatalogCache.clear();
}

/**
 * Fetch monsters from the VTT/Codex rules catalog API:
 * `GET /api/rules/catalog/entities?type=monster&ruleset=${ruleset}`
 * Falls back to static `SRD_MONSTERS` on network error or missing entities.
 */
export async function fetchServerMonsterCatalog(
  ruleset: RulesEdition = '2014',
): Promise<CatalogMonster[]> {
  const targetRuleset: RulesEdition = ruleset === '2024' ? '2024' : '2014';
  try {
    const response = await fetch(
      `/api/rules/catalog/entities?type=monster&ruleset=${encodeURIComponent(targetRuleset)}`,
      { credentials: 'include' },
    );
    if (!response.ok) {
      return getFallbackMonsterCatalog(targetRuleset);
    }
    const body = (await response.json()) as unknown;
    const entities =
      isRecord(body) && Array.isArray(body.entities) ? body.entities : undefined;
    if (!entities || entities.length === 0) {
      return getFallbackMonsterCatalog(targetRuleset);
    }
    const monsters = entities
      .map((entity) => catalogMonsterFromEntity(entity, targetRuleset))
      .filter((m): m is CatalogMonster => Boolean(m));
    if (monsters.length === 0) {
      return getFallbackMonsterCatalog(targetRuleset);
    }
    return monsters;
  } catch {
    return getFallbackMonsterCatalog(targetRuleset);
  }
}

/**
 * Canonical SRD monsters plus the campaign's homebrew, one list.
 * Supports passing `bundle`, `bundle.homebrewMonsters`, or homebrew array,
 * with optional `extraMonsters` and `customCanonical` overrides.
 */
export function buildMonsterCatalog(
  sourceOrBundle?:
    | readonly HomebrewMonster[]
    | { homebrewMonsters?: readonly HomebrewMonster[] }
    | null,
  extraMonsters: readonly HomebrewMonster[] = [],
  customCanonical?: readonly CatalogMonster[],
): CatalogMonster[] {
  let homebrew: readonly HomebrewMonster[] = [];
  if (Array.isArray(sourceOrBundle)) {
    homebrew = sourceOrBundle;
  } else if (
    sourceOrBundle &&
    'homebrewMonsters' in sourceOrBundle &&
    Array.isArray(sourceOrBundle.homebrewMonsters)
  ) {
    homebrew = sourceOrBundle.homebrewMonsters;
  }

  const allHomebrew =
    extraMonsters.length > 0 ? [...homebrew, ...extraMonsters] : homebrew;

  const canonical: CatalogMonster[] = customCanonical
    ? [...customCanonical]
    : SRD_MONSTERS.map((monster) => ({
        ...monster,
        key: srdKey(monster.id),
        source: 'canonical' as const,
        edition: SRD_EDITION,
      }));

  const custom: CatalogMonster[] = allHomebrew.map((monster) => ({
    key: homebrewKey(monster.id),
    name: monster.name,
    cr: monster.cr,
    type: monster.type,
    size: monster.size,
    ac: monster.ac,
    hp: monster.hp,
    speed: monster.speed,
    abilities: monster.abilities,
    source: 'homebrew' as const,
    edition: monster.edition,
  }));

  return [...canonical, ...custom];
}

export interface UseMonsterCatalogOptions {
  ruleset?: RulesEdition;
  offlineOnly?: boolean;
  extraMonsters?: readonly HomebrewMonster[];
}

export interface UseMonsterCatalogResult {
  /** The full catalog merging canonical and homebrew monsters */
  catalog: CatalogMonster[];
  /** Canonical monsters only (server or fallback) */
  canonical: CatalogMonster[];
  loading: boolean;
  error?: string;
  isFallback: boolean;
  ruleset: RulesEdition;
  catalogVersion: number;
  reload: () => Promise<void>;
  useFallbackCatalog: () => void;
}

/**
 * React hook to access monster catalog with server query and offline fallback.
 */
export function useMonsterCatalog(
  bundle?:
    | CampaignFixtureBundle
    | {
        homebrewMonsters?: readonly HomebrewMonster[];
        catalog?: { edition?: string };
      }
    | readonly HomebrewMonster[]
    | null,
  options?: UseMonsterCatalogOptions | boolean,
): UseMonsterCatalogResult {
  const opts: UseMonsterCatalogOptions =
    typeof options === 'boolean' ? { offlineOnly: options } : (options ?? {});

  let inferredRuleset: RulesEdition = '2014';
  if (opts.ruleset) {
    inferredRuleset = opts.ruleset === '2024' ? '2024' : '2014';
  } else if (
    bundle &&
    !Array.isArray(bundle) &&
    'catalog' in bundle &&
    bundle.catalog
  ) {
    inferredRuleset = editionOfBundle(bundle as CampaignFixtureBundle);
  }

  const ruleset = inferredRuleset;
  const offlineOnly = Boolean(opts.offlineOnly);
  const extraMonsters = opts.extraMonsters ?? [];

  const cached = monsterCatalogCache.get(ruleset);

  const [canonical, setCanonical] = useState<CatalogMonster[]>(
    cached?.monsters ?? (offlineOnly ? getFallbackMonsterCatalog(ruleset) : []),
  );
  const [loading, setLoading] = useState<boolean>(!cached && !offlineOnly);
  const [error, setError] = useState<string | undefined>();
  const [isFallback, setIsFallback] = useState<boolean>(
    Boolean(cached?.isFallback || (!cached && offlineOnly)),
  );
  const [catalogVersion, setCatalogVersion] = useState<number>(
    cached?.fetchedAt ?? 0,
  );

  const applyFallback = useCallback(() => {
    const fallback = getFallbackMonsterCatalog(ruleset);
    const now = Date.now();
    monsterCatalogCache.set(ruleset, {
      monsters: fallback,
      fetchedAt: now,
      isFallback: true,
    });
    setCanonical(fallback);
    setIsFallback(true);
    setCatalogVersion(now);
    setLoading(false);
    setError(undefined);
  }, [ruleset]);

  const load = useCallback(
    async (force = false) => {
      if (!force) {
        const existing = monsterCatalogCache.get(ruleset);
        if (existing) {
          setCanonical(existing.monsters);
          setIsFallback(existing.isFallback);
          setCatalogVersion(existing.fetchedAt);
          setLoading(false);
          setError(undefined);
          return;
        }
      }

      if (offlineOnly && !force) {
        applyFallback();
        return;
      }

      setLoading(true);
      setError(undefined);

      try {
        const monsters = await fetchServerMonsterCatalog(ruleset);
        const isDefaultFallback = monsters.length === SRD_MONSTERS.length;
        const now = Date.now();
        monsterCatalogCache.set(ruleset, {
          monsters,
          fetchedAt: now,
          isFallback: isDefaultFallback,
        });
        setCanonical(monsters);
        setIsFallback(isDefaultFallback);
        setCatalogVersion(now);
        setLoading(false);
        setError(undefined);
      } catch (err) {
        applyFallback();
        setError(err instanceof Error ? err.message : 'Catalog fetch failed');
      }
    },
    [ruleset, offlineOnly, applyFallback],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const reload = useCallback(async () => {
    await load(true);
  }, [load]);

  const useFallbackCatalog = useCallback(() => {
    applyFallback();
  }, [applyFallback]);

  // Combine canonical with homebrew monsters from bundle + extraMonsters
  const catalog = buildMonsterCatalog(
    bundle,
    extraMonsters,
    canonical.length > 0 ? canonical : undefined,
  );

  return {
    catalog,
    canonical,
    loading,
    error,
    isFallback,
    ruleset,
    catalogVersion,
    reload,
    useFallbackCatalog,
  };
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
