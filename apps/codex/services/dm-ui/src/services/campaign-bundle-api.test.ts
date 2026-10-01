import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getFixtureBundle } from '../demo/fixture-registry/registry';
import type { CampaignSummary } from './campaign-api';
import {
  createServerBundleStore,
  seedFromFixture,
} from './campaign-bundle-api';

const CAMPAIGN: CampaignSummary = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  name: 'Real Campaign',
  description: 'A real one',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

interface StoredObject {
  id: string;
  campaignId: string;
  kind: string;
  title: string;
  status: string;
  currentRevision: number;
  data: Record<string, unknown>;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stripData(object: StoredObject): Omit<StoredObject, 'data'> {
  const copy: Partial<StoredObject> = { ...object };
  delete copy.data;
  return copy as Omit<StoredObject, 'data'>;
}

/** In-memory fake of the prep API, including revision compare-and-swap. */
class FakeServer {
  objects = new Map<string, StoredObject>();
  campaigns: { id: string; name: string; description?: string }[] = [];
  failTitles = new Set<string>();
  bump409 = false;
  calls: { method: string; path: string; body?: Record<string, unknown> }[] =
    [];

  install() {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input);
      const method = init?.method ?? 'GET';
      const body = init?.body
        ? (JSON.parse(String(init.body)) as Record<string, unknown>)
        : undefined;
      this.calls.push({ method, path, body });

      if (path === '/api/campaigns' && method === 'POST') {
        const id = crypto.randomUUID();
        const created = {
          id,
          name: String(body?.name),
          description: body?.description as string | undefined,
        };
        this.campaigns.push(created);
        return json({
          ...created,
          createdAt: CAMPAIGN.createdAt,
          updatedAt: CAMPAIGN.updatedAt,
        });
      }
      const match = path.match(
        /^\/api\/campaigns\/([^/]+)\/prep\/objects(?:\/([^/?]+))?$/,
      );
      if (!match) return json({ error: 'unexpected ' + path }, 500);
      const [, campaignId, objectId] = match;

      if (method === 'GET' && !objectId) {
        return json({
          objects: [...this.objects.values()]
            .filter((object) => object.campaignId === campaignId)
            .map(stripData),
        });
      }
      if (method === 'GET' && objectId) {
        const object = this.objects.get(objectId);
        if (!object) return json({ error: 'not found' }, 404);
        const { data, ...record } = object;
        return json({ object: record, revision: { data } });
      }
      if (method === 'POST') {
        const data = body?.data as Record<string, unknown>;
        if (this.failTitles.has(String(data.title))) {
          return json({ error: 'boom', issues: [] }, 422);
        }
        const object: StoredObject = {
          id: String(data.id),
          campaignId,
          kind: String(body?.kind),
          title: String(data.title),
          status: 'draft',
          currentRevision: 1,
          data,
        };
        this.objects.set(object.id, object);
        const record = stripData(object);
        return json({ data, object: record }, 201);
      }
      if (method === 'PUT' && objectId) {
        const object = this.objects.get(objectId);
        if (!object) return json({ error: 'not found' }, 404);
        if (this.bump409 || object.currentRevision !== body?.expectedRevision) {
          return json({ error: 'Campaign object revision conflict' }, 409);
        }
        const data = body?.data as Record<string, unknown>;
        object.data = data;
        object.title = String(data.title);
        object.currentRevision += 1;
        const record = stripData(object);
        return json({ data, object: record });
      }
      return json({ error: 'unhandled' }, 500);
    });
  }

  put(kind: string, data: Record<string, unknown>, status = 'draft') {
    this.objects.set(String(data.id), {
      id: String(data.id),
      campaignId: CAMPAIGN.id,
      kind,
      title: String(data.title ?? data.name ?? 'x'),
      status,
      currentRevision: 1,
      data,
    });
  }
}

let server: FakeServer;

beforeEach(() => {
  server = new FakeServer();
  server.install();
});
afterEach(() => vi.restoreAllMocks());

