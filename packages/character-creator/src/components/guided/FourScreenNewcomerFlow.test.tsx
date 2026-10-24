import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FourScreenNewcomerFlow } from './FourScreenNewcomerFlow';

describe('FourScreenNewcomerFlow (CC-401, CC-402, CC-403, CC-404)', () => {
  it('navigates through all four screens and completes character creation', async () => {
    const handleComplete = vi.fn();
    const handleClose = vi.fn();

    render(
      <FourScreenNewcomerFlow
        isOpen={true}
        edition="2024"
        onClose={handleClose}
        onComplete={handleComplete}
      />
    );

    // Screen 1: Intent & Chooser
    expect(screen.getByText('How do you want to play?')).toBeInTheDocument();
    expect(screen.getByText('Close Combat')).toBeInTheDocument();
    expect(screen.getByText('Sneak & Skills')).toBeInTheDocument();
    expect(screen.getByText('Arcane Magic')).toBeInTheDocument();
    expect(screen.getByText('Screen 1 of 4')).toBeInTheDocument();

    // Select "Sneak & Skills" (Rogue)
    fireEvent.click(screen.getByText('Sneak & Skills'));

    // Advance to Screen 2
    fireEvent.click(screen.getByText('Continue'));
    expect(screen.getByText('Screen 2 of 4')).toBeInTheDocument();
    expect(screen.getByText(/Key Strengths in Play/i)).toBeInTheDocument();
    expect(screen.getByText('Sneak Attack')).toBeInTheDocument();

    // Advance to Screen 3
    fireEvent.click(screen.getByText('Continue'));
    expect(screen.getByText('Screen 3 of 4')).toBeInTheDocument();
    expect(screen.getByText('Equipment & Spell Package')).toBeInTheDocument();
    expect(screen.getByText(/Starting Loadout & Currency/i)).toBeInTheDocument();

    // Advance to Screen 4
    fireEvent.click(screen.getByText('Continue'));
    expect(screen.getByText('Screen 4 of 4')).toBeInTheDocument();
    expect(screen.getByText('Name & Finalize')).toBeInTheDocument();
    expect(screen.getByText('First-Turn Combat Guidance')).toBeInTheDocument();

    // Click "Create Character"
    fireEvent.click(screen.getByRole('button', { name: /Create Character/i }));

    expect(handleComplete).toHaveBeenCalledTimes(1);
    const result = handleComplete.mock.calls[0][0];
    expect(result.classSlug).toBe('rogue');
    expect(result.edition).toBe('2024');
    expect(result.name).toBeTruthy();
  });

  it('supports direct class bypass ("Just make a Fighter")', () => {
    const handleComplete = vi.fn();

    render(
      <FourScreenNewcomerFlow
        isOpen={true}
        edition="2024"
        onClose={vi.fn()}
        onComplete={handleComplete}
      />
    );

    // Click Fighter bypass button
    const fighterBtn = screen.getByRole('button', { name: 'Fighter' });
    fireEvent.click(fighterBtn);

    // Advance to Screen 2
    fireEvent.click(screen.getByText('Continue'));
    expect(screen.getByText(/FIGHTER/i)).toBeInTheDocument();
    expect(screen.getByText('Battle Hardened')).toBeInTheDocument();
  });

  it('allows stepping back to previous screens without losing state', () => {
    render(
      <FourScreenNewcomerFlow
        isOpen={true}
        edition="2024"
        onClose={vi.fn()}
        onComplete={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Continue')); // to Screen 2
    expect(screen.getByText('Screen 2 of 4')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back' })); // Back to Screen 1
    expect(screen.getByText('Screen 1 of 4')).toBeInTheDocument();
  });
});
