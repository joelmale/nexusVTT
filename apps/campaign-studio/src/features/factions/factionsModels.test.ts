import { describe, it, expect } from 'vitest';
import { getFixtureBundle } from '@/demo/fixture-registry';
import {
  buildFactionsModel,
  campaignFactionsToGeneratedFactions,
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

  describe('campaignFactionsToGeneratedFactions', () => {
    it('returns empty array when given no factions', () => {
      expect(campaignFactionsToGeneratedFactions([])).toEqual([]);
    });

    it('converts campaign factions into GeneratedFaction format', () => {
      const result = campaignFactionsToGeneratedFactions(bundle.factions);
      expect(result).toHaveLength(bundle.factions.length);

      for (let i = 0; i < bundle.factions.length; i++) {
        const original = bundle.factions[i]!;
        const converted = result[i]!;

        expect(converted.tempId).toBe(original.id);
        expect(converted.name).toBe(original.name);
        expect(converted.status).toBe(original.status);
        expect(converted.publicFace).toBe(original.publicFace);
        expect(converted.hiddenAgenda).toBe(original.hiddenAgenda);
        // Each faction should have relationships to all other factions
        expect(converted.relationships).toHaveLength(bundle.factions.length - 1);
      }
    });

    it('correctly maps alliances and rivalries with reciprocity', () => {
      const factions = [
        {
          id: 'f1',
          name: 'Faction 1',
          status: 'ally' as const,
          publicFace: 'Allied group with long description that gets truncated nicely',
          hiddenAgenda: 'Secret',
          leaderNpcId: null,
          alliedFactionIds: ['f2'],
          rivalFactionIds: ['f3'],
          locationIds: [],
          questIds: [],
          encounterIds: [],
        },
        {
          id: 'f2',
          name: 'Faction 2',
          status: 'ally' as const,
          publicFace: '',
          hiddenAgenda: '',
          leaderNpcId: null,
          alliedFactionIds: [], // reciprocal from f1
          rivalFactionIds: [],
          locationIds: [],
          questIds: [],
          encounterIds: [],
        },
        {
          id: 'f3',
          name: 'Faction 3',
          status: 'opposition' as const,
          publicFace: undefined,
          hiddenAgenda: undefined,
          leaderNpcId: null,
          alliedFactionIds: [],
          rivalFactionIds: [], // reciprocal rival from f1
          locationIds: [],
          questIds: [],
          encounterIds: [],
        },
        {
          id: 'f4',
          name: 'Faction 4',
          status: 'neutral' as const,
          publicFace: '',
          hiddenAgenda: '',
          leaderNpcId: null,
          alliedFactionIds: [],
          rivalFactionIds: [],
          locationIds: [],
          questIds: [],
          encounterIds: [],
        },
      ];

      const converted = campaignFactionsToGeneratedFactions(factions);

      // f1 relationships
      const f1 = converted.find((f) => f.tempId === 'f1')!;
      expect(f1.archetype).toBe('Allied group with long…');
      expect(f1.relationships.find((r) => r.targetTempId === 'f2')?.type).toBe('ally');
      expect(f1.relationships.find((r) => r.targetTempId === 'f3')?.type).toBe('rival');
      expect(f1.relationships.find((r) => r.targetTempId === 'f4')?.type).toBe('ambivalent');

      // f2 relationships (reciprocal ally to f1)
      const f2 = converted.find((f) => f.tempId === 'f2')!;
      expect(f2.archetype).toBe('Faction');
      expect(f2.relationships.find((r) => r.targetTempId === 'f1')?.type).toBe('ally');
      expect(f2.relationships.find((r) => r.targetTempId === 'f3')?.type).toBe('ambivalent');

      // f3 relationships (reciprocal rival to f1)
      const f3 = converted.find((f) => f.tempId === 'f3')!;
      expect(f3.archetype).toBe('Faction');
      expect(f3.relationships.find((r) => r.targetTempId === 'f1')?.type).toBe('rival');
    });
  });
});