describe('load + mapping round-trip', () => {
  it('starts empty and marks the bundle as server sourced', async () => {
    const store = createServerBundleStore(CAMPAIGN);
    const bundle = await store.load();
    expect(bundle.source).toBe('server');
    expect(bundle.lifecycle).toBe('draft');
    expect(bundle.npcs).toEqual([]);
    expect(bundle.quests).toEqual([]);
    expect(bundle.encounters).toEqual([]);
  });

  it('round-trips an npc', async () => {
    const store = createServerBundleStore(CAMPAIGN);
    await store.load();
    const added = await store.addItem('npc', {
      name: 'Mira',
      role: 'Innkeeper',
      motivation: 'Keep the peace',
      tags: ['ally'],
    });
    expect(added.ok).toBe(true);
    const fresh = createServerBundleStore(CAMPAIGN);
    const bundle = await fresh.load();
    expect(bundle.npcs).toHaveLength(1);
    expect(bundle.npcs[0]).toMatchObject({
      id: added.id,
      name: 'Mira',
      role: 'Innkeeper',
      motivation: 'Keep the peace',
      tags: ['ally'],
      portraitFallback: 'M',
    });
    expect(bundle.campaign.objectCounts.npcs).toBe(1);
  });

  it('round-trips a faction', async () => {
    const store = createServerBundleStore(CAMPAIGN);
    await store.load();
    const added = await store.addItem('faction', {
      name: 'Ash Court',
      publicFace: 'Judges',
      hiddenAgenda: 'Seize the crown',
      status: 'opposition',
    });
    const bundle = await createServerBundleStore(CAMPAIGN).load();
    expect(bundle.factions[0]).toMatchObject({
      id: added.id,
      name: 'Ash Court',
      hiddenAgenda: 'Seize the crown',
      status: 'opposition',
    });
  });

  it('round-trips a quest with objectives', async () => {
    const store = createServerBundleStore(CAMPAIGN);
    await store.load();
    const added = await store.addItem('quest', {
      title: 'Find the relic',
      status: 'active',
      priority: 'high',
      summary: 'Somewhere below',
      objectives: [
        { title: 'Second', order: 2, status: 'pending' },
        { title: 'First', order: 1, status: 'complete' },
      ],
    });
    const bundle = await createServerBundleStore(CAMPAIGN).load();
    const quest = bundle.quests[0];
    expect(quest).toMatchObject({
      id: added.id,
      status: 'active',
      priority: 'high',
    });
    expect(bundle.objectives.map((objective) => objective.title)).toEqual([
      'First',
      'Second',
    ]);
    expect(quest.objectiveIds).toEqual(bundle.objectives.map((o) => o.id));
    expect(bundle.objectives[0].questId).toBe(added.id);
  });

  it('round-trips a location', async () => {
    const store = createServerBundleStore(CAMPAIGN);
    await store.load();
    const added = await store.addItem('location', {
      name: 'Glass Harbor',
      type: 'harbor',
      shortDescription: 'A port',
      description: ['Wet.', 'Windy.'],
      tags: ['port'],
    });
    const bundle = await createServerBundleStore(CAMPAIGN).load();
    expect(bundle.locations[0]).toMatchObject({
      id: added.id,
      name: 'Glass Harbor',
      description: ['Wet.', 'Windy.'],
      tags: ['port'],
    });
  });

  it('round-trips a note with anchor and sticky defaults', async () => {
    const store = createServerBundleStore(CAMPAIGN);
    await store.load();
    const added = await store.addItem('note', {
      title: 'The Sundering',
      body: 'First para.\n\nSecond para.',
      anchor: { type: 'session', id: 'sp-9' },
    });
    const raw = server.objects.get(added.id!)!;
    expect(raw.kind).toBe('note');
    expect(raw.data.visibility).toBe('dm-only');
    const bundle = await createServerBundleStore(CAMPAIGN).load();
    expect(bundle.notes[0]).toMatchObject({
      id: added.id,
      title: 'The Sundering',
      body: 'First para.\n\nSecond para.',
      anchor: { type: 'session', id: 'sp-9' },
      color: 'yellow',
      size: 'small',
      order: 0,
    });
    expect(bundle.notes[0].audience).toBe('none');
  });

  it('maps note audience to players visibility and back', async () => {
    const store = createServerBundleStore(CAMPAIGN);
    await store.load();
    const added = await store.addItem('note', {
      title: 'Letter',
      body: 'Dear party',
      audience: 'all',
    });
    expect(server.objects.get(added.id!)!.data.visibility).toBe('players');
    expect(
      (await store.updateItem('note', added.id!, { audience: ['pc-1'] })).ok,
    ).toBe(true);
    let bundle = await createServerBundleStore(CAMPAIGN).load();
    expect(bundle.notes[0].audience).toEqual(['pc-1']);
    expect(server.objects.get(added.id!)!.data.visibility).toBe('players');
    await store.updateItem('note', added.id!, { audience: 'none' });
    bundle = await createServerBundleStore(CAMPAIGN).load();
    expect(bundle.notes[0].audience).toBe('none');
    expect(server.objects.get(added.id!)!.data.visibility).toBe('dm-only');
  });

  it('maps scene templates, maps and session plans from the list only', async () => {
    server.put('scene-template', { id: 'st-1', title: 'Docks' });
    server.put('campaign-map', { id: 'map-1', title: 'Region' });
    server.put('session-plan', { id: 'sp-1', title: 'Session 1' }, 'ready');
    const bundle = await createServerBundleStore(CAMPAIGN).load();
    expect(bundle.sceneTemplates).toEqual([{ id: 'st-1', title: 'Docks' }]);
    expect(bundle.maps[0]).toMatchObject({ id: 'map-1', title: 'Region' });
    expect(bundle.sessions[0]).toMatchObject({
      id: 'sp-1',
      title: 'Session 1',
      status: 'planned',
    });
    expect(server.calls.some((call) => call.path.endsWith('/st-1'))).toBe(
      false,
    );
  });

  it('round-trips acts, sessions, encounters and party members', async () => {
    const store = createServerBundleStore(CAMPAIGN);
    await store.load();
    const act = await store.addItem('act', {
      title: 'Act I',
      summary: 'The harbor',
    });
    const npc = await store.addItem('npc', { name: 'Mira' });
    const quest = await store.addItem('quest', { title: 'Find the key' });
    const encounter = await store.addItem('encounter', {
      title: 'Dock ambush',
      kind: 'combat',
      difficulty: 'high',
      composition: [
        { name: 'Thug', count: 3, ruleset: '2024', role: 'brute' },
      ],
      trigger: 'Players enter the pier',
    });
    const session = await store.addItem('session', {
      title: 'Session One',
      actId: act.id,
      npcIds: [npc.id],
      questIds: [quest.id],
      encounterIds: [encounter.id],
      status: 'planned',
      summary: 'Arrival',
    });
    const member = await store.addItem('party-member', {
      name: 'Tamsin',
      className: 'Rogue',
      level: 3,
      hook: 'Owes a debt',
    });
    for (const result of [act, encounter, session, member]) {
      expect(result.ok).toBe(true);
    }
    expect(
      [...server.objects.values()].map((object) => object.kind).sort(),
    ).toEqual(['act', 'encounter', 'npc', 'party-member', 'quest', 'session']);

    const bundle = await createServerBundleStore(CAMPAIGN).load();
    expect(bundle.acts).toHaveLength(1);
    expect(bundle.acts[0]).toMatchObject({ title: 'Act I', summary: 'The harbor' });
    expect(bundle.sessions).toHaveLength(1);
    expect(bundle.sessions[0]).toMatchObject({
      id: session.id,
      number: 1,
      actId: act.id,
      status: 'planned',
      npcIds: [npc.id],
      questIds: [quest.id],
      encounterIds: [encounter.id],
    });
    expect(bundle.encounters[0]).toMatchObject({
      title: 'Dock ambush',
      difficulty: 'high',
      composition: [{ name: 'Thug', count: 3, ruleset: '2024', role: 'brute' }],
      sessionIds: [session.id],
    });
    // Reverse links are derived from the session, never persisted.
    expect(bundle.npcs[0].sessionIds).toEqual([session.id]);
    expect(bundle.quests[0].sessionIds).toEqual([session.id]);
    expect(bundle.campaign.playerCharacters).toEqual([
      expect.objectContaining({ name: 'Tamsin', className: 'Rogue', level: 3 }),
    ]);
    expect(bundle.campaign.actIds).toEqual([act.id]);
    expect(bundle.campaign.objectCounts.encounters).toBe(1);
    const npcData = server.objects.get(String(npc.id))!.data;
    expect(JSON.stringify(npcData)).not.toContain('sessionIds');
  });

  it('numbers new sessions and orders new acts sequentially', async () => {
    const store = createServerBundleStore(CAMPAIGN);
    await store.load();
    await store.addItem('session', { title: 'One' });
    await store.addItem('session', { title: 'Two' });
    await store.addItem('act', { title: 'A1' });
    await store.addItem('act', { title: 'A2' });
    const bundle = store.getBundle();
    expect(bundle.sessions.map((session) => session.number)).toEqual([1, 2]);
    expect(bundle.acts.map((act) => act.order)).toEqual([0, 1]);
  });

  it('attaches a session-plan to its session and lists unattached plans after', async () => {
    server.put('session-plan', { id: 'sp-1', title: 'Plan A' }, 'ready');
    server.put('session-plan', { id: 'sp-2', title: 'Plan B' }, 'draft');
    const store = createServerBundleStore(CAMPAIGN);
    await store.load();
    await store.addItem('session', { title: 'Opening night', planId: 'sp-1' });
    const bundle = await createServerBundleStore(CAMPAIGN).load();
    expect(bundle.sessions.map((session) => session.title)).toEqual([
      'Opening night',
      'Plan B',
    ]);
    expect(bundle.sessions[1].number).toBe(2);
  });

  it('revises a session with a revision check and reports conflicts', async () => {
    const store = createServerBundleStore(CAMPAIGN);
    await store.load();
    const added = await store.addItem('session', { title: 'One' });
    const saved = await store.updateItem('session', String(added.id), {
      summary: 'Updated',
    });
    expect(saved.ok).toBe(true);
    expect(server.objects.get(String(added.id))!.currentRevision).toBe(2);
    server.bump409 = true;
    const conflict = await store.updateItem('session', String(added.id), {
      summary: 'Again',
    });
    expect(conflict).toMatchObject({ ok: false, conflict: true });
  });

  it('falls back to plain text for objects created elsewhere and skips retired', async () => {
    server.put('npc', {
      id: 'n-1',
      title: 'Foreign',
      visibility: 'dm-only',
      tags: ['x'],
      content: {
        format: 'lexical',
        schemaVersion: 1,
        value: {
          root: {
            children: [{ type: 'paragraph', children: [{ text: 'Hello' }] }],
          },
        },
      },
    });
    server.put('npc', { id: 'n-2', title: 'Gone' }, 'retired');
    server.put('note', {
      id: 'note-1',
      title: 'Plan note',
      visibility: 'dm-only',
      content: {
        format: 'lexical',
        schemaVersion: 1,
        value: {
          root: {
            children: [{ type: 'paragraph', children: [{ text: 'Shared' }] }],
          },
        },
      },
    });
    const bundle = await createServerBundleStore(CAMPAIGN).load();
    expect(bundle.npcs).toHaveLength(1);
    expect(bundle.npcs[0]).toMatchObject({
      name: 'Foreign',
      motivation: 'Hello',
      tags: ['x'],
    });
    expect(bundle.notes[0]).toMatchObject({
      title: 'Plan note',
      body: 'Shared',
      anchor: { type: 'campaign' },
      color: 'yellow',
      size: 'small',
    });
    expect(server.objects.get('note-1')!.kind).toBe('note');
  });
});

