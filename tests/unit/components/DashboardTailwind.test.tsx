import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DashboardTailwind } from '@/components/DashboardTailwind';
import { useGameStore, useSettings } from '@/stores/gameStore';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

// Mock game store and settings
vi.mock('@/stores/gameStore', () => ({
  useGameStore: vi.fn(),
  useSettings: vi.fn(),
}));

// Mock hook
vi.mock('@/hooks', () => ({
  useCharacterCreationLauncher: vi.fn(() => ({
    startCharacterCreation: vi.fn(),
    LauncherComponent: null,
  })),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('DashboardTailwind', () => {
  it('renders the VTT Dashboard elements correctly', async () => {
    // Arrange mocks
    vi.mocked(useGameStore).mockReturnValue({
      user: { id: 'user-1', name: 'Adventurer Joel' },
      isAuthenticated: true,
      joinRoomWithCode: vi.fn(),
      setEnableTailwindDashboard: vi.fn(),
    });

    vi.mocked(useSettings).mockReturnValue({
      reducedMotion: false,
      enableTailwindDashboard: true,
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
      return Promise.resolve({ ok: false });
    });

    // Act
    render(<DashboardTailwind />);

    // Assert key layout elements are in the document (allowing up to 2 seconds for the 1-second auth check timeout to resolve)
    expect(await screen.findByText('NexusVTT', {}, { timeout: 2000 })).toBeInTheDocument();
    expect(await screen.findByText('Beta')).toBeInTheDocument();
    expect(await screen.findByText('Quick Join')).toBeInTheDocument();
    expect(await screen.findByText('Recent Campaigns')).toBeInTheDocument();
    expect(await screen.findByText('Recent Characters')).toBeInTheDocument();
    expect(await screen.findByText('Document Library')).toBeInTheDocument();
    expect(await screen.findByText('Offline Mode Active')).toBeInTheDocument();
  });
});
