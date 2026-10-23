import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-router-dom', () => ({
  useParams: () => ({ roomCode: 'ABCD' }),
  useNavigate: () => vi.fn(),
}));
vi.mock('@/components/GameUI', () => ({
  GameUI: () => <div data-testid="full-game-ui" />,
}));
vi.mock('@/components/simple-player/SimplePlayerShell', () => ({
  SimplePlayerShell: () => <div data-testid="simple-shell" />,
}));
const modeRef = vi.hoisted(() => ({ isSimpleMode: false }));
vi.mock('@/hooks/useSimplePlayerMode', () => ({
  useSimplePlayerMode: () => modeRef,
}));
vi.mock('@/stores/gameStore', () => {
  const state = {
    session: { roomCode: 'ABCD' },
    user: { type: 'player' },
  };
  return {
    useGameStore: (selector: (s: typeof state) => unknown) => selector(state),
  };
});

import { LinearGameLayout } from '@/components/LinearGameLayout';

describe('LinearGameLayout simple mode switch', () => {
  beforeEach(() => {
    modeRef.isSimpleMode = false;
  });

  it('renders the full GameUI by default', async () => {
    render(<LinearGameLayout />);
    expect(await screen.findByTestId('full-game-ui')).toBeInTheDocument();
    expect(screen.queryByTestId('simple-shell')).not.toBeInTheDocument();
  });

  it('renders the Simple Player shell instead in simple mode', async () => {
    modeRef.isSimpleMode = true;
    render(<LinearGameLayout />);
    expect(await screen.findByTestId('simple-shell')).toBeInTheDocument();
    expect(screen.queryByTestId('full-game-ui')).not.toBeInTheDocument();
  });
});
