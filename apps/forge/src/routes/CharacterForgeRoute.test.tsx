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
  edition?: string;
  initialMode?: string;
  onCancel: () => void;
  onComplete: (result: CharacterCreationResult) => Promise<void> | void;
}

vi.mock('../components/ForgeCharacterCreator', () => ({
  ForgeCharacterCreator: ({
    isOpen,
    edition,
    initialMode,
    onCancel,
    onComplete,
  }: MockWizardProps) =>
    isOpen ? (
      <div
        role="dialog"
        aria-label="Character creation wizard"
        data-edition={edition}
        data-mode={initialMode}
      >
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

  it('lets the player choose edition and creation style before opening the wizard', () => {
    render(<CharacterForgeRoute />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('2014 rules'));
    fireEvent.click(screen.getByRole('button', { name: 'Guided creation' }));

    const wizard = screen.getByRole('dialog', {
      name: 'Character creation wizard',
    });
    expect(wizard).toHaveAttribute('data-edition', '2014');
    expect(wizard).toHaveAttribute('data-mode', 'guided');
  });

  it('opens the full wizard on the default 2024 rules', () => {
    render(<CharacterForgeRoute />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Full step-by-step wizard' }),
    );

    const wizard = screen.getByRole('dialog');
    expect(wizard).toHaveAttribute('data-edition', '2024');
    expect(wizard).toHaveAttribute('data-mode', 'full');
    expect(screen.queryByText(/Monster Library/i)).not.toBeInTheDocument();
  });

  it('returns to the choices when the wizard is closed', () => {
    render(<CharacterForgeRoute />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Full step-by-step wizard' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel creation' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Guided creation' }),
    ).toBeInTheDocument();
  });

  it('persists a completed character and offers another creation', async () => {
    render(<CharacterForgeRoute />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Full step-by-step wizard' }),
    );

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
      screen.getByRole('button', { name: 'Guided creation' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
