import React from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CharacterCreationResult } from '@nexus/character-creator';

import { CharacterForgeRoute } from './CharacterForgeRoute';

const addCharacter = vi.hoisted(() => vi.fn());

const completedCharacter = {
  character: {
    id: 'character-1',
    name: 'Ember Vale',
  },
} as CharacterCreationResult;

interface MockWizardProps {
  isOpen: boolean;
  onCancel: () => void;
  onComplete: (result: CharacterCreationResult) => Promise<void> | void;
}

vi.mock('@nexus/character-creator', () => ({
  CharacterCreationWizard: ({
    isOpen,
    onCancel,
    onComplete,
  }: MockWizardProps) =>
    isOpen ? (
      <div role="dialog" aria-label="Character creation wizard">
        <button
          type="button"
          onClick={() => void onComplete(completedCharacter)}
        >
          Complete character
        </button>
        <button type="button" onClick={onCancel}>
          Cancel creation
        </button>
      </div>
    ) : null,
}));

vi.mock('../services/dbService', () => ({
  addCharacter: (...args: unknown[]) => addCharacter(...args),
}));

describe('CharacterForgeRoute', () => {
  beforeEach(() => {
    addCharacter.mockReset();
    addCharacter.mockResolvedValue('character-1');
  });

  it('isolates character creation from the rest of Forge', () => {
    render(<CharacterForgeRoute />);

    expect(
      screen.getByRole('dialog', { name: 'Character creation wizard' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Monster Library/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Spellbook/i)).not.toBeInTheDocument();
  });

  it('persists a completed character and offers another creation', async () => {
    render(<CharacterForgeRoute />);

    fireEvent.click(screen.getByRole('button', { name: 'Complete character' }));

    await waitFor(() =>
      expect(addCharacter).toHaveBeenCalledWith(completedCharacter.character),
    );
    expect(
      await screen.findByText('Ember Vale is ready for adventure.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Character Forge' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Forge another character' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