describe('sticky notes', () => {
  it('stores color and size, assigns order = max + 1, and sorts on load', async () => {
    const store = createServerBundleStore(CAMPAIGN);
    await store.load();
    const a = await store.addItem('note', { title: 'A', color: 'pink' });
    await store.addItem('note', { title: 'B', color: 'green', size: 'large' });
    const c = await store.addItem('note', { title: 'C' });
    expect(server.objects.get(c.id!)!.data.content).toMatchObject({
      value: { nexusStudio: { fields: { order: 2, color: 'yellow' } } },
    });
    const bundle = await createServerBundleStore(CAMPAIGN).load();
    expect(
      bundle.notes.map((n) => [n.title, n.color, n.size, n.order]),
    ).toEqual([
      ['A', 'pink', 'small', 0],
      ['B', 'green', 'large', 1],
      ['C', 'yellow', 'small', 2],
    ]);
    const patched = await store.updateItem('note', a.id!, {
      color: 'blue',
      size: 'medium',
    });
    expect(patched.ok).toBe(true);
    expect(store.getBundle().notes.find((n) => n.id === a.id)).toMatchObject({
      color: 'blue',
      size: 'medium',
    });
  });

  it('defaults invalid color and size', async () => {
    const store = createServerBundleStore(CAMPAIGN);
    await store.load();
    await store.addItem('note', { title: 'A', color: 'teal', size: 'huge' });
    expect(store.getBundle().notes[0]).toMatchObject({
      color: 'yellow',
      size: 'small',
    });
  });

  async function board() {
    const store = createServerBundleStore(CAMPAIGN);
    await store.load();
    const ids: string[] = [];
    for (const title of ['A', 'B', 'C', 'D']) {
      ids.push((await store.addItem('note', { title })).id!);
    }
    return { store, ids };
  }

  it('reorders the whole board with revision checks', async () => {
    const { store, ids } = await board();
    server.calls.length = 0;
    const result = await store.reorderNotes([ids[3], ids[2], ids[1], ids[0]]);
    expect(result.ok).toBe(true);
    expect(store.getBundle().notes.map((n) => n.title)).toEqual([
      'D',
      'C',
      'B',
      'A',
    ]);
    const fresh = await createServerBundleStore(CAMPAIGN).load();
    expect(fresh.notes.map((n) => n.title)).toEqual(['D', 'C', 'B', 'A']);
    expect(
      server.calls
        .filter((call) => call.method === 'PUT')
        .every((call) => call.body?.expectedRevision === 1),
    ).toBe(true);
  });

  it('reorders a filtered subset within the slots it occupies', async () => {
    const { store, ids } = await board();
    const result = await store.reorderNotes([ids[2], ids[0]]);
    expect(result.ok).toBe(true);
    expect(store.getBundle().notes.map((n) => n.title)).toEqual([
      'C',
      'B',
      'A',
      'D',
    ]);
    expect(server.calls.filter((call) => call.method === 'PUT')).toHaveLength(
      2,
    );
  });

  it('reports conflicts and partial failure', async () => {
    const { store, ids } = await board();
    server.objects.get(ids[3])!.currentRevision = 9;
    const result = await store.reorderNotes([ids[3], ids[2], ids[1], ids[0]]);
    expect(result.ok).toBe(false);
    expect(result.conflict).toBe(true);
    expect(result.failedIds).toEqual([ids[3]]);
    expect(result.error).toMatch(/1 of 4/);
    expect(store.getBundle().notes.find((n) => n.id === ids[2])!.order).toBe(1);
  });

  it('rejects unknown ids', async () => {
    const { store } = await board();
    expect((await store.reorderNotes(['nope'])).ok).toBe(false);
  });
});

