import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { RollLog, LOG_COLLAPSED_KEY } from './RollLog';
import type { DiceRoll } from '@/types/game';

const makeRoll = (overrides: Partial<DiceRoll> = {}): DiceRoll => ({
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

describe('RollLog', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows an empty state', () => {
    render(<RollLog rolls={[]} />);
    expect(screen.getByText('No dice rolls yet')).toBeInTheDocument();
  });

  it('renders compact rows in the order given', () => {
    render(
      <RollLog
        rolls={[
          makeRoll({ id: 'a', userName: 'Ann', expression: '2d8', total: 4 }),
          makeRoll({
            id: 'b',
            userName: 'Bob',
            expression: '1d20',
            results: [14],
            modifier: 2,
            total: 16,
          }),
        ]}
      />,
    );
    const rows = screen.getAllByTestId('dice-log-entry');
    expect(rows[0]).toHaveTextContent('Ann:');
    expect(rows[0]).toHaveTextContent('2d8 [2, 2] = 4');
    expect(rows[1]).toHaveTextContent('Bob:');
    expect(rows[1]).toHaveTextContent('1d20 [14] +2 = 16');
  });

  it('marks private rolls with a lock', () => {
    render(<RollLog rolls={[makeRoll({ isPrivate: true })]} />);
    expect(screen.getByLabelText('Private roll')).toBeInTheDocument();
  });

  it('tints critical totals', () => {
    render(<RollLog rolls={[makeRoll({ crit: 'success', total: 20 })]} />);
    const total = screen.getByText('20');
    expect(total.className).toMatch(/critSuccess/);
  });

  it('collapses via the chevron and persists the choice', () => {
    const { unmount } = render(<RollLog rolls={[makeRoll()]} />);
    const toggle = screen.getByRole('button', { name: /Roll Log/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('dice-log-entry')).not.toBeInTheDocument();
    expect(localStorage.getItem(LOG_COLLAPSED_KEY)).toBe('true');

    unmount();
    render(<RollLog rolls={[makeRoll()]} />);
    expect(screen.queryByTestId('dice-log-entry')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Roll Log/ }));
    expect(screen.getByTestId('dice-log-entry')).toBeInTheDocument();
    expect(localStorage.getItem(LOG_COLLAPSED_KEY)).toBe('false');
  });
});
