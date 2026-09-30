import type {
  CampaignFixtureBundle,
  CampaignQuest,
  QuestObjective,
} from '@/demo/fixture-registry';

export type QuestStatus = CampaignQuest['status'];
export type ObjectiveStatus = QuestObjective['status'];

export const QUEST_STATUSES: QuestStatus[] = [
  'active',
  'on-hold',
  'not-started',
  'complete',
];
export const OBJECTIVE_STATUSES: ObjectiveStatus[] = [
  'pending',
  'active',
  'blocked',
  'complete',
];

const PRIORITY_RANK: Record<CampaignQuest['priority'], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export const QUEST_GROUP_LABELS: Record<QuestStatus, string> = {
  active: 'Active',
  'on-hold': 'On hold',
  'not-started': 'Not started',
  complete: 'Complete',
};

export interface QuestsQuery {
  q?: string;
  priority?: string;
  faction?: string;
  sort?: string;
  /** Show the complete group's rows even in non-complete campaigns. */
  showComplete?: boolean;
  /** A quest that must stay visible, e.g. the selected one. */
  selectedId?: string;
}

export interface QuestRow {
  quest: CampaignQuest;
  done: number;
  total: number;
  /** Paused campaign, quest still in play. */
  openThread: boolean;
}

export interface QuestGroup {
  id: QuestStatus;
  label: string;
  items: QuestRow[];
}

