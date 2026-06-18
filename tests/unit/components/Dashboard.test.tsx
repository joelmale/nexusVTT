import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Dashboard } from '@/components/Dashboard';
import { useGameStore } from '@/stores/gameStore';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
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
  it('renders the VTT Gothic/Fantasy Dashboard elements correctly', async () => {
    // Arrange mocks
    vi.mocked(useGameStore).mockReturnValue({
      user: { id: 'user-1', name: 'Adventurer Joel' },
      isAuthenticated: true,
      authChecked: true,
      joinRoomWithCode: vi.fn(),
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
    vi.useFakeTimers();
    render(<Dashboard />);
    vi.runAllTimers();

    // Assert key layout elements are in the document
    vi.useRealTimers();
    expect(await screen.findByText('Adventurer Joel', { exact: false })).toBeInTheDocument();
    expect(await screen.findByText('Document Library')).toBeInTheDocument();
    expect(await screen.findByText('Lost Mine of Phandelver')).toBeInTheDocument();
    expect(await screen.findByText('Gimli')).toBeInTheDocument();
  });
});
