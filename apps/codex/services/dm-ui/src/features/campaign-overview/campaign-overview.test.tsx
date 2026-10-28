import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getFixtureBundle } from '@/demo/fixture-registry';
import { CampaignOverview } from './campaign-overview';
import { createReadOnlyStore } from '@/features/section-shell/bundleStore';
import { SectionContext } from '@/features/section-shell/SectionContext';
import {
  CampaignContext,
  type CampaignContextValue,
} from '@/features/campaigns/CampaignContext';
import { CapabilityNoticeProvider } from '@/features/capability-notice';
import { LocationProbe } from '@/features/section-shell/LocationProbe';
import { ServerBackendContext } from '@/features/section-shell/ServerBackendContext';
import { StudioNavigationProvider } from '@/features/studio-shell/StudioNavigationProvider';
import { DemoCampaignOverviewRoute } from '@/routes/DemoCampaignOverviewRoute';

const SLUG = 'stars-below-kharad';
const bundle = getFixtureBundle(SLUG, 'test')!;

function renderOverview() {
  const context: CampaignContextValue = {
    activeCampaign: undefined,
    activeCampaignId: undefined,
    campaigns: [],
    createCampaign: vi.fn(),
    isDemoCampaign: true,
    lastValidCampaignId: undefined,
    reload: vi.fn(),
    rememberCampaign: vi.fn(),
    state: 'ready',
  };
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={[`/demo/${SLUG}/overview`]}>
      <CampaignContext.Provider value={context}>
        <ServerBackendContext.Provider value={null}>
          <CapabilityNoticeProvider>
            <StudioNavigationProvider>
              <Routes>
                <Route
                  path="/demo/:fixtureSlug/overview"
                  element={<DemoCampaignOverviewRoute />}
                />
                <Route path="*" element={null} />
              </Routes>
              <LocationProbe />
            </StudioNavigationProvider>
          </CapabilityNoticeProvider>
        </ServerBackendContext.Provider>
      </CampaignContext.Provider>
    </MemoryRouter>,
  );
  return user;
}

const panel = (name: RegExp) => screen.getByRole('region', { name });
/** The header toggle is the first button in each panel. */
const panelToggle = (name: RegExp) =>
  within(panel(name)).getAllByRole('button')[0];
const openLinks = (name: RegExp) =>
  within(panel(name)).queryAllByRole('link', { name: /^Open / });

