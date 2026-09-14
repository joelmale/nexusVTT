import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { Dashboard } from '@/components/Dashboard';
import { useGameStore } from '@/stores/gameStore';

const mockNavigate = vi.hoisted(() => vi.fn());

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock game store
vi.mock('@/stores/gameStore', () => ({
  useGameStore: vi.fn(),
}));

// Mock launcher hook
vi.mock('@/hooks', () => ({
  useCharacterCreationLauncher: vi.fn(() => ({
    startCharacterCreation: vi.fn(),
    LauncherComponent: null,
  })),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Dashboard', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the VTT Gothic/Fantasy Dashboard elements correctly', async () => {
    const createGameRoom = vi.fn();
    const joinRoomWithCode = vi.fn();

    // Arrange mocks
    vi.mocked(useGameStore).mockReturnValue({
      user: { id: 'user-1', name: 'Adventurer Joel' },
      isAuthenticated: true,
      authChecked: true,
      joinRoomWithCode,
      createGameRoom,
    });

    // Mock fetch responses for campaigns and characters
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/campaigns')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 'c-1', name: 'Lost Mine of Phandelver', description: 'Starter set campaign', dmId: 'dm-1', updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() }
          ]),
        });
      }
      if (url.includes('/api/characters')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 'ch-1', name: 'Gimli', ownerId: 'user-1', data: { race: 'Dwarf', class: 'Fighter', level: 3 }, updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() }
          ]),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 503,
        json: () => Promise.resolve({ error: 'Service unavailable in test' }),
      });
    });

    // Act
    render(<Dashboard />);

    // Assert key layout elements are in the document
    expect(await screen.findByText('Adventurer Joel', { exact: false })).toBeInTheDocument();
    expect(await screen.findByText('Document Library')).toBeInTheDocument();
    expect(await screen.findByText('Lost Mine of Phandelver')).toBeInTheDocument();
    expect(await screen.findByText('Gimli')).toBeInTheDocument();
  });

  it('renders character race objects using their display name', async () => {
    vi.mocked(useGameStore).mockReturnValue({
      user: { id: 'user-1', name: 'Adventurer Joel' },
      isAuthenticated: true,
      authChecked: true,
      joinRoomWithCode: vi.fn(),
      createGameRoom: vi.fn(),
    });

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/campaigns')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      if (url.includes('/api/characters')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                id: 'ch-object-race',
                name: 'Lyra',
                ownerId: 'user-1',
                data: {
                  race: {
                    name: 'High Elf',
                    speed: 30,
                    traits: [],
                    languages: ['Common', 'Elvish'],
                    proficiencies: [],
                    abilityScoreIncrease: { dexterity: 2 },
                  },
                  class: 'Wizard',
                  level: 4,
                },
                updatedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
              },
            ]),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 503,
        json: () => Promise.resolve({ error: 'Service unavailable in test' }),
      });
    });

    render(<Dashboard />);

    expect(await screen.findByText('Lyra')).toBeInTheDocument();
    expect(await screen.findByText('Lvl 4 High Elf Wizard')).toBeInTheDocument();
  });

  it('opens a saved campaign as host instead of joining it as a player', async () => {
    const createGameRoom = vi.fn().mockResolvedValue('ABCD12');
    const joinRoomWithCode = vi.fn();

    vi.mocked(useGameStore).mockReturnValue({
      user: { id: 'user-1', name: 'Adventurer Joel' },
      isAuthenticated: true,
      authChecked: true,
      joinRoomWithCode,
      createGameRoom,
    });

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/campaigns')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                id: 'c-1',
                name: 'Lost Mine of Phandelver',
                description: 'Starter set campaign',
                dmId: 'user-1',
                lastRoomCode: 'lmop42',
                updatedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
              },
            ]),
        });
      }
      if (url.includes('/api/characters')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 503,
        json: () => Promise.resolve({ error: 'Service unavailable in test' }),
      });
    });

    render(<Dashboard />);

    fireEvent.click(
      await screen.findByRole(
        'button',
        { name: /play/i },
        { timeout: 5000 },
      ),
    );

    await waitFor(() => {
      expect(createGameRoom).toHaveBeenCalledWith(
        {
          name: 'Lost Mine of Phandelver',
          description: 'Starter set campaign',
          estimatedTime: '',
          campaignType: 'campaign',
          maxPlayers: 6,
          campaignId: 'c-1',
          preferredRoomCode: 'LMOP42',
        },
        false,
      );
    });
    expect(joinRoomWithCode).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/lobby/game/ABCD12');
  });
});
