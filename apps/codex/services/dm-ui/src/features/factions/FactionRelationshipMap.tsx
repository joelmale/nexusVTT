import { useState, useMemo } from 'react';
import type { GeneratedFaction, FactionRelationshipType } from '@nexus/character-creator';
import Network from 'lucide-react/dist/esm/icons/network';
import styles from './FactionRelationshipMap.module.css';

export interface FactionRelationshipMapProps {
  factions: GeneratedFaction[];
  selectedFactionId?: string;
  onSelectFaction?: (factionId: string) => void;
  title?: string;
  className?: string;
}

interface NodePosition {
  faction: GeneratedFaction;
  x: number;
  y: number;
}

interface EdgeLink {
  id: string;
  source: NodePosition;
  target: NodePosition;
  type: FactionRelationshipType;
  sourceSummary: string;
  targetSummary: string;
}

const TYPE_CONFIG: Record<
  FactionRelationshipType,
  { label: string; color: string; dasharray?: string; width: number }
> = {
  ally: { label: 'Allies', color: 'var(--studio-positive, #315f4a)', width: 2.5 },
  rival: { label: 'Rivals', color: 'var(--studio-danger, #a0443f)', width: 2.5 },
  'uneasy-truce': {
    label: 'Uneasy Truce',
    color: 'var(--studio-warning, #a26a1f)',
    dasharray: '6 3',
    width: 2,
  },
  infiltrated: {
    label: 'Infiltrated / Espionage',
    color: '#7c3aed',
    dasharray: '3 3',
    width: 2,
  },
  transactional: {
    label: 'Transactional',
    color: 'var(--studio-info, #41677a)',
    width: 2,
  },
  'willful-ignorance': {
    label: 'Willful Ignorance',
    color: '#db2777',
    dasharray: '4 4',
    width: 2,
  },
  ambivalent: {
    label: 'Ambivalent',
    color: 'var(--studio-neutral, #737874)',
    dasharray: '2 2',
    width: 1.5,
  },
  distant: {
    label: 'Distant',
    color: 'var(--studio-neutral, #737874)',
    dasharray: '2 2',
    width: 1.5,
  },
  ignorance: {
    label: 'Ignorance',
    color: 'var(--studio-neutral, #737874)',
    dasharray: '2 2',
    width: 1.5,
  },
};

const STATUS_COLOR_MAP: Record<string, string> = {
  ally: 'var(--studio-positive, #315f4a)',
  opposition: 'var(--studio-danger, #a0443f)',
  neutral: 'var(--studio-neutral, #737874)',
  unknown: 'var(--studio-warning, #a26a1f)',
};

