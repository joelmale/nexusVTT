import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LIVE_ROLL_TOAST_MS,
  LiveRollToast,
} from '@/components/simple-player/LiveRollToast';
import type { DiceRoll } from '@/types/game';

function roll(id: string, overrides: Partial<DiceRoll> = {}): DiceRoll {
  return {
    id,
    userId: 'u1',
    userName: 'Aria',
    expression: '1d20+4',
    pools: [],
    modifier: 4,
    results: [18],
    total: 22,
    timestamp: 0,
    ...overrides,
  };
}

describe('LiveRollToast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does not announce rolls already in history', () => {
    render(<LiveRollToast rolls={[roll('old')]} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows a new roll and auto-dismisses it', () => {
    const { rerender } = render(<LiveRollToast rolls={[]} />);
    rerender(<LiveRollToast rolls={[roll('r1')]} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Aria rolled 1d20+4: 22',
    );
    act(() => vi.advanceTimersByTime(LIVE_ROLL_TOAST_MS));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('marks crits and fumbles', () => {
    const { rerender } = render(<LiveRollToast rolls={[]} />);
    rerender(<LiveRollToast rolls={[roll('c', { crit: 'success' })]} />);
    expect(screen.getByRole('status')).toHaveTextContent('critical!');
    rerender(<LiveRollToast rolls={[roll('f', { crit: 'failure' })]} />);
    expect(screen.getByRole('status')).toHaveTextContent('fumble');
  });

  it('can be dismissed early', () => {
    const { rerender } = render(<LiveRollToast rolls={[roll('old')]} />);
    rerender(<LiveRollToast rolls={[roll('new'), roll('old')]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss roll' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('only receives rolls the caller decided were visible', () => {
    // Private-roll filtering happens in the shell; an absent roll never shows.
    const { rerender } = render(<LiveRollToast rolls={[]} />);
    rerender(<LiveRollToast rolls={[]} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
