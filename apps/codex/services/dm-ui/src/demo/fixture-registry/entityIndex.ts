import type { CampaignFixtureBundle, FixtureId } from './types';

export type EntityKind =
  | 'session'
  | 'location'
  | 'npc'
  | 'faction'
  | 'quest'
  | 'objective'
  | 'encounter'
  | 'map'
  | 'clue'
  | 'handout'
  | 'scene';

export interface EntityRef {
  id: string;
  kind: EntityKind;
  label: string;
  /** Path relative to the campaign basePath (leading slash), when navigable. */
  href?: string;
}

interface EntityIndex {
  byId: Map<string, EntityRef>;
  /** target id -> refs of the entities that reference it. */
  backlinks: Map<string, EntityRef[]>;
}

const indexes = new WeakMap<CampaignFixtureBundle, EntityIndex>();

function buildIndex(bundle: CampaignFixtureBundle): EntityIndex {
  const byId = new Map<string, EntityRef>();
  const add = (ref: EntityRef): void => {
    if (!byId.has(ref.id)) byId.set(ref.id, ref);
  };

  const questHref = (questId: FixtureId): string => `/quests/${questId}`;
  const questByObjective = new Map(
    bundle.objectives.map((objective) => [objective.id, objective.questId]),
  );

  for (const s of bundle.sessions) {
    add({
      id: s.id,
      kind: 'session',
      label: `Session ${s.number}: ${s.title}`,
      href: `/sessions/${s.id}`,
    });
  }
  for (const l of bundle.locations) {
    add({ id: l.id, kind: 'location', label: l.name, href: `/world/${l.id}` });
  }
  for (const n of bundle.npcs) {
    add({ id: n.id, kind: 'npc', label: n.name, href: `/npcs/${n.id}` });
  }
  for (const f of bundle.factions) {
    add({
      id: f.id,
      kind: 'faction',
      label: f.name,
      href: `/factions/${f.id}`,
    });
  }
  for (const q of bundle.quests) {
    add({ id: q.id, kind: 'quest', label: q.title, href: questHref(q.id) });
  }
  for (const o of bundle.objectives) {
    add({
      id: o.id,
      kind: 'objective',
      label: o.title,
      href: `${questHref(o.questId)}#objective-${o.id}`,
    });
  }
  for (const e of bundle.encounters) {
    add({
      id: e.id,
      kind: 'encounter',
      label: e.title,
      href: `/encounters/${e.id}`,
    });
  }
  for (const m of bundle.maps) {
    add({ id: m.id, kind: 'map', label: m.title, href: `/maps/${m.id}` });
  }
  const noteIds = new Set(bundle.notes.map((note) => note.id));
  const noteHref = (id: string) =>
    noteIds.has(id) ? `/notes/${encodeURIComponent(id)}` : '/notes';
  for (const c of bundle.clues) {
    add({ id: c.id, kind: 'clue', label: c.title, href: noteHref(c.id) });
  }
  for (const h of bundle.handouts) {
    add({ id: h.id, kind: 'handout', label: h.title, href: noteHref(h.id) });
  }
  for (const t of bundle.sceneTemplates) {
    add({ id: t.id, kind: 'scene', label: t.title });
  }

  const backlinks = new Map<string, EntityRef[]>();
  const link = (sourceId: string, targets: readonly (string | undefined)[]) => {
    const source = byId.get(sourceId);
    if (!source) return;
    for (const target of targets) {
      if (!target || target === sourceId) continue;
      const list = backlinks.get(target) ?? [];
      if (!list.some((ref) => ref.id === source.id)) list.push(source);
      backlinks.set(target, list);
    }
  };

  for (const s of bundle.sessions) {
    link(s.id, [
      ...s.questIds,
      ...s.npcIds,
      ...s.factionIds,
      ...s.locationIds,
      ...s.encounterIds,
      ...s.clueIds,
      ...s.handoutIds,
      ...(s.plan?.dependencies.map((d) => d.objectId) ?? []),
      ...(s.plan?.steps.map((step) => step.objectId) ?? []),
      ...(s.plan?.attachments ?? []),
    ]);
  }
  for (const n of bundle.npcs) {
    link(n.id, [...n.factionIds, ...n.locationIds, ...n.sessionIds]);
  }
  for (const f of bundle.factions) {
    link(f.id, [
      f.leaderNpcId,
      ...f.alliedFactionIds,
      ...f.rivalFactionIds,
      ...f.locationIds,
      ...f.questIds,
    ]);
  }
  for (const q of bundle.quests) {
    link(q.id, [
      q.giverNpcId,
      ...q.factionIds,
      ...q.sessionIds,
      ...q.locationIds,
      ...q.objectiveIds,
    ]);
  }
  for (const o of bundle.objectives) {
    // The quest owns the objective; its parent link keeps the union symmetric.
    link(o.id, [questByObjective.get(o.id), ...o.clueIds, ...o.locationIds]);
  }
  for (const e of bundle.encounters) {
    link(e.id, [...e.sessionIds, ...e.locationIds, ...e.factionIds]);
  }
  for (const c of bundle.clues) {
    link(c.id, [
      ...c.sourceHandoutIds,
      ...c.relatedQuestIds,
      ...c.locationIds,
      ...c.sessionIds,
    ]);
  }
  for (const h of bundle.handouts) {
    link(h.id, [
      ...h.sessionIds,
      ...h.clueIds,
      ...h.questIds,
      ...h.locationIds,
      ...h.factionIds,
    ]);
  }
  for (const l of bundle.locations) {
    link(l.id, [
      l.parentLocationId,
      l.mapId,
      ...l.npcIds,
      ...l.factionIds,
      ...l.encounterIds,
      ...l.questIds,
      ...l.handoutIds,
      l.sceneTemplateId,
    ]);
  }
  for (const m of bundle.maps) {
    link(m.id, m.locationIds);
  }

  return { byId, backlinks };
}

function getIndex(bundle: CampaignFixtureBundle): EntityIndex {
  let index = indexes.get(bundle);
  if (!index) {
    index = buildIndex(bundle);
    indexes.set(bundle, index);
  }
  return index;
}

export function resolveEntity(
  bundle: CampaignFixtureBundle,
  id: string,
): EntityRef | undefined {
  return getIndex(bundle).byId.get(id);
}

/**
 * Entities that reference `id` through any id-bearing field, deduplicated.
 * Callers union this with the entity's own forward links: the fixture data is
 * not symmetric (for example encounters have no `npcIds`).
 */
export function getBacklinks(
  bundle: CampaignFixtureBundle,
  id: string,
): EntityRef[] {
  return getIndex(bundle).backlinks.get(id) ?? [];
}
