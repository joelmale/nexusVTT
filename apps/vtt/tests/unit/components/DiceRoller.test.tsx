import React from 'react';
import { render, screen } from '@testing-library/react';
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

// Mock the app flow store
vi.mock('@/stores/appFlowStore', () => ({
  useAppFlowStore: vi.fn(() => ({
    user: { id: '1', name: 'Test User' }
  }))
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
});