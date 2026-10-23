import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CompactInitiativeRibbon,
  type CompactInitiativeRibbonProps,
} from '@/components/simple-player/CompactInitiativeRibbon';

function props(
  overrides: Partial<CompactInitiativeRibbonProps> = {},
): CompactInitiativeRibbonProps {
  return {
    characterName: 'Aria',
    currentHp: 24,
    maxHp: 30,
    armorClass: 15,
    conditions: [],
    isInCombat: false,
    combatants: [],
    isMyTurn: false,
    connectionState: 'connected',
    onAdjustHp: vi.fn().mockResolvedValue(undefined),
    onEndTurn: vi.fn().mockResolvedValue(undefined),
    onOpenSettings: vi.fn(),
    ...overrides,
  };
}

const combatants = [
  {
    id: 'a',
    name: 'Aria',
    initiative: 18,
    isPlayer: true,
    isMine: true,
    isActive: true,
    hpLabel: '24/30',
  },
  {
    id: 'g',
    name: 'Goblin',
    initiative: 12,
    isPlayer: false,
    isMine: false,
    isActive: false,
  },
];

describe('CompactInitiativeRibbon', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('shows vitals out of combat', () => {
    render(
      <CompactInitiativeRibbon
        {...props({
          tempHp: 3,
          conditions: ['Prone'],
          characterAvatarUrl: 'a.png',
        })}
      />,
    );
    expect(screen.getByText('Aria')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Hit points 24 of 30/ }),
    ).toHaveTextContent('24/30+3');
    expect(screen.getByLabelText('Armor class 15')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Conditions' })).toHaveTextContent(
      'Prone',
    );
    expect(
      screen.queryByRole('button', { name: 'Turn order' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: 'Connected' }),
    ).toBeInTheDocument();
  });

  it('sends quick and custom HP adjustments', () => {
    const p = props();
    render(<CompactInitiativeRibbon {...p} />);
    fireEvent.click(screen.getByRole('button', { name: /Hit points/ }));

    fireEvent.click(screen.getByRole('button', { name: '-1' }));
    fireEvent.click(screen.getByRole('button', { name: '+5' }));
    expect(p.onAdjustHp).toHaveBeenNthCalledWith(1, -1);
    expect(p.onAdjustHp).toHaveBeenNthCalledWith(2, 5);

    const amount = screen.getByRole('spinbutton', { name: 'Amount' });
    fireEvent.change(amount, { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Damage' }));
    expect(p.onAdjustHp).toHaveBeenLastCalledWith(-7);

    fireEvent.change(amount, { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Heal' }));
    expect(p.onAdjustHp).toHaveBeenLastCalledWith(4);

    fireEvent.change(amount, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Heal' }));
    expect(p.onAdjustHp).toHaveBeenCalledTimes(4);
  });

  it('disables HP controls while an HP intent is pending', () => {
    render(<CompactInitiativeRibbon {...props({ pendingIntent: 'hp' })} />);
    expect(screen.getByRole('button', { name: /Hit points/ })).toBeDisabled();
    expect(screen.getByLabelText('Saving')).toBeInTheDocument();
  });

  it('shows the active combatant and up next, and the turn order drawer', () => {
    render(
      <CompactInitiativeRibbon
        {...props({
          isInCombat: true,
          roundNumber: 3,
          combatants,
          activeLabel: 'Enemy activity…',
          upNextLabel: 'Aria',
        })}
      />,
    );
    expect(screen.getByText('Enemy activity…')).toBeInTheDocument();
    expect(screen.getByText('Up next: Aria')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'End Turn' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Turn order' }));
    const list = screen.getByRole('list', { name: 'Round 3 turn order' });
    expect(list).toHaveTextContent('Aria');
    expect(list).toHaveTextContent('24/30');
    expect(list).toHaveTextContent('Goblin');
  });

  it('shows YOUR TURN with an End Turn button and vibrates once on the edge', () => {
    const p = props({ isInCombat: true, combatants });
    const { rerender } = render(<CompactInitiativeRibbon {...p} />);
    expect(navigator.vibrate).not.toHaveBeenCalled();

    rerender(<CompactInitiativeRibbon {...p} isMyTurn />);
    expect(screen.getByText('YOUR TURN!')).toBeInTheDocument();
    expect(navigator.vibrate).toHaveBeenCalledTimes(1);

    rerender(
      <CompactInitiativeRibbon
        {...p}
        isMyTurn
        connectionState="reconnecting"
      />,
    );
    expect(navigator.vibrate).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'End Turn' }));
    expect(p.onEndTurn).toHaveBeenCalledTimes(1);
  });

  it('shows a pending end turn', () => {
    render(
      <CompactInitiativeRibbon
        {...props({
          isInCombat: true,
          isMyTurn: true,
          pendingIntent: 'end-turn',
        })}
      />,
    );
    expect(screen.getByRole('button', { name: 'End Turn' })).toBeDisabled();
  });

  it('shows the DM-away notice and connection states', () => {
    render(
      <CompactInitiativeRibbon
        {...props({ hostAway: true, connectionState: 'offline' })}
      />,
    );
    expect(screen.getByText(/DM is away/)).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Offline' })).toBeInTheDocument();
  });

  it('handles no character and spectators', () => {
    const { rerender } = render(
      <CompactInitiativeRibbon
        {...props({ characterName: undefined, currentHp: undefined })}
      />,
    );
    expect(screen.getByText('No character yet')).toBeInTheDocument();
    rerender(
      <CompactInitiativeRibbon
        {...props({ readOnly: true, isMyTurn: true, isInCombat: true })}
      />,
    );
    expect(screen.getByText('Watching')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Hit points/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'End Turn' }),
    ).not.toBeInTheDocument();
  });

  it('opens settings', () => {
    const p = props();
    render(<CompactInitiativeRibbon {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(p.onOpenSettings).toHaveBeenCalled();
  });
});
