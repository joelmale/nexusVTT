import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '@nexus/character-contracts';

const mockStartCharacterCreation = vi.fn();

vi.mock('@/components/CharacterCard', () => ({
  CharacterCard: ({ character }: { character: Character }) => (
    <div data-testid="character-card">{character.name}</div>
  ),
}));
vi.mock('@/services/characterSyncService', () => ({
  characterSyncService: { syncStats: vi.fn() },
}));
vi.mock('@/hooks/useCharacterCreationLauncher', () => ({
  useCharacterCreationLauncher: () => ({
    startCharacterCreation: mockStartCharacterCreation,
    LauncherComponent: <div data-testid="launcher-component" />,
    isActive: false,
  }),
}));
vi.mock('@/services/playerIntentClient', () => ({
  sendPlayerIntent: vi.fn().mockResolvedValue({ status: 'applied' }),
}));

import { CharacterPanel } from '@/components/CharacterPanel';
import { CharacterCreationContext } from '../../../src/components/CharacterCreationContext';
import { useCharacterStore } from '@/stores/characterStore';
import { useGameStore } from '@/stores/gameStore';

function renderPanel() {
  return render(
    <CharacterCreationContext.Provider
      value={{
        startCharacterCreation: mockStartCharacterCreation,
        LauncherComponent: <div data-testid="launcher-component" />,
        isActive: false,
      }}
    >
      <CharacterPanel />
    </CharacterCreationContext.Provider>,
  );
}

function character(id: string, playerId?: string): Character {
  return {
    id,
    name: id,
    level: 1,
    hitPoints: 10,
    abilities: {},
    skills: {},
    playerId,
  } as unknown as Character;
}

function setRole(type: 'host' | 'player') {
  useGameStore.setState((state) => {
    state.user.id = type === 'host' ? 'dm' : 'p1';
    state.user.type = type;
    state.session = {
      roomCode: 'ABCD',
      hostId: 'dm',
      players: [
        { id: 'dm', name: 'DM', type: 'host' },
        { id: 'p1', name: 'Mia', type: 'player' },
      ],
      status: 'connected',
    } as never;
  });
}

describe('CharacterPanel onboarding and empty states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCharacterStore.setState({
      characters: [],
    });
  });

  it('renders actionable onboarding empty state for a player with no characters', () => {
    setRole('player');
    renderPanel();

    expect(screen.getByText('No Character Assigned')).toBeInTheDocument();
    expect(
      screen.getByText("You don't have an active character in this game yet."),
    ).toBeInTheDocument();

    const createBtn = screen.getByRole('button', { name: /Create a Character/i });
    expect(createBtn).toBeInTheDocument();

    fireEvent.click(createBtn);
    expect(mockStartCharacterCreation).toHaveBeenCalledTimes(1);
    expect(mockStartCharacterCreation).toHaveBeenCalledWith(
      'p1',
      'modal',
      expect.any(Function),
    );
  });

  it('shows Select Existing Character button when unassigned characters are present', () => {
    setRole('player');
    useCharacterStore.setState({
      characters: [character('Unclaimed Party Character')],
    });

    renderPanel();

    expect(screen.getByText('No Character Assigned')).toBeInTheDocument();
    const selectBtn = screen.getByRole('button', {
      name: /Select Existing Character/i,
    });
    expect(selectBtn).toBeInTheDocument();

    fireEvent.click(selectBtn);
    // Dialog modal opens
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Unclaimed Party Character/i)).toBeInTheDocument();
  });

  it('renders search empty state when characters exist but none match search', () => {
    setRole('player');
    useCharacterStore.setState({
      characters: [character('Hero', 'p1')],
    });

    renderPanel();
    expect(screen.getByText('Hero')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText('Search characters...');
    fireEvent.change(searchInput, { target: { value: 'Nonexistent' } });

    expect(screen.getByText('No characters found')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your search')).toBeInTheDocument();
  });

  it('renders header create button for players and launches creation', () => {
    setRole('player');
    useCharacterStore.setState({
      characters: [character('Hero', 'p1')],
    });

    renderPanel();
    const createBtn = screen.getByRole('button', { name: /Create/i });
    expect(createBtn).toBeInTheDocument();

    fireEvent.click(createBtn);
    expect(mockStartCharacterCreation).toHaveBeenCalledTimes(1);
  });

  it('renders import button in header for host', () => {
    setRole('host');
    renderPanel();
    expect(screen.getByRole('button', { name: /Import/i })).toBeInTheDocument();
  });
});

