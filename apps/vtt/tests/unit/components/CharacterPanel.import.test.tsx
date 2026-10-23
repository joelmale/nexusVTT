import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '@nexus/character-contracts';

vi.mock('@/components/CharacterCard', () => ({
  CharacterCard: ({ character }: { character: Character }) => (
    <div data-testid="character-card">{character.name}</div>
  ),
}));
vi.mock('@/services/characterSyncService', () => ({
  characterSyncService: { syncStats: vi.fn() },
}));

import { CharacterPanel } from '@/components/CharacterPanel';
import { useCharacterStore } from '@/stores/characterStore';
import { useGameStore } from '@/stores/gameStore';

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

const nexusJson = JSON.stringify({
  id: 'pip-1',
  name: 'Pip',
  level: 2,
  hitPoints: 14,
  abilities: {
    STR: { score: 10, modifier: 0 },
    DEX: { score: 14, modifier: 2 },
    CON: { score: 12, modifier: 1 },
    INT: { score: 10, modifier: 0 },
    WIS: { score: 10, modifier: 0 },
    CHA: { score: 10, modifier: 0 },
  },
  skills: {},
});

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

describe('CharacterPanel party import', () => {
  beforeEach(() => {
    useCharacterStore.setState({
      characters: [
        character('Aria', 'p1'),
        character('Unclaimed'),
        character('Stranger', 'someone-not-here'),
      ],
    });
  });

  it('shows the DM unclaimed party characters and an import button', () => {
    setRole('host');
    render(<CharacterPanel />);
    const names = screen
      .getAllByTestId('character-card')
      .map((c) => c.textContent);
    expect(names).toEqual(['Aria', 'Unclaimed']);
    expect(screen.getByRole('button', { name: /Import/ })).toBeInTheDocument();
  });

  it('hides unclaimed characters and the import button from players', () => {
    setRole('player');
    render(<CharacterPanel />);
    const names = screen
      .getAllByTestId('character-card')
      .map((c) => c.textContent);
    expect(names).toEqual(['Aria']);
    expect(
      screen.queryByRole('button', { name: /Import/ }),
    ).not.toBeInTheDocument();
  });

  it('imports a file as an unclaimed character', async () => {
    setRole('host');
    const { container } = render(<CharacterPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Import/ }));

    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File([nexusJson], 'pip.json', {
      type: 'application/json',
    });
    fireEvent.change(input, { target: { files: [file] } });

    fireEvent.click(
      await screen.findByRole('button', { name: 'Import 1 Character' }),
    );
    await waitFor(
      () =>
        expect(
          useCharacterStore.getState().characters.find((c) => c.name === 'Pip'),
        ).toBeDefined(),
      { timeout: 10_000 },
    );
    const pip = useCharacterStore
      .getState()
      .characters.find((c) => c.name === 'Pip');
    expect(pip?.playerId).toBeUndefined();
  });
});
