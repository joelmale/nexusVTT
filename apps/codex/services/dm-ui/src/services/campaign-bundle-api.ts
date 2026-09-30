/*
 * Server-backed campaign bundle adapter (plan section 5, task T-S).
 *
 * Maps the campaign prep API (`/api/campaigns/:id/prep/objects`) into the
 * `CampaignFixtureBundle` read model the section pages render, and maps edits
 * back with compare-and-swap revisions.
 *
 * MAPPING DECISIONS (no server schema changes were needed)
 * --------------------------------------------------------
 * The server validates npc / faction / quest / location / note / clue
 * payloads with one generic `campaignEntrySchema` (title, visibility, Lexical
 * `content`, `links`, `tags`; `content.value` is `z.unknown()`). The kind must
 * match the object kind, the object id equals `data.id` (chosen by the
 * client), and a revise must send `revision = expectedRevision + 1`.
 *
 * - The section entity is stored structured inside
 *   `content.value.nexusStudio = { v: 1, fields }`, next to a plain Lexical
 *   `root` of readable paragraphs so other consumers still see text. `fields`
 *   is the entity minus id/campaignId/title. Quests keep their objectives
 *   inline as `fields.objectives`; on load they are flattened into
 *   `bundle.objectives` and `quest.objectiveIds`.
 * - Objects without `nexusStudio` (created elsewhere) load through a fallback
 *   that maps the plain text onto the kind's main text field.
 * - Titles: npc/faction/location -> `name`; quest/note/handout/folder -> `title`.
 * - Notes use kind `note`: `fields` holds `body` (one formattable markdown
 *   string) and `anchor` (`{type:'campaign'} | {type:'session', id} |
 *   {type:'scene', id}`), `color` (default 'yellow'), `size` (default
 *   'small') and `order` (global board order; new notes get max + 1, load
 *   sorts by it). Notes are always 'dm-only'. Foreign `note` objects
 *   (e.g. from the session-plan publisher) load through the plain-text
 *   fallback as campaign-wide notes.
 * - Handouts and handout folders both use server kind `lore`, told apart by
 *   `fields.subtype` ('handout' | 'handout-folder'; a foreign `lore` object
 *   without it loads as a handout). Handout fields: body, folderId, order,
 *   audience ('hidden' | 'all' | playerCharacterIds[]); server visibility is
 *   'players' when audience is not 'hidden', else 'dm-only'. Folder fields:
 *   order. Folders are single level; folder `objectIds`/`children` are
 *   derived on load from the handouts pointing at them.
 * - Everything except shared handouts is 'dm-only'.
 * - scene-template -> `bundle.sceneTemplates`, campaign-map -> minimal
 *   `bundle.maps` (title only), session-plan -> minimal `bundle.sessions`
 *   (title, draft/planned). The list endpoint returns no payload, so these
 *   three are not fetched individually.
 * - Never persisted (no server kind): sessionIds, encounterIds, clueIds,
 *   mapId, pinId, sceneTemplateId. Encounters are not created (by design).
 * - Bundle ids are the server object ids, so tracking is id -> revision.
 * - Seeding pre-generates UUIDs for every copied fixture item and rewrites
 *   cross references (faction/npc/location/quest ids) before creating,
 *   dropping references to anything not copied. If an item fails to create,
 *   references to it dangle; the failure is reported in `SeedResult.failed`.
 */
import type { CampaignSummary } from './campaign-api';
import { createCampaign } from './campaign-api';
import {
  createEmptyBundle,
  getFixtureBundle,
} from '../demo/fixture-registry/registry';
import type {
  CampaignFixtureBundle,
  CampaignHandout,
  CampaignNote,
  NoteColor,
  NoteSize,
  CampaignLifecycle,
  CampaignLocation,
  CampaignFaction,
  CampaignNpc,
  CampaignQuest,
  FolderRecord,
  HandoutAudience,
  QuestObjective,
} from '../demo/fixture-registry/types';

export type EditableKind =
  | 'npc'
  | 'faction'
  | 'quest'
  | 'location'
  | 'note'
  | 'handout'
  | 'handout-folder';

/** Handouts and folders are both stored as server kind `lore`. */
function serverKind(kind: EditableKind): string {
  return kind === 'handout' || kind === 'handout-folder' ? 'lore' : kind;
}

export interface SaveResult {
  ok: boolean;
  conflict?: boolean;
  error?: string;
}

export type AddResult = SaveResult & { id?: string };

export type ReorderResult = SaveResult & {
  /** Note ids whose new order could not be saved (conflict or error). */
  failedIds?: string[];
};

export interface SeedFailure {
  kind: EditableKind;
  id: string;
  title: string;
  error: string;
}

export interface SeedResult {
  campaignId: string;
  created: number;
  failed: SeedFailure[];
}

