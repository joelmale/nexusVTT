import {
  getBacklinks,
  resolveEntity,
  type CampaignFixtureBundle,
  type CampaignSession,
  type EntityKind,
} from '@/demo/fixture-registry';

export type OverviewTone = 'positive' | 'warning' | 'danger' | 'neutral';

export interface OverviewRecord {
  id: string;
  kind: EntityKind;
  title: string;
  subtitle: string;
  meta: string;
  tone?: OverviewTone;
  /** Path relative to the campaign basePath, when the record is navigable. */
  href?: string;
  /** Extra label/value pairs shown when the panel is focused. */
  details: { label: string; value: string }[];
}

export type OverviewPanelId =
  | 'quests'
  | 'encounters'
  | 'clues'
  | 'objects'
  | 'party';

export interface OverviewPanelModel {
  id: OverviewPanelId;
  title: string;
  /** Section path relative to basePath. */
  viewAllHref: string;
  emptyMessage: string;
  records: OverviewRecord[];
}

export interface NextSessionFact {
  label: string;
  record: OverviewRecord;
}

export interface NextSessionModel {
  sessionId: string;
  heading: string;
  schedule: string[];
  planHref: string;
  facts: NextSessionFact[];
}

export interface OverviewModel {
  title: string;
  subtitle: string;
  chips: string[];
  nextSession: NextSessionModel | null;
  panels: OverviewPanelModel[];
  backlinks: OverviewRecord[];
  recentEdits: OverviewRecord[];
}