export function FactionRelationshipMap({
  factions,
  selectedFactionId,
  onSelectFaction,
  title = 'Faction Ecosystem Relationship Web',
  className,
}: FactionRelationshipMapProps) {
  const [activeEdgeId, setActiveEdgeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const activeFocusId = selectedFactionId || hoveredNodeId;

  // Layout calculations
  const width = 600;
  const height = 380;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.35;

  const nodePositions = useMemo<NodePosition[]>(() => {
    const n = factions.length;
    if (n === 0) return [];
    if (n === 1) {
      return [{ faction: factions[0], x: cx, y: cy }];
    }

    return factions.map((faction, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      return {
        faction,
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      };
    });
  }, [factions, cx, cy, radius]);

  const links = useMemo<EdgeLink[]>(() => {
    const result: EdgeLink[] = [];
    const seenPairs = new Set<string>();

    for (let i = 0; i < nodePositions.length; i++) {
      for (let j = i + 1; j < nodePositions.length; j++) {
        const source = nodePositions[i];
        const target = nodePositions[j];

        const pairKey = [source.faction.tempId, target.faction.tempId].sort().join('::');
        if (seenPairs.has(pairKey)) continue;
        seenPairs.add(pairKey);

        const relAtoB = source.faction.relationships.find(
          (r) => r.targetTempId === target.faction.tempId,
        );
        const relBtoA = target.faction.relationships.find(
          (r) => r.targetTempId === source.faction.tempId,
        );

        const type: FactionRelationshipType = relAtoB?.type || relBtoA?.type || 'ambivalent';

        result.push({
          id: pairKey,
          source,
          target,
          type,
          sourceSummary: relAtoB?.summary || '',
          targetSummary: relBtoA?.summary || '',
        });
      }
    }
    return result;
  }, [nodePositions]);

  const activeEdge = useMemo(() => {
    if (!activeEdgeId) return null;
    return links.find((l) => l.id === activeEdgeId) ?? null;
  }, [activeEdgeId, links]);

  // If a node is focused, find its first relationship to display if no edge is clicked
  const selectedNodeRelationships = useMemo(() => {
    if (!activeFocusId) return [];
    const faction = factions.find((f) => f.tempId === activeFocusId);
    return faction ? faction.relationships : [];
  }, [activeFocusId, factions]);

  return (
    <div className={`${styles.container} ${className ?? ''}`.trim()}>
      <div className={styles.mapHeader}>
        <h4 className={styles.mapTitle}>
          <Network size={16} />
          {title}
        </h4>
        <span className={styles.hint}>
          Click nodes or lines to inspect dynamics
        </span>
      </div>

      <div className={styles.svgWrapper}>
        <svg
          aria-label={title}
          className={styles.svg}
          viewBox={`0 0 ${width} ${height}`}
        >
          <defs>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
            </filter>
          </defs>

          {/* Links */}
          <g className="links-layer">
            {links.map((link) => {
              const config = TYPE_CONFIG[link.type] || TYPE_CONFIG.ambivalent;
              const isSelected = activeEdgeId === link.id;
              const isConnected =
                activeFocusId &&
                (link.source.faction.tempId === activeFocusId ||
                  link.target.faction.tempId === activeFocusId);
              const isDimmed = activeFocusId && !isConnected && !isSelected;

              // Quadratic bezier curve with slight bend towards center
              const midX = (link.source.x + link.target.x) / 2;
              const midY = (link.source.y + link.target.y) / 2;
              const bendFactor = 0.15;
              const ctrlX = midX + (cx - midX) * bendFactor;
              const ctrlY = midY + (cy - midY) * bendFactor;

              const pathData = `M ${link.source.x} ${link.source.y} Q ${ctrlX} ${ctrlY} ${link.target.x} ${link.target.y}`;

              return (
                <g key={link.id} onClick={() => setActiveEdgeId(link.id)}>
                  {/* Invisible wide hitbox for easy clicking */}
                  <path d={pathData} className={styles.linkHitbox} />
                  <path
                    d={pathData}
                    className={styles.linkPath}
                    stroke={config.color}
                    strokeWidth={isSelected ? config.width + 2 : isConnected ? config.width + 1 : config.width}
                    strokeDasharray={config.dasharray}
                    opacity={isDimmed ? 0.2 : isSelected || isConnected ? 1 : 0.75}
                  >
                    <title>
                      {`${link.source.faction.name} ↔ ${link.target.faction.name}: ${config.label}`}
                    </title>
                  </path>
                </g>
              );
            })}
          </g>

          {/* Nodes */}
          <g className="nodes-layer">
            {nodePositions.map((pos) => {
              const isSelected = selectedFactionId === pos.faction.tempId;
              const isHovered = hoveredNodeId === pos.faction.tempId;
              const isFocused = isSelected || isHovered;
              const statusColor = STATUS_COLOR_MAP[pos.faction.status] || '#737874';

              const shortName =
                pos.faction.name.length > 20
                  ? pos.faction.name.slice(0, 18) + '…'
                  : pos.faction.name;

              return (
                <g
                  key={pos.faction.tempId}
                  data-testid={`faction-node-${pos.faction.tempId}`}
                  className={styles.nodeGroup}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onClick={() => onSelectFaction?.(pos.faction.tempId)}
                  onMouseEnter={() => setHoveredNodeId(pos.faction.tempId)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                >
                  <circle
                    className={styles.nodeCircle}
                    r={isFocused ? 32 : 28}
                    fill="var(--studio-surface-raised, #ffffff)"
                    stroke={statusColor}
                    strokeWidth={isFocused ? 3.5 : 2}
                    filter="url(#shadow)"
                  />
                  <circle
                    r={isFocused ? 28 : 24}
                    fill={statusColor}
                    fillOpacity={0.12}
                  />

                  {/* Faction initial */}
                  <text
                    className={styles.nodeText}
                    y={-2}
                    fontSize={isFocused ? '14px' : '12px'}
                    fill={statusColor}
                  >
                    {pos.faction.name.charAt(0)}
                  </text>

                  {/* Faction Name Badge */}
                  <text className={styles.nodeText} y={42}>
                    {shortName}
                  </text>

                  {/* Faction Archetype */}
                  <text className={styles.nodeSubtext} y={54}>
                    {(pos.faction.archetype || 'Faction').length > 22
                      ? (pos.faction.archetype || 'Faction').slice(0, 20) + '…'
                      : pos.faction.archetype || 'Faction'}
                  </text>

                  <title>{`${pos.faction.name} (${pos.faction.archetype || 'Faction'}) - Status: ${pos.faction.status}`}</title>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Relationship / Focus Inspector */}
      {activeEdge ? (
        <div className={styles.relationshipInspector}>
          <div className={styles.inspectorHeader}>
            <span className={styles.inspectorTitle}>
              {activeEdge.source.faction.name} ↔ {activeEdge.target.faction.name}
            </span>
            <span
              className={styles.typeBadge}
              style={{
                backgroundColor: `${TYPE_CONFIG[activeEdge.type].color}20`,
                color: TYPE_CONFIG[activeEdge.type].color,
                border: `1px solid ${TYPE_CONFIG[activeEdge.type].color}`,
              }}
            >
              {TYPE_CONFIG[activeEdge.type].label}
            </span>
          </div>
          {activeEdge.sourceSummary && (
            <p className={styles.inspectorSummary}>
              <strong>{activeEdge.source.faction.name}:</strong> {activeEdge.sourceSummary}
            </p>
          )}
          {activeEdge.targetSummary && (
            <p className={styles.inspectorSummary}>
              <strong>{activeEdge.target.faction.name}:</strong> {activeEdge.targetSummary}
            </p>
          )}
        </div>
      ) : activeFocusId && selectedNodeRelationships.length > 0 ? (
        <div className={styles.relationshipInspector}>
          <div className={styles.inspectorHeader}>
            <span className={styles.inspectorTitle}>
              {factions.find((f) => f.tempId === activeFocusId)?.name} Relationships
            </span>
          </div>
          {selectedNodeRelationships.map((rel) => (
            <p key={rel.targetTempId} className={styles.inspectorSummary}>
              <strong
                style={{
                  color: TYPE_CONFIG[rel.type]?.color || 'inherit',
                  textTransform: 'capitalize',
                }}
              >
                [{rel.type.replace('-', ' ')}]
              </strong>{' '}
              {rel.summary}
            </p>
          ))}
        </div>
      ) : (
        <div className={styles.legend}>
          {(
            [
              'ally',
              'rival',
              'uneasy-truce',
              'infiltrated',
              'transactional',
              'willful-ignorance',
            ] as FactionRelationshipType[]
          ).map((type) => {
            const conf = TYPE_CONFIG[type];
            return (
              <div key={type} className={styles.legendItem}>
                <span
                  className={styles.legendDot}
                  style={{
                    backgroundColor: conf.color,
                    border: conf.dasharray ? '1px dashed #666' : 'none',
                  }}
                />
                <span>{conf.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
