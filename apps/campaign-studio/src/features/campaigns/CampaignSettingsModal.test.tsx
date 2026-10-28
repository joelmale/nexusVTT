import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import * as campaignApi from '@/services/campaign-api';
import { CampaignContext, type CampaignContextValue } from './CampaignContext';
import { CampaignSettingsModal } from './CampaignSettingsModal';

vi.mock('@/services/campaign-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/campaign-api')>();
  return {
    ...actual,
    updateCampaign: vi.fn(),
    deleteCampaign: vi.fn(),
  };
});

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Current path">{location.pathname}</output>;
}

const mockCampaign = {
  createdAt: '2026-01-01T00:00:00Z',
  description: 'An existing adventure',
  edition: '2024',
  id: 'camp-settings-test',
  mode: 'campaign' as const,
  mood: 'parchment',
  name: 'Dragons of Stormwreck',
  updatedAt: '2026-01-02T00:00:00Z',
};

function createMockCampaignContext(
  overrides?: Partial<CampaignContextValue>,
): CampaignContextValue {
  return {
    activeCampaign: mockCampaign,
    activeCampaignId: mockCampaign.id,
    campaigns: [mockCampaign],
    createCampaign: vi.fn(),
    error: undefined,
    isDemoCampaign: false,
    reload: vi.fn().mockResolvedValue(undefined),
    rememberCampaign: vi.fn(),
    state: 'ready',
    ...overrides,
  };
}

describe('CampaignSettingsModal (CS-11 & CS-15)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    render(
      <MemoryRouter>
        <CampaignContext.Provider value={createMockCampaignContext()}>
          <CampaignSettingsModal
            campaign={mockCampaign}
            isOpen={false}
            onClose={vi.fn()}
          />
        </CampaignContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('populates fields with the campaign data and handles close', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <MemoryRouter>
        <CampaignContext.Provider value={createMockCampaignContext()}>
          <CampaignSettingsModal
            campaign={mockCampaign}
            isOpen={true}
            onClose={onClose}
          />
        </CampaignContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Campaign Settings' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Campaign name' })).toHaveValue('Dragons of Stormwreck');
    expect(screen.getByRole('textbox', { name: /Description/i })).toHaveValue('An existing adventure');
    expect(screen.getByRole('radio', { name: /2024 Rules/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /Campaign/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('combobox', { name: 'Visual Theme & Mood' })).toHaveValue('parchment');

    await user.click(screen.getByRole('button', { name: 'Close settings' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('updates campaign settings via updateCampaign on valid form submission', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const reload = vi.fn().mockResolvedValue(undefined);
    const context = createMockCampaignContext({ reload });
    vi.mocked(campaignApi.updateCampaign).mockResolvedValueOnce(undefined);

    render(
      <MemoryRouter>
        <CampaignContext.Provider value={context}>
          <CampaignSettingsModal
            campaign={mockCampaign}
            isOpen={true}
            onClose={onClose}
          />
        </CampaignContext.Provider>
      </MemoryRouter>,
    );

    const nameInput = screen.getByRole('textbox', { name: 'Campaign name' });
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Campaign Name');

    await user.click(screen.getByRole('radio', { name: /2014 Legacy/i }));
    await user.click(screen.getByRole('radio', { name: /One-Shot/i }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Visual Theme & Mood' }), 'grimdark');

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(campaignApi.updateCampaign).toHaveBeenCalledWith('camp-settings-test', {
        description: 'An existing adventure',
        edition: '2014',
        mode: 'one-shot',
        mood: 'grimdark',
        name: 'Updated Campaign Name',
      });
    });

    expect(reload).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('shows an error when attempting to save with an empty name', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <CampaignContext.Provider value={createMockCampaignContext()}>
          <CampaignSettingsModal
            campaign={mockCampaign}
            isOpen={true}
            onClose={vi.fn()}
          />
        </CampaignContext.Provider>
      </MemoryRouter>,
    );

    const nameInput = screen.getByRole('textbox', { name: 'Campaign name' });
    await user.clear(nameInput);
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Campaign name is required.');
    expect(campaignApi.updateCampaign).not.toHaveBeenCalled();
  });

  it('displays API error when updateCampaign fails', async () => {
    const user = userEvent.setup();
    vi.mocked(campaignApi.updateCampaign).mockRejectedValueOnce(new Error('Network failure'));

    render(
      <MemoryRouter>
        <CampaignContext.Provider value={createMockCampaignContext()}>
          <CampaignSettingsModal
            campaign={mockCampaign}
            isOpen={true}
            onClose={vi.fn()}
          />
        </CampaignContext.Provider>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Network failure');
  });

  it('executes delete flow with confirmation and navigates to /campaigns (CS-15)', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const reload = vi.fn().mockResolvedValue(undefined);
    const context = createMockCampaignContext({ reload });
    vi.mocked(campaignApi.deleteCampaign).mockResolvedValueOnce(undefined);

    render(
      <MemoryRouter initialEntries={['/campaigns/camp-settings-test/overview']}>
        <CampaignContext.Provider value={context}>
          <CampaignSettingsModal
            campaign={mockCampaign}
            isOpen={true}
            onClose={onClose}
          />
          <LocationProbe />
        </CampaignContext.Provider>
      </MemoryRouter>,
    );

    // Initial delete button click triggers confirmation
    await user.click(screen.getByRole('button', { name: 'Delete Campaign' }));
    expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();

    // Confirm delete
    await user.click(screen.getByRole('button', { name: 'Yes, Delete Campaign' }));

    await waitFor(() => {
      expect(campaignApi.deleteCampaign).toHaveBeenCalledWith('camp-settings-test');
    });

    expect(reload).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByLabelText('Current path')).toHaveTextContent('/campaigns');
  });

  it('renders read-only state for non-editable campaigns', () => {
    render(
      <MemoryRouter>
        <CampaignContext.Provider value={createMockCampaignContext()}>
          <CampaignSettingsModal
            campaign={mockCampaign}
            isEditable={false}
            isOpen={true}
            onClose={vi.fn()}
          />
        </CampaignContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'This example fixture is read-only. Settings cannot be edited or deleted.',
    );

    expect(screen.getByRole('textbox', { name: 'Campaign name' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: /Description/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save Changes' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete Campaign' })).toBeNull();
  });
});
