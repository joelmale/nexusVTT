import type {
  CampaignEncounter,
  CampaignFixtureBundle,
  TrapComplexity,
} from '@/demo/fixture-registry';

export const ENCOUNTER_KIND_LABELS: Record<CampaignEncounter['kind'], string> =
  {
    combat: 'Combat',
    social: 'Social',
    'combat-hazard': 'Combat + hazard',
    'combat-exploration': 'Combat + exploration',
    trap: 'Trap / Puzzle',
  };

export const TRAP_COMPLEXITY_LABELS: Record<TrapComplexity, string> = {
  simple: 'Simple Trap',
  complex: 'Complex Trap',
  puzzle: 'Puzzle Trap',
};

export const RULESET_LABELS: Record<CampaignEncounter['composition'][number]['ruleset'], string> = {
  '2024': '2024 rules',
  '2014-srd': '2014 SRD',
  custom: 'Custom',
};

const DIFFICULTY_RANK: Record<CampaignEncounter['difficulty'], number> = {
  high: 0,
  moderate: 1,
  low: 2,
};

export interface EncountersQuery {
  q?: string;
  kind?: string;
  difficulty?: string;
  sort?: string;
}

export interface EncounterRow {
  encounter: CampaignEncounter;
  total: number;
  inNextSession: boolean;
}

/** The session the campaign is heading into, when it has one. */
export function nextSessionId(
  bundle: CampaignFixtureBundle,
): string | undefined {
  if (bundle.lifecycle !== 'active') return undefined;
  const id =
    bundle.campaign?.currentSessionId || bundle.catalog?.selectedSessionId;
  return id && bundle.sessions.some((session) => session.id === id)
    ? id
    : undefined;
}

/** Sum of `composition[].count`, leaving out hazards and lair actions. */
export function participantTotal(encounter: CampaignEncounter): number {
  return encounter.composition.reduce(
    (sum, part) => (part.nonCreature ? sum : sum + part.count),
    0,
  );
}

export function isInNextSession(
  bundle: CampaignFixtureBundle,
  encounter: CampaignEncounter,
): boolean {
  const next = nextSessionId(bundle);
  if (!next) return false;
  const session = bundle.sessions.find((item) => item.id === next);
  return (
    encounter.sessionIds.includes(next) ||
    (session?.encounterIds ?? []).includes(encounter.id)
  );
}

export function buildEncountersModel(
  bundle: CampaignFixtureBundle,
  query: EncountersQuery = {},
): EncounterRow[] {
  const q = query.q?.trim().toLowerCase();
  const rows = bundle.encounters
    .filter((encounter) => {
      if (query.kind && encounter.kind !== query.kind) return false;
      if (query.difficulty && encounter.difficulty !== query.difficulty) {
        return false;
      }
      if (
        q &&
        !`${encounter.title} ${encounter.trigger}`.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    })
    .map((encounter) => ({
      encounter,
      total: participantTotal(encounter),
      inNextSession: isInNextSession(bundle, encounter),
    }));

  const byTitle = (a: EncounterRow, b: EncounterRow) =>
    a.encounter.title.localeCompare(b.encounter.title);
  if (query.sort === 'next') {
    return rows.sort(
      (a, b) => Number(b.inNextSession) - Number(a.inNextSession) || byTitle(a, b),
    );
  }
  if (query.sort === 'difficulty') {
    return rows.sort(
      (a, b) =>
        DIFFICULTY_RANK[a.encounter.difficulty] -
          DIFFICULTY_RANK[b.encounter.difficulty] || byTitle(a, b),
    );
  }
  return rows.sort(byTitle);
}

/** Only complete campaigns hide the Deploy button. */
export function canDeploy(bundle: CampaignFixtureBundle): boolean {
  return bundle.lifecycle !== 'complete';
}

export function encounterSummaryStats(
  bundle: CampaignFixtureBundle,
): Array<{ label: string; value: number }> {
  const traps = bundle.encounters.filter((item) => item.kind === 'trap').length;
  return [
    { label: 'Encounters', value: bundle.encounters.length },
    {
      label: 'Combat',
      value: bundle.encounters.filter((item) => item.kind.startsWith('combat'))
        .length,
    },
    ...(traps > 0 ? [{ label: 'Traps', value: traps }] : []),
    {
      label: 'Social',
      value: bundle.encounters.filter((item) => item.kind === 'social').length,
    },
    {
      label: 'High difficulty',
      value: bundle.encounters.filter((item) => item.difficulty === 'high')
        .length,
    },
  ];
}
