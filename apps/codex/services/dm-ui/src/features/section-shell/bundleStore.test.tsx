import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { getFixtureBundle } from '@/demo/fixture-registry';
import {
  CampaignContext,
  type CampaignContextValue,
} from '@/features/campaigns/CampaignContext';

import {
  createReadOnlyStore,
  type ServerBundleBackend,
  type ServerBundleStoreController,
} from './bundleStore';
import { ServerBackendContext } from './ServerBackendContext';
import { TEST_CAMPAIGN } from './testUtils';
import { useBundleStore } from './useBundleStore';

describe('read-only store', () => {
  it('is not editable and rejects mutations as read-only', async () => {
    const bundle = getFixtureBundle('ashes-of-veyra')!;
    const store = createReadOnlyStore(bundle);
    expect(store.editable).toBe(false);
    expect(store.status).toBe('ready');
    expect(store.bundle).toBe(bundle);
    await expect(store.updateItem('npc', 'x', {})).resolves.toEqual({
      ok: false,
      error: 'read-only',
    });
    await expect(store.addItem('npc', {})).resolves.toEqual({
      ok: false,
      error: 'read-only',
    });
    await expect(store.reload()).resolves.toBeUndefined();
  });
});

function Probe() {
  const state = useBundleStore();
  if (state.status !== 'ready') return <p>{state.status}</p>;
  return (
    <p>
      {state.store.editable ? 'editable' : 'read-only'} ·{' '}
      {state.store.bundle.source} · {state.store.status} · {state.basePath}
    </p>
  );
}

function renderProbe(path: string, backend: ServerBundleBackend | null = null) {
  const demo = path.startsWith('/demo/');
  const context: CampaignContextValue = {
    activeCampaign: demo ? undefined : TEST_CAMPAIGN,
    campaigns: [],
    createCampaign: vi.fn(),
    isDemoCampaign: demo,
    reload: vi.fn(),
    rememberCampaign: vi.fn(),
    state: 'ready',
  };
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CampaignContext.Provider value={context}>
        <ServerBackendContext.Provider value={backend}>
          <Routes>
            <Route path="/demo/:fixtureSlug/*" element={<Probe />} />
            <Route path="/campaigns/:campaignId/*" element={<Probe />} />
          </Routes>
        </ServerBackendContext.Provider>
      </CampaignContext.Provider>
    </MemoryRouter>,
  );
}

describe('useBundleStore', () => {
  it('is read-only for example campaigns, even with a backend', () => {
    const backend: ServerBundleBackend = {
      createServerBundleStore: vi.fn(),
      seedFromFixture: vi.fn(),
    };
    renderProbe('/demo/ashes-of-veyra/npcs', backend);
    expect(
      screen.getByText('read-only · fixture · ready · /demo/ashes-of-veyra'),
    ).toBeInTheDocument();
    expect(backend.createServerBundleStore).not.toHaveBeenCalled();
  });

  it('is read-only and empty for real campaigns without a backend', () => {
    renderProbe('/campaigns/campaign-blank/npcs');
    expect(
      screen.getByText(
        'read-only · server-empty · ready · /campaigns/campaign-blank',
      ),
    ).toBeInTheDocument();
  });

  it('becomes editable with a server backend and adopts its bundle', async () => {
    const serverBundle = {
      ...getFixtureBundle('ashes-of-veyra')!,
      source: 'server',
    } as never;
    const controller: ServerBundleStoreController = {
      load: vi.fn().mockResolvedValue(serverBundle),
      updateItem: vi.fn(),
      addItem: vi.fn(),
    };
    const backend: ServerBundleBackend = {
      createServerBundleStore: vi.fn().mockReturnValue(controller),
      seedFromFixture: vi.fn(),
    };
    renderProbe('/campaigns/campaign-blank/npcs', backend);
    expect(
      await screen.findByText(
        'editable · server · ready · /campaigns/campaign-blank',
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(controller.load).toHaveBeenCalledTimes(1));
  });

  it('stays read-only when the server refuses to load (non-DM)', async () => {
    const controller: ServerBundleStoreController = {
      load: vi.fn().mockRejectedValue(new Error('403')),
      updateItem: vi.fn(),
      addItem: vi.fn(),
    };
    const backend: ServerBundleBackend = {
      createServerBundleStore: vi.fn().mockReturnValue(controller),
      seedFromFixture: vi.fn(),
    };
    renderProbe('/campaigns/campaign-blank/npcs', backend);
    expect(
      await screen.findByText(/^read-only .* server-empty .* error .*/),
    ).toBeInTheDocument();
  });

  it('refetches the authoritative bundle when an update conflicts', async () => {
    const serverBundle = {
      ...getFixtureBundle('ashes-of-veyra')!,
      source: 'server',
    } as never;
    const controller: ServerBundleStoreController = {
      load: vi.fn().mockResolvedValue(serverBundle),
      updateItem: vi.fn().mockResolvedValue({ ok: false, conflict: true }),
      addItem: vi.fn(),
    };
    const backend: ServerBundleBackend = {
      createServerBundleStore: vi.fn().mockReturnValue(controller),
      seedFromFixture: vi.fn(),
    };
    let result: unknown;
    function Updater() {
      const state = useBundleStore();
      if (state.status !== 'ready' || !state.store.editable) return null;
      return (
        <button
          onClick={() => {
            void state.store.updateItem('npc', 'x', {}).then((r) => {
              result = r;
            });
          }}
          type="button"
        >
          go
        </button>
      );
    }
    const context: CampaignContextValue = {
      activeCampaign: TEST_CAMPAIGN,
      campaigns: [],
      createCampaign: vi.fn(),
      isDemoCampaign: false,
      reload: vi.fn(),
      rememberCampaign: vi.fn(),
      state: 'ready',
    };
    render(
      <MemoryRouter initialEntries={['/campaigns/c/npcs']}>
        <CampaignContext.Provider value={context}>
          <ServerBackendContext.Provider value={backend}>
            <Routes>
              <Route path="/campaigns/:campaignId/*" element={<Updater />} />
            </Routes>
          </ServerBackendContext.Provider>
        </CampaignContext.Provider>
      </MemoryRouter>,
    );
    const button = await screen.findByRole('button', { name: 'go' });
    button.click();
    await waitFor(() => expect(controller.load).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result).toMatchObject({ conflict: true }));
  });
});
