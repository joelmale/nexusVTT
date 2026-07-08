import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import {
  useGameStore,
  useIsHost,
  useCamera,
  useActiveTool,
} from '@/stores/gameStore';
import '@/styles/toolbar-unified.css';
import { useDraggablePanel } from '@/hooks/useDraggablePanel';
import { useUIStackStore, useStackZIndex } from '@/stores/uiStackStore';
import {
  Circle,
  Eraser,
  Grid3x3,
  Hand,
  Minus,
  MousePointer2,
  Pencil,
  Ruler,
  Square,
  Target,
  Triangle,
  ZoomIn,
  ZoomOut,
  Disc,
  Play,
  Flame,
  Maximize2,
  CloudFog,
  Paintbrush,
  Trash2,
} from 'lucide-react';
import { useSceneFog } from '@/stores/scene';
import { useActiveScene } from '@/stores/gameStore';

interface ToolbarItem {
  id: string;
  icon?: React.ReactNode;
  label: string;
  shortcut?: string;
  tooltip?: string;
  className?: string;
  disabled?: boolean;
  action?: () => void;
}

interface ToolbarGroup {
  id: string;
  label: string;
  tools: ToolbarItem[];
}

const NoteIcon: React.FC = () => (
  <svg
    aria-hidden="true"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
    <path d="M14 2v5h5" />
    <path d="M8 16l2.5-.5L17 9l-2.5-2.5L8 13z" />
    <path d="M13.5 6.5L16 9" />
  </svg>
);

