import { describe, expect, it } from 'vitest';
import type { CampaignFixtureBundle } from '@/demo/fixture-registry';
import {
  buildRelationshipGraph,
  filterGraph,
  layoutGraphNodes,
  RELATIONSHIP_LABELS,
} from './relationshipGraphModel';

describe('relationshipGraphModel', () => {
  const mockBundle: CampaignFixtureBundle = {
    slug: 'test-slug',
    campaignId: 'camp-1',
    lifecycle: 'active',
    catalog: {
      slug: 'test-slug',
      title: 'Test Campaign',
      summary: 'A test campaign',
      system: 'dnd5e',
      tags: [],
    },
    source: 'fixture',
    features: { publishSessionPlans: true },
    campaign: {
      id: 'camp-1',
      name: 'Test Campaign',
      tagline: 'A bold adventure',
      premise: 'Explore the depths',
      theme: 'mystery',
    },
    acts: [],
    sessions: [],
    npcs: [
      {
        id: 'npc-1',
        campaignId: 'camp-1',
        name: 'Aelar Silverleaf',
        role: 'Elven Emissary',
        ancestry: 'Elf',
        factionIds: ['fac-1'],
        locationIds: ['loc-1'],
        sessionIds: [],
        portraitFallback: '',
        tags: [],
        motivation: 'Peace',
        relationship: 'Ally of Bryn Blackwood. Rival of Corin Vane.',
      },
      {
        id: 'npc-2',
        campaignId: 'camp-1',
        name: 'Bryn Blackwood',
        role: 'Ranger',
        ancestry: 'Human',
        factionIds: ['fac-1'],
        locationIds: [],
        sessionIds: [],
        portraitFallback: '',
        tags: [],
        motivation: 'Survival',
        relationship: '',
      },
      {
        id: 'npc-3',
        campaignId: 'camp-1',
        name: 'Corin Vane',
        role: 'Mercenary Leader',
        ancestry: 'Human',
        factionIds: [],
        locationIds: [],
        sessionIds: [],
        portraitFallback: '',
        tags: [],
        motivation: 'Gold',
        relationship: '',
      },
    ],
    factions: [
      {
        id: 'fac-1',
        campaignId: 'camp-1',
        name: 'The Silver Harpers',
        publicFace: 'Protectors of the realm',
        hiddenAgenda: 'Keep vigilance',
        alliedFactionIds: ['fac-2'],
        rivalFactionIds: ['fac-3'],
        locationIds: ['loc-1'],
        questIds: [],
        status: 'ally',
      },
      {
        id: 'fac-2',
        campaignId: 'camp-1',
        name: 'The Circle of Dawn',
        publicFace: 'Sun monks',
        hiddenAgenda: 'Solar communion',
        alliedFactionIds: [],
        rivalFactionIds: [],
        locationIds: [],
        questIds: [],
        status: 'neutral',
      },
      {
        id: 'fac-3',
        campaignId: 'camp-1',
        name: 'Shadow Syndicate',
        publicFace: 'Merchant guild',
        hiddenAgenda: 'Black market',
        alliedFactionIds: [],
        rivalFactionIds: [],
        locationIds: [],
        questIds: [],
        status: 'opposition',
      },
    ],
    locations: [
      {
        id: 'loc-1',
        campaignId: 'camp-1',
        name: 'Silver Keep',
        summary: 'A towering fortress',
        parentLocationId: 'loc-2',
        type: 'fortress',
        tags: [],
        sessionIds: [],
      },
      {
        id: 'loc-2',
        campaignId: 'camp-1',
        name: 'Verdant Valley',
        summary: 'A sprawling province',
        type: 'region',
        tags: [],
        sessionIds: [],
      },
    ],
    quests: [
      {
        id: 'quest-1',
        campaignId: 'camp-1',
        title: 'Retrieve the Sun Blade',
        summary: 'Find the lost relic',
        status: 'active',
        priority: 'high',
        giverNpcId: 'npc-1',
        factionIds: ['fac-1'],
        locationIds: ['loc-1'],
        sessionIds: [],
        objectiveIds: [],
      },
    ],
    objectives: [],
    encounters: [
      {
        id: 'enc-1',
        campaignId: 'camp-1',
        title: 'Ambush at Dawn',
        kind: 'combat',
        difficulty: 'high',
        composition: [],
        trigger: 'Entering the valley',
        intendedUse: 'Main fight',
        sessionIds: [],
        locationIds: ['loc-1'],
        factionIds: [],
        tactics: 'Surround players',
        rulesetNotes: '',
      },
    ],
    items: [
      {
        id: 'item-1',
        campaignId: 'camp-1',
        name: 'Sun Blade',
        itemType: 'weapon',
        rarity: 'rare',
        requiresAttunement: true,
        quantity: 1,
        description: 'A blade of pure light.',
        holder: { kind: 'npc', id: 'npc-3' },
        discovered: true,
        identified: true,
        questIds: ['quest-1'],
      },
      {
        id: 'item-2',
        campaignId: 'camp-1',
        name: 'Potion of Healing',
        itemType: 'potion',
        rarity: 'common',
        requiresAttunement: false,
        quantity: 2,
        description: 'Restores 2d4+2 hit points.',
        holder: { kind: 'location', id: 'loc-1' },
        discovered: false,
        identified: true,
        questIds: [],
      },
    ],
    secrets: [
      {
        id: 'sec-1',
        campaignId: 'camp-1',
        text: 'The mayor is a doppelganger.',
        attachedTo: [{ kind: 'npc', id: 'npc-1' }],
        revealed: false,
      },
    ],
    clues: [],
    handouts: [],
    maps: [],
    pins: [],
    libraryObjects: [],
    folders: [],
    sceneTemplates: [],
    notes: [],
    pinnedObjectIds: ['npc-1', 'fac-1'],
  };

  it('exposes canonical relationship label dictionary', () => {
    expect(RELATIONSHIP_LABELS.ally).toBe('Ally');
    expect(RELATIONSHIP_LABELS.rival).toBe('Rival');
    expect(RELATIONSHIP_LABELS['member-of']).toBe('Member of');
    expect(RELATIONSHIP_LABELS['located-in']).toBe('Located in');
    expect(RELATIONSHIP_LABELS.holds).toBe('Holds');
    expect(RELATIONSHIP_LABELS.wants).toBe('Wants');
    expect(RELATIONSHIP_LABELS['attached-to']).toBe('Attached to');
  });

  describe('buildRelationshipGraph', () => {
    it('extracts all node kinds and tags pinned nodes', () => {
      const graph = buildRelationshipGraph(mockBundle);

      const aelar = graph.nodes.find((n) => n.id === 'npc-1');
      expect(aelar).toBeDefined();
      expect(aelar?.label).toBe('Aelar Silverleaf');
      expect(aelar?.kind).toBe('npc');
      expect(aelar?.isPinned).toBe(true);
      expect(aelar?.subtitle).toContain('NPC · Elven Emissary');

      const fac = graph.nodes.find((n) => n.id === 'fac-1');
      expect(fac).toBeDefined();
      expect(fac?.kind).toBe('faction');
      expect(fac?.isPinned).toBe(true);

      const sunBlade = graph.nodes.find((n) => n.id === 'item-1');
      expect(sunBlade).toBeDefined();
      expect(sunBlade?.kind).toBe('item');
      expect(sunBlade?.subtitle).toContain('rare weapon');

      const enc = graph.nodes.find((n) => n.id === 'enc-1');
      expect(enc).toBeDefined();
      expect(enc?.kind).toBe('encounter');

      const loc = graph.nodes.find((n) => n.id === 'loc-1');
      expect(loc).toBeDefined();
      expect(loc?.kind).toBe('location');
    });

    it('extracts edges across entities and computes node degrees', () => {
      const graph = buildRelationshipGraph(mockBundle);

      expect(graph.edges.length).toBeGreaterThan(0);

      // NPC-to-Faction member-of
      const memberEdge = graph.edges.find(
        (e) => e.source === 'npc-1' && e.target === 'fac-1' && e.kind === 'member-of',
      );
      expect(memberEdge).toBeDefined();

      // NPC-to-NPC ally
      const allyEdge = graph.edges.find(
        (e) => e.source === 'npc-1' && e.target === 'npc-2' && e.kind === 'ally',
      );
      expect(allyEdge).toBeDefined();

      // NPC-to-NPC rival
      const rivalEdge = graph.edges.find(
        (e) => e.source === 'npc-1' && e.target === 'npc-3' && e.kind === 'rival',
      );
      expect(rivalEdge).toBeDefined();

      // Faction-to-Faction ally
      const facAlly = graph.edges.find(
        (e) => e.source === 'fac-1' && e.target === 'fac-2' && e.kind === 'ally',
      );
      expect(facAlly).toBeDefined();

      // Item holder
      const itemHolder = graph.edges.find(
        (e) => e.source === 'npc-3' && e.target === 'item-1' && e.kind === 'holds',
      );
      expect(itemHolder).toBeDefined();

      // Item located-in
      const itemLoc = graph.edges.find(
        (e) => e.source === 'item-2' && e.target === 'loc-1' && e.kind === 'located-in',
      );
      expect(itemLoc).toBeDefined();

      // Quest relations
      const questGiver = graph.edges.find(
        (e) => e.source === 'npc-1' && e.target === 'quest-1' && e.kind === 'wants',
      );
      expect(questGiver).toBeDefined();

      // Node degree should reflect total incoming and outgoing edges
      const aelar = graph.nodes.find((n) => n.id === 'npc-1');
      expect(aelar?.degree).toBeGreaterThanOrEqual(4);
    });

    it('includes secrets and attachedTo edges when includeSecrets is true (CS-31)', () => {
      const graph = buildRelationshipGraph(mockBundle, { includeSecrets: true });

      const sec = graph.nodes.find((n) => n.id === 'sec-1');
      expect(sec).toBeDefined();
      expect(sec?.kind).toBe('secret');
      expect(sec?.label).toBe('The mayor is a doppelganger.');
      expect(sec?.subtitle).toContain('Secret · Unrevealed');

      const attachEdge = graph.edges.find(
        (e) => e.source === 'sec-1' && e.target === 'npc-1' && e.kind === 'attached-to',
      );
      expect(attachEdge).toBeDefined();
      expect(attachEdge?.label).toBe('Attached to');
    });

    it('excludes secrets when includeSecrets is false or omitted (CS-31)', () => {
      const defaultGraph = buildRelationshipGraph(mockBundle);
      expect(defaultGraph.nodes.some((n) => n.kind === 'secret')).toBe(false);
      expect(defaultGraph.edges.some((e) => e.kind === 'attached-to')).toBe(false);

      const explicitFalseGraph = buildRelationshipGraph(mockBundle, { includeSecrets: false });
      expect(explicitFalseGraph.nodes.some((n) => n.kind === 'secret')).toBe(false);
      expect(explicitFalseGraph.edges.some((e) => e.kind === 'attached-to')).toBe(false);
    });

    it('handles empty bundle gracefully', () => {
      const emptyBundle = {
        ...mockBundle,
        npcs: [],
        factions: [],
        locations: [],
        quests: [],
        encounters: [],
        items: [],
        secrets: [],
      };
      const graph = buildRelationshipGraph(emptyBundle);
      expect(graph.nodes).toEqual([]);
      expect(graph.edges).toEqual([]);
    });
  });

  describe('layoutGraphNodes', () => {
    it('returns empty array if no nodes', () => {
      expect(layoutGraphNodes([], [])).toEqual([]);
    });

    it('positions nodes deterministically with distinct coordinates', () => {
      const graph = buildRelationshipGraph(mockBundle);
      const positioned = layoutGraphNodes(graph.nodes, graph.edges, 800, 600);

      expect(positioned.length).toBe(graph.nodes.length);
      for (const node of positioned) {
        expect(typeof node.x).toBe('number');
        expect(typeof node.y).toBe('number');
        expect(Number.isFinite(node.x)).toBe(true);
        expect(Number.isFinite(node.y)).toBe(true);
      }

      // Consistent layout across calls
      const positionedAgain = layoutGraphNodes(graph.nodes, graph.edges, 800, 600);
      expect(positioned).toEqual(positionedAgain);
    });
  });

  describe('filterGraph', () => {
    it('filters nodes and connected edges by text search query', () => {
      const graph = buildRelationshipGraph(mockBundle);

      const filtered = filterGraph(graph, { query: 'Silverleaf' });
      expect(filtered.nodes).toHaveLength(1);
      expect(filtered.nodes[0].id).toBe('npc-1');
      // Edges only remain if both ends are in filtered nodes
      expect(filtered.edges).toHaveLength(0);
    });

    it('filters by node kind', () => {
      const graph = buildRelationshipGraph(mockBundle);

      const factionsOnly = filterGraph(graph, { nodeKind: 'faction' });
      expect(factionsOnly.nodes.every((n) => n.kind === 'faction')).toBe(true);
      expect(factionsOnly.nodes.length).toBe(3);
      expect(factionsOnly.edges.length).toBeGreaterThan(0);
      expect(factionsOnly.edges.some((e) => e.kind === 'ally')).toBe(true);
      expect(factionsOnly.edges.some((e) => e.kind === 'rival')).toBe(true);
    });

    it('filters by relationship kind', () => {
      const graph = buildRelationshipGraph(mockBundle);

      const rivalsOnly = filterGraph(graph, { edgeKind: 'rival' });
      expect(rivalsOnly.edges.every((e) => e.kind === 'rival')).toBe(true);
      expect(rivalsOnly.edges.length).toBeGreaterThan(0);
    });

    it('isolates 1st-degree neighborhood when focusedNodeId is provided', () => {
      const graph = buildRelationshipGraph(mockBundle);

      const focused = filterGraph(graph, { focusedNodeId: 'npc-1' });
      const focusedIds = new Set(focused.nodes.map((n) => n.id));

      expect(focusedIds.has('npc-1')).toBe(true);
      expect(focusedIds.has('npc-2')).toBe(true);
      expect(focusedIds.has('fac-1')).toBe(true);
      expect(focusedIds.has('loc-1')).toBe(true);
      expect(focusedIds.has('fac-2')).toBe(false);

      for (const edge of focused.edges) {
        expect(focusedIds.has(edge.source)).toBe(true);
        expect(focusedIds.has(edge.target)).toBe(true);
      }
    });
  });
});
