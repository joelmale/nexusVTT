import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiceRoller } from '@/components/DiceRoller';
import { useGameStore, useDiceRolls, useIsHost } from '@/stores/gameStore';
import { webSocketService } from '@/services/websocket';
import type { DiceRoll } from '@/types/game';

vi.mock('@/stores/gameStore', () => ({
  useGameStore: vi.fn(),
  useDiceRolls: vi.fn(),
  useIsHost: vi.fn(),
}));

vi.mock('@/services/websocket', () => ({
  webSocketService: {
    isConnected: vi.fn(() => true),
    sendEvent: vi.fn(),
  },
}));

vi.mock('@/services/diceSounds', () => ({
  diceSounds: {
    isSoundMuted: vi.fn(() => false),
    toggleMute: vi.fn(() => true),
  },
}));

vi.mock('@/services/themeManager', () => ({
  initializeTheme: vi.fn(() => Promise.resolve()),
}));

interface MockStoreState {
  user: { id: string; name: string };
  sendChatMessage: (
    msg: string,
    type: string,
    to?: string,
    data?: unknown,
  ) => void;
  addDiceRoll: (roll: unknown) => void;
}

const makeRoll = (overrides: Partial<DiceRoll>): DiceRoll => ({
  id: 'r1',
  userId: 'u1',
  userName: 'Joel',
  expression: '2d8',
  pools: [{ count: 2, sides: 8, results: [2, 2] }],
  modifier: 0,
  results: [2, 2],
  total: 4,
  timestamp: new Date('2026-01-01T22:26:00').getTime(),
  ...overrides,
});

const sendEvent = () => vi.mocked(webSocketService.sendEvent);

