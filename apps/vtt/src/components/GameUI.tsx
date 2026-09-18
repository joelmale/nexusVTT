import React, {
  useCallback,
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
import { ScenePill } from './Scene/ScenePill';
import { GeneratorOverlay } from './Generator/GeneratorOverlay';
import { GameToolbar } from './GameToolbar';
import { ErrorBoundary } from './ErrorBoundary';
import { PanelDock } from './PanelDock';
import { PlayerClusterFloating } from './PlayerClusterFloating';
import { FloatingPanel } from './FloatingPanel';
import { AtlasDock } from './Atlas/AtlasDock';
import ConnectionStatus from './ConnectionStatus';
import { applyColorScheme } from '@/utils/colorSchemes';
import { useUIStackStore, DOCK_ZONES } from '@/stores/uiStackStore';
import { useFocusModeController } from '@/hooks/useFocusMode';
import { useReducedMotionSync } from '@/hooks/useReducedMotion';
import { usePanelLayoutSync } from '@/hooks/usePanelLayout';
import { useDockLayoutSync } from '@/hooks/useDocking';
import { useFontSizeSync } from '@/hooks/useFontSize';
import { useThemeSync } from '@/hooks/useTheme';
import { DockRegion } from './DockRegion';
import { ContextPanel } from './ContextPanel';

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

export const GameUI: React.FC = () => {
  const activeScene = useActiveScene();
  const scenes = useScenes();
  const settings = useSettings();
  const colorScheme = useColorScheme();
  // Narrow selectors: the old `useGameStore()` (no selector) subscribed to the
  // ENTIRE store, so every set() — token moves, chat, connection heartbeats —
  // re-rendered GameUI and its whole subtree. Actions have stable identity.
  const user = useGameStore((state) => state.user);
  const leaveRoom = useGameStore((state) => state.leaveRoom);
  const syncGameStateToServer = useGameStore(
    (state) => state.syncGameStateToServer,
  );
  const roomCode = useServerRoomCode();

  const isHost = user.type === 'host';

  const activePanels = useUIStackStore(state => state.activePanels);
  const togglePanel = useUIStackStore(state => state.togglePanel);
  const selectPanel = useUIStackStore(state => state.selectPanel);

  // Immersive mode (press F) and the in-app reduced-motion setting. Both
  // mirror a flag onto <html> so CSS can reach portal-mounted chrome too.
  useFocusModeController();
  useReducedMotionSync();
  usePanelLayoutSync();
  useDockLayoutSync();
  useFontSizeSync();
  useThemeSync();

  const isGeneratorOpen = activePanels.includes('generator');
  const closeGenerator = useCallback(() => {
    togglePanel('generator');
  }, [togglePanel]);

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

  return (
    <div className="game-layout">
      {/* Dock region hosts. Docked FloatingPanels portal into these, which is
          what makes a dock reserve real layout space and reflow the canvas
          (see .game-layout's --dock-* grid tracks). Empty regions collapse. */}
      {DOCK_ZONES.map((zone) => (
        <DockRegion key={zone} zone={zone} />
      ))}

      <PlayerClusterFloating leaveRoom={leaveRoom} />

      <PanelDock
        panels={panels}
        activePanels={activePanels}
        onSelect={selectPanel}
      />

      <ScenePill scenes={scenes} activeSceneId={activeScene?.id || ''} />

      {/* Main Game Canvas */}
      <ErrorBoundary name="Main Canvas" key={activeScene?.id || 'no-scene'}>
        {/* tabIndex -1: focus is parked here when focus mode marks chrome inert */}
        <div className="layout-scene" tabIndex={-1}>
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
          </div>

          {/* Floating Toolbar */}
          {/* data-chrome lives on .layout-toolbar-inner (GameToolbar's own
              root), not here: this wrapper is purely grid positioning, and
              tagging both would double-fade and leave this one without inert. */}
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

      {/* Render all active FloatingPanels */}
      {activePanels.map((panelId) => {
        // Generator is handled via overlay, skip rendering its floating panel
        if (panelId === 'generator') return null;
        
        const panelConfig = panels.find((p) => p.id === panelId);
        if (!panelConfig) return null;

        return (
          <FloatingPanel
            key={panelId}
            panelId={panelId}
            isOpen={true}
            onClose={() => togglePanel(panelId)}
            label={panelConfig.label}
          >
            <Suspense fallback={<div className="panel-skeleton">Loading panel...</div>}>
              <ContextPanel
                activePanel={panelId as Parameters<typeof ContextPanel>[0]['activePanel']}
                onPanelChange={() => {}}
                expanded={true}
                onToggleExpanded={() => {}}
                onContentWidthChange={() => {}}
              />
            </Suspense>
          </FloatingPanel>
        );
      })}

      <GeneratorOverlay
        isOpen={isGeneratorOpen}
        onClose={closeGenerator}
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

      {/* 3D Dice Box (Global Overlay) */}
      <Suspense
        fallback={<div className="dice-loading">Loading 3D dice...</div>}
      >
        <DiceBox3D />
      </Suspense>

      {/* C4: Atlas Dock Component */}
      <AtlasDock />
    </div>
  );
};
