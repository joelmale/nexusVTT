import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContextualDiceHUD } from '@/components/DiceHUD/ContextualDiceHUD';
import { useGameStore, useDiceRolls, useIsHost } from '@/stores/gameStore';
import { webSocketService } from '@/services/websocket';
import { diceSounds } from '@/services/diceSounds';

// Mock game store
vi.mock('@/stores/gameStore', () => ({
  useGameStore: vi.fn(),
  useDiceRolls: vi.fn(),
  useIsHost: vi.fn(),
}));

// Mock UI stack store
vi.mock('@/stores/uiStackStore', () => ({
  useUIStackStore: {
    getState: vi.fn(() => ({
      selectPanel: vi.fn(),
      togglePanel: vi.fn(),
    })),
  },
}));

// Mock WebSocket service
vi.mock('@/services/websocket', () => ({
  webSocketService: {
    isConnected: vi.fn(() => true),
    sendEvent: vi.fn(),
  },
}));

// Mock dice sounds
vi.mock('@/services/diceSounds', () => ({
  diceSounds: {
    isSoundMuted: vi.fn(() => false),
    toggleMute: vi.fn(() => true),
  },
}));

// Mock theme manager
vi.mock('@/services/themeManager', () => ({
  initializeTheme: vi.fn(() => Promise.resolve()),
}));

interface MockStoreState {
  user: { id: string; name: string };
  sendChatMessage: (msg: string, type: string, to?: string, data?: unknown) => void;
  addDiceRoll: (roll: unknown) => void;
}

