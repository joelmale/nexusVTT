import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import Network from 'lucide-react/dist/esm/icons/network';
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw';
import Search from 'lucide-react/dist/esm/icons/search';
import X from 'lucide-react/dist/esm/icons/x';
import ZoomIn from 'lucide-react/dist/esm/icons/zoom-in';
import ZoomOut from 'lucide-react/dist/esm/icons/zoom-out';

import { usePlayerView } from '@/features/player-view';
import { useSectionBundle } from '@/features/section-shell/SectionContext';
import styles from './RelationshipWebModal.module.css';
import {
  buildRelationshipGraph,
  filterGraph,
  layoutGraphNodes,
  RELATIONSHIP_LABELS,
  type GraphEdge,
  type GraphNode,
  type GraphNodeKind,
  type RelationshipKind,
} from './relationshipGraphModel';

export interface RelationshipWebModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFocusedNodeId?: string;
  onNavigateToEntity?: (kind: string, id: string) => void;
}

const NODE_KIND_COLORS: Record<GraphNodeKind, string> = {
  npc: 'var(--studio-positive)',
  faction: 'var(--studio-rarity-very-rare)',
  location: 'var(--studio-info)',
  quest: 'var(--studio-warning)',
  item: 'var(--studio-gold)',
  encounter: 'var(--studio-danger)',
  secret: 'var(--studio-accent, #8b5cf6)',
};

const RELATIONSHIP_COLORS: Record<RelationshipKind, string> = {
  ally: 'var(--studio-positive)',
  rival: 'var(--studio-danger)',
  'member-of': 'var(--studio-rarity-very-rare)',
  'located-in': 'var(--studio-info)',
  holds: 'var(--studio-gold)',
  wants: 'var(--studio-warning)',
  'attached-to': 'var(--studio-accent, #8b5cf6)',
};

const NODE_KIND_LETTERS: Record<GraphNodeKind, string> = {
  npc: 'N',
  faction: 'F',
  location: 'L',
  quest: 'Q',
  item: 'I',
  encounter: 'E',
  secret: 'S',
};

