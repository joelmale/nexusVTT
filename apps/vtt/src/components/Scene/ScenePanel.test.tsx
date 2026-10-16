import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScenePanel } from './ScenePanel';
import { useGameStore, useIsHost } from '@/stores/gameStore';
import type { Scene } from '@/types/game';

vi.mock('@/stores/gameStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/stores/gameStore')>();
  return {
    ...actual,
    useIsHost: vi.fn(),
  };
});

const mockScene: Scene = {
  id: 'scene-1',
  name: 'Sunken Crypt',
  description: 'An ancient dungeon beneath the marshes',
  roomCode: 'TEST1',
  createdBy: 'dm-1',
  backgroundImage: {
    url: 'http://example.com/crypt.jpg',
    width: 2000,
    height: 2000,
    offsetX: -1000,
    offsetY: -1000,
    scale: 1,
  },
  gridSettings: {
    enabled: true,
    size: 50,
    color: '#ffffff',
    opacity: 0.1,
    snapToGrid: true,
    showToPlayers: true,
  },
  lightingSettings: {
    enabled: false,
    globalIllumination: true,
    ambientLight: 0.5,
    darkness: 0,
  },
  visibility: 'private',
  isEditable: true,
  drawings: [],
  placedTokens: [],
  placedProps: [],
  isActive: true,
  playerCount: 1,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe('ScenePanel (Deliberate DM/Co-DM Map Selection & Scene Calibration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(useIsHost).mockReturnValue(true);
    useGameStore.setState({ updateScene: vi.fn(), deleteScene: vi.fn() });
    if (!document.getElementById('portal-root')) {
      const portalRoot = document.createElement('div');
      portalRoot.id = 'portal-root';
      document.body.appendChild(portalRoot);
    }
  });

  afterEach(() => {
    document.getElementById('portal-root')?.remove();
  });

  it('renders nothing when the user is not a host/DM (strict player isolation)', () => {
    vi.mocked(useIsHost).mockReturnValue(false);

    const { container } = render(<ScenePanel scene={mockScene} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders Scene Settings and Map Selection controls when user is host/DM', () => {
    vi.mocked(useIsHost).mockReturnValue(true);

    render(<ScenePanel scene={mockScene} />);

    expect(screen.getByText('Scene Settings')).toBeInTheDocument();
    expect(screen.getByText('Sunken Crypt')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Change Map' }));
    expect(screen.getByText(/Browse Base Maps/i)).toBeInTheDocument();
  });

  it('opens deliberate BaseMapBrowser when clicking Browse Base Maps', () => {
    vi.mocked(useIsHost).mockReturnValue(true);

    render(<ScenePanel scene={mockScene} />);

    fireEvent.click(screen.getByRole('button', { name: 'Change Map' }));
    const browseBtn = screen.getByText(/Browse Base Maps/i);
    fireEvent.click(browseBtn);

    // BaseMapBrowser opens in Portal and renders header & search input
    expect(screen.getByText(/Default Base Maps/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Search maps\.\.\./i),
    ).toBeInTheDocument();
  });

  it('shows one settings section and reveals the URL form on demand', () => {
    render(<ScenePanel scene={mockScene} />);
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.queryByRole('textbox', { name: 'Image URL' })).toBeNull();
    expect(screen.queryByText('Danger Zone')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Change Map' }));
    fireEvent.click(screen.getByRole('button', { name: /From URL/ }));
    expect(screen.getByRole('textbox', { name: 'Image URL' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
    expect(screen.queryByRole('textbox', { name: 'Image URL' })).toBeNull();
  });

  it('supports keyboard tabs and restores the saved section', () => {
    localStorage.setItem('scenePanel.activeTab', 'grid');
    render(<ScenePanel scene={mockScene} />);
    const gridTab = screen.getByRole('tab', { name: 'Grid' });
    expect(gridTab).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(gridTab, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Lighting' })).toHaveFocus();
    expect(localStorage.getItem('scenePanel.activeTab')).toBe('lighting');
    expect(
      screen.queryByRole('spinbutton', { name: 'Cell size value' }),
    ).toBeNull();
  });

  it('updates exact grid values, presets, type, and percent opacity', () => {
    render(<ScenePanel scene={mockScene} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Grid' }));
    fireEvent.click(screen.getByRole('button', { name: '70px' }));
    expect(useGameStore.getState().updateScene).toHaveBeenLastCalledWith(
      'scene-1',
      {
        gridSettings: { ...mockScene.gridSettings, size: 70 },
      },
    );
    fireEvent.change(
      screen.getByRole('spinbutton', { name: 'Cell size value' }),
      { target: { value: '85' } },
    );
    expect(useGameStore.getState().updateScene).toHaveBeenLastCalledWith(
      'scene-1',
      {
        gridSettings: { ...mockScene.gridSettings, size: 85 },
      },
    );
    fireEvent.change(
      screen.getByRole('spinbutton', { name: 'Opacity value' }),
      { target: { value: '50' } },
    );
    expect(useGameStore.getState().updateScene).toHaveBeenLastCalledWith(
      'scene-1',
      {
        gridSettings: { ...mockScene.gridSettings, opacity: 0.5 },
      },
    );
    fireEvent.click(screen.getByRole('radio', { name: /Hex/ }));
    expect(useGameStore.getState().updateScene).toHaveBeenLastCalledWith(
      'scene-1',
      {
        gridSettings: { ...mockScene.gridSettings, type: 'hex' },
      },
    );
  });

  it('updates lighting percentages and compact visibility permissions', () => {
    render(
      <ScenePanel
        scene={{
          ...mockScene,
          lightingSettings: { ...mockScene.lightingSettings, enabled: true },
        }}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Lighting' }));
    fireEvent.change(
      screen.getByRole('spinbutton', { name: 'Ambient light value' }),
      { target: { value: '35' } },
    );
    expect(useGameStore.getState().updateScene).toHaveBeenLastCalledWith(
      'scene-1',
      {
        lightingSettings: {
          ...mockScene.lightingSettings,
          enabled: true,
          ambientLight: 0.35,
        },
      },
    );
    fireEvent.click(screen.getByRole('tab', { name: 'General' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Shared' }));
    expect(useGameStore.getState().updateScene).toHaveBeenLastCalledWith(
      'scene-1',
      { visibility: 'shared' },
    );
  });

  it('requires confirmation and cancels pending deletion when changing tabs', () => {
    render(<ScenePanel scene={mockScene} />);
    fireEvent.click(screen.getByRole('tab', { name: 'General' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Scene' }));
    expect(useGameStore.getState().deleteScene).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('tab', { name: 'Map' }));
    fireEvent.click(screen.getByRole('tab', { name: 'General' }));
    expect(screen.queryByRole('button', { name: 'Confirm delete' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Scene' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    expect(useGameStore.getState().deleteScene).toHaveBeenCalledWith('scene-1');
  });

  it('does not carry a deletion confirmation to a different scene', () => {
    const { rerender } = render(<ScenePanel scene={mockScene} />);
    fireEvent.click(screen.getByRole('tab', { name: 'General' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Scene' }));
    rerender(<ScenePanel scene={{ ...mockScene, id: 'scene-2' }} />);
    expect(screen.queryByRole('button', { name: 'Confirm delete' })).toBeNull();
    expect(useGameStore.getState().deleteScene).not.toHaveBeenCalled();
  });

  it('includes props when confirming deletion of all scene objects', () => {
    useGameStore.setState({
      clearDrawings: vi.fn(),
      deleteToken: vi.fn(),
      deleteProp: vi.fn(),
    });
    const sceneWithProps = {
      ...mockScene,
      placedProps: [{ id: 'prop-1' } as Scene['placedProps'][number]],
    };
    render(<ScenePanel scene={sceneWithProps} />);
    fireEvent.click(screen.getByRole('tab', { name: 'General' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete All Objects' }));
    expect(useGameStore.getState().deleteProp).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    expect(useGameStore.getState().deleteProp).toHaveBeenCalledWith(
      'scene-1',
      'prop-1',
    );
    expect(useGameStore.getState().clearDrawings).toHaveBeenCalledWith(
      'scene-1',
    );
  });
});
