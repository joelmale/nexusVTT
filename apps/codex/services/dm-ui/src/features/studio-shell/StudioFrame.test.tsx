import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { CampaignContext } from '@/features/campaigns/CampaignContext';

import { StudioFrame } from './StudioFrame';
import { StudioNavigationProvider } from './StudioNavigationProvider';

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Current route">{location.pathname}</output>;
}

const campaignContext = {
  campaigns: [],
  createCampaign: vi.fn(),
  isDemoCampaign: true,
  reload: vi.fn(),
  rememberCampaign: vi.fn(),
  state: 'ready' as const,
};

describe('StudioFrame navigation', () => {
  it('keeps the campaign rail open on session routes', () => {
    render(
      <MemoryRouter
        initialEntries={['/demo/ashes-of-veyra/sessions/session-12']}
      >
        <CampaignContext.Provider value={campaignContext}>
          <StudioNavigationProvider>
            <StudioFrame onCapability={vi.fn()}>
              <p>Session workspace</p>
            </StudioFrame>
          </StudioNavigationProvider>
        </CampaignContext.Provider>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('complementary', { name: 'Campaign navigation' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Sessions', current: 'page' }),
    ).toBeInTheDocument();
  });

  it('highlights Maps on a nested map editor route', () => {
    render(
      <MemoryRouter initialEntries={['/demo/ashes-of-veyra/maps/map-1']}>
        <CampaignContext.Provider value={campaignContext}>
          <StudioNavigationProvider>
            <StudioFrame onCapability={vi.fn()}>
              <p>Map editor</p>
            </StudioFrame>
          </StudioNavigationProvider>
        </CampaignContext.Provider>
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('button', { name: 'Maps', current: 'page' }),
    ).toBeInTheDocument();
  });

  it('collapses into the top bar and restores the rail on overview', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter
        initialEntries={['/demo/ashes-of-veyra/sessions/session-12']}
      >
        <CampaignContext.Provider value={campaignContext}>
          <StudioNavigationProvider>
            <StudioFrame onCapability={vi.fn()}>
              <LocationProbe />
            </StudioFrame>
          </StudioNavigationProvider>
        </CampaignContext.Provider>
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
      '/demo/ashes-of-veyra/overview',
    );
    expect(
      screen.getByRole('complementary', { name: 'Campaign navigation' }),
    ).toBeInTheDocument();
  });

  it.each([
    ['Overview', 'overview'],
    ['Sessions', 'sessions'],
    ['World & Locations', 'world'],
    ['NPCs', 'npcs'],
    ['Factions', 'factions'],
    ['Quests', 'quests'],
    ['Encounters', 'encounters'],
    ['Items', 'items'],
    ['Maps', 'maps'],
    ['Assets', 'assets'],
    ['Notes', 'notes'],
  ])(
    'navigates %s to its section page and marks it current',
    async (label, route) => {
      const onCapability = vi.fn();
      const user = userEvent.setup();
      render(
        <MemoryRouter initialEntries={['/demo/ashes-of-veyra/overview']}>
          <CampaignContext.Provider value={campaignContext}>
            <StudioNavigationProvider>
              <StudioFrame onCapability={onCapability}>
                <LocationProbe />
              </StudioFrame>
            </StudioNavigationProvider>
          </CampaignContext.Provider>
        </MemoryRouter>,
      );

      await user.click(screen.getByRole('button', { name: label }));
      expect(screen.getByLabelText('Current route')).toHaveTextContent(
        `/demo/ashes-of-veyra/${route}`,
      );
      expect(
        screen.getByRole('button', { name: label, current: 'page' }),
      ).toBeInTheDocument();
      expect(onCapability).not.toHaveBeenCalled();
    },
  );

  it('keeps the section active on a nested item route', () => {
    render(
      <MemoryRouter
        initialEntries={['/demo/ashes-of-veyra/npcs/npc-captain-serin']}
      >
        <CampaignContext.Provider value={campaignContext}>
          <StudioNavigationProvider>
            <StudioFrame onCapability={vi.fn()}>
              <p>npc</p>
            </StudioFrame>
          </StudioNavigationProvider>
        </CampaignContext.Provider>
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('button', { name: 'NPCs', current: 'page' }),
    ).toBeInTheDocument();
  });

  it('navigates real campaigns to /campaigns/:id/<section>', async () => {
    const user = userEvent.setup();
    const campaign = {
      createdAt: '2026-09-27T12:00:00Z',
      id: 'campaign-blank',
      name: 'Blank Slate',
      updatedAt: '2026-09-27T12:00:00Z',
    };
    render(
      <MemoryRouter initialEntries={['/campaigns/campaign-blank/overview']}>
        <CampaignContext.Provider
          value={{
            ...campaignContext,
            activeCampaign: campaign,
            activeCampaignId: campaign.id,
            campaigns: [campaign],
            isDemoCampaign: false,
          }}
        >
          <StudioNavigationProvider>
            <StudioFrame onCapability={vi.fn()}>
              <LocationProbe />
            </StudioFrame>
          </StudioNavigationProvider>
        </CampaignContext.Provider>
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'NPCs' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent(
      '/campaigns/campaign-blank/npcs',
    );
    expect(
      screen.getByRole('button', { name: 'NPCs', current: 'page' }),
    ).toBeInTheDocument();
  });
});
