import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getFixtureBundle } from '@/demo/fixture-registry';
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
    expect(panelToggle(/^Quests/)).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    await user.keyboard('{Escape}');
    expect(panelToggle(/^Quests/)).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(openLinks(/Prepared Encounters/)).toHaveLength(4);
  });

  it('Open links go to the editable section detail', async () => {
    const user = renderOverview();
    const link = openLinks(/^Quests/)[0];
    const questId = link.getAttribute('href')!.split('/').pop()!;
    expect(bundle.quests.some((quest) => quest.id === questId)).toBe(true);

    await user.click(link);
    expect(screen.getByTestId('location')).toHaveTextContent(
      `/demo/${SLUG}/quests/${questId}`,
    );
  });
});
