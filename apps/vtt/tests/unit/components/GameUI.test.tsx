import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameUI } from '@/components/GameUI';

// Mock dependencies
vi.mock('@/stores/gameStore', () => ({
  useActiveScene: vi.fn(() => ({ id: 'scene-1', name: 'Test Scene' })),
  useScenes: vi.fn(() => [{ id: 'scene-1', name: 'Test Scene' }]),
  useSettings: vi.fn(() => ({ enableGlassmorphism: false })),
  useColorScheme: vi.fn(() => ({ primary: '#000000', secondary: '#000000', background: '#000000', surface: '#000000', text: '#000000' })),
  useIsHost: vi.fn(() => true),
  useSession: vi.fn(() => ({ user: { id: 'host-1', name: 'Host' } })),
  useSceneState: vi.fn(() => ({ scenes: [{ id: 'scene-1', name: 'Test Scene' }], activeSceneId: 'scene-1' })),
  useGameStore: Object.assign(
    vi.fn(() => ({
      user: { id: 'host-1', name: 'Host', type: 'host' },
      leaveRoom: vi.fn(),
      syncGameStateToServer: vi.fn(),
    })),
    { getState: vi.fn(() => ({ activeSceneId: 'scene-1' })) }
  ),
  useServerRoomCode: vi.fn(() => 'TEST-123'),
}));

vi.mock('@/stores/uiStackStore', () => ({
  useUIStackStore: vi.fn((selector) => {
    // Return mock state based on the selector function's string representation
    const selectorStr = selector.toString();
    if (selectorStr.includes('activePanels')) return ['dice'];
    if (selectorStr.includes('togglePanel')) return vi.fn();
    return vi.fn();
  }),
  useStackZIndex: vi.fn(() => 70),
}));

vi.mock('@/components/Scene/SceneCanvas', () => ({
  SceneCanvas: () => <div data-testid="scene-canvas">Mock Canvas</div>,
}));

vi.mock('@/components/DiceBox3D', () => ({
  DiceBox3D: () => <div id="dice-box" data-testid="dice-box">Mock DiceBox3D</div>,
}));

vi.mock('@/components/FloatingPanel', () => ({
  FloatingPanel: ({ children, panelId }: { children: React.ReactNode, panelId: string }) => (
    <div data-testid={`floating-panel-${panelId}`} className="mock-floating-panel">
      {children}
    </div>
  ),
}));

vi.mock('@/components/Generator/GeneratorOverlay', () => ({
  GeneratorOverlay: ({ children }: { children: React.ReactNode }) => <div data-testid="generator-overlay">{children}</div>,
}));

vi.mock('@/components/ContextPanel', () => ({
  ContextPanel: () => <div data-testid="context-panel">Mock ContextPanel</div>,
}));

vi.mock('@/components/GameToolbar', () => ({
  GameToolbar: () => <div data-testid="game-toolbar">Mock GameToolbar</div>,
}));

vi.mock('@/components/PlayerClusterFloating', () => ({
  PlayerClusterFloating: () => <div data-testid="player-cluster">Mock PlayerCluster</div>,
}));

describe('GameUI Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders DiceBox3D outside of the scene-content-relative div to prevent z-index occlusion', async () => {
    render(<GameUI />);
    
    // Find the scene-content-relative div
    const sceneContent = document.querySelector('.scene-content-relative');
    expect(sceneContent).toBeInTheDocument();
    
    // Find the dice-box container
    // Need to use findByTestId because it's lazy loaded
    const diceBox = await screen.findByTestId('dice-box');
    expect(diceBox).toBeInTheDocument();
    
    // Regression check: Ensure the dice-box is NOT a child of sceneContent
    // This is critical because scene-content-relative creates a z-index stacking context (z-index: 1),
    // which traps the 3D dice behind floating panels (z-index: 70).
    expect(sceneContent?.contains(diceBox)).toBe(false);
  });
});
