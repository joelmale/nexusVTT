import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
} from 'react';
import {
  useGameStore,
  useIsHost,
  useCamera,
  useActiveTool,
} from '@/stores/gameStore';
import { useDraggablePanel } from '@/hooks/useDraggablePanel';
import {
  useUIStackStore,
  useStackZIndex,
  useFocusMode,
} from '@/stores/uiStackStore';
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
import { getActiveCameraGestureEngine } from '@/utils/cameraGestureEngine';
import { isGlobalShortcut } from '@/utils/hotkeys';
import { PopoverMenu } from './PopoverMenu';
import styles from './GameToolbar.module.css';

export type CanvasMode = 'play' | 'design';

interface GameToolbarProps {
  mode?: CanvasMode;
  onEditScene?: () => void;
  onOpenProps?: () => void;
}

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

export const GameToolbar: React.FC<GameToolbarProps> = ({
  mode = 'play',
  onEditScene,
  onOpenProps,
}) => {
  const activeTool = useActiveTool();
  const isHost = useIsHost();
  const isDesign = isHost && mode === 'design';
  // Narrow selectors: the old `useGameStore()` (no selector) subscribed to the
  // whole store, re-rendering the toolbar on every unrelated set().
  const updateCamera = useGameStore((state) => state.updateCamera);
  const setActiveTool = useGameStore((state) => state.setActiveTool);
  const camera = useCamera();
  // A9: fog group needs the active scene's id (to target the right scene's
  // fog state) and its current SceneFog (to reflect enabled/on state on the
  // toggle button). useSceneFog narrowly subscribes to `scene.fog` only -
  // it does not widen this component's re-render surface beyond what
  // useActiveScene already does.
  const activeScene = useActiveScene();
  const fog = useSceneFog(activeScene?.id ?? '');
  const [hoveredTool, setHoveredTool] = useState<ToolbarItem | null>(null);
  const [isVertical, setIsVertical] = useState(false);
  const [isNearTop, setIsNearTop] = useState(false);

  const { onPointerDown, isCollapsed, toggleCollapsed, panelRef } =
    useDraggablePanel({
      id: 'gameToolbar',
      defaultAnchor: 'bottom-center',
    });

  const zIndex = useStackZIndex('gameToolbar');
  const focusMode = useFocusMode();
  const bringToFront = useUIStackStore((state) => state.bringToFront);

  useLayoutEffect(() => {
    if (!focusMode) return;
    panelRef.current
      ?.querySelectorAll<HTMLElement>('[popover]')
      .forEach((popover) => {
        if (popover.hidePopover && popover.matches(':popover-open')) {
          popover.hidePopover();
        }
      });
  }, [focusMode, panelRef]);

  const handleZoomIn = useCallback(() => {
    const engine = getActiveCameraGestureEngine();
    if (engine) {
      engine.stepZoom(1.2);
    } else {
      updateCamera({ zoom: Math.min(5.0, camera.zoom * 1.2) });
    }
  }, [camera.zoom, updateCamera]);

  const handleZoomOut = useCallback(() => {
    const engine = getActiveCameraGestureEngine();
    if (engine) {
      engine.stepZoom(1 / 1.2);
    } else {
      updateCamera({ zoom: Math.max(0.1, camera.zoom / 1.2) });
    }
  }, [camera.zoom, updateCamera]);

  const handleZoomReset = useCallback(() => {
    const engine = getActiveCameraGestureEngine();
    if (engine) {
      engine.setCamera({ x: 0, y: 0, zoom: 0.54 });
    } else {
      updateCamera({ x: 0, y: 0, zoom: 0.54 });
    }
  }, [updateCamera]);

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
                label: 'Clear Fog Reveals',
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

  const revealTools = useMemo(
    () => dmFogGroup?.tools.filter((tool) => !tool.action) ?? [],
    [dmFogGroup],
  );
  const availableTools = useMemo(
    () => [
      ...toolGroups.slice(0, isDesign ? 3 : 4).flatMap((group) => group.tools),
      ...(isDesign ? (dmUtilityGroup?.tools ?? []) : []),
      ...(isDesign ? (dmFogGroup?.tools ?? []) : revealTools),
    ],
    [dmFogGroup, dmUtilityGroup, isDesign, revealTools, toolGroups],
  );
  const selectedTool = availableTools.find((tool) => tool.id === activeTool);

  useLayoutEffect(() => {
    if (!selectedTool) setActiveTool('select');
  }, [selectedTool, setActiveTool]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // isGlobalShortcut also rejects modifier combos: without that check
      // Ctrl+R matched the "R" tool and preventDefault()'d browser reload
      // (likewise Ctrl+E / Ctrl+O).
      if (!isGlobalShortcut(e)) return;

      const key = e.key.toUpperCase();
      const tool = availableTools.find(
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
  }, [availableTools, setActiveTool]);

  const handleToolMouseEnter = useCallback(
    (tool: ToolbarItem) => {
      if (panelRef.current) {
        setIsNearTop(panelRef.current.getBoundingClientRect().top < 48);
      }
      setHoveredTool(tool);
    },
    [panelRef],
  );

  const renderToolButton = (tool: ToolbarItem, showLabel = false) => {
    const isActive =
      activeTool === tool.id || tool.className?.split(' ').includes('active');
    const buttonClassName = [
      'toolbar-btn',
      isActive ? 'active' : '',
      tool.disabled ? 'disabled' : '',
      tool.className
        ?.split(' ')
        .filter((name) => name !== 'active')
        .join(' '),
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        key={tool.id}
        data-id={tool.id}
        type="button"
        className={buttonClassName}
        onClick={(event) => {
          if (tool.action) tool.action();
          else setActiveTool(tool.id);
          event.currentTarget
            .closest<HTMLElement>('[popover]')
            ?.hidePopover?.();
        }}
        disabled={tool.disabled}
        aria-pressed={
          !tool.action || tool.id === 'fog-toggle' ? isActive : undefined
        }
        aria-label={tool.label}
        title={
          tool.tooltip && tool.tooltip !== tool.label
            ? `${tool.label}: ${tool.tooltip}`
            : tool.label
        }
        onMouseEnter={() => handleToolMouseEnter(tool)}
      >
        {tool.icon && (
          <span className="tool-icon" aria-hidden="true">
            {tool.icon}
          </span>
        )}
        {(showLabel || !tool.icon) && <span>{tool.label}</span>}
        {showLabel && tool.shortcut && (
          <kbd aria-hidden="true">{tool.shortcut}</kbd>
        )}
      </button>
    );
  };

  const renderToolMenu = (label: string, tools: ToolbarItem[]) => (
    <PopoverMenu
      trigger={label}
      triggerClassName={`toolbar-btn ${styles.category}`}
      contentClassName={styles.menu}
    >
      <div className={styles.menuTools} role="group" aria-label={label}>
        {tools.map((tool) => renderToolButton(tool, true))}
      </div>
    </PopoverMenu>
  );

  return (
    <div
      ref={panelRef}
      data-chrome
      inert={focusMode || undefined}
      style={{ zIndex }}
      onPointerDownCapture={() => bringToFront('gameToolbar')}
      className="layout-toolbar-inner"
    >
      {!isCollapsed && hoveredTool && (
        <div
          id="toolbar-info-banner"
          role="tooltip"
          className={isNearTop ? 'placement-below' : undefined}
        >
          <span>
            {hoveredTool.tooltip && hoveredTool.tooltip !== hoveredTool.label
              ? `${hoveredTool.label}: ${hoveredTool.tooltip}`
              : hoveredTool.label}
          </span>
          {hoveredTool.shortcut && (
            <span className="shortcut">{hoveredTool.shortcut}</span>
          )}
        </div>
      )}

      <div
        className={`game-toolbar ${styles.toolbar} ${isVertical ? 'vertical' : 'horizontal'}`}
        role="toolbar"
        aria-label={isDesign ? 'Design tools' : 'Quick Tools Dock'}
        onMouseLeave={() => setHoveredTool(null)}
        data-collapsed={isCollapsed ? 'true' : undefined}
      >
        {isCollapsed ? (
          <button
            type="button"
            className="toolbar-btn"
            aria-label="Expand Toolbar"
            onClick={toggleCollapsed}
          >
            <Pencil size={18} aria-hidden="true" />
          </button>
        ) : (
          <div
            className="toolbar-drag-handle"
            aria-hidden="true"
            onPointerDown={onPointerDown}
            title="Drag Toolbar"
          >
            ⠿
          </div>
        )}

        {!isCollapsed && (
          <>
            <div
              className={styles.segment}
              role="group"
              aria-label="Navigation"
            >
              {[...toolGroups[0].tools, ...toolGroups[2].tools].map((tool) =>
                renderToolButton(tool),
              )}
            </div>
            <div className={styles.segment} key={isDesign ? 'design' : 'play'}>
              {renderToolMenu('Draw', toolGroups[1].tools)}
              {isDesign ? (
                <>
                  {onEditScene && (
                    <button
                      type="button"
                      className={'toolbar-btn ' + styles.category}
                      onClick={onEditScene}
                    >
                      Scene Properties
                    </button>
                  )}
                  {onOpenProps && (
                    <button
                      type="button"
                      className={'toolbar-btn ' + styles.category}
                      onClick={onOpenProps}
                    >
                      Props
                    </button>
                  )}
                  {dmUtilityGroup?.tools.map((tool) =>
                    renderToolButton(tool, true),
                  )}
                  {dmFogGroup && renderToolMenu('Fog Setup', dmFogGroup.tools)}
                </>
              ) : (
                <>
                  {renderToolMenu('Spells', toolGroups[3].tools)}
                  {revealTools.length > 0 &&
                    renderToolMenu('Reveal Fog', revealTools)}
                </>
              )}
            </div>
            <div className={styles.segment} role="group" aria-label="Zoom">
              {cameraControls.map((tool) => renderToolButton(tool))}
            </div>
            <output className={styles.activeTool} aria-label="Active tool">
              {selectedTool?.id.startsWith('spell-') && 'Spell: '}
              {selectedTool?.label ?? 'Select / Move'}
            </output>

            <button
              type="button"
              className="toolbar-btn"
              onClick={toggleCollapsed}
              title="Minimize Toolbar"
              aria-label="Minimize Toolbar"
            >
              <Minus size={16} />
            </button>

            {/* Vertical Toggle */}
            <button
              type="button"
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
