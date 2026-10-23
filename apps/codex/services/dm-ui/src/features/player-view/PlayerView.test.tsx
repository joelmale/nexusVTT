import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PlayerViewBanner } from './PlayerViewBanner';
import { PlayerViewProvider, usePlayerView } from './PlayerViewContext';
import { PlayerViewToggle } from './PlayerViewToggle';

function TestConsumer() {
  const { isPlayerView } = usePlayerView();
  return (
    <div>
      <span data-testid="status">{isPlayerView ? 'ACTIVE' : 'INACTIVE'}</span>
      <PlayerViewToggle />
      {isPlayerView && <PlayerViewBanner />}
    </div>
  );
}

describe('PlayerView components', () => {
  it('toggles player view on and off via PlayerViewToggle', async () => {
    const user = userEvent.setup();
    render(
      <PlayerViewProvider>
        <TestConsumer />
      </PlayerViewProvider>,
    );

    expect(screen.getByTestId('status')).toHaveTextContent('INACTIVE');
    expect(
      screen.queryByRole('region', { name: 'Player view preview notice' }),
    ).toBeNull();

    const toggle = screen.getByRole('button', {
      name: 'Preview what players see',
    });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await user.click(toggle);

    expect(screen.getByTestId('status')).toHaveTextContent('ACTIVE');
    expect(
      screen.getByRole('button', { name: 'Toggle player view off' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('region', { name: 'Player view preview notice' }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Toggle player view off' }),
    );
    expect(screen.getByTestId('status')).toHaveTextContent('INACTIVE');
  });

  it('allows exiting preview from PlayerViewBanner exit button', async () => {
    const user = userEvent.setup();
    render(
      <PlayerViewProvider initialActive>
        <TestConsumer />
      </PlayerViewProvider>,
    );

    expect(screen.getByTestId('status')).toHaveTextContent('ACTIVE');
    const exitBtn = screen.getByRole('button', {
      name: 'Exit player view preview',
    });
    await user.click(exitBtn);

    expect(screen.getByTestId('status')).toHaveTextContent('INACTIVE');
  });

  it('calls custom onExit prop in PlayerViewBanner when provided', async () => {
    const user = userEvent.setup();
    const onExit = vi.fn();
    render(
      <PlayerViewProvider initialActive>
        <PlayerViewBanner onExit={onExit} />
      </PlayerViewProvider>,
    );

    await user.click(
      screen.getByRole('button', { name: 'Exit player view preview' }),
    );
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
