
import { render, screen, fireEvent } from '@testing-library/react';
import { SceneManager } from '@/components/Scene/SceneManager';
import { useGameStore, useScenes, useActiveScene, useIsHost, useUser } from '@/stores/gameStore';
import { vi } from 'vitest';

// Mock dependencies
vi.mock('@/stores/gameStore', () => ({
  useGameStore: vi.fn(),
  useScenes: vi.fn(),
  useActiveScene: vi.fn(),
  useIsHost: vi.fn(),
  useUser: vi.fn(),
}));

vi.mock('@/components/Scene/SceneCanvas', () => ({ SceneCanvas: () => <div>Scene Canvas</div> }));
vi.mock('@/components/Scene/SceneEditor', () => ({ SceneEditor: () => <div>Scene Editor</div> }));

describe('SceneManager', () => {
  const createScene = vi.fn().mockImplementation((scene) => ({ ...scene, id: 'new-scene-id' }));
  const setActiveScene = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    createScene.mockImplementation((scene) => ({ ...scene, id: 'new-scene-id' }));
    (useGameStore as vi.Mock).mockReturnValue({ createScene, setActiveScene });
    (useUser as vi.Mock).mockReturnValue({ id: 'user-1', name: 'Test User' });
    // Default mock for SceneList
    vi.doMock('@/components/Scene/SceneList', () => ({
      SceneList: ({ scenes, onSceneSelect }) => (
        <div>
          {scenes.map(s => (
            <button key={s.id} onClick={() => onSceneSelect(s.id)}>{s.name}</button>
          ))}
        </div>
      ),
    }));
  });

  describe('when no scenes exist', () => {
    beforeEach(() => {
      (useScenes as vi.Mock).mockReturnValue([]);
      (useActiveScene as vi.Mock).mockReturnValue(null);
    });

    it('should show "Create First Scene" button for host', () => {
      (useIsHost as vi.Mock).mockReturnValue(true);
      render(<SceneManager />);
      expect(screen.getByText('Create First Scene')).toBeInTheDocument();
    });

    it('should show "Waiting for DM" message for non-host', () => {
      (useIsHost as vi.Mock).mockReturnValue(false);
      render(<SceneManager />);
      expect(screen.getByText('Waiting for the DM to create scenes...')).toBeInTheDocument();
    });

    it('should call createScene when host clicks "Create First Scene"', () => {
      (useIsHost as vi.Mock).mockReturnValue(true);
      render(<SceneManager />);
      fireEvent.click(screen.getByText('Create First Scene'));
      expect(createScene).toHaveBeenCalled();
    });
  });

  describe('when scenes exist', () => {
    const scenes = [{ id: 'scene-1', name: 'Test Scene', drawings: [], tokens: [] }];

    beforeEach(() => {
      (useScenes as vi.Mock).mockReturnValue(scenes);
    });

    it('should render the scene list and canvas', () => {
      (useIsHost as vi.Mock).mockReturnValue(true);
      (useActiveScene as vi.Mock).mockReturnValue(scenes[0]);
      render(<SceneManager />);
      expect(screen.getByText('Test Scene')).toBeInTheDocument();
      expect(screen.getByText('Scene Canvas')).toBeInTheDocument();
    });

    it('should show "+ New Scene" button for host', () => {
      (useIsHost as vi.Mock).mockReturnValue(true);
      (useActiveScene as vi.Mock).mockReturnValue(scenes[0]);
      render(<SceneManager />);
      expect(screen.getByText('+ New Scene')).toBeInTheDocument();
    });

    it('should call createScene when host clicks \'+ New Scene\'', () => {
      (useIsHost as vi.Mock).mockReturnValue(true);
      (useActiveScene as vi.Mock).mockReturnValue(scenes[0]);
      render(<SceneManager />);
      fireEvent.click(screen.getByText('+ New Scene'));
      expect(createScene).toHaveBeenCalled();
    });

    it('should call setActiveScene when a scene is selected', () => {
      (useIsHost as vi.Mock).mockReturnValue(true);
      (useActiveScene as vi.Mock).mockReturnValue(scenes[0]);
      render(<SceneManager />);
      fireEvent.click(screen.getByText('Test Scene'));
      expect(setActiveScene).toHaveBeenCalledWith('scene-1');
    });

    it('should open the scene editor when editing a scene', () => {
      (useIsHost as vi.Mock).mockReturnValue(true);
      (useActiveScene as vi.Mock).mockReturnValue(scenes[0]);
      render(<SceneManager />);
      fireEvent.click(screen.getByTitle('Edit Scene'));
      expect(screen.getByText('Scene Editor')).toBeInTheDocument();
    });
  });
});
