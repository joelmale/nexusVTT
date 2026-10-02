import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScenePanel } from './ScenePanel';
import { useIsHost } from '@/stores/gameStore';
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
    expect(screen.getByText(/Browse Base Maps/i)).toBeInTheDocument();
  });

  it('opens deliberate BaseMapBrowser when clicking Browse Base Maps', () => {
    vi.mocked(useIsHost).mockReturnValue(true);

    render(<ScenePanel scene={mockScene} />);

    const browseBtn = screen.getByText(/Browse Base Maps/i);
    fireEvent.click(browseBtn);

    // BaseMapBrowser opens in Portal and renders header & search input
    expect(screen.getByText(/Default Base Maps/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search maps\.\.\./i)).toBeInTheDocument();
  });
});
