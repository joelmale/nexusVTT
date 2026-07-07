import { render, screen, fireEvent } from '@testing-library/react';
import { GameToolbar } from '@/components/GameToolbar';
import {
  useGameStore,
  useIsHost,
  useCamera,
  useActiveTool,
  useActiveScene,
} from '@/stores/gameStore';
import { useSceneFog } from '@/stores/scene';
import { vi } from 'vitest';

// Mock the gameStore
vi.mock('@/stores/gameStore', () => ({
  useGameStore: vi.fn(),
  useIsHost: vi.fn(),
  useCamera: vi.fn(),
  useActiveTool: vi.fn(),
  // A9: the Fog toolbar group reads the active scene (to target the right
  // scene's fog) and its fog config (to reflect enabled/on state).
  useActiveScene: vi.fn(),
}));

// A9: FogLayer/GameToolbar's narrow fog selector - mocked separately from
// gameStore since it lives in the @/stores/scene barrel (see fogSlice.ts).
vi.mock('@/stores/scene', () => ({
  useSceneFog: vi.fn(),
}));

describe('GameToolbar', () => {
  const setActiveTool = vi.fn();
  const updateCamera = vi.fn();
  const setFogEnabled = vi.fn();
  const clearFog = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useGameStore as vi.Mock).mockReturnValue({
      setActiveTool,
      updateCamera,
    });
    (useGameStore as unknown as { getState: vi.Mock }).getState = vi
      .fn()
      .mockReturnValue({ setFogEnabled, clearFog });
    (useCamera as vi.Mock).mockReturnValue({ x: 0, y: 0, zoom: 1.0 });
    (useActiveScene as vi.Mock).mockReturnValue({
      id: 'scene-1',
      name: 'Test Scene',
    });
    (useSceneFog as vi.Mock).mockReturnValue(null);
  });

  it('should render the toolbar with default tool selected', () => {
    (useActiveTool as vi.Mock).mockReturnValue('select');
    (useIsHost as vi.Mock).mockReturnValue(false);
    render(<GameToolbar />);

    const selectButton = screen.getByRole('button', { name: 'Select / Move' });
    expect(selectButton).toHaveClass('active');
  });

  it('should call setActiveTool when a tool button is clicked', () => {
    (useActiveTool as vi.Mock).mockReturnValue('select');
    (useIsHost as vi.Mock).mockReturnValue(false);
    render(<GameToolbar />);

    const panButton = screen.getByRole('button', { name: 'Pan' });
    fireEvent.click(panButton);

    expect(setActiveTool).toHaveBeenCalledWith('pan');
  });

  it('should show DM tools for the host', () => {
    (useActiveTool as vi.Mock).mockReturnValue('select');
    (useIsHost as vi.Mock).mockReturnValue(true);
    render(<GameToolbar />);

    const createMaskButton = screen.getByRole('button', { name: 'Create Mask' });
    expect(createMaskButton).toBeInTheDocument();
  });

  it('should not show DM tools for non-host players', () => {
    (useActiveTool as vi.Mock).mockReturnValue('select');
    (useIsHost as vi.Mock).mockReturnValue(false);
    render(<GameToolbar />);

    const createMaskButton = screen.queryByRole('button', { name: 'Create Mask' });
    expect(createMaskButton).not.toBeInTheDocument();
  });

  it('should call updateCamera when zoom buttons are clicked', () => {
    (useActiveTool as vi.Mock).mockReturnValue('select');
    (useIsHost as vi.Mock).mockReturnValue(false);
    render(<GameToolbar />);

    const zoomInButton = screen.getByRole('button', { name: 'Zoom In' });
    fireEvent.click(zoomInButton);
    expect(updateCamera).toHaveBeenCalledWith({ zoom: 1.2 });

    const zoomOutButton = screen.getByRole('button', { name: 'Zoom Out' });
    fireEvent.click(zoomOutButton);
    expect(updateCamera).toHaveBeenCalledWith({ zoom: 0.8333333333333334 });

    const zoomResetButton = screen.getByRole('button', { name: '100%' });
    fireEvent.click(zoomResetButton);
    expect(updateCamera).toHaveBeenCalledWith({ x: 0, y: 0, zoom: 0.54 });
  });

  it('should render the toolbar with all the basic tools', () => {
    (useActiveTool as vi.Mock).mockReturnValue('select');
    (useIsHost as vi.Mock).mockReturnValue(false);
    render(<GameToolbar />);

    // Navigation tools
    expect(screen.getByRole('button', { name: 'Select / Move' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Measure' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ping' })).toBeInTheDocument();

    // Entity tools
    expect(screen.getByRole('button', { name: 'Notes' })).toBeInTheDocument();
  });

  it('should render the toolbar with all the drawing tools', () => {
    (useActiveTool as vi.Mock).mockReturnValue('select');
    (useIsHost as vi.Mock).mockReturnValue(false);
    render(<GameToolbar />);

    // Drawing tools
    expect(screen.getByRole('button', { name: 'Draw' })).toBeInTheDocument();
    // 'Line' appears in both drawing tools and spell tools
    expect(screen.getAllByRole('button', { name: 'Line' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Rectangle' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Circle' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cone / AOE' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Erase' })).toBeInTheDocument();

    // Spell tools (all 6 in a single group)
    expect(screen.getByRole('button', { name: 'Sphere' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ring' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cone' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cube' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wedge' })).toBeInTheDocument();
  });
});