export function RelationshipWebModal({
  isOpen,
  onClose,
  initialFocusedNodeId,
  onNavigateToEntity,
}: RelationshipWebModalProps) {
  const { bundle, store } = useSectionBundle();
  const { isPlayerView } = usePlayerView();

  const [query, setQuery] = useState('');
  const [nodeKind, setNodeKind] = useState('all');
  const [edgeKind, setEdgeKind] = useState('all');
  const [focusedNodeId, setFocusedNodeId] = useState<string | undefined>(
    initialFocusedNodeId,
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(
    initialFocusedNodeId,
  );
  const [hoveredNodeId, setHoveredNodeId] = useState<string | undefined>();

  // Link authoring state
  const [linkTargetId, setLinkTargetId] = useState('');
  const [linkRelKind, setLinkRelKind] = useState<RelationshipKind>('ally');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);

  // Pan and Zoom
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (initialFocusedNodeId) {
      setFocusedNodeId(initialFocusedNodeId);
      setSelectedNodeId(initialFocusedNodeId);
    }
  }, [initialFocusedNodeId]);

  useEffect(() => {
    setLinkTargetId('');
    setLinkError(null);
  }, [selectedNodeId]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const rawGraph = useMemo(
    () => buildRelationshipGraph(bundle, { includeSecrets: !isPlayerView }),
    [bundle, isPlayerView],
  );

  const filteredGraph = useMemo(
    () =>
      filterGraph(rawGraph, {
        query,
        nodeKind,
        edgeKind,
        focusedNodeId,
      }),
    [rawGraph, query, nodeKind, edgeKind, focusedNodeId],
  );

  const positionedNodes = useMemo(
    () => layoutGraphNodes(filteredGraph.nodes, filteredGraph.edges, 900, 650),
    [filteredGraph.nodes, filteredGraph.edges],
  );

  const nodePosMap = useMemo(() => {
    const map = new Map<string, GraphNode>();
    for (const node of positionedNodes) {
      map.set(node.id, node);
    }
    return map;
  }, [positionedNodes]);

  const selectedNode = useMemo(
    () => (selectedNodeId ? rawGraph.nodes.find((n) => n.id === selectedNodeId) : undefined),
    [selectedNodeId, rawGraph.nodes],
  );

  const selectedRelations = useMemo(() => {
    if (!selectedNodeId) return [];
    return rawGraph.edges.filter(
      (e) => e.source === selectedNodeId || e.target === selectedNodeId,
    );
  }, [selectedNodeId, rawGraph.edges]);

  const availableLinkTargets = useMemo(() => {
    if (!selectedNodeId) return [];
    return rawGraph.nodes.filter((node) => node.id !== selectedNodeId);
  }, [selectedNodeId, rawGraph.nodes]);

  // Connected nodes map for hover/selection highlight
  const highlightedNodeIds = useMemo(() => {
    const activeId = hoveredNodeId || selectedNodeId;
    if (!activeId) return null;
    const set = new Set<string>([activeId]);
    for (const edge of filteredGraph.edges) {
      if (edge.source === activeId) set.add(edge.target);
      if (edge.target === activeId) set.add(edge.source);
    }
    return set;
  }, [hoveredNodeId, selectedNodeId, filteredGraph.edges]);

  if (!isOpen) return null;

  function handleMouseDown(e: MouseEvent<SVGSVGElement>) {
    // Only drag with left mouse click on background
    if (e.button !== 0) return;
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  }

  function handleMouseMove(e: MouseEvent<SVGSVGElement>) {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  }

  function handleMouseUp() {
    isDraggingRef.current = false;
  }

  function handleResetView() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setFocusedNodeId(undefined);
    setSelectedNodeId(undefined);
  }

  const handleAddLink = async () => {
    if (!selectedNode || !linkTargetId || !store.editable) return;
    setLinkError(null);
    setIsLinking(true);

    try {
      const targetNode = rawGraph.nodes.find((n) => n.id === linkTargetId);
      if (!targetNode) return;

      if (selectedNode.kind === 'secret') {
        const secret = bundle.secrets?.find((s) => s.id === selectedNode.id);
        if (secret) {
          const current = secret.attachedTo ?? [];
          if (!current.some((a) => a.id === targetNode.id)) {
            const res = await store.updateItem('secret', secret.id, {
              attachedTo: [...current, { kind: targetNode.kind, id: targetNode.id }],
            });
            if (!res.ok) setLinkError(res.error || 'Failed to link entity');
          }
        }
      } else if (targetNode.kind === 'secret') {
        const secret = bundle.secrets?.find((s) => s.id === targetNode.id);
        if (secret) {
          const current = secret.attachedTo ?? [];
          if (!current.some((a) => a.id === selectedNode.id)) {
            const res = await store.updateItem('secret', secret.id, {
              attachedTo: [...current, { kind: selectedNode.kind, id: selectedNode.id }],
            });
            if (!res.ok) setLinkError(res.error || 'Failed to link entity');
          }
        }
      } else if (selectedNode.kind === 'npc') {
        const npc = bundle.npcs?.find((n) => n.id === selectedNode.id);
        if (npc) {
          if (targetNode.kind === 'faction') {
            const current = npc.factionIds ?? [];
            if (!current.includes(targetNode.id)) {
              const res = await store.updateItem('npc', npc.id, {
                factionIds: [...current, targetNode.id],
              });
              if (!res.ok) setLinkError(res.error || 'Failed to link entity');
            }
          } else if (targetNode.kind === 'location') {
            const current = npc.locationIds ?? [];
            if (!current.includes(targetNode.id)) {
              const res = await store.updateItem('npc', npc.id, {
                locationIds: [...current, targetNode.id],
              });
              if (!res.ok) setLinkError(res.error || 'Failed to link entity');
            }
          } else if (targetNode.kind === 'npc') {
            const prefix = linkRelKind === 'rival' ? 'Rival' : 'Ally';
            const updatedRel = npc.relationship
              ? `${npc.relationship}. ${prefix} of ${targetNode.label}.`
              : `${prefix} of ${targetNode.label}.`;
            const res = await store.updateItem('npc', npc.id, {
              relationship: updatedRel,
            });
            if (!res.ok) setLinkError(res.error || 'Failed to link entity');
          }
        }
      } else if (selectedNode.kind === 'faction') {
        const faction = bundle.factions?.find((f) => f.id === selectedNode.id);
        if (faction) {
          if (targetNode.kind === 'faction') {
            if (linkRelKind === 'rival') {
              const current = faction.rivalFactionIds ?? [];
              if (!current.includes(targetNode.id)) {
                const res = await store.updateItem('faction', faction.id, {
                  rivalFactionIds: [...current, targetNode.id],
                });
                if (!res.ok) setLinkError(res.error || 'Failed to link entity');
              }
            } else {
              const current = faction.alliedFactionIds ?? [];
              if (!current.includes(targetNode.id)) {
                const res = await store.updateItem('faction', faction.id, {
                  alliedFactionIds: [...current, targetNode.id],
                });
                if (!res.ok) setLinkError(res.error || 'Failed to link entity');
              }
            }
          } else if (targetNode.kind === 'location') {
            const current = faction.locationIds ?? [];
            if (!current.includes(targetNode.id)) {
              const res = await store.updateItem('faction', faction.id, {
                locationIds: [...current, targetNode.id],
              });
              if (!res.ok) setLinkError(res.error || 'Failed to link entity');
            }
          }
        }
      } else if (selectedNode.kind === 'item') {
        if (targetNode.kind === 'npc' || targetNode.kind === 'location') {
          const res = await store.updateItem('item', selectedNode.id, {
            holder: { kind: targetNode.kind, id: targetNode.id },
          });
          if (!res.ok) setLinkError(res.error || 'Failed to link entity');
        } else if (targetNode.kind === 'quest') {
          const item = bundle.items?.find((i) => i.id === selectedNode.id);
          if (item) {
            const current = item.questIds ?? [];
            if (!current.includes(targetNode.id)) {
              const res = await store.updateItem('item', selectedNode.id, {
                questIds: [...current, targetNode.id],
              });
              if (!res.ok) setLinkError(res.error || 'Failed to link entity');
            }
          }
        }
      } else if (selectedNode.kind === 'quest') {
        const quest = bundle.quests?.find((q) => q.id === selectedNode.id);
        if (quest) {
          if (targetNode.kind === 'npc') {
            const res = await store.updateItem('quest', quest.id, {
              giverNpcId: targetNode.id,
            });
            if (!res.ok) setLinkError(res.error || 'Failed to link entity');
          } else if (targetNode.kind === 'location') {
            const current = quest.locationIds ?? [];
            if (!current.includes(targetNode.id)) {
              const res = await store.updateItem('quest', quest.id, {
                locationIds: [...current, targetNode.id],
              });
              if (!res.ok) setLinkError(res.error || 'Failed to link entity');
            }
          } else if (targetNode.kind === 'faction') {
            const current = quest.factionIds ?? [];
            if (!current.includes(targetNode.id)) {
              const res = await store.updateItem('quest', quest.id, {
                factionIds: [...current, targetNode.id],
              });
              if (!res.ok) setLinkError(res.error || 'Failed to link entity');
            }
          }
        }
      }
      setLinkTargetId('');
    } finally {
      setIsLinking(false);
    }
  };

  const handleRemoveLink = async (edge: GraphEdge) => {
    if (!store.editable) return;
    const isSource = edge.source === selectedNodeId;
    const partnerId = isSource ? edge.target : edge.source;

    if (edge.kind === 'attached-to') {
      const secretId = edge.source;
      const attachedId = edge.target;
      const secret = bundle.secrets?.find((s) => s.id === secretId);
      if (secret) {
        const updated = (secret.attachedTo ?? []).filter((a) => a.id !== attachedId);
        await store.updateItem('secret', secret.id, { attachedTo: updated });
      }
    } else if (edge.kind === 'member-of') {
      const npc = bundle.npcs?.find((n) => n.id === edge.source);
      if (npc && npc.factionIds) {
        await store.updateItem('npc', npc.id, {
          factionIds: npc.factionIds.filter((id) => id !== edge.target),
        });
      }
    } else if (edge.kind === 'located-in') {
      const npc = bundle.npcs?.find((n) => n.id === edge.source);
      if (npc && npc.locationIds) {
        await store.updateItem('npc', npc.id, {
          locationIds: npc.locationIds.filter((id) => id !== edge.target),
        });
      }
      const faction = bundle.factions?.find((f) => f.id === edge.source);
      if (faction && faction.locationIds) {
        await store.updateItem('faction', faction.id, {
          locationIds: faction.locationIds.filter((id) => id !== edge.target),
        });
      }
    } else if (edge.kind === 'holds') {
      const item = bundle.items?.find((i) => i.id === edge.target);
      if (item) {
        await store.updateItem('item', item.id, { holder: { kind: 'none' } });
      }
    } else if (edge.kind === 'wants') {
      const quest = bundle.quests?.find((q) => q.id === edge.target || q.id === edge.source);
      if (quest && quest.giverNpcId === partnerId) {
        await store.updateItem('quest', quest.id, { giverNpcId: undefined });
      }
    }
  };

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Campaign Relationship Web">
      <div className={styles.modal}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.titleGroup}>
            <h2 className={styles.title}>
              <Network size={20} aria-hidden="true" />
              Campaign Relationship Web
            </h2>
            <div className={styles.subtitle}>
              <span>Cross-entity connection graph</span>
              <span className={styles.nodeCountBadge}>
                {positionedNodes.length} nodes · {filteredGraph.edges.length} links
              </span>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close relationship web"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <Search size={15} className={styles.searchIcon} aria-hidden="true" />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search entities..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Filter entities"
            />
          </div>

          <select
            className={styles.select}
            value={nodeKind}
            onChange={(e) => setNodeKind(e.target.value)}
            aria-label="Filter by entity type"
          >
            <option value="all">All Entity Types</option>
            <option value="npc">NPCs</option>
            <option value="faction">Factions</option>
            <option value="location">Locations</option>
            <option value="quest">Quests</option>
            <option value="item">Items</option>
            <option value="encounter">Encounters</option>
            {!isPlayerView && <option value="secret">Secrets</option>}
          </select>

          <select
            className={styles.select}
            value={edgeKind}
            onChange={(e) => setEdgeKind(e.target.value)}
            aria-label="Filter by relationship"
          >
            <option value="all">All Relationships</option>
            <option value="ally">Ally</option>
            <option value="rival">Rival</option>
            <option value="member-of">Member of</option>
            <option value="located-in">Located in</option>
            <option value="holds">Holds</option>
            <option value="wants">Wants</option>
            {!isPlayerView && <option value="attached-to">Attached to</option>}
          </select>

          <div className={styles.controlGroup}>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
              aria-label="Zoom in"
              title="Zoom in"
            >
              <ZoomIn size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
              aria-label="Zoom out"
              title="Zoom out"
            >
              <ZoomOut size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={handleResetView}
              aria-label="Reset view"
              title="Reset view"
            >
              <RotateCcw size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Graph + Inspector */}
        <div className={styles.mainArea}>
          <svg
            className={styles.svgViewport}
            viewBox="0 0 900 650"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {/* Edges */}
              {filteredGraph.edges.map((edge) => {
                const source = nodePosMap.get(edge.source);
                const target = nodePosMap.get(edge.target);
                if (!source || !target) return null;

                const isConnectedToActive =
                  highlightedNodeIds &&
                  (edge.source === (hoveredNodeId || selectedNodeId) ||
                    edge.target === (hoveredNodeId || selectedNodeId));

                const isDimmed = highlightedNodeIds && !isConnectedToActive;

                const color = RELATIONSHIP_COLORS[edge.kind] ?? 'var(--studio-text-subtle)';

                return (
                  <g key={edge.id}>
                    <line
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke={color}
                      className={`${styles.edge} ${
                        isDimmed ? styles.edgeDimmed : ''
                      } ${isConnectedToActive ? styles.edgeHighlighted : ''}`}
                    />
                  </g>
                );
              })}

              {/* Nodes */}
              {positionedNodes.map((node) => {
                const isSelected = selectedNodeId === node.id;
                const isHovered = hoveredNodeId === node.id;
                const isHighlighted = highlightedNodeIds?.has(node.id);
                const isDimmed = highlightedNodeIds && !isHighlighted;

                const nodeColor = NODE_KIND_COLORS[node.kind] ?? 'var(--studio-text)';
                const kindLetter = NODE_KIND_LETTERS[node.kind] ?? '•';

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    className={`${styles.nodeGroup} ${isDimmed ? styles.nodeDimmed : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNodeId(node.id);
                    }}
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(undefined)}
                  >
                    <circle
                      r={isSelected || isHovered ? 20 : 16}
                      fill="var(--studio-surface-raised)"
                      stroke={nodeColor}
                      className={`${styles.nodeCircle} ${
                        isSelected ? styles.nodeCircleSelected : ''
                      }`}
                    />
                    <circle
                      r={isSelected || isHovered ? 14 : 11}
                      fill={nodeColor}
                    />
                    <text className={styles.nodeKindLetter}>
                      {kindLetter}
                    </text>
                    <text
                      y={isSelected || isHovered ? 34 : 30}
                      className={styles.nodeText}
                    >
                      {node.label}
                    </text>
                    {node.isPinned && (
                      <g transform="translate(10, -16) scale(0.6)">
                        <circle r={10} fill="var(--studio-surface-raised)" stroke="var(--studio-gold)" strokeWidth={2} />
                        <text textAnchor="middle" dominantBaseline="central" fontSize={11} fill="var(--studio-gold)">
                          ★
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Inspector Drawer */}
          {selectedNode && (
            <aside className={styles.inspector} aria-label="Entity Details">
              <div className={styles.inspectorHeader}>
                <span className={styles.inspectorKind}>{selectedNode.kind}</span>
                <h3 className={styles.inspectorTitle}>{selectedNode.label}</h3>
                <span className={styles.inspectorSubtitle}>{selectedNode.subtitle}</span>

                <div className={styles.inspectorActions}>
                  {focusedNodeId === selectedNode.id ? (
                    <button
                      type="button"
                      className={`${styles.smallButton} ${styles.smallButtonActive}`}
                      onClick={() => setFocusedNodeId(undefined)}
                    >
                      Clear Focus
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={styles.smallButton}
                      onClick={() => setFocusedNodeId(selectedNode.id)}
                    >
                      Focus Neighborhood
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.smallButton}
                    onClick={() => setSelectedNodeId(undefined)}
                  >
                    Deselect
                  </button>
                  {onNavigateToEntity && (
                    <button
                      type="button"
                      className={styles.smallButton}
                      onClick={() => onNavigateToEntity(selectedNode.kind, selectedNode.id)}
                    >
                      Open in Section
                    </button>
                  )}
                </div>
              </div>

              <div className={styles.inspectorSectionTitle}>
                Connected Relationships ({selectedRelations.length})
              </div>

              {selectedRelations.length === 0 ? (
                <div className={styles.inspectorSubtitle}>No direct connections found.</div>
              ) : (
                <ul className={styles.relationsList}>
                  {selectedRelations.map((edge) => {
                    const isSource = edge.source === selectedNode.id;
                    const partnerId = isSource ? edge.target : edge.source;
                    const partner = rawGraph.nodes.find((n) => n.id === partnerId);
                    const label = RELATIONSHIP_LABELS[edge.kind] ?? edge.kind;
                    const color = RELATIONSHIP_COLORS[edge.kind] ?? 'var(--studio-text-muted)';

                    return (
                      <li
                        key={edge.id}
                        className={styles.relationItem}
                        onClick={() => {
                          setSelectedNodeId(partnerId);
                        }}
                      >
                        <div>
                          <strong>{partner?.label ?? partnerId}</strong>
                          <div className={styles.inspectorSubtitle}>
                            {edge.label || label}
                          </div>
                        </div>
                        <div className={styles.relationBadgeGroup}>
                          <span
                            className={styles.relationKind}
                            style={{
                              backgroundColor: color,
                              color: 'var(--studio-surface-raised)',
                            }}
                          >
                            {label}
                          </span>
                          {store.editable && (
                            <button
                              type="button"
                              className={styles.unlinkButton}
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleRemoveLink(edge);
                              }}
                              aria-label={`Remove relationship with ${partner?.label ?? partnerId}`}
                              title="Remove relationship link"
                            >
                              <X size={13} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Authoring: Add Relationship / Attachment */}
              {store.editable && (
                <div className={styles.linkAuthoringSection}>
                  <div className={styles.inspectorSectionTitle}>
                    Link Relationship
                  </div>
                  <div className={styles.linkAuthoringForm}>
                    <select
                      className={styles.linkSelect}
                      value={linkTargetId}
                      onChange={(e) => setLinkTargetId(e.target.value)}
                      aria-label="Target entity to link"
                    >
                      <option value="">-- Choose entity to link --</option>
                      {availableLinkTargets.map((node) => (
                        <option key={node.id} value={node.id}>
                          {node.label} ({node.kind})
                        </option>
                      ))}
                    </select>

                    {selectedNode.kind !== 'secret' && (
                      <select
                        className={styles.linkSelect}
                        value={linkRelKind}
                        onChange={(e) => setLinkRelKind(e.target.value as RelationshipKind)}
                        aria-label="Relationship kind"
                      >
                        <option value="ally">Ally</option>
                        <option value="rival">Rival</option>
                        <option value="member-of">Member of</option>
                        <option value="located-in">Located in</option>
                        <option value="holds">Holds</option>
                        <option value="wants">Wants</option>
                        <option value="attached-to">Attached to</option>
                      </select>
                    )}

                    <button
                      type="button"
                      className={styles.addLinkButton}
                      disabled={!linkTargetId || isLinking}
                      onClick={() => void handleAddLink()}
                    >
                      {isLinking ? 'Linking...' : 'Add Link'}
                    </button>
                  </div>
                  {linkError && (
                    <div className={styles.linkError} role="alert">
                      {linkError}
                    </div>
                  )}
                </div>
              )}
            </aside>
          )}
        </div>

        {/* Footer Legend */}
        <footer className={styles.footerLegend}>
          <div className={styles.legendItem}>
            <strong>Relationships:</strong>
          </div>
          {(Object.entries(RELATIONSHIP_LABELS) as [RelationshipKind, string][]).map(
            ([kind, label]) => (
              <div key={kind} className={styles.legendItem}>
                <span
                  className={styles.legendDot}
                  style={{ backgroundColor: RELATIONSHIP_COLORS[kind] }}
                />
                <span>{label}</span>
              </div>
            ),
          )}
        </footer>
      </div>
    </div>
  );
}
