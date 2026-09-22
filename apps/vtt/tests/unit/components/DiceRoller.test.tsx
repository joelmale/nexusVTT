import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DiceRoller } from '@/components/DiceRoller';
import { useGameStore, useDiceRolls, useUser, useIsHost } from '@/stores/gameStore';

// Mock the game store
vi.mock('@/stores/gameStore', () => ({
  useGameStore: vi.fn(),
  useDiceRolls: vi.fn(),
  useUser: vi.fn(),
  useIsHost: vi.fn(),
}));

describe('DiceRoller', () => {
  it('renders the dice roller component', () => {
    // Arrange
    const addDiceRoll = vi.fn();
    const diceRolls = [];
    const user = { id: '1', name: 'Test User' };
    const isHost = false;

    vi.mocked(useGameStore).mockReturnValue({ addDiceRoll });
    vi.mocked(useDiceRolls).mockReturnValue(diceRolls);
    vi.mocked(useUser).mockReturnValue(user);
    vi.mocked(useIsHost).mockReturnValue(isHost);

    // Act
    render(<DiceRoller />);

    // Assert
    expect(screen.getByText('Dice Roller')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Click dice below to build your roll...')).toBeInTheDocument();
    expect(screen.getByText('Roll')).toBeInTheDocument();
  });

  /**
   * Advantage/Disadvantage toggle directly: the real bug (a wrapping div's
   * onClick double-firing because a browser click on a <label> also forwards
   * a synthetic click to its <input>) only reproduces with a *trusted*
   * browser click -- jsdom's fireEvent.click on the label does not trigger
   * that forwarding, so a jsdom test clicking the label can't catch this
   * regression; it was verified directly in a real browser instead. This
   * covers the input's own click handler doing the right thing in isolation.
   */
  it('toggles Advantage on and back off when clicked', () => {
    const addDiceRoll = vi.fn();
    vi.mocked(useGameStore).mockReturnValue({ addDiceRoll });
    vi.mocked(useDiceRolls).mockReturnValue([]);
    vi.mocked(useUser).mockReturnValue({ id: '1', name: 'Test User' });
    vi.mocked(useIsHost).mockReturnValue(false);

    render(<DiceRoller />);

    const advantageInput = screen.getByDisplayValue(
      'advantage',
    ) as HTMLInputElement;

    expect(advantageInput.checked).toBe(false);

    fireEvent.click(advantageInput);
    expect(advantageInput.checked).toBe(true);

    fireEvent.click(advantageInput);
    expect(advantageInput.checked).toBe(false);
  });
});
