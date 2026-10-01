import { describe, expect, it } from 'vitest';

import { getBacklinks, listEntities, resolveEntity } from './entityIndex';
import { getFixtureBundle, listFixtureBundles } from './registry';

const ashes = getFixtureBundle('ashes-of-veyra', 'test')!;

describe('entity index', () => {
  it('resolves entities with section-relative hrefs', () => {
    expect(resolveEntity(ashes, 'npc-captain-serin')).toEqual({
      id: 'npc-captain-serin',
      kind: 'npc',
      label: 'Captain Serin Dhal',
      href: '/npcs/npc-captain-serin',
    });
    expect(resolveEntity(ashes, 'map-glass-harbor')?.href).toBe(
      '/maps/map-glass-harbor',
    );
    expect(resolveEntity(ashes, 'does-not-exist')).toBeUndefined();
  });

  it('links objectives to their quest with an anchor', () => {
    const objective = ashes.objectives[0]!;
    expect(resolveEntity(ashes, objective.id)).toMatchObject({
      kind: 'objective',
      href: `/quests/${objective.questId}#objective-${objective.id}`,
    });
  });

  it('resolves scene templates without an href', () => {
    expect(resolveEntity(ashes, 'scene-salty-mast-cellar')).toEqual({
      id: 'scene-salty-mast-cellar',
      kind: 'scene',
      label: 'Salty Mast Cellar',
    });
  });

  it('inverts forward references into backlinks (Captain Serin)', () => {
    const backlinks = getBacklinks(ashes, 'npc-captain-serin');
    const quest = ashes.quests.find(
      (q) => q.giverNpcId === 'npc-captain-serin',
    );
    const session = ashes.sessions.find((s) =>
      s.npcIds.includes('npc-captain-serin'),
    );
    expect(quest).toBeDefined();
    expect(session).toBeDefined();
    expect(backlinks).toContainEqual(
      expect.objectContaining({ id: quest!.id, kind: 'quest' }),
    );
    expect(backlinks).toContainEqual(
      expect.objectContaining({ id: session!.id, kind: 'session' }),
    );
    expect(new Set(backlinks.map((ref) => ref.id)).size).toBe(backlinks.length);
  });

  it('surfaces links the source data does not mirror', () => {
    // Encounters carry no npcIds; the encounter still shows up on the location.
    const location = ashes.locations.find((l) => l.encounterIds.length > 0)!;
    const encounterId = location.encounterIds[0]!;
    expect(getBacklinks(ashes, encounterId).map((r) => r.id)).toContain(
      location.id,
    );
  });

  it('indexes every bundle without throwing and returns [] for unknown ids', () => {
    for (const bundle of listFixtureBundles('test')) {
      expect(getBacklinks(bundle, 'nope')).toEqual([]);
      for (const npc of bundle.npcs) {
        expect(resolveEntity(bundle, npc.id)?.kind).toBe('npc');
      }
    }
  });

  it('indexes notes and lists every entity of one campaign only', () => {
    const note = ashes.notes[0]!;
    expect(resolveEntity(ashes, note.id)).toMatchObject({
      kind: 'note',
      label: note.title,
      href: `/notes/${encodeURIComponent(note.id)}`,
    });
    const ids = new Set(listEntities(ashes).map((entity) => entity.id));
    expect(ids.has('npc-captain-serin')).toBe(true);
    const other = getFixtureBundle('crown-of-cinders', 'test')!;
    for (const entity of listEntities(other)) {
      expect(ids.has(entity.id)).toBe(false);
    }
  });

  it('turns @ mentions in free text into backlinks', () => {
    const target = ashes.npcs[0]!;
    const note = ashes.notes[0]!;
    const bundle = {
      ...ashes,
      notes: [
        { ...note, body: `Remember @[${target.name}](ref:${target.id}) and @[Gone](ref:missing-id).` },
        ...ashes.notes.slice(1),
      ],
    };
    expect(getBacklinks(bundle, target.id).map((ref) => ref.id)).toContain(note.id);
    // A mention of something that no longer exists links nowhere.
    expect(getBacklinks(bundle, 'missing-id').map((ref) => ref.id)).toEqual([note.id]);
    // The original bundle is untouched.
    expect(getBacklinks(ashes, 'missing-id')).toEqual([]);
  });
});