export interface ServerBundleStore {
  load(): Promise<CampaignFixtureBundle>;
  reload(): Promise<CampaignFixtureBundle>;
  updateItem(
    kind: EditableKind,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<SaveResult>;
  addItem(
    kind: EditableKind,
    draft: Record<string, unknown>,
  ): Promise<AddResult>;
  seedFromFixture(slug: string): Promise<SeedResult>;
  /**
   * Persists a new note order. `orderedIds` may be the whole board or a
   * filtered subset: the listed notes take the listed sequence within the
   * order slots they already occupy, other notes keep their positions.
   */
  reorderNotes(orderedIds: string[]): Promise<ReorderResult>;
  /** Latest bundle held by the store (updated after every successful save). */
  getBundle(): CampaignFixtureBundle;
  /** Notified after every successful load/save. Returns an unsubscribe. */
  subscribe(listener: (bundle: CampaignFixtureBundle) => void): () => void;
}

type Entity = Record<string, unknown> & { id: string };

interface Tracked {
  kind: EditableKind;
  entity: Entity;
  revision: number;
  createdAt: string;
  status: string;
}

interface PrepListItem {
  id: string;
  kind: string;
  title: string;
  status: string;
  currentRevision: number;
}

const NOTE_COLORS: NoteColor[] = [
  'yellow',
  'pink',
  'blue',
  'green',
  'purple',
  'orange',
  'gray',
];
const NOTE_SIZES: NoteSize[] = ['small', 'medium', 'large'];
const SCHEMA_VERSION = 1;
const LOAD_CONCURRENCY = 6;
const EDITABLE_KINDS: string[] = [
  'npc',
  'faction',
  'quest',
  'location',
  'note',
  'lore',
];

/** Fields that never round-trip because the server has no kind for them. */
const UNSUPPORTED_KEYS = [
  'sessionIds',
  'encounterIds',
  'clueIds',
  'mapId',
  'pinId',
  'sceneTemplateId',
];
const SINGLE_REF_KEYS = ['leaderNpcId', 'giverNpcId', 'parentLocationId'];
const LIST_REF_KEYS = [
  'factionIds',
  'locationIds',
  'npcIds',
  'questIds',
  'alliedFactionIds',
  'rivalFactionIds',
];

// ---------------------------------------------------------------- helpers

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function newId(): string {
  return crypto.randomUUID();
}

interface HttpResult {
  ok: boolean;
  status: number;
  body: unknown;
  error?: string;
}

function messageFrom(body: unknown, status: number): string {
  if (isRecord(body)) {
    if (Array.isArray(body.issues) && isRecord(body.issues[0])) {
      const issue = body.issues[0];
      const text = str(issue.message);
      if (text) {
        return typeof issue.path === 'string' && issue.path
          ? `${text} (${issue.path})`
          : text;
      }
    }
    if (typeof body.error === 'string') return body.error;
  }
  if (status === 401 || status === 403) {
    return 'Sign in to Nexus VTT to edit this campaign.';
  }
  return `Request failed with status ${status}`;
}

async function http(path: string, init?: RequestInit): Promise<HttpResult> {
  try {
    const response = await fetch(path, {
      credentials: 'include',
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
    const body = (await response.json().catch(() => null)) as unknown;
    return {
      ok: response.ok,
      status: response.status,
      body,
      ...(response.ok ? {} : { error: messageFrom(body, response.status) }),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      body: null,
      error:
        error instanceof Error ? error.message : 'The network is unavailable.',
    };
  }
}

function objectsPath(campaignId: string): string {
  return `/api/campaigns/${encodeURIComponent(campaignId)}/prep/objects`;
}

function titleKey(kind: EditableKind): 'name' | 'title' {
  return kind === 'npc' || kind === 'faction' || kind === 'location'
    ? 'name'
    : 'title';
}

// ------------------------------------------------------- entity normalizing

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

function splitParagraphs(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Fills every field of the section entity so pages can render it directly. */
function normalize(
  kind: EditableKind,
  raw: Record<string, unknown>,
  campaignId: string,
): Entity {
  const id = str(raw.id);
  const base = { id, campaignId };
  switch (kind) {
    case 'npc': {
      const name = str(raw.name);
      return {
        ...base,
        name,
        role: str(raw.role),
        ancestry: str(raw.ancestry),
        factionIds: strings(raw.factionIds),
        motivation: str(raw.motivation),
        relationship: str(raw.relationship),
        locationIds: strings(raw.locationIds),
        sessionIds: [],
        portraitFallback:
          str(raw.portraitFallback).replace(/^\?$/, '') || initials(name),
        tags: strings(raw.tags),
      } satisfies CampaignNpc;
    }
    case 'faction': {
      const status = str(raw.status);
      return {
        ...base,
        name: str(raw.name),
        publicFace: str(raw.publicFace),
        hiddenAgenda: str(raw.hiddenAgenda),
        ...(raw.leaderNpcId ? { leaderNpcId: str(raw.leaderNpcId) } : {}),
        alliedFactionIds: strings(raw.alliedFactionIds),
        rivalFactionIds: strings(raw.rivalFactionIds),
        locationIds: strings(raw.locationIds),
        questIds: strings(raw.questIds),
        status: (['ally', 'neutral', 'opposition', 'unknown'].includes(status)
          ? status
          : 'unknown') as CampaignFaction['status'],
      } satisfies CampaignFaction;
    }
    case 'quest': {
      const status = str(raw.status);
      const priority = str(raw.priority);
      return {
        ...base,
        title: str(raw.title),
        status: (['active', 'on-hold', 'not-started', 'complete'].includes(
          status,
        )
          ? status
          : 'not-started') as CampaignQuest['status'],
        priority: (['high', 'medium', 'low'].includes(priority)
          ? priority
          : 'medium') as CampaignQuest['priority'],
        summary: str(raw.summary),
        ...(raw.giverNpcId ? { giverNpcId: str(raw.giverNpcId) } : {}),
        factionIds: strings(raw.factionIds),
        sessionIds: [],
        locationIds: strings(raw.locationIds),
        objectiveIds: [],
        ...(raw.resolution ? { resolution: str(raw.resolution) } : {}),
      } satisfies CampaignQuest;
    }
    case 'location': {
      return {
        ...base,
        name: str(raw.name),
        type: str(raw.type),
        shortDescription: str(raw.shortDescription),
        description: strings(raw.description),
        tags: strings(raw.tags),
        ...(raw.parentLocationId
          ? { parentLocationId: str(raw.parentLocationId) }
          : {}),
        npcIds: strings(raw.npcIds),
        factionIds: strings(raw.factionIds),
        encounterIds: [],
        questIds: strings(raw.questIds),
        handoutIds: strings(raw.handoutIds),
        ...(raw.imagePath ? { imagePath: str(raw.imagePath) } : {}),
        notes: str(raw.notes),
      } satisfies CampaignLocation;
    }
    case 'note': {
      const anchor = isRecord(raw.anchor) ? raw.anchor : {};
      return {
        ...base,
        title: str(raw.title),
        body: str(raw.body),
        anchor:
          (anchor.type === 'session' || anchor.type === 'scene') && anchor.id
            ? { type: anchor.type, id: str(anchor.id) }
            : { type: 'campaign' },
        color: NOTE_COLORS.includes(raw.color as NoteColor)
          ? (raw.color as NoteColor)
          : 'yellow',
        size: NOTE_SIZES.includes(raw.size as NoteSize)
          ? (raw.size as NoteSize)
          : 'small',
        order: typeof raw.order === 'number' ? raw.order : 0,
      } satisfies CampaignNote;
    }
    case 'handout': {
      const body = str(raw.body);
      const audience: HandoutAudience =
        raw.audience === 'all'
          ? 'all'
          : Array.isArray(raw.audience) && strings(raw.audience).length > 0
            ? strings(raw.audience)
            : 'hidden';
      return {
        ...base,
        title: str(raw.title),
        kind: 'handout',
        summary: str(raw.summary),
        body,
        content: splitParagraphs(body),
        audience,
        ...(raw.folderId ? { folderId: str(raw.folderId) } : {}),
        order: typeof raw.order === 'number' ? raw.order : 0,
        visibility: audience === 'hidden' ? 'dm-only' : 'shared',
        sessionIds: [],
        clueIds: [],
        questIds: [],
        locationIds: [],
        factionIds: [],
      } satisfies CampaignHandout;
    }
    case 'handout-folder':
      return {
        ...base,
        title: str(raw.title),
        actId: '',
        objectIds: [],
        children: [],
        kind: 'handout-folder',
        order: typeof raw.order === 'number' ? raw.order : 0,
      } satisfies FolderRecord;
  }
}

function normalizeObjective(
  raw: unknown,
  questId: string,
  index: number,
): QuestObjective {
  const o = isRecord(raw) ? raw : {};
  const status = str(o.status);
  return {
    id: str(o.id) || newId(),
    questId,
    order: typeof o.order === 'number' ? o.order : index + 1,
    title: str(o.title),
    status: (['complete', 'active', 'blocked', 'pending'].includes(status)
      ? status
      : 'pending') as QuestObjective['status'],
    clueIds: [],
    locationIds: strings(o.locationIds),
  };
}

/** Quest objectives live beside the quest entity while tracked. */
function objectivesOf(entity: Entity): QuestObjective[] {
  const raw = entity.objectives;
  return Array.isArray(raw)
    ? raw.map((item, index) => normalizeObjective(item, entity.id, index))
    : [];
}

// -------------------------------------------------------------- persistence

function plainLines(kind: EditableKind, entity: Entity): string[] {
  switch (kind) {
    case 'npc':
      return [str(entity.role), str(entity.motivation)];
    case 'faction':
      return [str(entity.publicFace)];
    case 'quest':
      return [str(entity.summary)];
    case 'location':
      return [str(entity.shortDescription), ...strings(entity.description)];
    case 'note':
    case 'handout':
      return splitParagraphs(str(entity.body));
    case 'handout-folder':
      return [];
  }
}

/** Fields written to the server: the entity minus identity and unsupported keys. */
function persistedFields(
  kind: EditableKind,
  entity: Entity,
): Record<string, unknown> {
  const skip = new Set([
    'id',
    'campaignId',
    titleKey(kind),
    'objectiveIds',
    ...UNSUPPORTED_KEYS,
  ]);
  const fields: Record<string, unknown> = {};
  if (kind === 'handout' || kind === 'handout-folder') {
    const keep =
      kind === 'handout'
        ? ['body', 'folderId', 'order', 'audience']
        : ['order'];
    for (const key of keep) {
      if (entity[key] !== undefined) fields[key] = entity[key];
    }
    fields.subtype = kind;
    return fields;
  }
  for (const [key, value] of Object.entries(entity)) {
    if (!skip.has(key) && value !== undefined) fields[key] = value;
  }
  return fields;
}

function buildData(
  campaignId: string,
  kind: EditableKind,
  entity: Entity,
  revision: number,
  createdAt: string,
  now: string,
): Record<string, unknown> {
  const tags = strings(entity.tags);
  return {
    id: entity.id,
    campaignId,
    schemaVersion: SCHEMA_VERSION,
    revision,
    kind: serverKind(kind),
    title: str(entity[titleKey(kind)]).trim(),
    visibility:
      kind === 'handout' && entity.audience !== 'hidden'
        ? 'players'
        : 'dm-only',
    content: {
      format: 'lexical',
      schemaVersion: 1,
      value: {
        root: {
          type: 'root',
          children: plainLines(kind, entity)
            .filter(Boolean)
            .map((text) => ({
              type: 'paragraph',
              children: [{ type: 'text', text }],
            })),
        },
        nexusStudio: { v: 1, fields: persistedFields(kind, entity) },
      },
    },
    links: [],
    tags,
    createdAt,
    updatedAt: now,
  };
}

function readFields(data: unknown): Record<string, unknown> | undefined {
  if (!isRecord(data) || !isRecord(data.content)) return undefined;
  const value = data.content.value;
  if (!isRecord(value) || !isRecord(value.nexusStudio)) return undefined;
  const fields = value.nexusStudio.fields;
  return isRecord(fields) ? fields : undefined;
}

function readPlainText(data: unknown): string[] {
  if (!isRecord(data) || !isRecord(data.content)) return [];
  const value = data.content.value;
  if (!isRecord(value) || !isRecord(value.root)) return [];
  const children = value.root.children;
  if (!Array.isArray(children)) return [];
  const lines: string[] = [];
  for (const child of children) {
    if (!isRecord(child) || !Array.isArray(child.children)) continue;
    lines.push(
      child.children
        .map((leaf) => (isRecord(leaf) ? str(leaf.text) : ''))
        .join(''),
    );
  }
  return lines.filter(Boolean);
}

/** Resolves a server object kind (and stored subtype) to an editable kind. */
function editableKindOf(serverKindName: string, data: unknown): EditableKind {
  if (serverKindName !== 'lore') return serverKindName as EditableKind;
  return readFields(data)?.subtype === 'handout-folder'
    ? 'handout-folder'
    : 'handout';
}

/** Maps a stored payload (structured or foreign) to a section entity. */
function entityFromData(
  kind: EditableKind,
  data: unknown,
  campaignId: string,
  id: string,
  title: string,
): Entity {
  const record = isRecord(data) ? data : {};
  const fields = readFields(data);
  const raw: Record<string, unknown> = { ...(fields ?? {}) };
  if (!fields) {
    const text = readPlainText(data);
    if (kind === 'npc') raw.motivation = text.join('\n');
    if (kind === 'faction') raw.publicFace = text.join('\n');
    if (kind === 'quest') raw.summary = text.join('\n');
    if (kind === 'location') {
      raw.shortDescription = text[0] ?? '';
      raw.description = text.slice(1);
    }
    if (kind === 'note') raw.body = text.join('\n\n');
    if (kind === 'handout') {
      raw.body = text.join('\n\n');
      raw.audience = record.visibility === 'players' ? 'all' : 'hidden';
    }
    if (kind === 'npc' || kind === 'location') raw.tags = record.tags;
  }
  raw.id = id;
  raw[titleKey(kind)] = title || str(record.title);
  const entity = normalize(kind, raw, campaignId);
  if (kind === 'quest' && Array.isArray(raw.objectives)) {
    entity.objectives = raw.objectives;
  }
  return entity;
}

// ----------------------------------------------------------------- bundle

function lifecycleOf(summary: CampaignSummary): CampaignLifecycle {
  const candidate = (summary as unknown as Record<string, unknown>).lifecycle;
  const alt = (summary as unknown as Record<string, unknown>).status;
  for (const value of [candidate, alt]) {
    if (
      value === 'draft' ||
      value === 'active' ||
      value === 'paused' ||
      value === 'complete'
    ) {
      return value;
    }
  }
  return 'draft';
}

interface Extras {
  sceneTemplates: { id: string; title: string }[];
  maps: { id: string; title: string }[];
  plans: { id: string; title: string; status: string }[];
}

function buildBundle(
  summary: CampaignSummary,
  items: Map<string, Tracked>,
  extras: Extras,
): CampaignFixtureBundle {
  const base = createEmptyBundle(summary);
  const lifecycle = lifecycleOf(summary);
  const list = <T>(kind: EditableKind): T[] =>
    [...items.values()]
      .filter((item) => item.kind === kind)
      .map((item) => item.entity as unknown as T);

  const npcs = list<CampaignNpc>('npc');
  const factions = list<CampaignFaction>('faction');
  const locations = list<CampaignLocation>('location');
  const notes = list<CampaignNote>('note').sort((a, b) => a.order - b.order);
  const handouts = list<CampaignHandout>('handout').sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );
  const folders = list<FolderRecord>('handout-folder')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((folder) => {
      const own = handouts.filter((handout) => handout.folderId === folder.id);
      return {
        ...folder,
        objectIds: own.map((handout) => handout.id),
        children:
          own.length > 0
            ? [{ kind: 'handout' as const, count: own.length }]
            : [],
      };
    });
  const objectives: QuestObjective[] = [];
  const quests = [...items.values()]
    .filter((item) => item.kind === 'quest')
    .map((item) => {
      const own = objectivesOf(item.entity).sort((a, b) => a.order - b.order);
      objectives.push(...own);
      return {
        ...(item.entity as unknown as CampaignQuest),
        objectiveIds: own.map((objective) => objective.id),
      };
    });
  const sessions = extras.plans.map((plan, index) => ({
    id: plan.id,
    campaignId: summary.id,
    actId: '',
    number: index + 1,
    title: plan.title,
    status: plan.status === 'ready' ? ('planned' as const) : ('draft' as const),
    summary: '',
    partyLevel: 1,
    tags: [],
    questIds: [],
    npcIds: [],
    factionIds: [],
    locationIds: [],
    encounterIds: [],
    clueIds: [],
    handoutIds: [],
  }));
  const maps = extras.maps.map((map) => ({
    id: map.id,
    campaignId: summary.id,
    title: map.title,
    description: '',
    locationIds: [],
    layers: [],
  }));

  return Object.freeze({
    ...base,
    campaign: {
      ...base.campaign,
      status: lifecycle,
      sessionIds: sessions.map((session) => session.id),
      objectCounts: {
        all: items.size - folderCount(items) + extras.sceneTemplates.length,
        scenes: extras.sceneTemplates.length,
        encounters: 0,
        npcs: npcs.length,
        lore: notes.length,
        handouts: handouts.length,
      },
    },
    lifecycle,
    npcs,
    factions,
    quests,
    objectives,
    locations,
    notes,
    handouts,
    folders,
    maps,
    sessions,
    sceneTemplates: extras.sceneTemplates,
    source: 'server',
  });
}

function folderCount(items: Map<string, Tracked>): number {
  return [...items.values()].filter((item) => item.kind === 'handout-folder')
    .length;
}

// ------------------------------------------------------------------ store

async function mapPool<T, R>(
  input: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(input.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, input.length) },
    async () => {
      while (next < input.length) {
        const index = next++;
        results[index] = await fn(input[index]);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

function asListItems(body: unknown): PrepListItem[] {
  if (!isRecord(body) || !Array.isArray(body.objects)) return [];
  return body.objects.filter(isRecord).map((object) => ({
    id: str(object.id),
    kind: str(object.kind),
    title: str(object.title),
    status: str(object.status, 'draft'),
    currentRevision:
      typeof object.currentRevision === 'number' ? object.currentRevision : 1,
  }));
}

function revisionOf(body: unknown): number | undefined {
  if (isRecord(body) && isRecord(body.object)) {
    const revision = body.object.currentRevision;
    if (typeof revision === 'number') return revision;
  }
  return undefined;
}

export function createServerBundleStore(
  campaign: CampaignSummary,
): ServerBundleStore {
  const items = new Map<string, Tracked>();
  let extras: Extras = { sceneTemplates: [], maps: [], plans: [] };
  let bundle: CampaignFixtureBundle = createEmptyBundle(campaign);
  const listeners = new Set<(bundle: CampaignFixtureBundle) => void>();

  function publish(): CampaignFixtureBundle {
    bundle = buildBundle(campaign, items, extras);
    listeners.forEach((listener) => listener(bundle));
    return bundle;
  }

  async function load(): Promise<CampaignFixtureBundle> {
    const list = await http(objectsPath(campaign.id));
    if (!list.ok) throw new Error(list.error ?? 'Failed to load campaign.');
    const live = asListItems(list.body).filter(
      (item) => item.status !== 'retired' && item.status !== 'archived',
    );

    items.clear();
    extras = {
      sceneTemplates: live
        .filter((item) => item.kind === 'scene-template')
        .map((item) => ({ id: item.id, title: item.title })),
      maps: live
        .filter((item) => item.kind === 'campaign-map')
        .map((item) => ({ id: item.id, title: item.title })),
      plans: live
        .filter((item) => item.kind === 'session-plan')
        .map((item) => ({
          id: item.id,
          title: item.title,
          status: item.status,
        })),
    };

    const editable = live.filter((item) => EDITABLE_KINDS.includes(item.kind));
    const loaded = await mapPool(editable, LOAD_CONCURRENCY, async (item) => {
      const detail = await http(`${objectsPath(campaign.id)}/${item.id}`);
      return { item, detail };
    });
    for (const { item, detail } of loaded) {
      if (!detail.ok || !isRecord(detail.body)) continue;
      const revision = isRecord(detail.body.revision)
        ? detail.body.revision
        : {};
      const kind = editableKindOf(item.kind, revision.data);
      const entity = entityFromData(
        kind,
        revision.data,
        campaign.id,
        item.id,
        item.title,
      );
      const data = isRecord(revision.data) ? revision.data : {};
      items.set(item.id, {
        kind,
        entity,
        revision: revisionOf(detail.body) ?? item.currentRevision,
        createdAt: str(data.createdAt) || new Date().toISOString(),
        status: item.status,
      });
    }
    return publish();
  }

  async function write(
    kind: EditableKind,
    entity: Entity,
    tracked: Tracked | undefined,
  ): Promise<SaveResult & { revision?: number }> {
    const title = str(entity[titleKey(kind)]).trim();
    if (!title) return { ok: false, error: 'A title is required.' };
    const now = new Date().toISOString();
    const requestId = newId();
    const result = tracked
      ? await http(`${objectsPath(campaign.id)}/${entity.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            data: buildData(
              campaign.id,
              kind,
              entity,
              tracked.revision + 1,
              tracked.createdAt,
              now,
            ),
            expectedRevision: tracked.revision,
            requestId,
          }),
        })
      : await http(objectsPath(campaign.id), {
          method: 'POST',
          body: JSON.stringify({
            kind: serverKind(kind),
            data: buildData(campaign.id, kind, entity, 1, now, now),
            requestId,
          }),
        });
    if (!result.ok) {
      const conflict = result.status === 409;
      return {
        ok: false,
        ...(conflict ? { conflict: true } : {}),
        error: conflict
          ? 'This item changed elsewhere. Reload the latest version.'
          : (result.error ?? 'Save failed.'),
      };
    }
    return {
      ok: true,
      revision: revisionOf(result.body) ?? (tracked ? tracked.revision + 1 : 1),
    };
  }

  async function updateItem(
    kind: EditableKind,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<SaveResult> {
    const tracked = items.get(id);
    if (!tracked || tracked.kind !== kind) {
      return { ok: false, error: 'not-found' };
    }
    const merged = mergeEntity(kind, tracked.entity, patch);
    const result = await write(kind, merged, tracked);
    if (!result.ok) {
      return {
        ok: false,
        ...(result.conflict ? { conflict: true } : {}),
        error: result.error,
      };
    }
    items.set(id, { ...tracked, entity: merged, revision: result.revision! });
    publish();
    return { ok: true };
  }

  function nextOrder(kind: EditableKind, entity: Entity): number {
    const orders = [...items.values()]
      .filter(
        (item) =>
          item.kind === kind &&
          (kind === 'handout-folder' ||
            kind === 'note' ||
            item.entity.folderId === entity.folderId),
      )
      .map((item) => Number(item.entity.order) || 0);
    return orders.length > 0 ? Math.max(...orders) + 1 : 0;
  }

  async function addItem(
    kind: EditableKind,
    draft: Record<string, unknown>,
  ): Promise<AddResult> {
    const id = newId();
    const entity = mergeEntity(
      kind,
      normalize(kind, { id }, campaign.id),
      draft,
      id,
    );
    if (
      (kind === 'handout' || kind === 'handout-folder' || kind === 'note') &&
      typeof draft.order !== 'number'
    ) {
      entity.order = nextOrder(kind, entity);
    }
    const result = await write(kind, entity, undefined);
    if (!result.ok) {
      return {
        ok: false,
        ...(result.conflict ? { conflict: true } : {}),
        error: result.error,
      };
    }
    items.set(id, {
      kind,
      entity,
      revision: result.revision!,
      createdAt: new Date().toISOString(),
      status: 'draft',
    });
    publish();
    return { ok: true, id };
  }

  async function reorderNotes(orderedIds: string[]): Promise<ReorderResult> {
    const tracked = orderedIds.map((id) => items.get(id));
    if (tracked.some((item) => !item || item.kind !== 'note')) {
      return { ok: false, error: 'not-found' };
    }
    const slots = tracked
      .map((item) => Number(item!.entity.order) || 0)
      .sort((a, b) => a - b);
    // Duplicate/unset slots collapse; fall back to plain positions.
    const usable = new Set(slots).size === slots.length;
    const failedIds: string[] = [];
    let conflict = false;
    let error: string | undefined;
    for (const [index, id] of orderedIds.entries()) {
      const order = usable ? slots[index] : index;
      if (Number(items.get(id)!.entity.order) === order) continue;
      const result = await updateItem('note', id, { order });
      if (!result.ok) {
        failedIds.push(id);
        conflict ||= Boolean(result.conflict);
        error ??= result.error;
      }
    }
    if (failedIds.length === 0) return { ok: true };
    return {
      ok: false,
      ...(conflict ? { conflict: true } : {}),
      error: `${failedIds.length} of ${orderedIds.length} notes could not be reordered${error ? `: ${error}` : ''}`,
      failedIds,
    };
  }

  return {
    load,
    reload: load,
    updateItem,
    addItem,
    seedFromFixture,
    reorderNotes,
    getBundle: () => bundle,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Applies a section patch over an entity, keeping derived fields coherent. */
function mergeEntity(
  kind: EditableKind,
  current: Entity,
  patch: Record<string, unknown>,
  forcedId?: string,
): Entity {
  const merged: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'id' || key === 'campaignId' || value === undefined) continue;
    merged[key] = value;
  }
  if (forcedId) merged.id = forcedId;
  if (
    kind === 'npc' &&
    'name' in patch &&
    !('portraitFallback' in patch) &&
    current.portraitFallback === initials(str(current.name))
  ) {
    delete merged.portraitFallback; // derived from the old name; recompute
  }
  if (kind === 'quest' && Array.isArray(patch.objectives)) {
    merged.objectives = patch.objectives.map((item, index) =>
      normalizeObjective(item, current.id, index),
    );
  }
  const normalized = normalize(kind, merged, str(current.campaignId));
  if (kind === 'quest') {
    normalized.objectives =
      merged.objectives ??
      (Array.isArray(current.objectives) ? current.objectives : []);
  }
  return normalized;
}

// -------------------------------------------------------------- seeding

function remap(
  entity: Record<string, unknown>,
  idMap: Map<string, string>,
): Record<string, unknown> {
  const out = { ...entity };
  for (const key of SINGLE_REF_KEYS) {
    if (typeof out[key] === 'string') {
      const mapped = idMap.get(out[key] as string);
      if (mapped) out[key] = mapped;
      else delete out[key];
    }
  }
  for (const key of LIST_REF_KEYS) {
    if (Array.isArray(out[key])) {
      out[key] = strings(out[key])
        .map((id) => idMap.get(id))
        .filter((id): id is string => Boolean(id));
    }
  }
  return out;
}

/**
 * Creates a new real campaign named after the example fixture and copies its
 * npcs, factions, quests and locations into it, plus its handouts and their
 * folders as real handouts/folders, its lore as campaign-wide notes and its
 * clues as notes. Sequential and
 * resilient: an item that fails is reported and the rest continue.
 */
export async function seedFromFixture(slug: string): Promise<SeedResult> {
  const fixture = getFixtureBundle(slug);
  if (!fixture) throw new Error(`Unknown example campaign: ${slug}`);

  const created = await createCampaign({
    name: fixture.campaign.title,
    description: fixture.campaign.premise,
  });

  const idMap = new Map<string, string>();
  const plan: {
    kind: EditableKind;
    source: Record<string, unknown>;
    objectives?: QuestObjective[];
  }[] = [];

  const register = (
    kind: EditableKind,
    source: { id: string },
    objectives?: QuestObjective[],
  ) => {
    idMap.set(source.id, newId());
    plan.push({
      kind,
      source: source as unknown as Record<string, unknown>,
      objectives,
    });
  };
  fixture.locations.forEach((item) => register('location', item));
  fixture.npcs.forEach((item) => register('npc', item));
  fixture.factions.forEach((item) => register('faction', item));
  fixture.quests.forEach((item) =>
    register(
      'quest',
      item,
      fixture.objectives.filter((objective) => objective.questId === item.id),
    ),
  );

  // Handout folders first (only folders that hold fixture handouts), then the
  // handouts, so folderId points at a real object. Audience is 'all' for
  // handouts the fixture marks player-facing, else 'hidden'. Fixture lore
  // entries (kind 'lore') become campaign-wide notes via seedNotes().
  const realHandouts = fixture.handouts.filter((h) => h.kind === 'handout');
  const folderIds = [
    ...new Set(realHandouts.map((h) => h.folderId).filter(Boolean)),
  ] as string[];
  folderIds.forEach((folderId, index) => {
    const folder = fixture.folders.find((f) => f.id === folderId);
    if (!folder) return;
    idMap.set(folder.id, newId());
    plan.push({
      kind: 'handout-folder',
      source: { ...folder, order: index } as unknown as Record<string, unknown>,
    });
  });
  realHandouts.forEach((handout) => {
    idMap.set(handout.id, newId());
    const folderId = handout.folderId ? idMap.get(handout.folderId) : undefined;
    plan.push({
      kind: 'handout',
      source: {
        ...handout,
        folderId,
        audience: handout.visibility === 'shared' ? 'all' : 'hidden',
      } as unknown as Record<string, unknown>,
    });
  });

  const result: SeedResult = { campaignId: created.id, created: 0, failed: [] };

  for (const { kind, source, objectives } of plan) {
    const newItemId = idMap.get(str(source.id))!;
    const draft: Record<string, unknown> =
      kind === 'handout' || kind === 'handout-folder'
        ? { ...source }
        : { ...remap(source, idMap) };
    if (kind === 'handout') {
      draft.body = str(source.body) || strings(source.content).join('\n\n');
    }
    if (kind === 'quest') {
      draft.objectives = (objectives ?? [])
        .sort((a, b) => a.order - b.order)
        .map((objective) => ({
          id: newId(),
          title: objective.title,
          status: objective.status,
          order: objective.order,
          locationIds: remap({ locationIds: objective.locationIds }, idMap)
            .locationIds,
        }));
    }
    const entity = mergeEntity(
      kind,
      normalize(kind, { id: newItemId }, created.id),
      draft,
      newItemId,
    );
    const failure = await postNew(created.id, kind, entity);
    if (!failure) {
      result.created += 1;
    } else {
      result.failed.push({
        kind,
        id: str(source.id),
        title: str(source[titleKey(kind)]),
        error: failure,
      });
    }
  }

  for (const [noteIndex, note] of seedNotes(fixture).entries()) {
    const entity = normalize(
      'note',
      { ...note, id: newId(), anchor: { type: 'campaign' }, order: noteIndex },
      created.id,
    );
    const failure = await postNew(created.id, 'note', entity);
    if (!failure) {
      result.created += 1;
    } else {
      result.failed.push({
        kind: 'note',
        id: note.id,
        title: note.title,
        error: failure,
      });
    }
  }
  return result;
}

/** POSTs a new object; returns an error message on failure. */
async function postNew(
  campaignId: string,
  kind: EditableKind,
  entity: Entity,
): Promise<string | undefined> {
  const now = new Date().toISOString();
  const response = await http(objectsPath(campaignId), {
    method: 'POST',
    body: JSON.stringify({
      kind: serverKind(kind),
      data: buildData(campaignId, kind, entity, 1, now, now),
      requestId: newId(),
    }),
  });
  return response.ok ? undefined : (response.error ?? 'Failed to create item.');
}

/**
 * Notes to seed from an example: its lore (campaign-wide) plus clues. Session anchors need server session ids and
 * sessions are not seeded, so a session's clues become one campaign-wide note
 * that names the session in its title; unlinked clues share one "Clues" note.
 */
function seedNotes(fixture: CampaignFixtureBundle): CampaignNote[] {
  const notes = [...fixture.notes];
  const clueLine = (clue: CampaignFixtureBundle['clues'][number]) =>
    `- **${clue.title}** (${clue.status}): ${clue.meaning}`;
  const linked = new Set<string>();
  for (const session of fixture.sessions) {
    const clues = fixture.clues.filter((clue) =>
      clue.sessionIds.includes(session.id),
    );
    if (clues.length === 0) continue;
    clues.forEach((clue) => linked.add(clue.id));
    notes.push({
      id: `clues-${session.id}`,
      campaignId: fixture.campaignId,
      title: `Clues - Session ${session.number}: ${session.title}`,
      body: clues.map(clueLine).join('\n'),
      anchor: { type: 'campaign' },
      color: 'yellow',
      size: 'small',
      order: 0,
    });
  }
  const rest = fixture.clues.filter((clue) => !linked.has(clue.id));
  if (rest.length > 0) {
    notes.push({
      id: 'clues-campaign',
      campaignId: fixture.campaignId,
      title: 'Clues',
      body: rest.map(clueLine).join('\n'),
      anchor: { type: 'campaign' },
      color: 'yellow',
      size: 'small',
      order: 0,
    });
  }
  return notes;
}
