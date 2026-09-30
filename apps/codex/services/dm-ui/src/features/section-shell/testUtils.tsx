import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';

import {
  CampaignContext,
  type CampaignContextValue,
} from '@/features/campaigns/CampaignContext';
import { CapabilityNoticeProvider } from '@/features/capability-notice';
import { StudioNavigationProvider } from '@/features/studio-shell/StudioNavigationProvider';
import { SECTION_ROUTES, SECTION_ROUTE_PREFIXES } from '@/routes/sectionRoutes';
import type { CampaignSummary } from '@/services/campaign-api';

import {
  createReadOnlyStore,
  type BundleStore,
  type ServerBundleBackend,
} from './bundleStore';
import { getFixtureBundle } from '@/demo/fixture-registry';
import { SectionContext } from './SectionContext';
import { LocationProbe } from './LocationProbe';
import { ServerBackendContext } from './ServerBackendContext';

export const TEST_CAMPAIGN: CampaignSummary = {
  createdAt: '2026-09-27T12:00:00Z',
  description: 'A completely new world',
  id: 'campaign-blank',
  name: 'Blank Slate',
  updatedAt: '2026-09-27T12:00:00Z',
};

export interface RenderSectionOptions {
  /** Real-campaign summary for `/campaigns/:id/...` paths. */
  campaign?: CampaignSummary;
  /** Inject a server backend (`null` = none). Defaults to none. */
  backend?: ServerBundleBackend | null;
  /** Mock `matchMedia` so `(max-width: 1019.98px)` matches (single pane). */
  singlePane?: boolean;
  /** Extra elements rendered next to the routes. */
  children?: ReactElement;
}

/** Installs a `matchMedia` mock; returns nothing, cleanup is per-test. */
export function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

/**
 * Renders the real section route table at `path` (`/demo/<slug>/npcs/...` or
 * `/campaigns/<id>/...`) inside the providers the Studio frame needs. Read the
 * router location with `getByTestId('location')`.
 */
export function renderSection(
  path: string,
  options: RenderSectionOptions = {},
) {
  const { campaign = TEST_CAMPAIGN, backend = null, singlePane } = options;
  if (singlePane !== undefined) mockMatchMedia(singlePane);
  const isDemoCampaign = path.startsWith('/demo/');
  const context: CampaignContextValue = {
    activeCampaign: isDemoCampaign ? undefined : campaign,
    activeCampaignId: isDemoCampaign ? undefined : campaign.id,
    campaigns: isDemoCampaign ? [] : [campaign],
    createCampaign: vi.fn(),
    isDemoCampaign,
    lastValidCampaignId: campaign.id,
    reload: vi.fn().mockResolvedValue(undefined),
    rememberCampaign: vi.fn(),
    state: 'ready',
  };
  const user = userEvent.setup();
  const result = render(
    <MemoryRouter initialEntries={[path]}>
      <CampaignContext.Provider value={context}>
        <ServerBackendContext.Provider value={backend}>
          <CapabilityNoticeProvider>
            <StudioNavigationProvider>
              <Routes>
                {SECTION_ROUTE_PREFIXES.flatMap((prefix) =>
                  SECTION_ROUTES.map((route) => (
                    <Route
                      key={`${prefix}/${route.path}`}
                      path={`${prefix}/${route.path}`}
                      element={route.element}
                    />
                  )),
                )}
              </Routes>
              <LocationProbe />
              {options.children}
            </StudioNavigationProvider>
          </CapabilityNoticeProvider>
        </ServerBackendContext.Provider>
      </CampaignContext.Provider>
    </MemoryRouter>,
  );
  return { ...result, user, campaignContext: context };
}

export interface RenderInSectionOptions {
  /** Router location; also decides whether this is an example page. */
  path?: string;
  /** Fixture slug for the bundle. */
  slug?: string;
  /** Store overrides, e.g. `{ editable: true, updateItem: vi.fn() }`. */
  store?: Partial<BundleStore>;
  backend?: ServerBundleBackend | null;
  singlePane?: boolean;
}

/**
 * Renders `ui` (a `SectionLayout`, `EditableSection`, ...) inside a section
 * context without the route table. Use for component tests that need a custom
 * store.
 */
export function renderInSection(
  ui: ReactElement,
  options: RenderInSectionOptions = {},
) {
  const {
    slug = 'ashes-of-veyra',
    path = `/demo/${slug}/npcs`,
    backend = null,
    singlePane,
  } = options;
  if (singlePane !== undefined) mockMatchMedia(singlePane);
  const bundle = getFixtureBundle(slug);
  if (!bundle) throw new Error(`Unknown fixture ${slug}`);
  const isDemoCampaign = path.startsWith('/demo/');
  const store: BundleStore = {
    ...createReadOnlyStore(bundle),
    ...options.store,
  };
  const context: CampaignContextValue = {
    activeCampaign: undefined,
    campaigns: [],
    createCampaign: vi.fn(),
    isDemoCampaign,
    reload: vi.fn().mockResolvedValue(undefined),
    rememberCampaign: vi.fn(),
    state: 'ready',
  };
  const user = userEvent.setup();
  const result = render(
    <MemoryRouter initialEntries={[path]}>
      <CampaignContext.Provider value={context}>
        <ServerBackendContext.Provider value={backend}>
          <CapabilityNoticeProvider>
            <SectionContext.Provider
              value={{
                bundle: store.bundle,
                basePath: isDemoCampaign
                  ? `/demo/${slug}`
                  : '/campaigns/campaign-blank',
                store,
                exampleSlug: isDemoCampaign ? slug : undefined,
              }}
            >
              {ui}
            </SectionContext.Provider>
            <LocationProbe />
          </CapabilityNoticeProvider>
        </ServerBackendContext.Provider>
      </CampaignContext.Provider>
    </MemoryRouter>,
  );
  return { ...result, user, store, campaignContext: context };
}
