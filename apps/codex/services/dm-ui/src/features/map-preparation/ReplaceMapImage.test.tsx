import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getFixtureBundle } from '@/demo/fixture-registry';
import type {
  ServerBundleBackend,
  ServerBundleStoreController,
} from '@/features/section-shell/bundleStore';
import { renderSection } from '@/features/section-shell/testUtils';
import type { UserAsset } from '@/services/assets-api';

const api = vi.hoisted(() => ({
  listAssets: vi.fn(),
  uploadAssetFile: vi.fn(),
}));
const hub = vi.hoisted(() => ({ measureImage: vi.fn() }));

vi.mock('@/services/assets-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/assets-api')>()),
  ...api,
}));
vi.mock('@/services/generatorHub', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/generatorHub')>()),
  ...hub,
}));

const MAP_PATH = '/campaigns/campaign-blank/maps/map-glass-harbor';

function asset(id: string, overrides: Partial<UserAsset> = {}): UserAsset {
  return {
    id,
    name: `Asset ${id}`,
    category: 'maps',
    fullImage: `users/u1/${id}.png`,
    ...overrides,
  };
}

function setup(updateItem: ServerBundleStoreController['updateItem']) {
  const bundle = {
    ...structuredClone(getFixtureBundle('ashes-of-veyra')!),
    source: 'server',
  } as never;
  const controller: ServerBundleStoreController = {
    load: vi.fn().mockResolvedValue(bundle),
    updateItem,
    addItem: vi.fn(),
  };
  const backend: ServerBundleBackend = {
    createServerBundleStore: vi.fn().mockReturnValue(controller),
    seedFromFixture: vi.fn(),
  };
  return renderSection(MAP_PATH, { backend });
}

beforeEach(() => {
  vi.resetAllMocks();
  api.listAssets.mockResolvedValue([
    asset('m1'),
    asset('t1', { category: 'tokens' }),
    asset('d1', { fullImage: 'users/u1/d1.txt' }),
  ]);
  hub.measureImage.mockResolvedValue({ width: 800, height: 600 });
});

describe('Replace map image', () => {
  it('is not offered on read-only maps', () => {
    renderSection('/demo/ashes-of-veyra/maps/map-glass-harbor');
    expect(screen.queryByRole('button', { name: 'Replace image' })).toBeNull();
  });

  it('offers only map-category image assets and applies the chosen one', async () => {
    const updateItem = vi.fn().mockResolvedValue({ ok: true });
    const { user } = setup(updateItem);
    await user.click(await screen.findByRole('button', { name: 'Replace image' }));
    const list = await screen.findByRole('list', { name: 'Your map images' });
    expect(within(list).getAllByRole('button')).toHaveLength(1);

    await user.click(within(list).getByRole('button', { name: /Asset m1/ }));
    await waitFor(() =>
      expect(updateItem).toHaveBeenCalledWith('campaign-map', 'map-glass-harbor', {
        imageAssetRef: { target: 'asset', assetId: 'm1' },
        imagePath: '/users/u1/m1.png',
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('uploads a new image, measures it and applies it with its dimensions', async () => {
    const updateItem = vi.fn().mockResolvedValue({ ok: true });
    api.uploadAssetFile.mockResolvedValue(asset('up1'));
    const { user } = setup(updateItem);
    await user.click(await screen.findByRole('button', { name: 'Replace image' }));
    const file = new File(['x'], 'new.png', { type: 'image/png' });
    await user.upload(await screen.findByLabelText('Choose image to upload'), file);
    await waitFor(() =>
      expect(updateItem).toHaveBeenCalledWith('campaign-map', 'map-glass-harbor', {
        imageAssetRef: { target: 'asset', assetId: 'up1' },
        imagePath: '/users/u1/up1.png',
        dimensions: { width: 800, height: 600 },
      }),
    );
    expect(api.uploadAssetFile).toHaveBeenCalledWith(file, 'maps');
  });

  it('keeps the picker open and shows the failure when saving is rejected', async () => {
    const updateItem = vi
      .fn()
      .mockResolvedValue({ ok: false, error: 'Server said no' });
    const { user } = setup(updateItem);
    await user.click(await screen.findByRole('button', { name: 'Replace image' }));
    const list = await screen.findByRole('list', { name: 'Your map images' });
    await user.click(within(list).getByRole('button', { name: /Asset m1/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Server said no');
    expect(screen.getByRole('dialog')).toBeVisible();
  });

  it('shows an upload problem without changing the map', async () => {
    const updateItem = vi.fn();
    api.uploadAssetFile.mockRejectedValue(new Error('That image is over 5 MB.'));
    const { user } = setup(updateItem);
    await user.click(await screen.findByRole('button', { name: 'Replace image' }));
    await user.upload(
      await screen.findByLabelText('Choose image to upload'),
      new File(['x'], 'big.png', { type: 'image/png' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('over 5 MB');
    expect(updateItem).not.toHaveBeenCalled();
  });
});
