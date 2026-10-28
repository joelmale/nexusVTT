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

  it('indexes secrets, inboxNotes, homebrewMonsters, and items with expected routes and backlinks', () => {
    const targetNpc = ashes.npcs[0]!;
    const longSecretText =
      'The harbor watch captain secretly sold the lighthouse cipher to the Crimson Wake before the storm.';
    const bundle = {
      ...ashes,
      secrets: [
        {
          id: 'secret-harbor-cipher',
          campaignId: ashes.campaignId,
          text: `${longSecretText} @[${targetNpc.name}](ref:${targetNpc.id})`,
          attachedTo: [{ kind: 'npc', id: targetNpc.id }],
          revealed: false,
          revealedInSessionId: ashes.sessions[0]!.id,
        },
      ],
      inboxNotes: [
        {
          id: 'inbox-dockside-rumor',
          campaignId: ashes.campaignId,
          text: `Check dockside rumor about @[${targetNpc.name}](ref:${targetNpc.id})`,
          createdAt: '2026-10-01T00:00:00Z',
          triagedTo: { kind: 'npc', id: targetNpc.id },
        },
      ],
      homebrewMonsters: [
        {
          id: 'monster-ash-horror',
          campaignId: ashes.campaignId,
          name: 'Ash-Stained Horror',
          size: 'Large',
          type: 'aberration',
          cr: '5',
          ac: 15,
          hp: 95,
          speed: 30,
          abilities: [18, 12, 16, 8, 14, 10] as [
            number,
            number,
            number,
            number,
            number,
            number,
          ],
          edition: '2024' as const,
          notes: `Hunts @[${targetNpc.name}](ref:${targetNpc.id}) across the fog.`,
        },
      ],
      items: [
        {
          id: 'item-lighthouse-key',
          campaignId: ashes.campaignId,
          name: 'Lighthouse Brass Key',
          itemType: 'treasure' as const,
          rarity: 'rare' as const,
          requiresAttunement: false,
          quantity: 1,
          description: `Held by @[${targetNpc.name}](ref:${targetNpc.id}).`,
          holder: { kind: 'npc' as const, id: targetNpc.id },
          discovered: true,
          identified: true,
          questIds: [ashes.quests[0]!.id],
          sessionId: ashes.sessions[0]!.id,
        },
      ],
    };

    expect(resolveEntity(bundle, 'secret-harbor-cipher')).toEqual({
      id: 'secret-harbor-cipher',
      kind: 'secret',
      label: `${longSecretText} @[${targetNpc.name}](ref:${targetNpc.id})`.slice(
        0,
        60,
      ),
      href: '/notes?tab=secrets',
    });

    expect(resolveEntity(bundle, 'inbox-dockside-rumor')).toEqual({
      id: 'inbox-dockside-rumor',
      kind: 'note',
      label: `Check dockside rumor about @[${targetNpc.name}](ref:${targetNpc.id})`.slice(
        0,
        60,
      ),
      href: '/notes?tab=inbox',
    });

    expect(resolveEntity(bundle, 'monster-ash-horror')).toEqual({
      id: 'monster-ash-horror',
      kind: 'encounter',
      label: 'Ash-Stained Horror',
      href: '/encounters?tab=bestiary',
    });

    expect(resolveEntity(bundle, 'item-lighthouse-key')).toEqual({
      id: 'item-lighthouse-key',
      kind: 'item',
      label: 'Lighthouse Brass Key',
      href: '/items/item-lighthouse-key',
    });

    const npcBacklinkIds = getBacklinks(bundle, targetNpc.id).map((r) => r.id);
    expect(npcBacklinkIds).toContain('secret-harbor-cipher');
    expect(npcBacklinkIds).toContain('inbox-dockside-rumor');
    expect(npcBacklinkIds).toContain('monster-ash-horror');
    expect(npcBacklinkIds).toContain('item-lighthouse-key');
  });
});