describe('handouts and folders', () => {
  it('stores a handout as lore/handout with hidden default and folder order', async () => {
    const store = createServerBundleStore(CAMPAIGN);
    await store.load();
    const folder = await store.addItem('handout-folder', { title: 'Act 1' });
    const first = await store.addItem('handout', {
      title: 'Letter',
      body: 'Dear all\n\nBye',
      folderId: folder.id,
    });
    const second = await store.addItem('handout', {
      title: 'Map scrap',
      folderId: folder.id,
    });
    const raw = server.objects.get(first.id!)!;
    expect(raw.kind).toBe('lore');
    expect(raw.data.visibility).toBe('dm-only');
    expect(raw.data.content).toMatchObject({
      value: {
        nexusStudio: {
          fields: {
            subtype: 'handout',
            audience: 'hidden',
            folderId: folder.id,
            order: 0,
          },
        },
      },
    });
    expect(server.objects.get(folder.id!)!.data.content).toMatchObject({
      value: {
        nexusStudio: { fields: { subtype: 'handout-folder', order: 0 } },
      },
    });
    const bundle = await createServerBundleStore(CAMPAIGN).load();
    expect(bundle.handouts.map((h) => [h.title, h.order, h.audience])).toEqual([
      ['Letter', 0, 'hidden'],
      ['Map scrap', 1, 'hidden'],
    ]);
    expect(bundle.handouts[0]).toMatchObject({
      kind: 'handout',
      body: 'Dear all\n\nBye',
      content: ['Dear all', 'Bye'],
      folderId: folder.id,
      visibility: 'dm-only',
    });
    expect(bundle.folders).toHaveLength(1);
    expect(bundle.folders[0]).toMatchObject({
      id: folder.id,
      title: 'Act 1',
      kind: 'handout-folder',
      objectIds: [first.id, second.id],
    });
    expect(bundle.notes).toEqual([]);
    expect(bundle.campaign.objectCounts.handouts).toBe(2);
  });

  it('maps audience all and character-id lists to players visibility', async () => {
    const store = createServerBundleStore(CAMPAIGN);
    await store.load();
    const added = await store.addItem('handout', {
      title: 'Letter',
      audience: 'all',
    });
    expect(server.objects.get(added.id!)!.data.visibility).toBe('players');
    expect(store.getBundle().handouts[0].visibility).toBe('shared');
    expect(
      (
        await store.updateItem('handout', added.id!, {
          audience: ['pc-1', 'pc-2'],
        })
      ).ok,
    ).toBe(true);
    let bundle = await createServerBundleStore(CAMPAIGN).load();
    expect(bundle.handouts[0].audience).toEqual(['pc-1', 'pc-2']);
    expect(server.objects.get(added.id!)!.data.visibility).toBe('players');
    expect(
      (await store.updateItem('handout', added.id!, { audience: 'hidden' })).ok,
    ).toBe(true);
    bundle = await createServerBundleStore(CAMPAIGN).load();
    expect(bundle.handouts[0].audience).toBe('hidden');
    expect(server.objects.get(added.id!)!.data.visibility).toBe('dm-only');
  });

  it('renames folders and moves handouts with revision checks', async () => {
    const store = createServerBundleStore(CAMPAIGN);
    await store.load();
    const a = await store.addItem('handout-folder', { title: 'A' });
    const b = await store.addItem('handout-folder', { title: 'B' });
    const h = await store.addItem('handout', { title: 'H', folderId: a.id });
    expect(
      (await store.updateItem('handout-folder', a.id!, { title: 'A2' })).ok,
    ).toBe(true);
    expect(
      (await store.updateItem('handout', h.id!, { folderId: b.id })).ok,
    ).toBe(true);
    const bundle = await createServerBundleStore(CAMPAIGN).load();
    expect(bundle.folders.map((f) => [f.title, f.objectIds.length])).toEqual([
      ['A2', 0],
      ['B', 1],
    ]);
    server.objects.get(h.id!)!.currentRevision = 8;
    const conflict = await store.updateItem('handout', h.id!, { title: 'X' });
    expect(conflict.conflict).toBe(true);
  });

  it('loads a foreign lore object as a handout', async () => {
    server.put('lore', {
      id: 'l-1',
      title: 'Old lore',
      visibility: 'players',
      content: {
        format: 'lexical',
        schemaVersion: 1,
        value: {
          root: {
            children: [{ type: 'paragraph', children: [{ text: 'Text' }] }],
          },
        },
      },
    });
    const bundle = await createServerBundleStore(CAMPAIGN).load();
    expect(bundle.handouts[0]).toMatchObject({
      title: 'Old lore',
      body: 'Text',
      audience: 'all',
    });
  });
});

