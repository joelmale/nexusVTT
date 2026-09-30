import { describe, it, expect } from 'vitest';
import { getFixtureBundle } from '@/demo/fixture-registry';
import {
  buildFactionsModel,
  sortedFactions,
  factionMembers,
  factionForwardIds,
} from './factionsModels';

describe('factionsModels', () => {
  const bundle = getFixtureBundle('ashes-of-veyra')!;

  describe('buildFactionsModel', () => {
    it('groups factions by status in order: opposition, unknown, neutral, ally', () => {
      const model = buildFactionsModel(bundle);
      const statusOrder = model.groups.map((g) => g.status);
      const expectedOrder = bundle.factions
        .map((f) => f.status)
        .filter((status, i, arr) => arr.indexOf(status) === i)
        .sort((a, b) => {
          const order = ['opposition', 'unknown', 'neutral', 'ally'];
          return order.indexOf(a) - order.indexOf(b);
        });
      expect(statusOrder).toEqual(expectedOrder);
    });

    it('includes all factions in each group', () => {
      const model = buildFactionsModel(bundle);
      const allFactions = model.groups.flatMap((g) => g.factions);
      expect(allFactions).toHaveLength(bundle.factions.length);
    });

    it('filters by status when query.status is set', () => {
      const model = buildFactionsModel(bundle, { status: 'ally' });
      const allFactions = model.groups.flatMap((g) => g.factions);
      expect(allFactions.every((f) => f.status === 'ally')).toBe(true);
    });

    it('filters by search query', () => {
      const factionName = bundle.factions[0]!.name.substring(0, 3).toLowerCase();
      const model = buildFactionsModel(bundle, { q: factionName });
      expect(model.visibleCount).toBeGreaterThan(0);
      const allFactions = model.groups.flatMap((g) => g.factions);
      expect(allFactions.some((f) =>
        f.name.toLowerCase().includes(factionName),
      )).toBe(true);
    });

    it('sorts by name within each status group', () => {
      const model = buildFactionsModel(bundle);
      for (const group of model.groups) {
        const names = group.factions.map((f) => f.name);
        const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
        expect(names).toEqual(sortedNames);
      }
    });

    it('sorts by member count within each status group when sort=members', () => {
      const model = buildFactionsModel(bundle, { sort: 'members' });
      for (const group of model.groups) {
        const factions = group.factions;
        for (let i = 1; i < factions.length; i++) {
          const prevMembers = factionMembers(bundle, factions[i - 1]!.id)
            .length;
          const currMembers = factionMembers(bundle, factions[i]!.id).length;
          expect(prevMembers).toBeGreaterThanOrEqual(currMembers);
        }
      }
    });

    it('provides stats by status', () => {
      const model = buildFactionsModel(bundle);
      expect(model.stats).toContainEqual(
        expect.objectContaining({ label: 'Allies' }),
      );
      expect(model.stats).toContainEqual(
        expect.objectContaining({ label: 'Opposition' }),
      );
      expect(model.stats).toContainEqual(
        expect.objectContaining({ label: 'Neutral' }),
      );
      expect(model.stats).toContainEqual(
        expect.objectContaining({ label: 'Unknown' }),
      );
    });

    it('sets defaultFactionId to the first sorted faction', () => {
      const model = buildFactionsModel(bundle);
      const first = sortedFactions(bundle)[0];
      expect(model.defaultFactionId).toBe(first?.id);
    });

    it('provides status and sort options', () => {
      const model = buildFactionsModel(bundle);
      expect(model.statusOptions).toHaveLength(4);
      expect(model.sortOptions).toHaveLength(2);
    });
  });

  describe('sortedFactions', () => {
    it('sorts by name when sort=name', () => {
      const factions = sortedFactions(bundle, 'name');
      const names = factions.map((f) => f.name);
      const expected = [...names].sort((a, b) => a.localeCompare(b));
      expect(names).toEqual(expected);
    });

    it('sorts by member count (descending) then name when sort=members', () => {
      const factions = sortedFactions(bundle, 'members');
      for (let i = 1; i < factions.length; i++) {
        const prevMembers = factionMembers(bundle, factions[i - 1]!.id).length;
        const currMembers = factionMembers(bundle, factions[i]!.id).length;
        expect(prevMembers).toBeGreaterThanOrEqual(currMembers);
      }
    });
  });

  describe('factionMembers', () => {
    it('returns NPCs that belong to the faction', () => {
      const faction = bundle.factions[0]!;
      const members = factionMembers(bundle, faction.id);
      expect(members.every((npc) => npc.factionIds.includes(faction.id))).toBe(
        true,
      );
    });

    it('returns empty array if no NPCs belong to the faction', () => {
      const emptyFaction = bundle.factions.find(
        (f) => factionMembers(bundle, f.id).length === 0,
      );
      if (emptyFaction) {
        const members = factionMembers(bundle, emptyFaction.id);
        expect(members).toHaveLength(0);
      }
    });
  });

  describe('factionForwardIds', () => {
    it('includes leader NPC id if present', () => {
      const factionWithLeader = bundle.factions.find(
        (f) => f.leaderNpcId,
      );
      if (factionWithLeader) {
        const ids = factionForwardIds(factionWithLeader);
        expect(ids).toContain(factionWithLeader.leaderNpcId);
      }
    });

    it('includes allied faction ids', () => {
      const factionWithAllies = bundle.factions.find(
        (f) => f.alliedFactionIds.length > 0,
      );
      if (factionWithAllies) {
        const ids = factionForwardIds(factionWithAllies);
        expect(ids).toEqual(
          expect.arrayContaining(factionWithAllies.alliedFactionIds),
        );
      }
    });

    it('includes rival faction ids', () => {
      const factionWithRivals = bundle.factions.find(
        (f) => f.rivalFactionIds.length > 0,
      );
      if (factionWithRivals) {
        const ids = factionForwardIds(factionWithRivals);
        expect(ids).toEqual(
          expect.arrayContaining(factionWithRivals.rivalFactionIds),
        );
      }
    });

    it('includes location and quest ids', () => {
      const faction = bundle.factions[0]!;
      const ids = factionForwardIds(faction);
      expect(ids).toEqual(
        expect.arrayContaining([
          ...faction.locationIds,
          ...faction.questIds,
        ]),
      );
    });
  });
});