describe('ContextualDiceHUD', () => {
  const mockUser = { id: 'u123', name: 'Adventurer' };
  const mockSendChatMessage = vi.fn();
  const mockAddDiceRoll = vi.fn();

  const storeState: MockStoreState = {
    user: mockUser,
    sendChatMessage: mockSendChatMessage,
    addDiceRoll: mockAddDiceRoll,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(webSocketService.isConnected).mockReturnValue(true);
    vi.mocked(useDiceRolls).mockReturnValue([]);
    vi.mocked(useIsHost).mockReturnValue(false);

    vi.mocked(useGameStore).mockImplementation(((
      selector?: (state: MockStoreState) => unknown,
    ) => {
      return selector ? selector(storeState) : storeState;
    }) as unknown as typeof useGameStore);

    (
      useGameStore as unknown as { getState: () => MockStoreState }
    ).getState = vi.fn(() => storeState);
  });

  it('renders correctly with title, connection status, and controls', () => {
    render(<ContextualDiceHUD />);
    expect(screen.getByText('🎲 Dice HUD')).toBeInTheDocument();
    expect(screen.getByTestId('connection-badge')).toHaveTextContent('Online');
    expect(screen.getByTestId('roll-d20-button')).toBeInTheDocument();
    expect(screen.getByTestId('advantage-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('disadvantage-toggle')).toBeInTheDocument();
  });

  it('shows offline badge when websocket is disconnected', () => {
    vi.mocked(webSocketService.isConnected).mockReturnValue(false);

    render(<ContextualDiceHUD />);
    expect(screen.getByTestId('connection-badge')).toHaveTextContent('Offline');
  });

  it('rolls 1d20 when central circular D20 button is clicked', async () => {
    render(<ContextualDiceHUD />);

    const rollBtn = screen.getByTestId('roll-d20-button');
    fireEvent.click(rollBtn);

    await waitFor(() => {
      expect(mockSendChatMessage).toHaveBeenCalledWith(
        expect.stringContaining('rolled 1d20'),
        'dice-roll',
        undefined,
        expect.objectContaining({
          expression: '1d20',
          rollType: 'normal',
        }),
      );
    });

    expect(webSocketService.sendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'dice/roll-request',
        data: expect.objectContaining({
          expression: '1d20',
          advantage: false,
          disadvantage: false,
        }),
      }),
    );
  });

  it('toggles Advantage on and off, and enforces mutual exclusion with Disadvantage', async () => {
    render(<ContextualDiceHUD />);

    const advBtn = screen.getByTestId('advantage-toggle');
    const disBtn = screen.getByTestId('disadvantage-toggle');

    expect(advBtn).toHaveAttribute('aria-pressed', 'false');
    expect(disBtn).toHaveAttribute('aria-pressed', 'false');

    // Click Advantage -> on
    fireEvent.click(advBtn);
    expect(advBtn).toHaveAttribute('aria-pressed', 'true');
    expect(disBtn).toHaveAttribute('aria-pressed', 'false');

    // Roll d20 with Advantage
    fireEvent.click(screen.getByTestId('roll-d20-button'));
    await waitFor(() => {
      expect(webSocketService.sendEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            advantage: true,
            disadvantage: false,
          }),
        }),
      );
    });

    // Click Disadvantage -> Advantage is turned off, Disadvantage turns on
    fireEvent.click(disBtn);
    expect(advBtn).toHaveAttribute('aria-pressed', 'false');
    expect(disBtn).toHaveAttribute('aria-pressed', 'true');

    // Clicking Disadvantage again -> turns off
    fireEvent.click(disBtn);
    expect(disBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('applies modifiers to d20 rolls', async () => {
    render(<ContextualDiceHUD />);

    // Click +3 modifier
    const modPlus3 = screen.getByRole('button', { name: '+3' });
    fireEvent.click(modPlus3);

    fireEvent.click(screen.getByTestId('roll-d20-button'));

    await waitFor(() => {
      expect(webSocketService.sendEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            expression: '1d20+3',
          }),
        }),
      );
    });
  });

  it('handles custom negative modifier in text input', async () => {
    render(<ContextualDiceHUD />);

    const customInput = screen.getByLabelText('Custom modifier input');
    fireEvent.change(customInput, { target: { value: '-2' } });

    fireEvent.click(screen.getByTestId('roll-d20-button'));

    await waitFor(() => {
      expect(webSocketService.sendEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            expression: '1d20-2',
          }),
        }),
      );
    });
  });

  it('allows staging dice, shows count badges, and rolls the staged pool', async () => {
    render(<ContextualDiceHUD />);

    // Click d6 button twice
    const d6Btn = screen.getByTestId('die-btn-d6');
    fireEvent.click(d6Btn);
    fireEvent.click(d6Btn);

    // Staging display shows 2d6
    expect(screen.getByTestId('staging-formula-display')).toHaveTextContent('2d6');
    expect(screen.getByTestId('staged-count-badge')).toHaveTextContent('2');

    // Right-click d6 decrements
    fireEvent.contextMenu(d6Btn);
    expect(screen.getByTestId('staging-formula-display')).toHaveTextContent('1d6');

    // Add quick pool +1d8
    const quickD8 = screen.getByRole('button', { name: /\+1d8/i });
    fireEvent.click(quickD8);

    expect(screen.getByTestId('staging-formula-display')).toHaveTextContent('1d6 + 1d8');

    // Roll pool
    const rollPoolBtn = screen.getByTestId('roll-staged-button');
    fireEvent.click(rollPoolBtn);

    await waitFor(() => {
      expect(webSocketService.sendEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            expression: '1d6 + 1d8',
          }),
        }),
      );
    });

    // Staging pool cleared after roll
    expect(screen.queryByTestId('staged-count-badge')).not.toBeInTheDocument();
  });

  it('allows clearing the staged pool with the trash button', () => {
    render(<ContextualDiceHUD />);

    const d10Btn = screen.getByTestId('die-btn-d10');
    fireEvent.click(d10Btn);

    expect(screen.getByTestId('staged-count-badge')).toHaveTextContent('1');

    const clearBtn = screen.getByRole('button', { name: 'Clear staged pool' });
    fireEvent.click(clearBtn);

    expect(screen.queryByTestId('staged-count-badge')).not.toBeInTheDocument();
  });

  it('collapses and expands the dice tray', () => {
    render(<ContextualDiceHUD />);

    const trayToggle = screen.getByRole('button', { name: /Dice Bag & Tray/i });
    expect(trayToggle).toHaveAttribute('aria-expanded', 'true');

    // Click to collapse
    fireEvent.click(trayToggle);
    expect(trayToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('die-btn-d6')).not.toBeInTheDocument();

    // Keydown space to expand
    fireEvent.keyDown(trayToggle, { key: ' ' });
    expect(trayToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('die-btn-d6')).toBeInTheDocument();
  });

  it('executes custom direct formula input', async () => {
    render(<ContextualDiceHUD />);

    const input = screen.getByLabelText('Custom dice expression');
    fireEvent.change(input, { target: { value: '2d8 + 3' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(webSocketService.sendEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            expression: '2d8 + 3',
          }),
        }),
      );
    });
  });

  it('displays error message on empty formula', () => {
    render(<ContextualDiceHUD />);

    const rollBtn = screen.getByRole('button', { name: 'Roll' });
    fireEvent.click(rollBtn);

    expect(screen.getByRole('alert')).toHaveTextContent('Please provide a dice expression');
  });

  it('executes common macros when clicked', async () => {
    render(<ContextualDiceHUD />);

    const fireballBtn = screen.getByRole('button', { name: /Fireball/i });
    fireEvent.click(fireballBtn);

    await waitFor(() => {
      expect(webSocketService.sendEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            expression: '8d6',
          }),
        }),
      );
    });
  });

  it('toggles sound mute and persists dice theme changes', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    render(<ContextualDiceHUD />);

    // Toggle sound
    const soundBtn = screen.getByLabelText('Mute sounds');
    fireEvent.click(soundBtn);
    expect(diceSounds.toggleMute).toHaveBeenCalled();

    // Change theme
    const themeSelect = screen.getByLabelText('Dice theme selector');
    fireEvent.change(themeSelect, { target: { value: 'fire' } });

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'nexus-dice-theme-changed',
        detail: { theme: 'fire' },
      }),
    );
  });

  it('allows host to toggle private roll lock', async () => {
    vi.mocked(useIsHost).mockReturnValue(true);

    render(<ContextualDiceHUD />);

    const lockBtn = screen.getByRole('button', { name: 'Public roll' });
    fireEvent.click(lockBtn);

    // Now roll
    fireEvent.click(screen.getByTestId('roll-d20-button'));

    await waitFor(() => {
      expect(webSocketService.sendEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isPrivate: true,
          }),
        }),
      );
    });
  });

  it('renders roll history with reroll action and crit styling', async () => {
    const mockRolls = [
      {
        id: 'r1',
        expression: '1d20',
        results: [20],
        total: 20,
        crit: 'success',
        userId: 'u1',
        userName: 'Player',
        timestamp: Date.now(),
        pools: [{ sides: 20, count: 1, results: [20] }],
        isPrivate: false,
      },
      {
        id: 'r2',
        expression: '1d20',
        results: [1],
        total: 1,
        crit: 'failure',
        userId: 'u1',
        userName: 'Player',
        timestamp: Date.now(),
        pools: [{ sides: 20, count: 1, results: [1] }],
        isPrivate: false,
      },
    ];

    vi.mocked(useDiceRolls).mockReturnValue(
      mockRolls as unknown as ReturnType<typeof useDiceRolls>,
    );

    render(<ContextualDiceHUD />);

    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();

    const rerollButtons = screen.getAllByTitle('Re-roll this formula');
    expect(rerollButtons.length).toBe(2);

    fireEvent.click(rerollButtons[0]);
    await waitFor(() => {
      expect(webSocketService.sendEvent).toHaveBeenCalled();
    });
  });

  it('triggers onSwitchToClassic when Classic View button is clicked', () => {
    const onSwitch = vi.fn();
    render(<ContextualDiceHUD onSwitchToClassic={onSwitch} />);

    const switchBtn = screen.getByRole('button', { name: 'Classic View' });
    fireEvent.click(switchBtn);

    expect(onSwitch).toHaveBeenCalledTimes(1);
  });

  it('adds roll to game store directly when offline fallback triggers', async () => {
    vi.mocked(webSocketService.isConnected).mockReturnValue(false);

    render(<ContextualDiceHUD />);

    fireEvent.click(screen.getByTestId('roll-d20-button'));

    await waitFor(() => {
      expect(mockAddDiceRoll).toHaveBeenCalledWith(
        expect.objectContaining({
          expression: '1d20',
        }),
      );
    });

    // WebSocket sendEvent should NOT be called when offline
    expect(webSocketService.sendEvent).not.toHaveBeenCalled();
  });

  it('opens macro customization modal, toggles macros, and persists to localStorage', async () => {
    localStorage.clear();
    render(<ContextualDiceHUD />);

    // Initially "Fireball" is visible
    expect(screen.getByRole('button', { name: /Fireball/i })).toBeInTheDocument();

    // Click customize button
    const customizeBtn = screen.getByLabelText('Customize macros');
    fireEvent.click(customizeBtn);

    // Modal dialog is displayed
    expect(screen.getByRole('dialog', { name: 'Customize Macros Modal' })).toBeInTheDocument();

    // Toggle Fireball off
    const fireballCheckbox = screen.getByLabelText('Toggle 🔥 Fireball');
    expect(fireballCheckbox).toBeChecked();
    fireEvent.click(fireballCheckbox);
    expect(fireballCheckbox).not.toBeChecked();

    // Add a custom character macro
    const nameInput = screen.getByLabelText('New macro action name');
    const formulaInput = screen.getByLabelText('New macro formula');
    const addBtn = screen.getByRole('button', { name: 'Add' });

    fireEvent.change(nameInput, { target: { value: '⚡ Lightning Arrow' } });
    fireEvent.change(formulaInput, { target: { value: '4d8+3' } });
    fireEvent.click(addBtn);

    // Close modal
    const doneBtn = screen.getByRole('button', { name: 'Done' });
    fireEvent.click(doneBtn);

    // Modal closed
    expect(screen.queryByRole('dialog', { name: 'Customize Macros Modal' })).not.toBeInTheDocument();

    // Fireball is no longer visible on HUD
    expect(screen.queryByRole('button', { name: /Fireball/i })).not.toBeInTheDocument();

    // New custom macro is visible on HUD and clickable
    const customMacroBtn = screen.getByRole('button', { name: /Lightning Arrow/i });
    expect(customMacroBtn).toBeInTheDocument();

    fireEvent.click(customMacroBtn);
    await waitFor(() => {
      expect(webSocketService.sendEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            expression: '4d8+3',
          }),
        }),
      );
    });
  });

  it('displays empty macros prompt when no macros enabled and allows reopening modal', () => {
    localStorage.setItem('nexus_dice_enabled_macros', JSON.stringify([]));
    render(<ContextualDiceHUD />);

    const emptyPrompt = screen.getByRole('button', {
      name: /\+ No active macros\. Click here to choose actions for your character\./i,
    });
    expect(emptyPrompt).toBeInTheDocument();

    fireEvent.click(emptyPrompt);
    expect(screen.getByRole('dialog', { name: 'Customize Macros Modal' })).toBeInTheDocument();
  });

  it('renders visual dice bag banner inside expanded tray', () => {
    render(<ContextualDiceHUD />);

    expect(screen.getByTestId('dice-bag-banner')).toBeInTheDocument();
    expect(screen.getByText("Adventurer's Dice Bag")).toBeInTheDocument();
    expect(
      screen.getByText(/Click any polyhedral die below to draw it from your pouch/i),
    ).toBeInTheDocument();
  });

  it('displays transient roll toast notification on roll and allows manual dismissal', async () => {
    render(<ContextualDiceHUD />);

    // Roll d20
    fireEvent.click(screen.getByTestId('roll-d20-button'));

    // Toast appears
    await waitFor(() => {
      expect(screen.getByTestId('dice-roll-toast')).toBeInTheDocument();
    });

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('1d20')).toBeInTheDocument();

    // Dismiss button closes toast
    const dismissBtn = screen.getByLabelText('Dismiss roll notification');
    fireEvent.click(dismissBtn);

    expect(screen.queryByTestId('dice-roll-toast')).not.toBeInTheDocument();
  });

  it('auto-dismisses roll toast after timeout', () => {
    vi.useFakeTimers();
    try {
      render(<ContextualDiceHUD />);

      // Roll d20
      fireEvent.click(screen.getByTestId('roll-d20-button'));

      expect(screen.getByTestId('dice-roll-toast')).toBeInTheDocument();

      // Advance timers past 3500ms inside act
      act(() => {
        vi.advanceTimersByTime(3600);
      });

      expect(screen.queryByTestId('dice-roll-toast')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
