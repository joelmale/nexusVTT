import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import {
  MemoryRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import {
  CampaignContext,
  type CampaignContextValue,
} from '@/features/campaigns/CampaignContext';
import { CapabilityNoticeProvider } from '@/features/capability-notice';
import { renderSection } from '@/features/section-shell/testUtils';
import { StudioNavigationProvider } from '@/features/studio-shell/StudioNavigationProvider';

import { CampaignOverviewRoute } from './CampaignOverviewRoute';
import { CampaignRootRoute } from './CampaignRootRoute';
import { DemoCampaignOverviewRoute } from './DemoCampaignOverviewRoute';
import {
  LEGACY_REDIRECTS,
  SECTION_ROUTE_PREFIXES,
  SECTION_ROUTES,
} from './sectionRoutes';

const campaign = {
  createdAt: '2026-09-27T12:00:00Z',
  description: 'A completely new world',
  id: 'campaign-blank',
  name: 'Blank Slate',
  updatedAt: '2026-09-27T12:00:00Z',
};

function contextValue(
  overrides: Partial<CampaignContextValue> = {},
): CampaignContextValue {
  return {
    activeCampaign: campaign,
    activeCampaignId: campaign.id,
    campaigns: [campaign],
    createCampaign: vi.fn(),
    isDemoCampaign: false,
    lastValidCampaignId: campaign.id,
    reload: vi.fn(),
    rememberCampaign: vi.fn(),
    state: 'ready',
    ...overrides,
  };
}

function LocationProbe() {
  return <div aria-label="location">{useLocation().pathname}</div>;
}

describe('campaign routes', () => {
  it('renders a distinct development fixture with its session plan', () => {
    render(
      <MemoryRouter initialEntries={['/demo/crown-of-cinders/overview']}>
        <CampaignContext.Provider
          value={contextValue({
            activeCampaign: undefined,
            activeCampaignId: undefined,
            isDemoCampaign: true,
          })}
        >
          <CapabilityNoticeProvider>
            <StudioNavigationProvider>
              <Routes>
                <Route
                  path="/demo/:fixtureSlug/overview"
                  element={<DemoCampaignOverviewRoute />}
                />
              </Routes>
            </StudioNavigationProvider>
          </CapabilityNoticeProvider>
        </CampaignContext.Provider>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: 'Crown of Cinders' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Embers at the Coronation')).toBeInTheDocument();
    expect(
      screen.getByText('Choose which heir receives the crown'),
    ).toBeInTheDocument();
  });

  it('rejects unknown and production-gated fixture slugs', () => {
    render(
      <MemoryRouter initialEntries={['/demo/not-a-fixture/overview']}>
        <CampaignContext.Provider
          value={contextValue({
            activeCampaign: undefined,
            activeCampaignId: undefined,
            isDemoCampaign: true,
          })}
        >
          <CapabilityNoticeProvider>
            <StudioNavigationProvider>
              <Routes>
                <Route
                  path="/demo/:fixtureSlug/overview"
                  element={<DemoCampaignOverviewRoute />}
                />
              </Routes>
            </StudioNavigationProvider>
          </CapabilityNoticeProvider>
        </CampaignContext.Provider>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: 'Example campaign unavailable' }),
    ).toBeInTheDocument();
  });

  it('renders a truthful blank overview without sample fixture data', () => {
    render(
      <MemoryRouter initialEntries={['/campaigns/campaign-blank/overview']}>
        <CampaignContext.Provider value={contextValue()}>
          <CapabilityNoticeProvider>
            <StudioNavigationProvider>
              <CampaignOverviewRoute />
            </StudioNavigationProvider>
          </CapabilityNoticeProvider>
        </CampaignContext.Provider>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: 'Blank Slate' }),
    ).toBeInTheDocument();
    expect(screen.getByText('This campaign is empty')).toBeInTheDocument();
    expect(screen.getAllByText('0')).toHaveLength(6);
    expect(screen.queryByText('The Glass Harbor')).toBeNull();
    expect(screen.queryByText('Captain Serin')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Add campaign object' }),
    ).toBeDisabled();
  });

  it('shows an unavailable state for an inaccessible route campaign ID', () => {
    render(
      <MemoryRouter>
        <CampaignContext.Provider
          value={contextValue({ activeCampaign: undefined })}
        >
          <CapabilityNoticeProvider>
            <StudioNavigationProvider>
              <CampaignOverviewRoute />
            </StudioNavigationProvider>
          </CapabilityNoticeProvider>
        </CampaignContext.Provider>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: 'Campaign unavailable' }),
    ).toBeInTheDocument();
  });

  it('redirects the root to the last valid campaign ID', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <CampaignContext.Provider value={contextValue()}>
          <Routes>
            <Route path="/" element={<CampaignRootRoute />} />
            <Route
              path="/campaigns/:campaignId/overview"
              element={<LocationProbe />}
            />
          </Routes>
        </CampaignContext.Provider>
      </MemoryRouter>,
    );

    expect(await screen.findByLabelText('location')).toHaveTextContent(
      '/campaigns/campaign-blank/overview',
    );
  });

  it.each([
    [
      '/demo/ashes-of-veyra/maps/glass-harbor',
      '/demo/ashes-of-veyra/maps/map-glass-harbor',
    ],
    [
      '/campaigns/ashes-of-veyra/sessions/session-12',
      '/demo/ashes-of-veyra/sessions/session-12/plan',
    ],
    [
      '/campaigns/ashes-of-veyra/maps/glass-harbor',
      '/demo/ashes-of-veyra/maps/map-glass-harbor',
    ],
    ['/campaigns/ashes-of-veyra/overview', '/demo/ashes-of-veyra/overview'],
  ])('redirects legacy %s to %s', (from, to) => {
    render(
      <MemoryRouter initialEntries={[from]}>
        <Routes>
          {LEGACY_REDIRECTS.map((redirect) => (
            <Route
              key={redirect.from}
              path={redirect.from}
              element={<Navigate to={redirect.to} replace />}
            />
          ))}
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByLabelText('location')).toHaveTextContent(to);
  });

  it.each([
    ['/demo/ashes-of-veyra/lore', '/demo/ashes-of-veyra/notes'],
    ['/demo/ashes-of-veyra/lore/notes/note-1', '/demo/ashes-of-veyra/notes/note-1'],
    ['/demo/ashes-of-veyra/lore/handouts', '/demo/ashes-of-veyra/notes'],
    ['/demo/ashes-of-veyra/lore/lore-1', '/demo/ashes-of-veyra/notes/lore-1'],
    ['/demo/ashes-of-veyra/handouts', '/demo/ashes-of-veyra/notes'],
    [
      '/campaigns/campaign-blank/handouts/h-1',
      '/campaigns/campaign-blank/notes/h-1',
    ],
    [
      '/campaigns/campaign-blank/lore/handouts/h-1',
      '/campaigns/campaign-blank/notes/h-1',
    ],
  ])('redirects legacy %s to Notes %s', (from, to) => {
    render(
      <MemoryRouter initialEntries={[from]}>
        <Routes>
          {SECTION_ROUTES.filter(
            (route) =>
              route.path.startsWith('lore') ||
              route.path.startsWith('handouts'),
          ).flatMap((route) =>
            SECTION_ROUTE_PREFIXES.map((prefix) => (
              <Route
                key={`${prefix}/${route.path}`}
                path={`${prefix}/${route.path}`}
                element={route.element}
              />
            )),
          )}
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByLabelText('location')).toHaveTextContent(to);
  });

  const SECTIONS: ReadonlyArray<{
    path: string;
    heading: string;
    empty?: string;
  }> = [
    { path: 'sessions', heading: 'Sessions', empty: 'No sessions yet.' },
    { path: 'world', heading: 'World', empty: 'No locations yet.' },
    { path: 'npcs', heading: 'NPCs', empty: 'No NPCs yet.' },
    { path: 'factions', heading: 'Factions', empty: 'No factions yet.' },
    { path: 'quests', heading: 'Quests', empty: 'No quests yet.' },
    {
      path: 'encounters',
      heading: 'Encounters',
      empty: 'No encounters prepared.',
    },
    { path: 'maps', heading: 'Maps' },
    { path: 'notes', heading: 'Notes', empty: 'No notes yet.' },
  ];

  it('renders every section under the demo and campaign prefixes', () => {
    for (const prefix of ['/demo/ashes-of-veyra', '/campaigns/campaign-blank']) {
      for (const section of SECTIONS) {
        const { unmount } = renderSection(`${prefix}/${section.path}`);
        expect(
          screen.getByRole('heading', { level: 1, name: section.heading }),
        ).toBeInTheDocument();
        expect(screen.queryByText('Coming soon')).toBeNull();
        unmount();
      }
    }
  });

  it('renders the section empty state for a real campaign', () => {
    for (const section of SECTIONS) {
      if (!section.empty) continue;
      const { unmount } = renderSection(
        `/campaigns/campaign-blank/${section.path}`,
      );
      expect(
        screen.getByRole('heading', { level: 1, name: section.heading }),
      ).toBeInTheDocument();
      expect(screen.getAllByText(section.empty).length).toBeGreaterThan(0);
      unmount();
    }
  });

  it('shows "Example campaign unavailable" for an unknown section slug', () => {
    renderSection('/demo/not-a-fixture/npcs');
    expect(
      screen.getByRole('heading', { name: 'Example campaign unavailable' }),
    ).toBeInTheDocument();
  });
});
