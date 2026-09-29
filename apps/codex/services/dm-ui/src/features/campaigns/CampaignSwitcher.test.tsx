import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { CampaignContextValue } from './CampaignContext';
import { CampaignContext } from './CampaignContext';
import { CampaignSwitcher } from './CampaignSwitcher';

beforeAll(() => {
  const originalMatches = HTMLElement.prototype.matches;
  HTMLElement.prototype.matches = function matches(selector: string) {
    if (selector === ':popover-open') {
      return this.hasAttribute('data-test-popover-open');
    }
    return originalMatches.call(this, selector);
  };
  HTMLElement.prototype.showPopover = function showPopover() {
    this.setAttribute('data-test-popover-open', '');
    this.style.display = 'block';
  };
  HTMLElement.prototype.hidePopover = function hidePopover() {
    this.removeAttribute('data-test-popover-open');
    this.style.display = 'none';
  };
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open');
  };
});

function LocationProbe() {
  return <div aria-label="location">{useLocation().pathname}</div>;
}

const campaign = {
  createdAt: '2026-01-01T00:00:00Z',
  description: 'Friday group',
  id: 'campaign-one',
  name: 'Shared name',
  updatedAt: '2026-03-01T00:00:00Z',
};

function renderSwitcher(
  overrides: Partial<CampaignContextValue> = {},
  initialEntry = '/campaigns/campaign-one/overview',
) {
  const value: CampaignContextValue = {
    activeCampaign: campaign,
    activeCampaignId: campaign.id,
    campaigns: [
      campaign,
      {
        ...campaign,
        description: 'Northern table',
        id: 'campaign-two',
      },
    ],
    createCampaign: vi.fn().mockResolvedValue({
      ...campaign,
      id: 'created-campaign',
      name: 'New world',
    }),
    isDemoCampaign: false,
    reload: vi.fn(),
    rememberCampaign: vi.fn(),
    state: 'ready',
    ...overrides,
  };
  return {
    ...render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <CampaignContext.Provider value={value}>
          <CampaignSwitcher />
          <LocationProbe />
        </CampaignContext.Provider>
      </MemoryRouter>,
    ),
    value,
  };
}

describe('CampaignSwitcher', () => {
  it('lists four development examples without remembering fixture IDs', async () => {
    const user = userEvent.setup();
    const { value } = renderSwitcher();
    await user.click(screen.getByRole('button', { name: 'Shared name' }));

    expect(screen.getByText('Ashes of Veyra')).toBeInTheDocument();
    expect(screen.getByText('Crown of Cinders')).toBeInTheDocument();
    expect(screen.getByText('Lanterns of Mourningfen')).toBeInTheDocument();
    expect(screen.getByText('Stars Below Kharad')).toBeInTheDocument();

    await user.click(
      screen.getByRole('menuitemradio', { name: /Crown of Cinders/i }),
    );
    expect(screen.getByLabelText('location')).toHaveTextContent(
      '/demo/crown-of-cinders/overview',
    );
    expect(value.rememberCampaign).not.toHaveBeenCalled();
  });

  it('distinguishes duplicate names, marks selection, and switches by ID', async () => {
    const user = userEvent.setup();
    const { value } = renderSwitcher();
    await user.click(screen.getByRole('button', { name: 'Shared name' }));

    expect(screen.getByText('Friday group')).toBeInTheDocument();
    const northernOption = screen
      .getAllByRole('menuitemradio')
      .find((option) => option.textContent?.includes('Northern table'));
    expect(northernOption).toBeDefined();
    if (!northernOption) return;
    await user.click(northernOption);

    expect(value.rememberCampaign).toHaveBeenCalledWith('campaign-two');
    expect(screen.getByLabelText('location')).toHaveTextContent(
      '/campaigns/campaign-two/overview',
    );
  });

  it('validates, cancels, and restores focus in the creation dialog', async () => {
    const user = userEvent.setup();
    renderSwitcher();
    const trigger = screen.getByRole('button', { name: 'Shared name' });
    await user.click(trigger);
    await user.click(
      screen.getByRole('menuitem', { name: /create campaign/i }),
    );
    await user.click(screen.getByRole('button', { name: 'Create Campaign' }));
    expect(screen.getByRole('status')).toHaveTextContent(
      'Enter a campaign name.',
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('creates once, disables repeat submission, and navigates to the new ID', async () => {
    const user = userEvent.setup();
    let resolveCreation: ((value: typeof campaign) => void) | undefined;
    const createCampaign = vi.fn(
      () =>
        new Promise<typeof campaign>((resolve) => {
          resolveCreation = resolve;
        }),
    );
    renderSwitcher({ createCampaign });
    await user.click(screen.getByRole('button', { name: 'Shared name' }));
    await user.click(
      screen.getByRole('menuitem', { name: /create campaign/i }),
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Campaign name' }),
      'New world',
    );
    await user.click(screen.getByRole('button', { name: 'Create Campaign' }));

    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();
    expect(createCampaign).toHaveBeenCalledOnce();
    resolveCreation?.({
      ...campaign,
      id: 'created-campaign',
      name: 'New world',
    });
    await waitFor(() => {
      expect(screen.getByLabelText('location')).toHaveTextContent(
        '/campaigns/created-campaign/overview',
      );
    });
  });

  it('shows server failures inline', async () => {
    const user = userEvent.setup();
    renderSwitcher({
      createCampaign: vi
        .fn()
        .mockRejectedValue(new Error('Server unavailable')),
    });
    await user.click(screen.getByRole('button', { name: 'Shared name' }));
    await user.click(
      screen.getByRole('menuitem', { name: /create campaign/i }),
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Campaign name' }),
      'New world',
    );
    await user.click(screen.getByRole('button', { name: 'Create Campaign' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Server unavailable',
    );
  });
});
