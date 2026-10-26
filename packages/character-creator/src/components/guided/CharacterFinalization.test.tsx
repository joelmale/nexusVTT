/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CharacterFinalization from './CharacterFinalization';
import { CharacterProfile } from '../../data/characterProfiles';

const mockProfile: CharacterProfile = {
  name: 'The Guardian',
  description: 'Heavy armor and resolute defense.',
  recommendedClasses: [{ class: 'fighter', reason: 'Resolute defense' }],
  recommendedRaces: [{ race: 'human', reason: 'Adaptable' }],
  recommendedBackgrounds: [
    { background: 'soldier', reason: 'Military training' },
  ],
  keyStats: ['STR', 'CON'],
  finalQuestion: 'What drives your courage?',
};

describe('CharacterFinalization', () => {
  it('retains the canonical draft alignment and submits it on creation', () => {
    const handleCreate = vi.fn();
    const handleBack = vi.fn();

    render(
      <CharacterFinalization
        profile={mockProfile}
        selectedClass="fighter"
        selectedSpecies="human"
        selectedBackground="soldier"
        edition="2024"
        onCreateCharacter={handleCreate}
        onBack={handleBack}
      />,
    );

    // Every alignment remains selectable; opening this view does not relabel the draft.
    expect(screen.getByText('Balance and pragmatism')).toBeInTheDocument();

    const createButton = screen.getByRole('button', {
      name: /create character/i,
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Character name' }), {
      target: { value: 'A named hero' },
    });
    fireEvent.click(createButton);

    expect(handleCreate).toHaveBeenCalledTimes(1);
    const submittedData = handleCreate.mock.calls[0][0];
    expect(submittedData.alignment).toBe('Neutral Good');
  });

  it('allows changing alignment when a different option is clicked', () => {
    const handleCreate = vi.fn();
    const handleBack = vi.fn();

    render(
      <CharacterFinalization
        profile={mockProfile}
        selectedClass="fighter"
        selectedSpecies="human"
        selectedBackground="soldier"
        edition="2024"
        onCreateCharacter={handleCreate}
        onBack={handleBack}
      />,
    );

    // Click 'Chaotic Good'
    const cgButton = screen.getByText('Freedom and kindness').closest('button');
    expect(cgButton).not.toBeNull();
    fireEvent.click(cgButton!);

    const createButton = screen.getByRole('button', {
      name: /create character/i,
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Character name' }), {
      target: { value: 'Another hero' },
    });
    fireEvent.click(createButton);

    expect(handleCreate).toHaveBeenCalledTimes(1);
    const submittedData = handleCreate.mock.calls[0][0];
    expect(submittedData.alignment).toBe('Chaotic Good');
  });
});
