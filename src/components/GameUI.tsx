/**
 * Game UI Component
 *
 * This component renders the main game interface.
 */

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  Suspense,
} from 'react';
import {
  useActiveScene,
  useScenes,
  useSettings,
  useColorScheme,
  useGameStore,
  useServerRoomCode,
} from '@/stores/gameStore';
import { SceneCanvas } from './Scene/SceneCanvas';
import { SceneTabs } from './Scene/SceneTabs';
import { ScenePill } from './Scene/ScenePill';
import { GeneratorOverlay } from './Generator/GeneratorOverlay';
import { GameToolbar } from './GameToolbar';
import { PlayerBar, PlayerActions } from './PlayerBar';
import { ContextPanel } from './ContextPanel';
import { ErrorBoundary } from './ErrorBoundary';
import { PanelDock } from './PanelDock';
import { PlayerClusterFloating } from './PlayerClusterFloating';
import { FloatingPanel } from './FloatingPanel';
import { useFlag } from '@/utils/featureFlags';
import { AtlasDock } from './Atlas/AtlasDock';

// Lazy load heavy panels
const GeneratorPanel = React.lazy(() =>
  import('./Generator/GeneratorPanel').then((module) => ({
    default: module.GeneratorPanel,
  })),
);
const DiceBox3D = React.lazy(() =>
  import('./DiceBox3D').then((module) => ({
    default: module.DiceBox3D,
  })),
);
import ConnectionStatus from './ConnectionStatus';
import { applyColorScheme } from '@/utils/colorSchemes';

