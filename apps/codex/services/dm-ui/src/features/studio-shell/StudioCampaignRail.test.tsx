import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { CampaignContext, type CampaignContextValue } from '@/features/campaigns/CampaignContext';
import { StudioCampaignRail } from './StudioCampaignRail';
import { StudioNavigationProvider } from './StudioNavigationProvider';

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Current path">{location.pathname}</output>;
}

const mockCampaign = {
  createdAt: '2026-01-01T00:00:00Z',
  description: 'A test campaign',
  id: 'test-campaign-1',
  name: 'Test Campaign',
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
    reload: vi.fn(),
    rememberCampaign: vi.fn(),
    state: 'ready',
    ...overrides,
  };
}

describe('StudioCampaignRail', () => {
  it('navigates to /campaigns when brand is clicked and no campaign is active (CS-08)', async () => {
    const user = userEvent.setup();
    const context = createMockCampaignContext({
      activeCampaign: undefined,
      activeCampaignId: undefined,
      campaigns: [],
      isDemoCampaign: false,
    });

    render(
      <MemoryRouter initialEntries={['/campaigns']}>
        <CampaignContext.Provider value={context}>
          <StudioNavigationProvider>
            <StudioCampaignRail onCapability={vi.fn()} />
            <LocationProbe />
          </StudioNavigationProvider>
        </CampaignContext.Provider>
      </MemoryRouter>,
    );

    const brandBtn = screen.getByRole('button', { name: 'Return to campaigns' });
    await user.click(brandBtn);

    expect(screen.getByLabelText('Current path')).toHaveTextContent('/campaigns');
  });

  it('navigates to campaign overview when brand is clicked with an active campaign', async () => {
    const user = userEvent.setup();
    const context = createMockCampaignContext();

    render(
      <MemoryRouter initialEntries={['/campaigns/test-campaign-1/npcs']}>
        <CampaignContext.Provider value={context}>
          <StudioNavigationProvider>
            <StudioCampaignRail onCapability={vi.fn()} />
            <LocationProbe />
          </StudioNavigationProvider>
        </CampaignContext.Provider>
      </MemoryRouter>,
    );

    const brandBtn = screen.getByRole('button', {
      name: 'Return to campaign overview',
    });
    await user.click(brandBtn);

    expect(screen.getByLabelText('Current path')).toHaveTextContent(
      '/campaigns/test-campaign-1/overview',
    );
  });

  it('disables section navigation items when no campaign is loaded', () => {
    const context = createMockCampaignContext({
      activeCampaign: undefined,
      activeCampaignId: undefined,
      campaigns: [],
      isDemoCampaign: false,
    });

    render(
      <MemoryRouter initialEntries={['/campaigns']}>
        <CampaignContext.Provider value={context}>
          <StudioNavigationProvider>
            <StudioCampaignRail onCapability={vi.fn()} />
          </StudioNavigationProvider>
        </CampaignContext.Provider>
      </MemoryRouter>,
    );

    const npcsBtn = screen.getByRole('button', { name: 'NPCs' });
    expect(npcsBtn).toBeDisabled();
  });

  it('renders and triggers search when onSearch is provided', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    const context = createMockCampaignContext();

    render(
      <MemoryRouter initialEntries={['/campaigns/test-campaign-1/overview']}>
        <CampaignContext.Provider value={context}>
          <StudioNavigationProvider>
            <StudioCampaignRail onCapability={vi.fn()} onSearch={onSearch} />
          </StudioNavigationProvider>
        </CampaignContext.Provider>
      </MemoryRouter>,
    );

    const searchBtn = screen.getByRole('button', { name: 'Search' });
    await user.click(searchBtn);
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('exposes Quick capture, Relationship web, and Change theme in footer when handlers are provided (CS-09)', async () => {
    const user = userEvent.setup();
    const onQuickCapture = vi.fn();
    const onRelationshipWeb = vi.fn();
    const onTheme = vi.fn();
    const onSettings = vi.fn();
    const context = createMockCampaignContext();

    render(
      <MemoryRouter initialEntries={['/campaigns/test-campaign-1/overview']}>
        <CampaignContext.Provider value={context}>
          <StudioNavigationProvider>
            <StudioCampaignRail
              onCapability={vi.fn()}
              onQuickCapture={onQuickCapture}
              onRelationshipWeb={onRelationshipWeb}
              onSettings={onSettings}
              onTheme={onTheme}
            />
          </StudioNavigationProvider>
        </CampaignContext.Provider>
      </MemoryRouter>,
    );

    const quickCaptureBtn = screen.getByRole('button', {
      name: 'Quick capture (Ctrl+Shift+N)',
    });
    await user.click(quickCaptureBtn);
    expect(onQuickCapture).toHaveBeenCalledTimes(1);

    const relWebBtn = screen.getByRole('button', {
      name: 'Relationship web',
    });
    await user.click(relWebBtn);
    expect(onRelationshipWeb).toHaveBeenCalledTimes(1);

    const themeBtn = screen.getByRole('button', {
      name: 'Change theme',
    });
    await user.click(themeBtn);
    expect(onTheme).toHaveBeenCalledTimes(1);

    const settingsBtn = screen.getByRole('button', {
      name: 'Campaign settings',
    });
    await user.click(settingsBtn);
    expect(onSettings).toHaveBeenCalledTimes(1);
  });

  it('falls back to onCapability when onSettings is not provided', async () => {
    const user = userEvent.setup();
    const onCapability = vi.fn();
    const context = createMockCampaignContext();

    render(
      <MemoryRouter initialEntries={['/campaigns/test-campaign-1/overview']}>
        <CampaignContext.Provider value={context}>
          <StudioNavigationProvider>
            <StudioCampaignRail onCapability={onCapability} />
          </StudioNavigationProvider>
        </CampaignContext.Provider>
      </MemoryRouter>,
    );

    const settingsBtn = screen.getByRole('button', {
      name: 'Campaign settings',
    });
    await user.click(settingsBtn);
    expect(onCapability).toHaveBeenCalledWith('campaign.settings.open');
  });
});
