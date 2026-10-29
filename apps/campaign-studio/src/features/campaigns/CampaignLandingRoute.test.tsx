import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { CapabilityNoticeProvider } from '@/features/capability-notice';
import { StudioNavigationProvider } from '@/features/studio-shell/StudioNavigationProvider';
import { CampaignLandingRoute } from '@/routes/CampaignLandingRoute';
import { CampaignContext, type CampaignContextValue } from './CampaignContext';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open');
  };
});

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Current path">{location.pathname}</output>;
}

function createMockCampaignContext(
  overrides?: Partial<CampaignContextValue>,
): CampaignContextValue {
  return {
    activeCampaign: undefined,
    activeCampaignId: undefined,
    campaigns: [],
    createCampaign: vi.fn(),
    error: undefined,
    isDemoCampaign: false,
    reload: vi.fn().mockResolvedValue(undefined),
    rememberCampaign: vi.fn(),
    state: 'ready',
    ...overrides,
  };
}

function renderLandingRoute(contextValue: CampaignContextValue, initialPath = '/campaigns') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <CapabilityNoticeProvider>
        <CampaignContext.Provider value={contextValue}>
          <StudioNavigationProvider>
            <CampaignLandingRoute />
            <LocationProbe />
          </StudioNavigationProvider>
        </CampaignContext.Provider>
      </CapabilityNoticeProvider>
    </MemoryRouter>,
  );
}

describe('CampaignLandingRoute (CS-07 & CS-16)', () => {
  it('renders Create campaign and Explore Ashes of Veyra buttons in empty state (CS-16)', async () => {
    const user = userEvent.setup();
    const context = createMockCampaignContext();

    renderLandingRoute(context);

    expect(screen.getByRole('heading', { name: 'Create your first campaign' })).toBeInTheDocument();

    const createBtn = screen.getByRole('button', { name: 'Create campaign' });
    const exploreBtn = screen.getByRole('button', { name: 'Explore Ashes of Veyra' });

    expect(createBtn).toBeInTheDocument();
    expect(exploreBtn).toBeInTheDocument();

    // Clicking Explore navigates to /demo/ashes-of-veyra/overview
    await user.click(exploreBtn);
    expect(screen.getByLabelText('Current path')).toHaveTextContent(
      '/demo/ashes-of-veyra/overview',
    );
  });

  it('opens CreateCampaignDialog when Create campaign button is clicked', async () => {
    const user = userEvent.setup();
    const context = createMockCampaignContext();

    renderLandingRoute(context);

    const createBtn = screen.getByRole('button', { name: 'Create campaign' });
    await user.click(createBtn);

    expect(screen.getByRole('heading', { name: 'Create campaign' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Campaign name' })).toBeInTheDocument();
  });

  it('renders retry button and sign in message when authentication is required', async () => {
    const user = userEvent.setup();
    const reload = vi.fn().mockResolvedValue(undefined);
    const context = createMockCampaignContext({
      state: 'authentication-required',
      reload,
    });

    renderLandingRoute(context);

    expect(screen.getByRole('heading', { name: 'Sign in to load campaigns' })).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: 'Retry' });
    await user.click(retryBtn);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('renders retry button and error message when campaigns fail to load', async () => {
    const user = userEvent.setup();
    const reload = vi.fn().mockResolvedValue(undefined);
    const context = createMockCampaignContext({
      state: 'error',
      error: 'Backend is temporarily down',
      reload,
    });

    renderLandingRoute(context);

    expect(screen.getByRole('heading', { name: 'Campaigns are unavailable' })).toBeInTheDocument();
    expect(screen.getAllByText('Backend is temporarily down').length).toBeGreaterThanOrEqual(1);

    const retryBtn = screen.getByRole('button', { name: 'Retry' });
    await user.click(retryBtn);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
