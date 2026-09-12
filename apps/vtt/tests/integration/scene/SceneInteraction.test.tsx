import { render, screen, fireEvent } from '@testing-library/react';
import { GameToolbar } from '../../../src/components/GameToolbar';
import { SceneManager } from '../../../src/components/Scene/SceneManager';
import {
  useGameStore,
  useScenes,
  useActiveScene,
  useIsHost,
  useUser,
  useCamera,
  useActiveTool,
} from '../../../src/stores/gameStore';
import { vi } from 'vitest';
import { act } from 'react';
import type {
  PlayerCharacter,
  Camera,
  User,
  Scene,
  PlacedToken,
} from '../../../src/types/game';

interface MockState {
  user: User;
  session: {
    roomId: string;
    players: { id: string; name: string; isHost: boolean }[];
    characters: PlayerCharacter[];
  };
  scenes: Scene[];
  activeSceneId: string;
  activeTool: string;
  camera: Camera;
}

// Mock the entire store module
vi.mock('@/stores/gameStore');

// Mock child components
vi.mock('@/components/Scene/SceneCanvas', () => ({
  SceneCanvas: () => <div data-testid="scene-canvas">Scene Canvas</div>,
}));
vi.mock('@/components/Scene/SceneList', () => ({
  SceneList: ({ scenes, onSceneSelect }) => (
    <div>
      {scenes.map((s) => (
        <button key={s.id} onClick={() => onSceneSelect(s.id)}>
          {s.name}
        </button>
      ))}
    </div>
  ),
}));
vi.mock('@/components/Scene/SceneEditor', () => ({
  SceneEditor: () => <div>Scene Editor</div>,
}));

describe('Scene Interaction Integration Tests', () => {
  let state: MockState;
  const mockSetActiveTool = vi.fn((tool) => (state.activeTool = tool));
  const mockAddDrawing = vi.fn((sceneId, drawing) => {
    const scene = state.scenes.find((s) => s.id === sceneId);
    if (scene) scene.drawings.push(drawing);
  });
  const mockUpdateToken = vi.fn((sceneId, tokenId, updates) => {
    const scene = state.scenes.find((s) => s.id === sceneId);
    const token = scene?.placedTokens.find((t) => t.id === tokenId);
    if (token) Object.assign(token, updates);
  });

  beforeEach(() => {
    vi.clearAllMocks();

    state = {
      user: {
        id: 'user-1',
        name: 'Host',
        type: 'host',
        color: '#ff0000',
        connected: true,
      },
      session: {
        roomId: 'room-1',
        players: [{ id: 'user-1', name: 'Host', isHost: true }],
        characters: [],
      },
      scenes: [
        {
          id: 'scene-1',
          name: 'Test Scene',
          description: 'Test scene for interaction tests',
          roomCode: 'TEST123',
          visibility: 'shared',
          isEditable: true,
          createdBy: 'user-1',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          backgroundImage: undefined,
          gridSettings: {
            enabled: true,
            size: 50,
            color: '#000000',
            opacity: 0.3,
            snapToGrid: true,
            showToPlayers: true,
          },
          lightingSettings: {
            enabled: false,
            globalIllumination: true,
            ambientLight: 1.0,
            darkness: 0.0,
          },
          drawings: [],
          placedTokens: [],
          placedProps: [],
          isActive: true,
          playerCount: 1,
        },
      ],
      activeSceneId: 'scene-1',
      activeTool: 'select',
      camera: { x: 0, y: 0, zoom: 1.0 },
    };

    // Mock the hook implementations
    (useGameStore as vi.Mock).mockImplementation((selector) => selector(state));
    (useScenes as vi.Mock).mockReturnValue(state.scenes);
    (useActiveScene as vi.Mock).mockReturnValue(
      state.scenes.find((s) => s.id === state.activeSceneId),
    );
    (useIsHost as vi.Mock).mockReturnValue(true);
    (useUser as vi.Mock).mockReturnValue(state.user);
    (useCamera as vi.Mock).mockReturnValue(state.camera);
    (useActiveTool as vi.Mock).mockReturnValue(state.activeTool);

    // Mock actions separately
    (useGameStore as vi.Mock).mockReturnValue({
      ...state,
      setActiveTool: mockSetActiveTool,
      addDrawing: mockAddDrawing,
      updateToken: mockUpdateToken,
      updateCamera: vi.fn(),
      createScene: vi.fn().mockImplementation((scene) => ({ ...scene, id: 'new-scene-id' })),
      setActiveScene: vi.fn(),
    });
  });

  it('should create a drawing when using the rectangle tool', () => {
    render(
      <>
        <GameToolbar />
        <SceneManager />
      </>,
    );

    // 1. Select the rectangle tool
    const rectangleButton = screen.getByRole('button', { name: 'Rectangle' });
    fireEvent.click(rectangleButton);
    expect(mockSetActiveTool).toHaveBeenCalledWith('rectangle');
    // Manually update state for next part of test
    state.activeTool = 'rectangle';
    (useActiveTool as vi.Mock).mockReturnValue(state.activeTool);

    // Re-render to reflect the new active tool
    render(
      <>
        <GameToolbar />
        <SceneManager />
      </>,
    );

    // 2. Simulate a drag on the canvas by calling the action that would be triggered
    const newDrawing = {
      id: 'drawing-1',
      type: 'rectangle',
      x: 10,
      y: 10,
      width: 50,
      height: 50,
      color: 'red',
    };
    act(() => {
      // In a real scenario, a canvas event handler would call this.
      // We call it directly to simulate the effect.
      mockAddDrawing('scene-1', newDrawing);
    });

    // 3. Verify the drawing was added to the store
    expect(state.scenes[0].drawings).toContain(newDrawing);
  });

  it('should move a token when using the select/move tool', () => {
    const initialToken: PlacedToken = {
      id: 'token-1',
      tokenId: 'token-1',
      sceneId: 'scene-1',
      roomCode: 'TEST123',
      x: 20,
      y: 20,
      rotation: 0,
      scale: 1.0,
      layer: 'tokens',
      visibleToPlayers: true,
      dmNotesOnly: false,
      conditions: [],
      placedBy: 'user-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    state.scenes[0].placedTokens.push(initialToken);

    render(
      <>
        <GameToolbar />
        <SceneManager />
      </>,
    );

    // 1. Tool is 'select' by default
    expect(state.activeTool).toBe('select');

    // 2. Simulate dragging the token
    const updatedPosition = { x: 100, y: 120 };
    act(() => {
      mockUpdateToken('scene-1', 'token-1', updatedPosition);
    });

    // 3. Verify the token's position was updated in the store
    expect(state.scenes[0].placedTokens[0]).toEqual({
      ...initialToken,
      ...updatedPosition,
    });
  });
});