export interface QuestsModel {
  groups: QuestGroup[];
  /** Quests matching the filters, including collapsed ones. */
  filteredCount: number;
  /** Complete rows hidden behind the "Show completed" toggle. */
  collapsedCompleteCount: number;
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

/** Objectives of a quest, ordered. */
export function objectivesFor(
  bundle: CampaignFixtureBundle,
  quest: CampaignQuest,
): QuestObjective[] {
  return bundle.objectives
    .filter((objective) => objective.questId === quest.id)
    .sort((a, b) => a.order - b.order);
}

export function objectiveProgress(objectives: QuestObjective[]): {
  done: number;
  total: number;
} {
  return {
    done: objectives.filter((objective) => objective.status === 'complete')
      .length,
    total: objectives.length,
  };
}

export function isOpenThread(
  bundle: CampaignFixtureBundle,
  quest: CampaignQuest,
): boolean {
  return (
    bundle.lifecycle === 'paused' &&
    (quest.status === 'active' || quest.status === 'on-hold')
  );
}

export function questMatches(quest: CampaignQuest, query: QuestsQuery): boolean {
  if (query.priority && quest.priority !== query.priority) return false;
  if (query.faction && !quest.factionIds.includes(query.faction)) return false;
  const q = query.q?.trim().toLowerCase();
  if (q && !`${quest.title} ${quest.summary}`.toLowerCase().includes(q)) {
    return false;
  }
  return true;
}

export function buildQuestsModel(
  bundle: CampaignFixtureBundle,
  query: QuestsQuery = {},
): QuestsModel {
  const byTitle = (a: QuestRow, b: QuestRow) =>
    a.quest.title.localeCompare(b.quest.title);
  const byPriority = (a: QuestRow, b: QuestRow) =>
    PRIORITY_RANK[a.quest.priority] - PRIORITY_RANK[b.quest.priority] ||
    byTitle(a, b);
  const compare = query.sort === 'title' ? byTitle : byPriority;

  const rows: QuestRow[] = bundle.quests
    .filter((quest) => questMatches(quest, query))
    .map((quest) => ({
      quest,
      ...objectiveProgress(objectivesFor(bundle, quest)),
      openThread: isOpenThread(bundle, quest),
    }))
    .sort(compare);

  const completeLifecycle = bundle.lifecycle === 'complete';
  const expandComplete =
    completeLifecycle || Boolean(query.q?.trim()) || Boolean(query.showComplete);

  const order: QuestStatus[] = completeLifecycle
    ? ['complete', 'active', 'on-hold', 'not-started']
    : QUEST_STATUSES;

  let collapsedCompleteCount = 0;
  const groups = order.map((status): QuestGroup => {
    const all = rows.filter((row) => row.quest.status === status);
    if (status === 'complete' && !expandComplete) {
      const kept = all.filter((row) => row.quest.id === query.selectedId);
      collapsedCompleteCount = all.length - kept.length;
      return { id: status, label: QUEST_GROUP_LABELS[status], items: kept };
    }
    return { id: status, label: QUEST_GROUP_LABELS[status], items: all };
  });

  return { groups, filteredCount: rows.length, collapsedCompleteCount };
}

/** Counts by status for the summary card. */
export function questStatusCounts(
  bundle: CampaignFixtureBundle,
): Array<{ label: string; value: number }> {
  return QUEST_STATUSES.map((status) => ({
    label: QUEST_GROUP_LABELS[status],
    value: bundle.quests.filter((quest) => quest.status === status).length,
  }));
}

/** Quests linked to the next session, for active campaigns. */
export function questsInNextSession(
  bundle: CampaignFixtureBundle,
): CampaignQuest[] {
  const next = nextSessionId(bundle);
  if (!next) return [];
  const session = bundle.sessions.find((item) => item.id === next);
  return bundle.quests.filter(
    (quest) =>
      quest.sessionIds.includes(next) ||
      (session?.questIds ?? []).includes(quest.id),
  );
}

// ---------------------------------------------------------------- editing

export interface ObjectiveDraft {
  /** Stable React key; never sent to the server. */
  key: string;
  id?: string;
  title: string;
  status: ObjectiveStatus;
  locationIds: string[];
}

export interface ServerObjective {
  id?: string;
  title: string;
  status: ObjectiveStatus;
  order: number;
  locationIds: string[];
}

export function toObjectiveDrafts(
  objectives: QuestObjective[],
): ObjectiveDraft[] {
  return objectives.map((objective) => ({
    key: objective.id,
    id: objective.id,
    title: objective.title,
    status: objective.status,
    locationIds: [...objective.locationIds],
  }));
}

/** Blank titles are dropped; order is reassigned from list position. */
export function toServerObjectives(
  drafts: ObjectiveDraft[],
): ServerObjective[] {
  return drafts
    .filter((draft) => draft.title.trim())
    .map((draft, index) => ({
      ...(draft.id ? { id: draft.id } : {}),
      title: draft.title.trim(),
      status: draft.status,
      order: index + 1,
      locationIds: draft.locationIds,
    }));
}

export interface QuestDraft extends Record<string, unknown> {
  title: string;
  status: QuestStatus;
  summary: string;
  giverNpcId: string;
  objectives: ObjectiveDraft[];
}

export function toQuestDraft(
  bundle: CampaignFixtureBundle,
  quest: CampaignQuest,
): QuestDraft {
  return {
    title: quest.title,
    status: quest.status,
    summary: quest.summary,
    giverNpcId: quest.giverNpcId ?? '',
    objectives: toObjectiveDrafts(objectivesFor(bundle, quest)),
  };
}

/** Changed keys only; `objectives` is sent whole when anything in it changed. */
export function buildQuestPatch(
  draft: Record<string, unknown>,
  initial: Record<string, unknown>,
): Record<string, unknown> {
  const next = draft as QuestDraft;
  const before = initial as QuestDraft;
  const patch: Record<string, unknown> = {};
  const title = next.title.trim();
  if (title && title !== before.title) patch.title = title;
  if (next.status !== before.status) patch.status = next.status;
  if (next.summary !== before.summary) patch.summary = next.summary;
  if (next.giverNpcId !== before.giverNpcId) {
    patch.giverNpcId = next.giverNpcId;
  }
  const nextObjectives = toServerObjectives(next.objectives);
  if (
    JSON.stringify(nextObjectives) !==
    JSON.stringify(toServerObjectives(before.objectives))
  ) {
    patch.objectives = nextObjectives;
  }
  return patch;
}
