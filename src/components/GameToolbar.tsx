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
import {
  Box,
  Circle,
  Compass,
  Eraser,
  Grid3x3,
  Hand,
  Eye,
  EyeOff,
  Minus,
  MousePointer2,
  Pencil,
  Ruler,
  Sparkles,
  Square,
  Target,
  Triangle,
  Wand2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

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

export const GameToolbar: React.FC = () => {
  const activeTool = useActiveTool();
  const isHost = useIsHost();
  const { updateCamera, setActiveTool } = useGameStore();
  const camera = useCamera();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [hoveredTool, setHoveredTool] = useState<ToolbarItem | null>(null);

  const handleZoomIn = useCallback(
    () => updateCamera({ zoom: Math.min(5.0, camera.zoom * 1.2) }),
    [camera.zoom, updateCamera],
  );
  const handleZoomOut = useCallback(
    () => updateCamera({ zoom: Math.max(0.1, camera.zoom / 1.2) }),
    [camera.zoom, updateCamera],
  );
  const handleZoomReset = useCallback(
    () => updateCamera({ x: 0, y: 0, zoom: 1.0 }),
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
            id: 'draw',
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
            id: 'erase',
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
            id: 'props',
            icon: <Box size={18} />,
            label: 'Props',
            tooltip: 'Place and edit props',
          },
          {
            id: 'note',
            icon: <Compass size={18} />,
            label: 'Notes',
            tooltip: 'Add notes/markers',
          },
        ],
      },
    ],
    [],
  );

  const dmToolGroup: ToolbarGroup | null = useMemo(
    () =>
      isHost
        ? {
            id: 'dm',
            label: 'DM Tools',
            tools: [
              {
                id: 'mask-create',
                icon: <Sparkles size={18} />,
                label: 'Create Mask',
              },
              {
                id: 'mask-toggle',
                icon: <Wand2 size={18} />,
                label: 'Toggle Mask',
              },
              {
                id: 'mask-remove',
                icon: <Eraser size={18} />,
                label: 'Remove Mask',
              },
              {
                id: 'mask-show',
                icon: <Eye size={18} />,
                label: 'Reveal Scene',
              },
              {
                id: 'mask-hide',
                icon: <EyeOff size={18} />,
                label: 'Hide Scene',
              },
              {
                id: 'grid-align',
                icon: <Grid3x3 size={18} />,
                label: 'Grid Alignment',
              },
            ],
          }
        : null,
    [isHost],
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
        ...(dmToolGroup ? dmToolGroup.tools : []),
      ];
      const tool = allTools.find(
        (t) =>
          t.shortcut &&
          t.shortcut.toUpperCase() === key &&
          !t.shortcut.includes('+'),
      );

      if (tool) {
        e.preventDefault();
        setActiveTool(tool.id);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTool, toolGroups, dmToolGroup]);

  const renderToolButton = (tool: ToolbarItem) => {
    return (
      <button
        key={tool.id}
        data-id={tool.id}
        type="button"
        className={`toolbar-btn ${activeTool === tool.id ? 'active' : ''} ${
          tool.disabled ? 'disabled' : ''
        } ${tool.className || ''}`}
        onClick={tool.action ? tool.action : () => setActiveTool(tool.id)}
        disabled={tool.disabled}
        aria-pressed={activeTool === tool.id}
        aria-label={tool.label}
        title={tool.tooltip || tool.label}
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
    <>
      <div id="toolbar-info-banner">
        {hoveredTool ? (
          <>
            <span>{hoveredTool.tooltip || hoveredTool.label}</span>
            {hoveredTool.shortcut && (
              <span className="shortcut">{hoveredTool.shortcut}</span>
            )}
          </>
        ) : (
          <span>Hover over a tool for information.</span>
        )}
      </div>

      <div
        ref={toolbarRef}
        className="game-toolbar"
        role="toolbar"
        onMouseLeave={() => setHoveredTool(null)}
      >
        <div className="toolbar-row">
          {toolGroups.flatMap((g) => g.tools).map(renderToolButton)}
        </div>
        <div className="toolbar-row">
          {isHost && dmToolGroup && dmToolGroup.tools.map(renderToolButton)}
          {cameraControls.map(renderToolButton)}
        </div>
      </div>
    </>
  );
};