describe('CampaignOverview panels', () => {
  beforeEach(() => {
    // jsdom here ships without Web Storage; give each test a fresh one.
    const items = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => items.set(key, value),
      removeItem: (key: string) => items.delete(key),
      clear: () => items.clear(),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('collapses a panel to its header and remembers it', async () => {
    const user = renderOverview();
    const toggle = panelToggle(/^Quests/);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(
      document.getElementById(toggle.getAttribute('aria-controls')!),
    ).not.toBeVisible();
    expect(
      window.localStorage.getItem(`nexus-overview-panels:${bundle.campaignId}`),
    ).toContain('"quests":true');
  });

  it('keeps the party panel collapsed by default', () => {
    renderOverview();
    expect(panelToggle(/Party/)).toHaveAttribute('aria-expanded', 'false');
  });

  it('focus shows every record with detail and collapses the others', async () => {
    const user = renderOverview();
    expect(openLinks(/Prepared Encounters/)).toHaveLength(4);

    await user.click(
      screen.getByRole('button', { name: 'Focus Prepared Encounters' }),
    );
    expect(openLinks(/Prepared Encounters/)).toHaveLength(
      bundle.encounters.length,
    );
    expect(
      within(panel(/Prepared Encounters/)).getAllByText('Kind').length,
    ).toBeGreaterThan(0);
    expect(panelToggle(/^Quests/)).toHaveAttribute('aria-expanded', 'false');

    await user.keyboard('{Escape}');
    expect(panelToggle(/^Quests/)).toHaveAttribute('aria-expanded', 'true');
    expect(openLinks(/Prepared Encounters/)).toHaveLength(4);
  });

  it('Open links go to the editable section detail', async () => {
    const user = renderOverview();
    const link = openLinks(/^Quests/)[0];
    const questId = link.getAttribute('href')!.split('/').pop()!;
    expect(
      bundle.quests.some((quest: { id: string }) => quest.id === questId),
    ).toBe(true);

    await user.click(link);
    expect(screen.getByTestId('location')).toHaveTextContent(
      `/demo/${SLUG}/quests/${questId}`,
    );
  });

  it('renders Next Session hub with strong start, scenes timeline and opens run sheet export modal', async () => {
    const user = userEvent.setup();
    const upcomingBundle = {
      ...bundle,
      sessions: bundle.sessions.map((session, index) =>
        index === 0 ? { ...session, status: 'planned' as const } : session,
      ),
    };
    render(
      <MemoryRouter>
        <CapabilityNoticeProvider>
          <SectionContext.Provider
            value={{
              bundle: upcomingBundle,
              basePath: `/demo/${SLUG}`,
              store: createReadOnlyStore(upcomingBundle),
            }}
          >
            <CampaignOverview />
          </SectionContext.Provider>
        </CapabilityNoticeProvider>
      </MemoryRouter>,
    );

    // Strong start heading or content visible
    expect(screen.getByText('Strong Start')).toBeInTheDocument();

    // Planned Scenes & Beats timeline visible
    expect(
      screen.getByRole('heading', { level: 3, name: /Planned Scenes & Beats/ }),
    ).toBeInTheDocument();

    // Export Run Sheet button present
    const exportBtn = screen.getByRole('button', { name: 'Export Run Sheet' });
    expect(exportBtn).toBeInTheDocument();

    // Clicking Export Run Sheet opens modal
    await user.click(exportBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /Session Run Sheet Export/,
      }),
    ).toBeInTheDocument();
  });

  it('renders OneShotHub when campaign mode is one-shot', () => {
    const oneShotBundle = {
      ...bundle,
      campaign: {
        ...bundle.campaign,
        mode: 'one-shot' as const,
      },
    };

    render(
      <MemoryRouter>
        <CapabilityNoticeProvider>
          <SectionContext.Provider
            value={{
              basePath: `/demo/${SLUG}`,
              bundle: oneShotBundle,
              store: createReadOnlyStore(oneShotBundle),
            }}
          >
            <CampaignOverview />
          </SectionContext.Provider>
        </CapabilityNoticeProvider>
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('One-Shot Adventure Hub')).toBeInTheDocument();
    expect(screen.getByText('One-Shot Mode')).toBeInTheDocument();
  });

  it('opens PartyMemberModal in edit mode when clicking a party member row (CS-18)', async () => {
    const user = userEvent.setup();
    const character = bundle.campaign.playerCharacters[0];
    const mockStore = {
      ...createReadOnlyStore(bundle),
      editable: true,
    };

    render(
      <MemoryRouter>
        <SectionContext.Provider
          value={{
            basePath: `/demo/${SLUG}`,
            bundle,
            store: mockStore,
          }}
        >
          <CampaignOverview />
        </SectionContext.Provider>
      </MemoryRouter>,
    );

    // Expand party panel
    const partyToggle = panelToggle(/Party/);
    await user.click(partyToggle);

    // Click on the party member row
    const partyMemberText = within(panel(/Party/)).getByText(character.name);
    await user.click(partyMemberText);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByText(`Edit Party Member: ${character.name}`),
    ).toBeInTheDocument();
  });

  it('renders Add Party Member button on editable campaigns and opens create modal (CS-18)', async () => {
    const user = userEvent.setup();
    const mockStore = {
      ...createReadOnlyStore(bundle),
      editable: true,
    };

    render(
      <MemoryRouter>
        <SectionContext.Provider
          value={{
            basePath: `/demo/${SLUG}`,
            bundle,
            store: mockStore,
          }}
        >
          <CampaignOverview />
        </SectionContext.Provider>
      </MemoryRouter>,
    );

    // Expand party panel
    const partyToggle = panelToggle(/Party/);
    await user.click(partyToggle);

    const addBtn = within(panel(/Party/)).getByRole('button', {
      name: 'Add Party Member',
    });
    expect(addBtn).toBeInTheDocument();

    await user.click(addBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Add Party Member')).toBeInTheDocument();
  });

  it('opens party management roster when clicking View All on Party panel instead of navigating (CS-18)', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SectionContext.Provider
          value={{
            basePath: `/demo/${SLUG}`,
            bundle,
            store: createReadOnlyStore(bundle),
          }}
        >
          <CampaignOverview />
        </SectionContext.Provider>
      </MemoryRouter>,
    );

    // Party panel View All button
    const viewAllBtn = within(panel(/Party/)).getByRole('button', {
      name: /View All/i,
    });
    await user.click(viewAllBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Party Management')).toBeInTheDocument();
  });

  it('provides a row action menu with Open in section, Pin / Unpin, and Archive (CS-17)', async () => {
    const user = userEvent.setup();
    const mockTogglePin = vi.fn().mockResolvedValue({ ok: true });
    const mockRemoveItem = vi.fn().mockResolvedValue({ ok: true });
    const mockStore = {
      ...createReadOnlyStore(bundle),
      editable: true,
      togglePin: mockTogglePin,
      removeItem: mockRemoveItem,
    };

    render(
      <MemoryRouter>
        <SectionContext.Provider
          value={{
            basePath: `/demo/${SLUG}`,
            bundle,
            store: mockStore,
          }}
        >
          <CampaignOverview />
        </SectionContext.Provider>
      </MemoryRouter>,
    );

    const firstQuest = bundle.quests[0];
    const menuBtn = screen.getByRole('button', {
      name: `More actions for ${firstQuest.title}`,
    });
    await user.click(menuBtn);

    const menu = screen.getByRole('menu', {
      name: `Actions for ${firstQuest.title}`,
    });
    expect(menu).toBeInTheDocument();

    const openItem = within(menu).getByRole('menuitem', {
      name: 'Open in section',
    });
    const pinItem = within(menu).getByRole('menuitem', {
      name: 'Pin / Unpin',
    });
    const archiveItem = within(menu).getByRole('menuitem', {
      name: 'Archive',
    });

    expect(openItem).toBeInTheDocument();
    expect(pinItem).toBeInTheDocument();
    expect(archiveItem).toBeInTheDocument();

    await user.click(pinItem);
    expect(mockTogglePin).toHaveBeenCalledWith(firstQuest.id);

    // Open menu again to test archive
    await user.click(menuBtn);
    const archiveItemAgain = screen.getByRole('menuitem', { name: 'Archive' });
    await user.click(archiveItemAgain);
    expect(mockRemoveItem).toHaveBeenCalledWith('quest', firstQuest.id);
  });
});