export function humanize(value: string): string {
  const text = value.replace(/[-_]+/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

const STATUS_RANK: Record<string, number> = {
  active: 0,
  'on-hold': 1,
  'not-started': 2,
  complete: 3,
};
const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
const CLUE_RANK: Record<string, number> = {
  unresolved: 0,
  'partially-understood': 1,
  resolved: 2,
};

function priorityTone(priority: string): OverviewTone {
  return priority === 'high'
    ? 'danger'
    : priority === 'medium'
      ? 'warning'
      : 'neutral';
}

function difficultyTone(difficulty: string): OverviewTone {
  return difficulty === 'high'
    ? 'danger'
    : difficulty === 'moderate'
      ? 'warning'
      : 'neutral';
}

function questTone(status: string): OverviewTone {
  return status === 'active'
    ? 'positive'
    : status === 'on-hold'
      ? 'warning'
      : 'neutral';
}

function hrefFor(bundle: CampaignFixtureBundle, id: string) {
  return resolveEntity(bundle, id)?.href;
}

function compact(values: (string | undefined)[]): string[] {
  return values.filter((value): value is string => Boolean(value));
}

/**
 * Builds everything the overview renders from a campaign bundle. Pure: the
 * same bundle always yields the same model, and an empty bundle yields empty
 * panels and no next session rather than throwing.
 */
export function buildOverviewModel(
  bundle: CampaignFixtureBundle,
  now: number = Date.now(),
): OverviewModel {
  const { campaign } = bundle;
  const npcById = new Map(bundle.npcs.map((npc) => [npc.id, npc]));
  const locationById = new Map(bundle.locations.map((l) => [l.id, l]));
  const questById = new Map(bundle.quests.map((quest) => [quest.id, quest]));
  const updatedById = new Map(
    bundle.libraryObjects.map((item) => [item.id, item.updatedLabel]),
  );
  const locationName = (id: string | undefined) =>
    id ? locationById.get(id)?.name : undefined;
  const creatureCount = (
    composition: CampaignFixtureBundle['encounters'][number]['composition'],
  ) =>
    composition
      .filter((part) => !part.nonCreature)
      .reduce((sum, part) => sum + part.count, 0);

  // Quests: open work first, then by priority.
  const quests = [...bundle.quests]
    .sort(
      (a, b) =>
        (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) ||
        (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9),
    )
    .map((quest): OverviewRecord => {
      const objectives = bundle.objectives.filter(
        (objective) => objective.questId === quest.id,
      );
      const done = objectives.filter((o) => o.status === 'complete').length;
      return {
        id: quest.id,
        kind: 'quest',
        title: quest.title,
        subtitle: quest.summary,
        meta: quest.status === 'active' ? 'In progress' : humanize(quest.status),
        tone: questTone(quest.status),
        href: hrefFor(bundle, quest.id),
        details: [
          { label: 'Priority', value: humanize(quest.priority) },
          ...(objectives.length > 0
            ? [
                {
                  label: 'Objectives',
                  value: `${done} of ${objectives.length} complete`,
                },
              ]
            : []),
          ...compact([npcById.get(quest.giverNpcId ?? '')?.name]).map(
            (value) => ({ label: 'Quest giver', value }),
          ),
        ],
      };
    });

  const encounters = bundle.encounters.map((encounter): OverviewRecord => {
    const count = creatureCount(encounter.composition);
    return {
      id: encounter.id,
      kind: 'encounter',
      title: encounter.title,
      subtitle:
        locationName(encounter.locationIds[0]) ?? humanize(encounter.kind),
      meta: humanize(encounter.difficulty),
      tone: difficultyTone(encounter.difficulty),
      href: hrefFor(bundle, encounter.id),
      details: [
        { label: 'Kind', value: humanize(encounter.kind) },
        ...(count > 0
          ? [{ label: 'Creatures', value: plural(count, 'creature') }]
          : []),
        ...(encounter.trigger
          ? [{ label: 'Trigger', value: encounter.trigger }]
          : []),
      ],
    };
  });

  // Clues: open threads first; resolved ones stay listed so a campaign near
  // its end still shows what the party uncovered.
  const clues = [...bundle.clues]
    .sort(
      (a, b) =>
        (CLUE_RANK[a.status] ?? 9) - (CLUE_RANK[b.status] ?? 9) ||
        (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9),
    )
    .map(
      (clue): OverviewRecord => ({
        id: clue.id,
        kind: 'clue',
        title: clue.title,
        subtitle: clue.meaning,
        meta:
          clue.status === 'resolved' ? 'Resolved' : humanize(clue.priority),
        tone:
          clue.status === 'resolved' ? 'positive' : priorityTone(clue.priority),
        href: hrefFor(bundle, clue.id),
        details: [
          { label: 'Status', value: humanize(clue.status) },
          ...(clue.relatedQuestIds.length > 0
            ? [
                {
                  label: 'Related quests',
                  value: compact(
                    clue.relatedQuestIds.map((id) => questById.get(id)?.title),
                  ).join(', '),
                },
              ]
            : []),
        ],
      }),
    );

  const objects: OverviewRecord[] = [
    ...bundle.npcs.map(
      (npc): OverviewRecord => ({
        id: npc.id,
        kind: 'npc',
        title: npc.name,
        subtitle: `NPC · ${npc.role}`,
        meta: updatedById.get(npc.id) ?? 'NPC',
        href: hrefFor(bundle, npc.id),
        details: compact([npc.motivation]).map((value) => ({
          label: 'Motivation',
          value,
        })),
      }),
    ),
    ...bundle.factions.map(
      (faction): OverviewRecord => ({
        id: faction.id,
        kind: 'faction',
        title: faction.name,
        subtitle: `Faction · ${faction.publicFace}`,
        meta: updatedById.get(faction.id) ?? humanize(faction.status),
        href: hrefFor(bundle, faction.id),
        details: [{ label: 'Standing', value: humanize(faction.status) }],
      }),
    ),
  ];

  const party = campaign.playerCharacters.map(
    (character): OverviewRecord => ({
      id: character.id,
      kind: 'npc',
      title: character.name,
      subtitle: `Level ${character.level} ${character.ancestry} ${character.className}`,
      meta: `Lv ${character.level}`,
      details: compact([character.hook]).map((value) => ({
        label: 'Hook',
        value,
      })),
    }),
  );

  const activity = (
    items: CampaignFixtureBundle['campaign']['activity']['backlinks'],
    metaFor: (item: (typeof items)[number]) => string,
  ) =>
    items.map(
      (item): OverviewRecord => ({
        id: item.id,
        kind: item.objectType,
        title: item.label,
        subtitle: item.detail,
        meta: metaFor(item),
        href: hrefFor(bundle, item.targetId),
        details: [],
      }),
    );

  return {
    title: campaign.title,
    subtitle: campaign.subtitle || campaign.premise || '',
    chips: compact([
      // The catalog edition is a short label; `campaign.edition` may be prose.
      campaign.ruleset &&
        (bundle.catalog.edition
          ? `${campaign.ruleset} · ${bundle.catalog.edition}`
          : campaign.ruleset),
      bundle.sessions.length > 0
        ? plural(bundle.sessions.length, 'session')
        : undefined,
      humanize(bundle.lifecycle),
    ]),
    nextSession: buildNextSession(bundle, now, (id) => hrefFor(bundle, id), {
      creatureCount,
      locationName,
    }),
    panels: [
      {
        id: 'quests',
        title: 'Quests',
        viewAllHref: '/quests',
        emptyMessage: 'No quests yet.',
        records: quests,
      },
      {
        id: 'encounters',
        title: 'Prepared Encounters',
        viewAllHref: '/encounters',
        emptyMessage: 'No encounters prepared yet.',
        records: encounters,
      },
      {
        id: 'clues',
        title: 'Clues',
        viewAllHref: '/notes',
        emptyMessage: 'No clues yet.',
        records: clues,
      },
      {
        id: 'objects',
        title: 'Campaign Objects',
        viewAllHref: '/npcs',
        emptyMessage: 'No NPCs or factions yet.',
        records: objects,
      },
      {
        id: 'party',
        title: 'Party',
        viewAllHref: '/sessions',
        emptyMessage: 'No player characters yet.',
        records: party,
      },
    ],
    backlinks:
      campaign.activity.backlinks.length > 0
        ? activity(
            campaign.activity.backlinks,
            (item) => `${humanize(item.objectType)} link`,
          )
        : deriveBacklinks(bundle),
    recentEdits: activity(campaign.activity.recentEdits, (item) => {
      const at = item.updatedAt ? Date.parse(item.updatedAt) : NaN;
      return Number.isNaN(at)
        ? item.detail
        : `Edited ${timeAgo(at, now)}`;
    }).map((record) => ({ ...record, subtitle: humanize(record.kind) })),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Kinds the overview treats as "linkable campaign objects". */
const LINKABLE_KINDS = [
  'npc',
  'location',
  'encounter',
  'quest',
  'faction',
  'map',
] as const;

/**
 * Most-referenced campaign objects, for campaigns without curated backlinks
 * (real server campaigns). Ties keep bundle order.
 */
function deriveBacklinks(bundle: CampaignFixtureBundle): OverviewRecord[] {
  const candidates = [
    ...bundle.npcs.map((n) => ({ id: n.id, kind: 'npc' as const, label: n.name })),
    ...bundle.locations.map((l) => ({
      id: l.id,
      kind: 'location' as const,
      label: l.name,
    })),
    ...bundle.quests.map((q) => ({ id: q.id, kind: 'quest' as const, label: q.title })),
    ...bundle.factions.map((f) => ({
      id: f.id,
      kind: 'faction' as const,
      label: f.name,
    })),
    ...bundle.encounters.map((e) => ({
      id: e.id,
      kind: 'encounter' as const,
      label: e.title,
    })),
    ...bundle.maps.map((m) => ({ id: m.id, kind: 'map' as const, label: m.title })),
  ].filter((item) => LINKABLE_KINDS.includes(item.kind));

  return candidates
    .map((item) => ({ ...item, count: getBacklinks(bundle, item.id).length }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(
      (item): OverviewRecord => ({
        id: `backlink-${item.id}`,
        kind: item.kind,
        title: item.label,
        subtitle: humanize(item.kind),
        meta: `Linked from ${plural(item.count, 'object')}`,
        href: hrefFor(bundle, item.id),
        details: [],
      }),
    );
}

/** "3 hours ago" relative to `now` (never in the future). */
function timeAgo(at: number, now: number): string {
  const minutes = Math.floor(Math.max(0, now - at) / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${plural(days, 'day')} ago`;
  if (hours > 0) return `${plural(hours, 'hour')} ago`;
  if (minutes > 0) return `${plural(minutes, 'minute')} ago`;
  return 'just now';
}

/** A date-only or full ISO string as epoch ms, else NaN. */
function parseDate(value: string | undefined): number {
  return value ? Date.parse(value) : NaN;
}

/**
 * The session to prepare next when no curated `nextSession` resolves: the
 * earliest upcoming dated session that is not complete, else the
 * lowest-numbered session that is not complete.
 */
export function pickUpcomingSession(
  sessions: readonly CampaignSession[],
  now: number,
): CampaignSession | undefined {
  const open = sessions.filter((session) => session.status !== 'complete');
  const upcoming = open
    .map((session) => ({ session, at: parseDate(session.plannedDate) }))
    .filter(({ at }) => !Number.isNaN(at) && at >= now - DAY_MS)
    .sort((a, b) => a.at - b.at);
  if (upcoming.length > 0) return upcoming[0].session;
  return [...open].sort((a, b) => a.number - b.number)[0];
}

function scheduleFor(plannedDate: string | undefined, now: number): string[] {
  const at = parseDate(plannedDate);
  if (Number.isNaN(at)) return compact([plannedDate]);
  const date = new Date(at).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    // Date-only strings parse as UTC midnight; keep that calendar day.
    ...(plannedDate && /^\d{4}-\d{2}-\d{2}$/.test(plannedDate)
      ? { timeZone: 'UTC' }
      : {}),
  });
  const days = Math.round((at - now) / DAY_MS);
  const relative =
    days === 0
      ? 'today'
      : days === 1
        ? 'tomorrow'
        : days > 1
          ? `in ${days} days`
          : undefined;
  return compact([date, relative]);
}

function buildNextSession(
  bundle: CampaignFixtureBundle,
  now: number,
  href: (id: string) => string | undefined,
  helpers: {
    creatureCount: (
      composition: CampaignFixtureBundle['encounters'][number]['composition'],
    ) => number;
    locationName: (id: string | undefined) => string | undefined;
  },
): NextSessionModel | null {
  const next = bundle.campaign.nextSession;
  const curated = bundle.sessions.find(({ id }) => id === next.sessionId);
  const session = curated ?? pickUpcomingSession(bundle.sessions, now);
  if (!session) return null;
  // Curated fact ids win; otherwise use the session's first linked objects.
  const factId = (curatedId: string, fallback: readonly string[]) =>
    curated && curatedId ? curatedId : fallback[0];
  const ids = {
    encounter: factId(next.encounterId, session.encounterIds),
    npc: factId(next.npcId, session.npcIds),
    location: factId(next.locationId, session.locationIds),
    quest: factId(next.questId, session.questIds),
  };

  const facts: NextSessionFact[] = [];
  const encounter = bundle.encounters.find(({ id }) => id === ids.encounter);
  if (encounter) {
    const count = helpers.creatureCount(encounter.composition);
    facts.push({
      label: 'Primary Encounter',
      record: {
        id: encounter.id,
        kind: 'encounter',
        title: encounter.title,
        subtitle: compact([
          humanize(encounter.difficulty),
          count > 0 ? plural(count, 'creature') : undefined,
        ]).join(' · '),
        meta: 'Primary Encounter',
        href: href(encounter.id),
        details: [],
      },
    });
  }
  const npc = bundle.npcs.find(({ id }) => id === ids.npc);
  if (npc) {
    facts.push({
      label: 'Key NPC',
      record: {
        id: npc.id,
        kind: 'npc',
        title: npc.name,
        subtitle: npc.role,
        meta: 'Key NPC',
        href: href(npc.id),
        details: [],
      },
    });
  }
  const location = bundle.locations.find(({ id }) => id === ids.location);
  if (location) {
    facts.push({
      label: 'Primary Location',
      record: {
        id: location.id,
        kind: 'location',
        title: location.name,
        subtitle:
          helpers.locationName(location.parentLocationId) ??
          humanize(location.type),
        meta: 'Primary Location',
        href: href(location.id),
        details: [],
      },
    });
  }
  const quest = bundle.quests.find(({ id }) => id === ids.quest);
  if (quest) {
    facts.push({
      label: 'Relevant Quest',
      record: {
        id: quest.id,
        kind: 'quest',
        title: quest.title,
        subtitle:
          quest.status === 'active' ? 'In progress' : humanize(quest.status),
        meta: 'Relevant Quest',
        href: href(quest.id),
        details: [],
      },
    });
  }

  return {
    sessionId: session.id,
    heading: `Session ${session.number} — ${session.title}`,
    schedule: curated
      ? compact([
          next.plannedDate || session.plannedDate,
          next.time,
          next.relativeDate,
        ])
      : scheduleFor(session.plannedDate, now),
    planHref: `/sessions/${session.id}/plan`,
    facts,
  };
}