export const GameToolbar: React.FC = () => {
  const activeTool = useActiveTool();
  const isHost = useIsHost();
  const { updateCamera, setActiveTool } = useGameStore();
  const camera = useCamera();
  // A9: fog group needs the active scene's id (to target the right scene's
  // fog state) and its current SceneFog (to reflect enabled/on state on the
  // toggle button). useSceneFog narrowly subscribes to `scene.fog` only -
  // it does not widen this component's re-render surface beyond what
  // useActiveScene already does.
  const activeScene = useActiveScene();
  const fog = useSceneFog(activeScene?.id ?? '');
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [hoveredTool, setHoveredTool] = useState<ToolbarItem | null>(null);
  const [isVertical, setIsVertical] = useState(false);

  const {
    onPointerDown,
    isCollapsed,
    toggleCollapsed,
    panelRef,
  } = useDraggablePanel({
    id: 'gameToolbar',
    defaultPosition: { x: window.innerWidth / 2 - 200, y: window.innerHeight - 80 },
  });

  const zIndex = useStackZIndex('gameToolbar');
  const bringToFront = useUIStackStore((state) => state.bringToFront);

  const handleZoomIn = useCallback(
    () => updateCamera({ zoom: Math.min(5.0, camera.zoom * 1.2) }),
    [camera.zoom, updateCamera],
  );
  const handleZoomOut = useCallback(
    () => updateCamera({ zoom: Math.max(0.1, camera.zoom / 1.2) }),
    [camera.zoom, updateCamera],
  );
  const handleZoomReset = useCallback(
    () => updateCamera({ x: 0, y: 0, zoom: 0.54 }),
    [updateCamera],
  );

  const toolGroups: ToolbarGroup[] = useMemo(
    () => [
      {
        id: 'navigation',
        label: 'Navigation',
        tools: [
          {
            id: 'select',
            icon: <MousePointer2 size={18} />,
            label: 'Select / Move',
            shortcut: 'V',
            tooltip:
              'Select and move objects. Hold Shift+drag OR Cmd/Ctrl+click for multi-select',
          },
          { id: 'pan', icon: <Hand size={18} />, label: 'Pan', shortcut: 'H' },
          {
            id: 'measure',
            icon: <Ruler size={18} />,
            label: 'Measure',
            shortcut: 'M',
            tooltip: 'Measure distance',
          },
          {
            id: 'ping',
            icon: <Target size={18} />,
            label: 'Ping',
            shortcut: 'I',
            tooltip: 'Ping location for players',
          },
        ],
      },
      {
        id: 'draw',
        label: 'Draw & Shapes',
        tools: [
          {
            // 'pencil' is the tool id DrawingTools' gesture handlers dispatch
            // on — this was 'draw' (which nothing listens to), leaving the
            // freehand tool dead from the toolbar (pre-existing on master;
            // caught in Joel's A8b gate review).
            id: 'pencil',
            icon: <Pencil size={18} />,
            label: 'Draw',
            shortcut: 'D',
            tooltip: 'Freehand drawing',
          },
          {
            id: 'line',
            icon: <Minus size={18} />,
            label: 'Line',
            shortcut: 'L',
          },
          {
            id: 'rectangle',
            icon: <Square size={18} />,
            label: 'Rectangle',
            shortcut: 'R',
          },
          {
            id: 'circle',
            icon: <Circle size={18} />,
            label: 'Circle',
            shortcut: 'O',
          },
          {
            id: 'cone',
            icon: <Triangle size={18} />,
            label: 'Cone / AOE',
            shortcut: 'C',
          },
          {
            id: 'eraser',
            icon: <Eraser size={18} />,
            label: 'Erase',
            shortcut: 'E',
          },
        ],
      },
      {
        id: 'entities',
        label: 'Tokens & Props',
        tools: [
          {
            id: 'note',
            icon: <NoteIcon />,
            label: 'Notes',
            tooltip: 'Add notes/markers',
          },
        ],
      },
      {
        id: 'spells',
        label: 'Spell Effects',
        tools: [
          {
            id: 'spell-circle',
            icon: <Flame size={18} />,
            label: 'Sphere',
            tooltip: 'Sphere AOE (Fireball, Silence, Darkness)',
          },
          {
            id: 'spell-ring',
            icon: <Disc size={18} />,
            label: 'Ring',
            tooltip: 'Ring AOE (Auras, Wards)',
          },
          {
            id: 'spell-cone',
            icon: <Triangle size={18} />,
            label: 'Cone',
            tooltip: 'Cone AOE (Burning Hands, Cone of Cold)',
          },
          {
            id: 'spell-line',
            icon: <Minus size={18} />,
            label: 'Line',
            tooltip: 'Line AOE (Lightning Bolt, Wall of Fire)',
          },
          {
            id: 'spell-square',
            icon: <Square size={18} />,
            label: 'Cube',
            tooltip: 'Cube AOE (Web, Grease, Cloudkill)',
          },
          {
            id: 'spell-triangle',
            icon: <Play size={18} />,
            label: 'Wedge',
            tooltip: 'Wedge AOE (Alternative cone)',
          },
        ],
      },
    ],
    [],
  );

  const dmUtilityGroup: ToolbarGroup | null = useMemo(
    () =>
      isHost
        ? {
            id: 'dm-utility',
            label: 'DM Utilities',
            tools: [
              {
                id: 'grid-align',
                icon: <Grid3x3 size={18} />,
                label: 'Grid Alignment',
                tooltip: 'Align grid to map',
              },
            ],
          }
        : null,
    [isHost],
  );

  // A9: paintable fog - host-only group. The legacy dm-mask toolbar entry
  // was removed from this UI; the underlying fog-of-war drawing runtime is
  // left intact outside this packet. The toggle/clear buttons are actions
  // (not tool-select); the two reveal buttons behave like every other shape
  // tool (setActiveTool via the default onClick in renderToolButton).
  const handleToggleFog = useCallback(() => {
    if (!activeScene) return;
    const { setFogEnabled } = useGameStore.getState();
    setFogEnabled(activeScene.id, !(fog?.enabled ?? false));
  }, [activeScene, fog?.enabled]);

  const handleClearFog = useCallback(() => {
    if (!activeScene) return;
    if (!window.confirm('Clear all fog reveals on this scene?')) return;
    const { clearFog } = useGameStore.getState();
    clearFog(activeScene.id);
  }, [activeScene]);

  const dmFogGroup: ToolbarGroup | null = useMemo(
    () =>
      isHost
        ? {
            id: 'dm-fog',
            label: 'Fog',
            tools: [
              {
                id: 'fog-toggle',
                icon: <CloudFog size={18} />,
                label: fog?.enabled ? 'Fog: On' : 'Fog: Off',
                tooltip: 'Toggle paintable fog of war for this scene',
                action: handleToggleFog,
                className: fog?.enabled ? 'active' : '',
              },
              {
                id: 'fog-reveal-rect',
                icon: <Square size={18} />,
                label: 'Reveal Rect',
                tooltip: 'Draw a rectangular fog reveal',
              },
              {
                id: 'fog-reveal-brush',
                icon: <Paintbrush size={18} />,
                label: 'Reveal Brush',
                tooltip: 'Paint a freehand fog reveal',
              },
              {
                id: 'fog-clear',
                icon: <Trash2 size={18} />,
                label: 'Clear Fog',
                tooltip: 'Remove all fog reveals on this scene',
                action: handleClearFog,
              },
            ],
          }
        : null,
    [isHost, fog?.enabled, handleToggleFog, handleClearFog],
  );

  const cameraControls: ToolbarItem[] = useMemo(
    () => [
      {
        id: 'zoom-out',
        icon: <ZoomOut size={16} />,
        label: 'Zoom Out',
        action: handleZoomOut,
        disabled: camera.zoom <= 0.1,
        shortcut: '-',
      },
      {
        id: 'zoom-reset',
        label: `${Math.round(camera.zoom * 100)}%`,
        action: handleZoomReset,
        className: 'zoom-display',
      },
      {
        id: 'zoom-in',
        icon: <ZoomIn size={16} />,
        label: 'Zoom In',
        action: handleZoomIn,
        disabled: camera.zoom >= 5.0,
        shortcut: '+',
      },
    ],
    [camera.zoom, handleZoomOut, handleZoomIn, handleZoomReset],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const key = e.key.toUpperCase();
      const allTools = [
        ...toolGroups.flatMap((g) => g.tools),
        ...(dmUtilityGroup ? dmUtilityGroup.tools : []),
        ...(dmFogGroup ? dmFogGroup.tools : []),
      ];
      const tool = allTools.find(
        (t) =>
          t.shortcut &&
          t.shortcut.toUpperCase() === key &&
          !t.shortcut.includes('+'),
      );

      if (tool) {
        e.preventDefault();
        if (tool.action) {
          tool.action();
        } else {
          setActiveTool(tool.id);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTool, toolGroups, dmUtilityGroup, dmFogGroup]);

  const renderToolButton = (tool: ToolbarItem) => {
    const isActive =
      activeTool === tool.id || tool.className?.split(' ').includes('active');
    const buttonClassName = [
      'toolbar-btn',
      isActive ? 'active' : '',
      tool.disabled ? 'disabled' : '',
      tool.className?.split(' ').filter((name) => name !== 'active').join(' '),
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        key={tool.id}
        data-id={tool.id}
        type="button"
        className={buttonClassName}
        onClick={tool.action ? tool.action : () => setActiveTool(tool.id)}
        disabled={tool.disabled}
        aria-pressed={isActive}
        aria-label={tool.label}
        title={
          tool.tooltip && tool.tooltip !== tool.label
            ? `${tool.label}: ${tool.tooltip}`
            : tool.label
        }
        onMouseEnter={() => setHoveredTool(tool)}
      >
        {tool.icon ? (
          <span className="tool-icon">{tool.icon}</span>
        ) : (
          tool.label
        )}
      </button>
    );
  };

  return (
    <div
      ref={panelRef}
      style={{ zIndex }}
      onPointerDownCapture={() => bringToFront('gameToolbar')}
      className="layout-toolbar-inner"
    >
      {!isCollapsed && (
        <div id="toolbar-info-banner">
          {hoveredTool ? (
            <>
              <span>
                {hoveredTool.tooltip && hoveredTool.tooltip !== hoveredTool.label
                  ? `${hoveredTool.label}: ${hoveredTool.tooltip}`
                  : hoveredTool.label}
              </span>
              {hoveredTool.shortcut && (
                <span className="shortcut">{hoveredTool.shortcut}</span>
              )}
            </>
          ) : (
            <span>Hover over a tool for information.</span>
          )}
        </div>
      )}

      <div
        ref={toolbarRef}
        className={`game-toolbar ${isVertical ? 'vertical' : 'horizontal'}`}
        role="toolbar"
        onMouseLeave={() => setHoveredTool(null)}
        data-collapsed={isCollapsed ? 'true' : undefined}
      >
        <div
          className="toolbar-drag-handle"
          aria-hidden="true"
          onPointerDown={(e) => {
            if (isCollapsed) {
              e.stopPropagation();
              toggleCollapsed();
            } else {
              onPointerDown(e);
            }
          }}
          onClick={(e) => {
            if (isCollapsed) {
              e.stopPropagation();
              toggleCollapsed();
            }
          }}
          title={isCollapsed ? "Expand Toolbar" : "Drag Toolbar"}
        >
          {isCollapsed ? <Pencil size={18} /> : "⠿"}
        </div>

        {!isCollapsed && (
          <>
            {/* Main Tool Groups */}
            <div className="toolbar-section main-tools">
              {/* Navigation Tools */}
              <div className="toolbar-group">
                {toolGroups[0].tools.map(renderToolButton)}
              </div>

              <div className="toolbar-group-separator" />

              {/* Drawing Tools */}
              <div className="toolbar-group">
                {toolGroups[1].tools.map(renderToolButton)}
              </div>

              <div className="toolbar-group-separator" />

              {/* Entity & Props Tools */}
              <div className="toolbar-group">
                {toolGroups[2].tools.map(renderToolButton)}
              </div>
            </div>

            <div className="toolbar-group-separator" />

            {/* Spell Effects Grid */}
            <div className="toolbar-section spell-tools">
              <div className="toolbar-group spell-grid">
                {toolGroups[3].tools.map(renderToolButton)}
              </div>

              {/* DM Utility Tools */}
              {isHost && dmUtilityGroup && (
                <>
                  <div className="toolbar-group-separator" />
                  <div className="toolbar-group dm-tools">
                    {dmUtilityGroup.tools.map(renderToolButton)}
                  </div>
                </>
              )}

              {/* DM Fog Tools (A9 - paintable fog, host-only) */}
              {isHost && dmFogGroup && (
                <>
                  <div className="toolbar-group-separator" />
                  <div className="toolbar-group dm-tools" data-testid="dm-fog-group">
                    {dmFogGroup.tools.map(renderToolButton)}
                  </div>
                </>
              )}

              {/* Zoom Controls - Right Aligned */}
              <div className="toolbar-group-separator" />
              <div className="toolbar-group zoom-controls">
                {cameraControls.map(renderToolButton)}
              </div>
            </div>

            <div className="toolbar-group-separator" />

            <button
              className="toolbar-btn"
              onClick={() => toggleCollapsed()}
              title="Minimize Toolbar"
              aria-label="Minimize Toolbar"
            >
              <Minus size={16} />
            </button>

            {/* Vertical Toggle */}
            <button
              className="toolbar-orientation-toggle"
              onClick={() => setIsVertical(!isVertical)}
              title={isVertical ? 'Switch to horizontal' : 'Switch to vertical'}
              aria-label="Toggle toolbar orientation"
            >
              <Maximize2 size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
