import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { useStudioNavigation } from './StudioNavigationContext';
import { StudioNavigationProvider } from './StudioNavigationProvider';

function ConsumerComponent() {
  const { collapseCampaignRail, expandCampaignRail, isCampaignRailExpanded } =
    useStudioNavigation();

  return (
    <div>
      <span data-testid="rail-status">
        {isCampaignRailExpanded ? 'EXPANDED' : 'COLLAPSED'}
      </span>
      <button onClick={collapseCampaignRail} type="button">
        Collapse
      </button>
      <button onClick={expandCampaignRail} type="button">
        Expand
      </button>
    </div>
  );
}

describe('StudioNavigationProvider', () => {
  it('throws an error when useStudioNavigation is called outside of the provider', () => {
    // Suppress React error boundary console log for this intentional throw test
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<ConsumerComponent />)).toThrow(
      'useStudioNavigation must be used within StudioNavigationProvider',
    );

    consoleError.mockRestore();
  });

  it('provides expanded navigation state initially and responds to collapse and expand actions', async () => {
    const user = userEvent.setup();
    render(
      <StudioNavigationProvider>
        <ConsumerComponent />
      </StudioNavigationProvider>,
    );

    expect(screen.getByTestId('rail-status')).toHaveTextContent('EXPANDED');

    await user.click(screen.getByRole('button', { name: 'Collapse' }));
    expect(screen.getByTestId('rail-status')).toHaveTextContent('COLLAPSED');

    await user.click(screen.getByRole('button', { name: 'Expand' }));
    expect(screen.getByTestId('rail-status')).toHaveTextContent('EXPANDED');
  });
});