export const GameUI: React.FC = () => {
  const activeScene = useActiveScene();
  const scenes = useScenes();
  const settings = useSettings();
  const colorScheme = useColorScheme();
  const { user, leaveRoom, syncGameStateToServer } = useGameStore();
  const roomCode = useServerRoomCode();

  const isHost = user.type === 'host';

  // A6a: floating-panels flag. ON by default renders a single-column grid
  // with ContextPanel inside a portal-mounted FloatingPanel. Explicit OFF
  // preserves the legacy reserved sidebar column and resize handle.
  const floatingPanelsEnabled = useFlag('floating-panels');

  const [panelExpanded, setPanelExpanded] = useState(true);
  const [activePanel, setActivePanel] = useState<
    | 'tokens'
    | 'scene'
    | 'props'
    | 'generator'
    | 'initiative'
    | 'dice'
    | 'chat'
    | 'sounds'
    | 'lobby'
    | 'settings'
    | 'documents'
    | 'characters'
  >(isHost ? 'scene' : 'lobby');

  // A6a (flag-gated only): ContextPanel's `activePanel` union has no "none"
  // member - it always names one of the 12 panels, so the legacy sidebar
  // always shows *something*. The floating shell needs a genuine closed
  // state (clicking the active tab again, or Escape, closes the panel), so
  // that's modeled here as a separate boolean rather than widening
  // `activePanel` to `| null` - keeps the flag-off type/behavior untouched.
  const [floatingPanelOpen, setFloatingPanelOpen] = useState(true);

  const handlePanelTabSelect = useCallback(
    (panel: typeof activePanel) => {
      if (floatingPanelsEnabled && panel === activePanel && floatingPanelOpen) {
        setFloatingPanelOpen(false);
        return;
      }
      setActivePanel(panel);
      setFloatingPanelOpen(true);
    },
    [floatingPanelsEnabled, activePanel, floatingPanelOpen],
  );

  // A6c: GeneratorPanel modal hygiene (always on, not flag-gated - this is a
  // bug fix, not a layout change). Escape/focus-trap/focus-restore now live
  // in GeneratorOverlay (see Generator/GeneratorOverlay.tsx) so they're
  // independently testable without mounting all of GameUI.
  const isGeneratorOpen = activePanel === 'generator';

  const closeGenerator = useCallback(() => {
    setActivePanel('scene');
  }, []);

  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [collapsedWidth] = useState(8); // Width when collapsed (just the resize handle)
  const previousWidthRef = useRef(300); // Store the width before collapsing

  // Apply color scheme on mount and when it changes
  useEffect(() => {
    applyColorScheme(colorScheme);
  }, [colorScheme]);

  // Apply theme based on glassmorphism setting using theme manager
  useEffect(() => {
    import('@/services/themeManager').then(({ switchTheme }) => {
      const targetTheme = settings.enableGlassmorphism ? 'glass' : 'solid';
      switchTheme(targetTheme);
    });
  }, [settings.enableGlassmorphism]);

  // Sync sidebarWidth state with CSS variable for layout
  useEffect(() => {
    const effectiveWidth = panelExpanded ? sidebarWidth : collapsedWidth;
    document.documentElement.style.setProperty(
      '--sidebar-width',
      `${effectiveWidth}px`,
    );
  }, [sidebarWidth, panelExpanded, collapsedWidth]);

  // Resize functionality
  const isResizing = useRef(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const startMouseX = useRef(0);
  const startWidth = useRef(0);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const handle = e.currentTarget as HTMLElement;

      isResizing.current = true;
      startMouseX.current = e.clientX;
      startWidth.current = sidebarWidth;

      // Add dragging class for visual feedback
      handle.classList.add('dragging');

      // Set cursor and prevent text selection globally
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      document.body.style.pointerEvents = 'none';

      const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing.current) return;

        requestAnimationFrame(() => {
          const deltaX = startMouseX.current - e.clientX;
          const newWidth = startWidth.current + deltaX;

          const minWidth = 250;
          const maxWidth = window.innerWidth * 0.6;

          const constrainedWidth = Math.max(
            minWidth,
            Math.min(maxWidth, newWidth),
          );

          // Auto-expand panel when dragging from collapsed state
          if (!panelExpanded && constrainedWidth > collapsedWidth + 50) {
            setPanelExpanded(true);
          }

          setSidebarWidth(constrainedWidth);
        });
      };

      const handleMouseUp = () => {
        if (!isResizing.current) return;

        isResizing.current = false;

        handle.classList.remove('dragging');

        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.body.style.pointerEvents = '';

        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('mouseleave', handleMouseUp);

        document.removeEventListener('pointermove', handleMouseMove);
        document.removeEventListener('pointerup', handleMouseUp);
        document.removeEventListener('pointercancel', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove, {
        passive: false,
      });
      document.addEventListener('mouseup', handleMouseUp, { passive: false });
      document.addEventListener('mouseleave', handleMouseUp, {
        passive: false,
      });

      document.addEventListener('pointermove', handleMouseMove, {
        passive: false,
      });
      document.addEventListener('pointerup', handleMouseUp, {
        passive: false,
      });
      document.addEventListener('pointercancel', handleMouseUp, {
        passive: false,
      });
    },
    [sidebarWidth, panelExpanded, collapsedWidth],
  );

  const handleContentWidthChange = useCallback((width: number) => {
    if (width > 0) {
      setSidebarWidth(width);
    }
  }, []);

  const handleTogglePanel = useCallback(() => {
    if (panelExpanded) {
      // Collapsing: Save current width and collapse to 0
      previousWidthRef.current = sidebarWidth;
      setPanelExpanded(false);
    } else {
      // Expanding: Restore previous width
      setSidebarWidth(previousWidthRef.current);
      setPanelExpanded(true);
    }
  }, [panelExpanded, sidebarWidth]);

  const panels = [
    { id: 'tokens' as const, icon: '👤', label: 'Tokens' },
    ...(isHost ? [{ id: 'scene' as const, icon: '🖼', label: 'Scene' }] : []),
    { id: 'props' as const, icon: '📦', label: 'Props' },
    ...(isHost
      ? [{ id: 'generator' as const, icon: '🗺️', label: 'Generator' }]
      : []),
    { id: 'initiative' as const, icon: '⏱', label: 'Initiative' },
    { id: 'characters' as const, icon: '👥', label: 'Characters' },
    { id: 'dice' as const, icon: '🎲', label: 'Dice' },
    { id: 'documents' as const, icon: '📚', label: 'Documents' },
    { id: 'chat' as const, icon: '💬', label: 'Chat' },
    ...(isHost ? [{ id: 'sounds' as const, icon: '🔊', label: 'Sounds' }] : []),
    { id: 'lobby' as const, icon: '🏠', label: 'Lobby' },
    { id: 'settings' as const, icon: '⚙️', label: 'Settings' },
  ];

  // Show waiting screen only for players when no scene exists
  if (!activeScene && !isHost) {
    return (
      <div className="linear-game-layout">
        <div className="game-header">
          <div className="header-left">
            <div className="room-info">
              <h2>🎲 Game Room: {roomCode}</h2>
              <p>
                Welcome, <strong>{user.name}</strong>!
                {isHost && (
                  <button
                    onClick={() => {
                      syncGameStateToServer();
                      console.log('💾 Manual save triggered');
                    }}
                    className="glass-button small"
                    style={{ marginLeft: '12px', fontSize: '12px', padding: '4px 12px' }}
                    title="Save campaign to server"
                  >
                    💾 Save
                  </button>
                )}
              </p>
            </div>
          </div>
          <div className="header-right">
            <ConnectionStatus showDetails={false} />
            <button onClick={leaveRoom} className="glass-button secondary">
              <span>🚪</span>
              Leave Room
            </button>
          </div>
        </div>

        <div className="game-setup-content">
          <div className="setup-panel glass-panel">
            <div className="player-waiting">
              <ConnectionStatus showDetails={true} className="mb-4" />
              <h2>⏳ Waiting for DM</h2>
              <p>The Dungeon Master is setting up the game...</p>
              <div className="waiting-animation">
                <div className="loading-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Handle case where DM has no scenes yet - show full interface but with empty scene
  if (!activeScene && isHost) {
    // DM sees full interface even without scenes - they can create scenes via the scene panel
  }

  return (
    <div
      className="game-layout"
      data-panel-expanded={panelExpanded}
      data-sidebar-width={panelExpanded ? sidebarWidth : 60}
      data-floating-panels={floatingPanelsEnabled ? true : undefined}
    >
      {/* Game Header - flag OFF only (pixel-identical to pre-A6b markup).
          Flag ON removes this row entirely; the map gains the 60px it
          used to cede to the header (see .game-layout[data-floating-panels]
          in layout-consolidated.css). */}
      {!floatingPanelsEnabled && (
        <div className="layout-header">
          <div className="header-left">
            <PlayerBar />
            <PlayerActions />
          </div>

          <div className="header-right">
            {/* Horizontal Panel Tabs */}
            <ul className="horizontal-panel-tabs" role="tablist">
              {panels.map((panel) => (
                <React.Fragment key={panel.id}>
                  <input
                    type="radio"
                    name="panel"
                    id={`panel-radio-${panel.id}`}
                    value={panel.id}
                    checked={activePanel === panel.id}
                    onChange={() => handlePanelTabSelect(panel.id)}
                    style={{ display: 'none' }}
                  />
                  <li className="horizontal-panel-tab" role="tab">
                    <label htmlFor={`panel-radio-${panel.id}`}>
                      <span className="panel-icon">{panel.icon}</span>
                      <span className="panel-label">{panel.label}</span>
                    </label>
                  </li>
                </React.Fragment>
              ))}
            </ul>

            {/* Collapse/Expand Toggle */}
            <div className="horizontal-panel-toggle">
              <button
                type="button"
                onClick={handleTogglePanel}
                title={panelExpanded ? 'Collapse panel' : 'Expand panel'}
              >
                <span className="toggle-icon">
                  {panelExpanded ? '»' : '«'}
                </span>
              </button>
            </div>

            {/* Leave Room Button */}
            <div className="header-action">
              <button
                onClick={leaveRoom}
                className="glass-button secondary small"
                title="Leave Room"
              >
                🚪
              </button>
            </div>
          </div>
        </div>
      )}

      {/* A6b: flag ON replaces the header row with two floating clusters -
          top-left PlayerBar (avatars/DM badges/save-load/Leave Room) and
          top-right PanelDock (icon buttons + ConnectionStatus). The
          FloatingPanel (rendered further below) is offset under the dock
          so the two never overlap. */}
      {floatingPanelsEnabled && (
        <>
          <PlayerClusterFloating leaveRoom={leaveRoom} />

          <PanelDock
            panels={panels}
            activePanel={activePanel}
            isOpen={floatingPanelOpen}
            onSelect={handlePanelTabSelect}
          />
        </>
      )}

      {/* A6c: flag ON replaces the permanent scene-tab-bar row with a
          host-only floating ScenePill (top-left, below PlayerClusterFloating)
          that opens a popover containing the same SceneTabs UI. Players get
          no scene strip at all under the flag - they follow the DM's active
          scene and never had local scene-switching in practice. Flag OFF
          renders the legacy row byte-identically. */}
      {floatingPanelsEnabled && (
        <ScenePill scenes={scenes} activeSceneId={activeScene?.id || ''} />
      )}

      {/* Main Game Canvas with Scene Tabs */}
      <ErrorBoundary name="Main Canvas" key={activeScene?.id || 'no-scene'}>
        <div className="layout-scene">
          {/* Browser-Style Scene Tab Bar (legacy, flag off only) */}
          {!floatingPanelsEnabled && (
            <div className="scene-tab-bar">
              <SceneTabs scenes={scenes} activeSceneId={activeScene?.id || ''} />
            </div>
          )}

          {/* Scene Content */}
          <div className="scene-content scene-content-relative">
            {activeScene ? (
              <SceneCanvas scene={activeScene} />
            ) : (
              <div className="empty-scene-state">
                <div className="empty-scene-content">
                  <h3>🎲 Ready to Create Your First Scene</h3>
                  <p>
                    Use the Scene panel on the right to create and configure
                    your first scene.
                  </p>
                </div>
              </div>
            )}

            {/* 3D Dice Box */}
            <Suspense
              fallback={<div className="dice-loading">Loading 3D dice...</div>}
            >
              <DiceBox3D />
            </Suspense>
          </div>

          {/* Floating Toolbar */}
          <div className="layout-toolbar">
            <Suspense
              fallback={
                <div className="toolbar-skeleton">Loading toolbar...</div>
              }
            >
              <GameToolbar />
            </Suspense>
          </div>
        </div>
      </ErrorBoundary>

      {/* Context Panel: legacy reserved-column sidebar (flag off, default)
          vs. floating portal-mounted shell (flag on, A6a). */}
      {floatingPanelsEnabled ? (
        <FloatingPanel
          isOpen={floatingPanelOpen}
          onClose={() => setFloatingPanelOpen(false)}
          label={
            panels.find((p) => p.id === activePanel)?.label ?? 'Panel'
          }
        >
          <Suspense
            fallback={<div className="panel-skeleton">Loading panel...</div>}
          >
            <ContextPanel
              activePanel={activePanel}
              onPanelChange={setActivePanel}
              expanded={panelExpanded}
              onToggleExpanded={handleTogglePanel}
              onContentWidthChange={handleContentWidthChange}
            />
          </Suspense>
        </FloatingPanel>
      ) : (
        <div
          ref={sidebarRef}
          className={`layout-panel`}
          data-expanded={panelExpanded}
        >
          {/* Resize Handle */}
          <div
            className="sidebar-resize-handle"
            onMouseDown={handleResizeStart}
          />

          <Suspense
            fallback={<div className="panel-skeleton">Loading panel...</div>}
          >
            <ContextPanel
              activePanel={activePanel}
              onPanelChange={setActivePanel}
              expanded={panelExpanded}
              onToggleExpanded={handleTogglePanel}
              onContentWidthChange={handleContentWidthChange}
            />
          </Suspense>
        </div>
      )}

      <GeneratorOverlay
        isOpen={isGeneratorOpen}
        onClose={closeGenerator}
        floatingPanelsEnabled={floatingPanelsEnabled}
      >
        <ErrorBoundary name="Generator Panel">
          <Suspense
            fallback={
              <div className="panel-skeleton">Loading generator...</div>
            }
          >
            <GeneratorPanel onSwitchToScenes={closeGenerator} />
          </Suspense>
        </ErrorBoundary>
      </GeneratorOverlay>

      {/* C4: Atlas Dock Component */}
      <AtlasDock />
    </div>
  );
};