describe('updateItem', () => {
  it('sends expectedRevision + 1 payload and tracks the new revision', async () => {
    const store = createServerBundleStore(CAMPAIGN);
    await store.load();
    const added = await store.addItem('npc', { name: 'Mira' });
    expect((await store.updateItem('npc', added.id!, { role: 'A' })).ok).toBe(
      true,
    );
    expect((await store.updateItem('npc', added.id!, { role: 'B' })).ok).toBe(
      true,
    );
    const puts = server.calls.filter((call) => call.method === 'PUT');
    expect(puts.map((call) => call.body?.expectedRevision)).toEqual([1, 2]);
    expect((puts[1].body?.data as { revision: number }).revision).toBe(3);
    expect(
      (store.getBundle().npcs[0] as unknown as { role: string }).role,
    ).toBe('B');
    expect(server.objects.get(added.id!)!.currentRevision).toBe(3);
  });

  it('reports a conflict on 409 and leaves local state untouched', async () => {
    const store = createServerBundleStore(CAMPAIGN);
    await store.load();
    const added = await store.addItem('npc', { name: 'Mira', role: 'Old' });
    server.objects.get(added.id!)!.currentRevision = 5; // changed elsewhere
    const result = await store.updateItem('npc', added.id!, { role: 'New' });
    expect(result.ok).toBe(false);
    expect(result.conflict).toBe(true);
    expect(
      (store.getBundle().npcs[0] as unknown as { role: string }).role,
    ).toBe('Old');
    await store.reload();
    const retry = await store.updateItem('npc', added.id!, { role: 'New' });
    expect(retry.ok).toBe(true);
  });

  it('returns an error for unknown ids, empty titles and server rejections', async () => {
    const store = createServerBundleStore(CAMPAIGN);
    await store.load();
    expect((await store.updateItem('npc', 'nope', {})).error).toBe('not-found');
    const added = await store.addItem('npc', { name: 'Mira' });
    expect(
      (await store.updateItem('npc', added.id!, { name: '  ' })).error,
    ).toMatch(/title/i);
    server.failTitles.add('Bad');
    const bad = await store.addItem('npc', { name: 'Bad' });
    expect(bad.ok).toBe(false);
    expect(bad.conflict).toBeUndefined();
    expect(bad.error).toBe('boom');
  });

  it('uses a UUID requestId on creates', async () => {
    const store = createServerBundleStore(CAMPAIGN);
    await store.load();
    await store.addItem('faction', { name: 'F' });
    const post = server.calls.find((call) => call.method === 'POST')!;
    expect(post.body?.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(post.body?.kind).toBe('faction');
  });
});

describe('seedFromFixture', () => {
  it('creates a campaign named after the example and copies content', async () => {
    const fixture = getFixtureBundle('ashes-of-veyra')!;
    const result = await seedFromFixture('ashes-of-veyra');
    expect(result.failed).toEqual([]);
    expect(server.campaigns[0].name).toBe(fixture.campaign.title);
    const expected =
      fixture.npcs.length +
      fixture.factions.length +
      fixture.quests.length +
      fixture.locations.length;
    const byKind = (kind: string) =>
      [...server.objects.values()].filter((object) => object.kind === kind);
    // Lore and handouts are notes now: no lore/handout objects are created.
    expect(byKind('lore')).toHaveLength(0);
    expect(byKind('note').length).toBeGreaterThanOrEqual(fixture.notes.length);
    expect(result.created).toBe(server.objects.size);
    expect(server.objects.size).toBe(expected + byKind('note').length);
    expect(
      [...server.objects.values()].some((object) =>
        ['encounter', 'session-plan', 'campaign-map'].includes(object.kind),
      ),
    ).toBe(false);

    const seeded = await createServerBundleStore({
      ...CAMPAIGN,
      id: result.campaignId,
    }).load();
    expect(seeded.npcs).toHaveLength(fixture.npcs.length);
    expect(seeded.quests).toHaveLength(fixture.quests.length);
    expect(seeded.objectives.length).toBe(fixture.objectives.length);

    const ids = new Set(
      [
        ...seeded.npcs,
        ...seeded.factions,
        ...seeded.locations,
        ...seeded.quests,
      ].map((item) => item.id),
    );
    // References are remapped onto the new ids, never fixture ids.
    for (const faction of seeded.factions) {
      for (const ref of [
        ...faction.alliedFactionIds,
        ...faction.rivalFactionIds,
        ...faction.locationIds,
      ]) {
        expect(ids.has(ref)).toBe(true);
      }
    }
    for (const quest of seeded.quests) {
      if (quest.giverNpcId) expect(ids.has(quest.giverNpcId)).toBe(true);
    }
  });

  it('keeps going after a failed item and reports what failed', async () => {
    const fixture = getFixtureBundle('ashes-of-veyra')!;
    const failing = fixture.npcs[0];
    server.failTitles.add(failing.name);
    // npc titles are sent as `title` in the payload.
    const result = await seedFromFixture('ashes-of-veyra');
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]).toMatchObject({
      kind: 'npc',
      id: failing.id,
      title: failing.name,
    });
    expect(result.created).toBe(server.objects.size);
    expect(result.created).toBeGreaterThan(fixture.npcs.length);
    expect(server.objects.has(failing.id)).toBe(false);
  });

  it('seeds lore and handouts as notes with audience, plus clue notes', async () => {
    const fixture = getFixtureBundle('ashes-of-veyra')!;
    const result = await seedFromFixture('ashes-of-veyra');
    const seeded = await createServerBundleStore({
      ...CAMPAIGN,
      id: result.campaignId,
    }).load();
    expect(seeded.handouts).toHaveLength(0);
    expect(seeded.folders).toHaveLength(0);
    for (const source of fixture.handouts) {
      const copy = seeded.notes.find((note) => note.title === source.title)!;
      expect(copy.audience).toBe(source.kind === 'handout' ? 'all' : 'none');
    }
    expect(
      [...server.objects.values()]
        .filter((object) => object.kind === 'note')
        .every(
          (object) =>
            object.data.visibility ===
            (object.data.title &&
            fixture.handouts.some(
              (h) => h.kind === 'handout' && h.title === object.data.title,
            )
              ? 'players'
              : 'dm-only'),
        ),
    ).toBe(true);
    expect(seeded.notes.every((note) => note.anchor.type === 'campaign')).toBe(
      true,
    );
    const orders = seeded.notes.map((n) => n.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    if (fixture.clues.length > 0) {
      const clueNotes = seeded.notes.filter((note) =>
        note.title.startsWith('Clues'),
      );
      expect(clueNotes.length).toBeGreaterThan(0);
      expect(clueNotes.map((note) => note.body).join('\n')).toContain(
        fixture.clues[0].title,
      );
    }
  });

  it('derives read-only fixture notes: lore private, handouts shared', () => {
    const fixture = getFixtureBundle('ashes-of-veyra')!;
    expect(fixture.notes).toHaveLength(fixture.handouts.length);
    fixture.notes.forEach((note, index) => {
      expect(note).toMatchObject({ anchor: { type: 'campaign' }, order: index });
      const source = fixture.handouts.find((item) => item.id === note.id)!;
      expect(note.audience).toBe(source.kind === 'handout' ? 'all' : 'none');
    });
    expect(fixture.notes.some((note) => note.audience === 'all')).toBe(true);
    expect(fixture.notes.some((note) => note.audience === 'none')).toBe(true);
    for (const handout of fixture.handouts) {
      expect(handout.audience).toBe(
        handout.visibility === 'shared' ? 'all' : 'hidden',
      );
    }
  });

  it('rejects unknown examples', async () => {
    await expect(seedFromFixture('nope')).rejects.toThrow(/Unknown example/);
  });
});
