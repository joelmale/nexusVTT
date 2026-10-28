import type {
  CampaignAct,
  CampaignFixtureBundle,
} from '@/demo/fixture-registry';

type Bundle = CampaignFixtureBundle;
export type SessionItem = Bundle['sessions'][number];

export interface SessionsQuery {
  q?: string;
  status?: string;
  act?: string;
}

export interface SessionGroup {
  id: string;
  /** Undefined when the timeline is ungrouped (no acts). */
  label?: string;
  act?: CampaignAct;
  sessions: SessionItem[];
}

export interface SessionsModel {
  /** "Timeline", or "Chronicle" for a complete campaign. */
  timelineLabel: 'Timeline' | 'Chronicle';
  groups: SessionGroup[];
  /** Sessions after filtering. */
  visibleCount: number;
  totalCount: number;
  defaultSessionId?: string;
  canPlan: boolean;
  actOptions: Array<{ value: string; label: string }>;
  stats: Array<{ label: string; value: number }>;
}

const UNGROUPED_ID = 'ungrouped';

export function sortedSessions(bundle: Bundle): SessionItem[] {
  return [...bundle.sessions].sort((a, b) => a.number - b.number);
}

/** Lifecycle-aware default selection (plan §2.1). */
export function pickDefaultSessionId(bundle: Bundle): string | undefined {
  const sessions = sortedSessions(bundle);
  if (sessions.length === 0) return undefined;
  const has = (id?: string) =>
    id ? sessions.find((session) => session.id === id) : undefined;
  const lastComplete = [...sessions]
    .reverse()
    .find((session) => session.status === 'complete');
  switch (bundle.lifecycle) {
    case 'active':
      return (
        has(bundle.campaign.currentSessionId) ??
        has(bundle.catalog.selectedSessionId) ??
        sessions.find((session) => session.status !== 'complete') ??
        sessions[0]
      ).id;
    case 'paused':
      return (lastComplete ?? sessions[0]).id;
    case 'complete':
      return sessions[sessions.length - 1].id;
    default:
      return (
        sessions.find(
          (session) =>
            session.status === 'planned' || session.status === 'draft',
        ) ?? sessions[0]
      ).id;
  }
}

function matches(session: SessionItem, query: SessionsQuery): boolean {
  if (query.status && session.status !== query.status) return false;
  if (query.act && session.actId !== query.act) return false;
  const q = query.q?.trim().toLowerCase();
  if (q) {
    const haystack = [
      session.title,
      session.summary,
      `session ${session.number}`,
      `#${session.number}`,
      ...session.tags,
    ]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

export function actGroupLabel(act: CampaignAct): string {
  const status = act.status.charAt(0).toUpperCase() + act.status.slice(1);
  return `${act.title} (${status})`;
}

export function buildSessionsModel(
  bundle: Bundle,
  query: SessionsQuery = {},
): SessionsModel {
  const all = sortedSessions(bundle);
  const visible = all.filter((session) => matches(session, query));
  const acts = [...bundle.acts].sort((a, b) => a.order - b.order);
  const actIds = new Set(acts.map((act) => act.id));

  const groups: SessionGroup[] = [];
  if (acts.length === 0) {
    groups.push({ id: UNGROUPED_ID, sessions: visible });
  } else {
    for (const act of acts) {
      groups.push({
        id: act.id,
        label: actGroupLabel(act),
        act,
        sessions: visible.filter((session) => session.actId === act.id),
      });
    }
    const orphans = visible.filter((session) => !actIds.has(session.actId));
    if (orphans.length > 0) {
      groups.push({ id: UNGROUPED_ID, label: 'Sessions', sessions: orphans });
    }
  }

  const complete = bundle.lifecycle === 'complete';
  return {
    timelineLabel: complete ? 'Chronicle' : 'Timeline',
    groups,
    visibleCount: visible.length,
    totalCount: all.length,
    defaultSessionId: pickDefaultSessionId(bundle),
    canPlan: !complete,
    actOptions: acts.map((act) => ({ value: act.id, label: act.title })),
    stats: [
      { label: 'Sessions', value: all.length },
      {
        label: 'Complete',
        value: all.filter((session) => session.status === 'complete').length,
      },
      {
        label: 'Planned',
        value: all.filter((session) => session.status === 'planned').length,
      },
      {
        label: 'Draft',
        value: all.filter((session) => session.status === 'draft').length,
      },
      {
        label: 'With run sheet',
        value: all.filter((session) => session.plan).length,
      },
    ],
  };
}

export function readinessOf(session: SessionItem):
  | { complete: number; total: number }
  | undefined {
  if (!session.plan) return undefined;
  const items = session.plan.readiness;
  return {
    complete: items.filter((item) => item.complete).length,
    total: items.length,
  };
}

/** Every id the session references directly, for `RelatedGroups`. */
export function sessionForwardIds(session: SessionItem): string[] {
  return [
    ...session.questIds,
    ...session.npcIds,
    ...session.factionIds,
    ...session.locationIds,
    ...session.encounterIds,
    ...session.clueIds,
    ...session.handoutIds,
  ];
}
