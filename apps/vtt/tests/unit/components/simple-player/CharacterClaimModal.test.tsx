import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Character } from '@nexus/character-contracts';
import {
  CharacterClaimModal,
  type CharacterClaimModalProps,
} from '@/components/simple-player/CharacterClaimModal';

function character(id: string, overrides: Partial<Character> = {}): Character {
  return {
    id,
    name: id,
    level: 2,
    class: 'Rogue',
    hitPoints: 10,
    abilities: {},
    skills: {},
    ...overrides,
  } as Character;
}

const characters = [
  character('Aria', { playerId: 'p1' }),
  character('Bram', { playerId: 'p2' }),
  character('Cleo', { class: undefined }),
];

function props(
  overrides: Partial<CharacterClaimModalProps> = {},
): CharacterClaimModalProps {
  return {
    characters,
    userId: 'p1',
    onClaim: vi.fn().mockResolvedValue({ intentId: 'i', status: 'applied' }),
    onCreateNew: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe('CharacterClaimModal', () => {
  it('lists only free characters and my own', () => {
    render(<CharacterClaimModal {...props()} />);
    expect(
      screen.getByRole('button', { name: /Play as Aria/ }),
    ).toHaveTextContent('Rogue · Level 2');
    expect(
      screen.getByRole('button', { name: /Play as Cleo/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Bram/ }),
    ).not.toBeInTheDocument();
  });

  it('claims a character through the intent and closes', async () => {
    const p = props();
    render(<CharacterClaimModal {...p} />);
    fireEvent.click(screen.getByRole('button', { name: /Play as Cleo/ }));
    expect(await screen.findByText('Asking the DM…')).toBeInTheDocument();
    await vi.waitFor(() => expect(p.onClose).toHaveBeenCalled());
    expect(p.onClaim).toHaveBeenCalledWith('Cleo');
  });

  it.each([
    ['not-owner', 'Someone else is already playing that character.'],
    ['host-offline', "The DM is away — try again when they're back."],
    ['invalid', 'That character is not available.'],
    [undefined, 'That character is not available.'],
  ])('explains a %s rejection', async (reason, message) => {
    const p = props({
      onClaim: vi
        .fn()
        .mockResolvedValue({ intentId: 'i', status: 'rejected', reason }),
    });
    render(<CharacterClaimModal {...p} />);
    fireEvent.click(screen.getByRole('button', { name: /Play as Cleo/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(p.onClose).not.toHaveBeenCalled();
  });

  it('offers to create a new character and to close', () => {
    const p = props({ characters: [] });
    render(<CharacterClaimModal {...p} />);
    expect(
      screen.getByText(/No party characters are free/),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Create New Character' }),
    );
    expect(p.onCreateNew).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(p.onClose).toHaveBeenCalled();
  });
});
