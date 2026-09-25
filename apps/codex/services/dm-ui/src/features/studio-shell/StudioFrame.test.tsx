import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { StudioFrame } from './StudioFrame';
import { StudioNavigationProvider } from './StudioNavigationProvider';

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Current route">{location.pathname}</output>;
}

describe('StudioFrame navigation', () => {
  it('keeps the campaign rail open on session routes', () => {
    render(
      <MemoryRouter
        initialEntries={['/campaigns/ashes-of-veyra/sessions/session-12']}
      >
        <StudioNavigationProvider>
          <StudioFrame onCapability={vi.fn()}>
            <p>Session workspace</p>
          </StudioFrame>
        </StudioNavigationProvider>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('complementary', { name: 'Campaign navigation' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Sessions', current: 'page' }),
    ).toBeInTheDocument();
  });

  it('collapses into the top bar and restores the rail on overview', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter
        initialEntries={['/campaigns/ashes-of-veyra/sessions/session-12']}
      >
        <StudioNavigationProvider>
          <StudioFrame onCapability={vi.fn()}>
            <LocationProbe />
          </StudioFrame>
        </StudioNavigationProvider>
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole('button', { name: 'Collapse campaign sidebar' }),
    );
    expect(
      screen.queryByRole('complementary', { name: 'Campaign navigation' }),
    ).toBeNull();

    await user.click(
      screen.getByRole('button', {
        name: 'Return to overview and expand campaign sidebar',
      }),
    );
    expect(screen.getByLabelText('Current route')).toHaveTextContent(
      '/campaigns/ashes-of-veyra/overview',
    );
    expect(
      screen.getByRole('complementary', { name: 'Campaign navigation' }),
    ).toBeInTheDocument();
  });
});