describe('DiceRoller', () => {
  const mockSendChatMessage = vi.fn();
  const mockAddDiceRoll = vi.fn();
  const storeState: MockStoreState = {
    user: { id: 'u123', name: 'Adventurer' },
    sendChatMessage: mockSendChatMessage,
    addDiceRoll: mockAddDiceRoll,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(webSocketService.isConnected).mockReturnValue(true);
    vi.mocked(useDiceRolls).mockReturnValue([]);
    vi.mocked(useIsHost).mockReturnValue(false);
    vi.mocked(useGameStore).mockImplementation(((
      selector?: (state: MockStoreState) => unknown,
    ) => (selector ? selector(storeState) : storeState)) as unknown as typeof useGameStore);
    (
      useGameStore as unknown as { getState: () => MockStoreState }
    ).getState = vi.fn(() => storeState);
  });

  const input = () => screen.getByLabelText('Dice notation') as HTMLInputElement;
  const clickDie = (die: string, times = 1) => {
    for (let i = 0; i < times; i += 1) {
      fireEvent.click(screen.getByTestId(`die-btn-${die}`));
    }
  };

  it('renders the heading and the ONLINE badge', () => {
    render(<DiceRoller />);
    expect(
      screen.getByRole('heading', { name: 'Dice Roller' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('connection-badge')).toHaveTextContent('ONLINE');
    expect(screen.getByPlaceholderText('2d8 + 1d6 + 3')).toBeInTheDocument();
  });

  it('shows the OFFLINE badge when disconnected', () => {
    vi.mocked(webSocketService.isConnected).mockReturnValue(false);
    render(<DiceRoller />);
    expect(screen.getByTestId('connection-badge')).toHaveTextContent('OFFLINE');
  });

  it('center, Advantage and Disadvantage buttons send the right flags and modifier', async () => {
    render(<DiceRoller />);
    fireEvent.click(screen.getByRole('radio', { name: '+3' }));

    fireEvent.click(screen.getByTestId('roll-d20-button'));
    fireEvent.click(screen.getByTestId('advantage-button'));
    fireEvent.click(screen.getByTestId('disadvantage-button'));

    await waitFor(() => expect(sendEvent()).toHaveBeenCalledTimes(3));
    const payloads = sendEvent().mock.calls.map(
      (call) => (call[0] as { data: Record<string, unknown> }).data,
    );
    expect(payloads[0]).toMatchObject({
      expression: '1d20+3',
      advantage: false,
      disadvantage: false,
    });
    expect(payloads[1]).toMatchObject({
      expression: '1d20+3',
      advantage: true,
      disadvantage: false,
    });
    expect(payloads[2]).toMatchObject({
      expression: '1d20+3',
      advantage: false,
      disadvantage: true,
    });
    expect(sendEvent().mock.calls[0][0]).toMatchObject({
      type: 'dice/roll-request',
    });
    expect(mockSendChatMessage).toHaveBeenCalledWith(
      'rolled 1d20+3',
      'dice-roll',
      undefined,
      expect.objectContaining({ rollType: 'advantage' }),
    );
  });

  it('modifier chips are mutually exclusive', () => {
    render(<DiceRoller />);
    const plusZero = screen.getByRole('radio', { name: '+0' });
    expect(plusZero).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('radio', { name: '-2' }));
    expect(screen.getByRole('radio', { name: '-2' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(plusZero).toHaveAttribute('aria-checked', 'false');
    expect(screen.getAllByRole('radio')).toHaveLength(9);
  });

  it('left click adds a die and right click removes it down to zero', () => {
    render(<DiceRoller />);
    expect(screen.queryByTestId('die-count-d8')).not.toBeInTheDocument();
    clickDie('d8', 2);
    expect(screen.getByTestId('die-count-d8')).toHaveTextContent('2');
    expect(screen.getByTestId('die-btn-d8')).toHaveAccessibleName(
      'd8, 2 queued',
    );

    fireEvent.contextMenu(screen.getByTestId('die-btn-d8'));
    expect(screen.getByTestId('die-count-d8')).toHaveTextContent('1');
    fireEvent.contextMenu(screen.getByTestId('die-btn-d8'));
    fireEvent.contextMenu(screen.getByTestId('die-btn-d8'));
    expect(screen.queryByTestId('die-count-d8')).not.toBeInTheDocument();
    expect(input().value).toBe('');
  });

  it('builds the notation input from counters and the modifier', () => {
    render(<DiceRoller />);
    clickDie('d8', 2);
    clickDie('d6');
    fireEvent.click(screen.getByRole('radio', { name: '+3' }));
    expect(input().value).toBe('2d8 + 1d6 + 3');
  });

  it('typing by hand resets the counters', () => {
    render(<DiceRoller />);
    clickDie('d8', 2);
    fireEvent.change(input(), { target: { value: '4d6k3' } });
    expect(screen.queryByTestId('die-count-d8')).not.toBeInTheDocument();
    expect(input().value).toBe('4d6k3');
  });

  it('ROLL POOL sends the expression and clears counters and input', async () => {
    render(<DiceRoller />);
    expect(screen.getByRole('button', { name: 'Roll Pool' })).toBeDisabled();
    clickDie('d8', 2);
    clickDie('d6');
    fireEvent.click(screen.getByRole('radio', { name: '+3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Roll Pool' }));

    await waitFor(() => expect(sendEvent()).toHaveBeenCalled());
    expect(sendEvent().mock.calls[0][0]).toMatchObject({
      type: 'dice/roll-request',
    });
    expect(input().value).toBe('');
    expect(screen.queryByTestId('die-count-d8')).not.toBeInTheDocument();
    expect(screen.queryByTestId('die-count-d6')).not.toBeInTheDocument();
  });

  it('Enter in the input rolls the pool', async () => {
    render(<DiceRoller />);
    fireEvent.change(input(), { target: { value: '1d12+2' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    await waitFor(() => expect(sendEvent()).toHaveBeenCalled());
    expect(input().value).toBe('');
  });

  it('shows an alert for an invalid expression and keeps the input', () => {
    render(<DiceRoller />);
    fireEvent.change(input(), { target: { value: 'banana' } });
    fireEvent.click(screen.getByRole('button', { name: 'Roll Pool' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Invalid expression/);
    expect(input().value).toBe('banana');
    expect(sendEvent()).not.toHaveBeenCalled();
  });

  it('rolls a macro formula when its pill is clicked', async () => {
    render(<DiceRoller />);
    fireEvent.click(screen.getByRole('button', { name: /Fireball/ }));
    await waitFor(() => expect(sendEvent()).toHaveBeenCalled());
    expect(sendEvent().mock.calls[0][0]).toMatchObject({
      data: expect.objectContaining({ expression: '8d6' }),
    });
  });

  it('Customize toggles persist to localStorage', () => {
    render(<DiceRoller />);
    fireEvent.click(screen.getByRole('button', { name: 'Customize macros' }));
    const dialog = screen.getByRole('dialog', { name: 'Customize Macros Modal' });
    fireEvent.click(within(dialog).getByLabelText('Toggle Ranged Attack'));
    expect(
      JSON.parse(localStorage.getItem('nexus_dice_enabled_macros')!),
    ).toContain('ranged');
    fireEvent.click(within(dialog).getByLabelText('Toggle Fireball'));
    expect(
      JSON.parse(localStorage.getItem('nexus_dice_enabled_macros')!),
    ).not.toContain('fireball');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(
      screen.queryByRole('dialog', { name: 'Customize Macros Modal' }),
    ).not.toBeInTheDocument();
  });

  it('adds a custom macro that persists and renders as a pill', () => {
    render(<DiceRoller />);
    fireEvent.click(screen.getByRole('button', { name: 'Customize macros' }));
    fireEvent.change(screen.getByLabelText('New macro action name'), {
      target: { value: 'Eldritch Smite' },
    });
    fireEvent.change(screen.getByLabelText('New macro formula'), {
      target: { value: '2d8+4' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(localStorage.getItem('nexus_dice_custom_macros')).toContain(
      'Eldritch Smite',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(
      screen.getByRole('button', { name: /Eldritch Smite/ }),
    ).toBeInTheDocument();
  });

  describe('roll log', () => {
    it('lists newest first with compact formatting and collapses persistently', () => {
      vi.mocked(useDiceRolls).mockReturnValue([
        makeRoll({ id: 'new', expression: '2d8', total: 4 }),
        makeRoll({
          id: 'old',
          expression: '1d20',
          pools: [{ count: 1, sides: 20, results: [14] }],
          results: [14],
          total: 14,
        }),
      ]);
      render(<DiceRoller />);
      const rows = screen.getAllByTestId('dice-log-entry');
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveTextContent('Joel:');
      expect(rows[0]).toHaveTextContent('2d8 [2, 2] = 4');
      expect(rows[1]).toHaveTextContent('1d20 [14] = 14');

      const toggle = screen.getByRole('button', { name: /Roll Log/ });
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('dice-log-entry')).not.toBeInTheDocument();
      expect(localStorage.getItem('nexus_dice_log_collapsed')).toBe('true');
    });

    it('starts collapsed when persisted', () => {
      localStorage.setItem('nexus_dice_log_collapsed', 'true');
      vi.mocked(useDiceRolls).mockReturnValue([makeRoll({})]);
      render(<DiceRoller />);
      expect(screen.queryByTestId('dice-log-entry')).not.toBeInTheDocument();
    });

    it('hides private rolls from players', () => {
      vi.mocked(useDiceRolls).mockReturnValue([
        makeRoll({ id: 'a', isPrivate: true }),
        makeRoll({ id: 'b' }),
      ]);
      render(<DiceRoller />);
      expect(screen.getAllByTestId('dice-log-entry')).toHaveLength(1);
      expect(screen.queryByLabelText('Private roll')).not.toBeInTheDocument();
    });

    it('shows private rolls with a lock to the host, who can toggle Private', async () => {
      vi.mocked(useIsHost).mockReturnValue(true);
      vi.mocked(useDiceRolls).mockReturnValue([
        makeRoll({ id: 'a', isPrivate: true }),
        makeRoll({ id: 'b' }),
      ]);
      render(<DiceRoller />);
      expect(screen.getAllByTestId('dice-log-entry')).toHaveLength(2);
      expect(screen.getByLabelText('Private roll')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('Roll visibility'), {
        target: { value: 'private' },
      });
      fireEvent.click(screen.getByTestId('roll-d20-button'));
      await waitFor(() => expect(sendEvent()).toHaveBeenCalled());
      expect(sendEvent().mock.calls[0][0]).toMatchObject({
        data: expect.objectContaining({ isPrivate: true }),
      });
    });

    it('players see a static Public pill instead of the select', () => {
      render(<DiceRoller />);
      expect(screen.queryByLabelText('Roll visibility')).not.toBeInTheDocument();
      expect(screen.getByText('Public')).toBeInTheDocument();
    });
  });

  it('offline rolls are added to the store directly', async () => {
    vi.mocked(webSocketService.isConnected).mockReturnValue(false);
    render(<DiceRoller />);
    fireEvent.click(screen.getByTestId('roll-d20-button'));
    expect(mockAddDiceRoll).toHaveBeenCalledWith(
      expect.objectContaining({ expression: '1d20' }),
    );
    await waitFor(() => expect(mockSendChatMessage).toHaveBeenCalled());
    expect(sendEvent()).not.toHaveBeenCalled();
  });

  it('picking a theme writes localStorage and dispatches the change event', () => {
    const listener = vi.fn();
    window.addEventListener('nexus-dice-theme-changed', listener);
    render(<DiceRoller />);
    expect(screen.getByTitle(/^Dice Theme:/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Bronze'));
    expect(localStorage.getItem('nexus_dice_theme')).toBe('bronze');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(screen.getByTitle('Dice Theme: Bronze')).toBeInTheDocument();
    window.removeEventListener('nexus-dice-theme-changed', listener);
  });
});
