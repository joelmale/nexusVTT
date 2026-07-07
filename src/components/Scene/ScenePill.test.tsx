import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ScenePill } from './ScenePill';
import type { Scene } from '@/types/game';

/**
 * Covers the A6c ScenePill contract:
 *  - host renders the pill (with the active scene's name)
 *  - non-host renders nothing (players never get scene control under the
 *    floating-panels flag - they follow the DM's active scene)
 *  - clicking the pill opens a popover listing scenes
 *  - clicking a scene in the popover fires the switch action
 */

const mockUseIsHost = vi.fn();
const mockSetActiveScene = vi.fn();
const mockCreateScene = vi.fn();
const mockDeleteScene = vi.fn();
const mockUpdateScene = vi.fn();
const mockReorderScenes = vi.fn();

vi.mock('@/stores/gameStore', () => ({
  useGameStore: () => ({
    setActiveScene: mockSetActiveScene,
    createScene: mockCreateScene,
    deleteScene: mockDeleteScene,
    updateScene: mockUpdateScene,
    reorderScenes: mockReorderScenes,
  }),
  useSession: () => ({ hostId: 'host-1' }),
  useIsHost: () => mockUseIsHost(),
}));

const scenes: Scene[] = [
  {
    id: 'scene-1',
    name: 'The Tavern',
    description: '',
    visibility: 'public',
    isEditable: true,
  } as Scene,
  {
    id: 'scene-2',
    name: 'The Dungeon',
    description: '',
    visibility: 'public',
    isEditable: true,
  } as Scene,
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ScenePill', () => {
  it('renders the pill with the active scene name for a host', () => {
    mockUseIsHost.mockReturnValue(true);

    render(<ScenePill scenes={scenes} activeSceneId="scene-1" />);

    expect(screen.getByText('The Tavern')).not.toBeNull();
  });

  it('renders nothing for a non-host', () => {
    mockUseIsHost.mockReturnValue(false);

    const { container } = render(
      <ScenePill scenes={scenes} activeSceneId="scene-1" />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('opens a popover listing scenes on click', () => {
    mockUseIsHost.mockReturnValue(true);

    render(<ScenePill scenes={scenes} activeSceneId="scene-1" />);

    fireEvent.click(screen.getByRole('button', { name: /switch scene/i }));

    const dialog = screen.getByRole('dialog', { name: /scene switcher/i });
    expect(dialog).not.toBeNull();
    expect(dialog.textContent).toContain('The Tavern');
    expect(dialog.textContent).toContain('The Dungeon');
  });

  it('fires the switch action when a scene tab in the popover is clicked', () => {
    mockUseIsHost.mockReturnValue(true);

    render(<ScenePill scenes={scenes} activeSceneId="scene-1" />);

    fireEvent.click(screen.getByRole('button', { name: /switch scene/i }));

    const dungeonTab = screen.getByRole('tab', { name: /The Dungeon/i });
    fireEvent.click(dungeonTab);

    expect(mockSetActiveScene).toHaveBeenCalledWith('scene-2');
  });

  it('closes the popover on Escape', () => {
    mockUseIsHost.mockReturnValue(true);

    render(<ScenePill scenes={scenes} activeSceneId="scene-1" />);

    fireEvent.click(screen.getByRole('button', { name: /switch scene/i }));
    expect(screen.getByRole('dialog', { name: /scene switcher/i })).not.toBeNull();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: /scene switcher/i })).toBeNull();
  });
});
