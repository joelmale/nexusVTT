import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildPoolExpression } from '@/components/simple-player/dicePool';
import {
  SimpleDiceDrawer,
  type SimpleDiceDrawerProps,
} from '@/components/simple-player/SimpleDiceDrawer';
import type { DiceRoll } from '@/types/game';

function roll(id: string, overrides: Partial<DiceRoll> = {}): DiceRoll {
  return {
    id,
    userId: 'u1',
    userName: 'Mia',
    expression: '1d20+4',
    pools: [],
    modifier: 4,
    results: [14],
    total: 18,
    timestamp: 0,
    ...overrides,
  };
}

function props(
  overrides: Partial<SimpleDiceDrawerProps> = {},
): SimpleDiceDrawerProps {
  return {
    rolls: [],
    handouts: [],
    onRoll: vi.fn(),
    onOpenHandout: vi.fn(),
    ...overrides,
  };
}

describe('buildPoolExpression', () => {
  it('orders pools by die size and appends the modifier', () => {
    expect(buildPoolExpression({ 8: 1, 6: 2 }, 3)).toBe('2d6+1d8+3');
    expect(buildPoolExpression({ 20: 1 }, -2)).toBe('1d20-2');
    expect(buildPoolExpression({ 20: 1 }, 0)).toBe('1d20');
    expect(buildPoolExpression({}, 5)).toBe('');
  });
});

describe('SimpleDiceDrawer', () => {
  it('builds a pool with a modifier and rolls it', () => {
    const p = props();
    render(<SimpleDiceDrawer {...p} />);
    expect(screen.getByRole('button', { name: 'Roll Now' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Add d6' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add d6' }));
    fireEvent.click(screen.getByRole('button', { name: 'Increase modifier' }));
    fireEvent.click(screen.getByRole('button', { name: 'Increase modifier' }));
    fireEvent.click(screen.getByRole('button', { name: 'Decrease modifier' }));
    expect(screen.getByLabelText('Modifier value')).toHaveTextContent('+1');

    fireEvent.click(screen.getByRole('button', { name: 'Roll 2d6+1' }));
    expect(p.onRoll).toHaveBeenCalledWith('2d6+1', 'none');
    expect(screen.getByRole('button', { name: 'Roll Now' })).toBeDisabled();
  });

  it('clamps the modifier and the pool size, and clears', () => {
    render(<SimpleDiceDrawer {...props()} />);
    const down = screen.getByRole('button', { name: 'Decrease modifier' });
    for (let i = 0; i < 6; i += 1) fireEvent.click(down);
    expect(down).toBeDisabled();
    const up = screen.getByRole('button', { name: 'Increase modifier' });
    for (let i = 0; i < 25; i += 1) fireEvent.click(up);
    expect(up).toBeDisabled();
    expect(screen.getByLabelText('Modifier value')).toHaveTextContent('+15');

    const d4 = screen.getByRole('button', { name: 'Add d4' });
    for (let i = 0; i < 25; i += 1) fireEvent.click(d4);
    expect(d4).toHaveTextContent('×20');

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByLabelText('Modifier value')).toHaveTextContent('+0');
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
  });

  it('lists recent rolls with crit and fumble highlights', () => {
    render(
      <SimpleDiceDrawer
        {...props({
          rolls: [
            roll('r1', { crit: 'success', total: 24 }),
            roll('r2', { crit: 'failure', total: 5 }),
            roll('r3'),
          ],
        })}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0].className).toMatch(/crit/);
    expect(items[1].className).toMatch(/fumble/);
    expect(items[2]).toHaveTextContent('1d20+4 [14]');
  });

  it('shows the empty state', () => {
    render(<SimpleDiceDrawer {...props()} />);
    expect(screen.getByText('No rolls yet.')).toBeInTheDocument();
  });

  it('lists handouts and opens ones with images', () => {
    const p = props({
      handouts: [
        { id: 'h1', title: 'Harbor Map', url: '/x.png', revealedAt: 0 },
        { id: 'h2', title: 'Letter', revealedAt: 0 },
      ],
    });
    render(<SimpleDiceDrawer {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Harbor Map' }));
    expect(p.onOpenHandout).toHaveBeenCalledWith('h1');
    expect(
      screen.queryByRole('button', { name: 'Letter' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Letter')).toBeInTheDocument();
  });
});
