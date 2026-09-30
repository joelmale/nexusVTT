import { describe, expect, it } from 'vitest';

import { getBacklinks, resolveEntity } from './entityIndex';
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
});
