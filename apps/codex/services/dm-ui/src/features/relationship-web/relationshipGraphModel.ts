import type { CampaignFixtureBundle } from '@/demo/fixture-registry';

export type GraphNodeKind =
  | 'npc'
  | 'faction'
  | 'location'
  | 'quest'
  | 'item'
  | 'encounter';

export interface GraphNode {
  id: string;
  label: string;
  kind: GraphNodeKind;
  subtitle: string;
  isPinned?: boolean;
  degree: number;
  x: number;
  y: number;
}

export type RelationshipKind =
  | 'ally'
  | 'rival'
  | 'member-of'
  | 'located-in'
  | 'holds'
  | 'wants';

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  kind: RelationshipKind;
  label: string;
}

export interface GraphModel {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphFilter {
  query?: string;
  nodeKind?: string;
  edgeKind?: string;
  focusedNodeId?: string;
}

export const RELATIONSHIP_LABELS: Record<RelationshipKind, string> = {
  ally: 'Ally',
  rival: 'Rival',
  'member-of': 'Member of',
  'located-in': 'Located in',
  holds: 'Holds',
  wants: 'Wants',
};

/**
 * Builds a cross-entity relationship graph from any CampaignBundle.
 */
export function buildRelationshipGraph(bundle: CampaignFixtureBundle): GraphModel {
  const nodeMap = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const edgeSet = new Set<string>();

  function addEdge(
    source: string,
    target: string,
    kind: RelationshipKind,
    label: string,
  ) {
    if (!source || !target || source === target) return;
    const key = `${source}->${target}:${kind}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push({
      id: `edge-${edges.length + 1}`,
      source,
      target,
      kind,
      label,
    });
  }

  const pinnedSet = new Set(bundle.pinnedObjectIds ?? []);

  // 1. Populate Nodes
  // NPCs
  for (const npc of bundle.npcs ?? []) {
    nodeMap.set(npc.id, {
      id: npc.id,
      label: npc.name,
      kind: 'npc',
      subtitle: npc.role ? `NPC · ${npc.role}` : 'NPC',
      isPinned: pinnedSet.has(npc.id),
      degree: 0,
      x: 0,
      y: 0,
    });
  }

  // Factions
  for (const faction of bundle.factions ?? []) {
    nodeMap.set(faction.id, {
      id: faction.id,
      label: faction.name,
      kind: 'faction',
      subtitle: faction.publicFace ? `Faction · ${faction.publicFace}` : 'Faction',
      isPinned: pinnedSet.has(faction.id),
      degree: 0,
      x: 0,
      y: 0,
    });
  }

  // Locations
  for (const loc of bundle.locations ?? []) {
    nodeMap.set(loc.id, {
      id: loc.id,
      label: loc.name,
      kind: 'location',
      subtitle: loc.type ? `Location · ${loc.type}` : 'Location',
      isPinned: pinnedSet.has(loc.id),
      degree: 0,
      x: 0,
      y: 0,
    });
  }

  // Quests
  for (const quest of bundle.quests ?? []) {
    nodeMap.set(quest.id, {
      id: quest.id,
      label: quest.title,
      kind: 'quest',
      subtitle: `Quest · ${quest.priority} priority`,
      isPinned: pinnedSet.has(quest.id),
      degree: 0,
      x: 0,
      y: 0,
    });
  }

  // Items
  for (const item of bundle.items ?? []) {
    nodeMap.set(item.id, {
      id: item.id,
      label: item.name,
      kind: 'item',
      subtitle: `Item · ${item.rarity ? `${item.rarity} ` : ''}${item.itemType ?? ''}`.trim(),
      isPinned: pinnedSet.has(item.id),
      degree: 0,
      x: 0,
      y: 0,
    });
  }

  // Encounters
  for (const enc of bundle.encounters ?? []) {
    nodeMap.set(enc.id, {
      id: enc.id,
      label: enc.title,
      kind: 'encounter',
      subtitle: `Encounter · ${enc.difficulty}`,
      isPinned: pinnedSet.has(enc.id),
      degree: 0,
      x: 0,
      y: 0,
    });
  }

  // 2. Populate Edges
  // Faction relations
  for (const faction of bundle.factions ?? []) {
    if (faction.leaderNpcId && nodeMap.has(faction.leaderNpcId)) {
      addEdge(faction.leaderNpcId, faction.id, 'member-of', 'Leads');
    }
    for (const allyId of faction.alliedFactionIds ?? []) {
      if (nodeMap.has(allyId)) {
        addEdge(faction.id, allyId, 'ally', 'Allied faction');
      }
    }
    for (const rivalId of faction.rivalFactionIds ?? []) {
      if (nodeMap.has(rivalId)) {
        addEdge(faction.id, rivalId, 'rival', 'Rival faction');
      }
    }
    for (const locId of faction.locationIds ?? []) {
      if (nodeMap.has(locId)) {
        addEdge(faction.id, locId, 'located-in', 'Headquartered in');
      }
    }
  }

  // NPC relations
  for (const npc of bundle.npcs ?? []) {
    for (const factionId of npc.factionIds ?? []) {
      if (nodeMap.has(factionId)) {
        addEdge(npc.id, factionId, 'member-of', 'Member of');
      }
    }
    for (const locId of npc.locationIds ?? []) {
      if (nodeMap.has(locId)) {
        addEdge(npc.id, locId, 'located-in', 'Located in');
      }
    }
    const relText = (npc.relationship ?? '').toLowerCase();
    if (relText.includes('ally')) {
      for (const [id, target] of nodeMap.entries()) {
        if (id !== npc.id && target.label && relText.includes(target.label.toLowerCase())) {
          addEdge(npc.id, id, 'ally', 'Ally');
        }
      }
    }
    if (relText.includes('rival') || relText.includes('enemy')) {
      for (const [id, target] of nodeMap.entries()) {
        if (id !== npc.id && target.label && relText.includes(target.label.toLowerCase())) {
          addEdge(npc.id, id, 'rival', 'Rival');
        }
      }
    }
  }

  // Location relations
  for (const loc of bundle.locations ?? []) {
    if (loc.parentLocationId && nodeMap.has(loc.parentLocationId)) {
      addEdge(loc.id, loc.parentLocationId, 'located-in', 'Within');
    }
  }

  // Quest relations
  for (const quest of bundle.quests ?? []) {
    if (quest.giverNpcId && nodeMap.has(quest.giverNpcId)) {
      addEdge(quest.giverNpcId, quest.id, 'wants', 'Gives quest');
    }
    for (const locId of quest.locationIds ?? []) {
      if (nodeMap.has(locId)) {
        addEdge(quest.id, locId, 'located-in', 'Takes place in');
      }
    }
    for (const factionId of quest.factionIds ?? []) {
      if (nodeMap.has(factionId)) {
        addEdge(quest.id, factionId, 'wants', 'Faction interest');
      }
    }
  }

  // Item relations
  for (const item of bundle.items ?? []) {
    if (item.holder?.id && nodeMap.has(item.holder.id)) {
      if (item.holder.kind === 'location') {
        addEdge(item.id, item.holder.id, 'located-in', 'Found in');
      } else {
        addEdge(item.holder.id, item.id, 'holds', 'Holds item');
      }
    }
    for (const questId of item.questIds ?? []) {
      if (nodeMap.has(questId)) {
        addEdge(questId, item.id, 'wants', 'Quest item');
      }
    }
  }

  // Encounter relations
  for (const enc of bundle.encounters ?? []) {
    for (const locId of enc.locationIds ?? []) {
      if (nodeMap.has(locId)) {
        addEdge(enc.id, locId, 'located-in', 'Takes place in');
      }
    }
    for (const factionId of enc.factionIds ?? []) {
      if (nodeMap.has(factionId)) {
        addEdge(enc.id, factionId, 'rival', 'Threatens');
      }
    }
  }

  // Calculate degrees
  for (const edge of edges) {
    const src = nodeMap.get(edge.source);
    const tgt = nodeMap.get(edge.target);
    if (src) src.degree += 1;
    if (tgt) tgt.degree += 1;
  }

  const nodes = Array.from(nodeMap.values());
  const laidOutNodes = layoutGraphNodes(nodes, edges);

  return {
    nodes: laidOutNodes,
    edges,
  };
}

/**
 * Deterministic cluster & circular radial layout algorithm.
 */
export function layoutGraphNodes(
  nodes: GraphNode[],
  _edges: GraphEdge[],
  width = 900,
  height = 650,
): GraphNode[] {
  if (nodes.length === 0) return [];

  const centerX = width / 2;
  const centerY = height / 2;

  // Group by kind for visual clustering
  const kindAngles: Record<GraphNodeKind, number> = {
    faction: 0,
    npc: (Math.PI * 2) / 6,
    quest: (Math.PI * 2 * 2) / 6,
    item: (Math.PI * 2 * 3) / 6,
    location: (Math.PI * 2 * 4) / 6,
    encounter: (Math.PI * 2 * 5) / 6,
  };

  const kindGroups = new Map<GraphNodeKind, GraphNode[]>();
  for (const node of nodes) {
    const list = kindGroups.get(node.kind) ?? [];
    list.push(node);
    kindGroups.set(node.kind, list);
  }

  const result: GraphNode[] = [];

  for (const [kind, group] of kindGroups.entries()) {
    const baseAngle = kindAngles[kind];
    const groupRadius = Math.min(width, height) * 0.38;

    group.forEach((node, idx) => {
      // Spread nodes within their cluster wedge
      const offsetAngle =
        group.length > 1
          ? ((idx - (group.length - 1) / 2) * (Math.PI / 4)) / Math.max(1, group.length - 1)
          : 0;

      const angle = baseAngle + offsetAngle;
      // Stagger radius slightly based on degree to prevent node collision
      const radius = groupRadius + (idx % 2 === 0 ? 30 : -30);

      const x = Math.round(centerX + Math.cos(angle) * radius);
      const y = Math.round(centerY + Math.sin(angle) * radius);

      result.push({
        ...node,
        x,
        y,
      });
    });
  }

  return result;
}

/**
 * Filter graph by text search query, entity kind, relationship kind, or focused node.
 */
export function filterGraph(
  graph: GraphModel,
  { query = '', nodeKind = 'all', edgeKind = 'all', focusedNodeId }: GraphFilter = {},
): GraphModel {
  const needle = query.trim().toLowerCase();

  // If focusedNodeId is provided, collect focused node and 1st-degree neighbours
  let allowedNodeIds: Set<string> | null = null;
  if (focusedNodeId) {
    allowedNodeIds = new Set<string>([focusedNodeId]);
    for (const edge of graph.edges) {
      if (edge.source === focusedNodeId) allowedNodeIds.add(edge.target);
      if (edge.target === focusedNodeId) allowedNodeIds.add(edge.source);
    }
  }

  // Filter nodes
  const filteredNodes = graph.nodes.filter((node) => {
    if (allowedNodeIds && !allowedNodeIds.has(node.id)) return false;
    if (nodeKind !== 'all' && node.kind !== nodeKind) return false;
    if (needle) {
      const matchLabel = (node.label ?? '').toLowerCase().includes(needle);
      const matchSub = (node.subtitle ?? '').toLowerCase().includes(needle);
      if (!matchLabel && !matchSub) return false;
    }
    return true;
  });

  const validNodeIds = new Set(filteredNodes.map((n) => n.id));

  // Filter edges
  const filteredEdges = graph.edges.filter((edge) => {
    if (!validNodeIds.has(edge.source) || !validNodeIds.has(edge.target)) {
      return false;
    }
    if (edgeKind !== 'all' && edge.kind !== edgeKind) return false;
    return true;
  });

  return {
    nodes: filteredNodes,
    edges: filteredEdges,
  };
}
