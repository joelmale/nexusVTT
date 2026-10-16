import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getFixtureBundle } from '@/demo/fixture-registry';
import type {
  ServerBundleBackend,
  ServerBundleStoreController,
} from '@/features/section-shell/bundleStore';
import { renderSection } from '@/features/section-shell/testUtils';
import type { UserAsset } from '@/services/assets-api';

import { computeAssetUsage } from './assetUsage';

const api = vi.hoisted(() => ({
  listAssets: vi.fn(),
  updateAsset: vi.fn(),
  deleteAsset: vi.fn(),
  uploadAssetFile: vi.fn(),
}));

vi.mock('@/services/assets-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/assets-api')>()),
  ...api,
}));

function asset(overrides: Partial<UserAsset> & { id: string }): UserAsset {
  return {
    name: overrides.id,
    category: 'maps',
    tags: ['custom'],
    fullImage: `users/u1/${overrides.id}.png`,
    thumbnail: `users/u1/${overrides.id}.png`,
    size: 2048,
    source: 'user',
    ...overrides,
  };
}

const ASSETS: UserAsset[] = [
  asset({ id: 'a1', name: 'Harbor Map', createdAt: '2026-10-01T10:00:00Z' }),
  asset({ id: 'a2', name: 'Dragon Token', category: 'tokens', tags: ['dragon'] }),
  asset({ id: 'a3', name: 'Tavern Photo', fullImage: 'users/u1/loc-file.png' }),
  asset({ id: 'a4', name: 'Spare Cave', tags: ['generated', 'cave'] }),
];

function serverBundle() {
  const bundle = structuredClone(getFixtureBundle('ashes-of-veyra')!);
  bundle.maps[0]!.imageAssetRef = { target: 'asset', assetId: 'a1' };
  bundle.maps[0]!.imagePath = undefined;
  bundle.locations[0]!.imagePath = '/users/u1/loc-file.png';
  return { ...bundle, source: 'server' } as never;
}

function backend(): ServerBundleBackend {
  const controller: ServerBundleStoreController = {
    load: vi.fn().mockResolvedValue(serverBundle()),
    updateItem: vi.fn(),
    addItem: vi.fn(),
  };
  return {
    createServerBundleStore: vi.fn().mockReturnValue(controller),
    seedFromFixture: vi.fn(),
  };
}

async function open(path = '/campaigns/campaign-blank/assets') {
  const view = renderSection(path, { backend: backend() });
  await screen.findByRole('list', { name: 'Assets' });
  return view;
}

const cardNames = () =>
  within(screen.getByRole('list', { name: 'Assets' }))
    .getAllByRole('button')
    .map((button) => button.getAttribute('aria-label'));

beforeEach(() => {
  vi.resetAllMocks();
  api.listAssets.mockResolvedValue(ASSETS.map((item) => ({ ...item })));
});

describe('computeAssetUsage', () => {
  it('matches maps by asset id or image file and locations by image file', () => {
    const bundle = structuredClone(getFixtureBundle('ashes-of-veyra')!);
    bundle.maps[0]!.imageAssetRef = { target: 'asset', assetId: 'a1' };
    bundle.maps[1] = {
      ...bundle.maps[0]!,
      id: 'second',
      title: 'Second',
      imageAssetRef: undefined,
      imagePath: '/users/u1/a2.png?v=2',
    };
    bundle.locations[0]!.imagePath = '/users/u1/a3.png';
    expect(
      computeAssetUsage(bundle, { id: 'a1', fullImage: 'users/u1/a1.png' }).map(
        (item) => item.id,
      ),
    ).toEqual([bundle.maps[0]!.id]);
    expect(
      computeAssetUsage(bundle, { id: 'a2', fullImage: 'users/u1/a2.png' }),
    ).toEqual([{ kind: 'map', id: 'second', title: 'Second', section: 'maps' }]);
    expect(
      computeAssetUsage(bundle, { id: 'a3', fullImage: 'users/u1/a3.png' })[0],
    ).toMatchObject({ kind: 'location', section: 'world' });
    expect(
      computeAssetUsage(bundle, { id: 'zz', fullImage: 'users/u1/zz.png' }),
    ).toEqual([]);
  });
});

describe('AssetsSection', () => {
  it('shows an explanation in read-only example campaigns', () => {
    renderSection('/demo/ashes-of-veyra/assets');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Assets' }),
    ).toBeVisible();
    expect(
      screen.getByText('Assets are available in real campaigns.'),
    ).toBeVisible();
    expect(api.listAssets).not.toHaveBeenCalled();
  });

  it('defaults to assets used in this campaign, with chips that link to them', async () => {
    const bundle = getFixtureBundle('ashes-of-veyra')!;
    const { user } = await open();
    expect(cardNames()).toEqual(['Harbor Map', 'Tavern Photo']);

    await user.click(screen.getByRole('button', { name: 'Harbor Map' }));
    const chip = await screen.findByRole('link', {
      name: new RegExp(bundle.maps[0]!.title),
    });
    expect(chip).toHaveAttribute(
      'href',
      `/campaigns/campaign-blank/maps/${bundle.maps[0]!.id}`,
    );

    await user.click(screen.getByRole('button', { name: 'Tavern Photo' }));
    const locationChip = await screen.findByRole('link', {
      name: new RegExp(bundle.locations[0]!.name),
    });
    expect(locationChip).toHaveAttribute(
      'href',
      `/campaigns/campaign-blank/world/${bundle.locations[0]!.id}`,
    );
  });

  it('lists everything under All my assets and filters by category and tag', async () => {
    const { user } = await open();
    await user.click(screen.getByRole('button', { name: 'All my assets' }));
    expect(cardNames()).toHaveLength(4);

    await user.selectOptions(screen.getByLabelText('Category'), 'tokens');
    expect(cardNames()).toEqual(['Dragon Token']);

    await user.selectOptions(screen.getByLabelText('Category'), 'all');
    await user.type(screen.getByLabelText('Search assets'), 'cave');
    expect(cardNames()).toEqual(['Spare Cave']);

    await user.clear(screen.getByLabelText('Search assets'));
    await user.type(screen.getByLabelText('Search assets'), 'nothing-matches');
    expect(screen.getByText('No assets match these filters.')).toBeVisible();
  });

  it('autosaves a rename on blur and reports Saving then Saved', async () => {
    let finish!: (value: UserAsset) => void;
    api.updateAsset.mockReturnValue(
      new Promise<UserAsset>((resolve) => {
        finish = resolve;
      }),
    );
    const { user } = await open('/campaigns/campaign-blank/assets/a1');
    const name = await screen.findByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Glass Harbor');
    await user.tab();
    expect(api.updateAsset).toHaveBeenCalledWith('a1', { name: 'Glass Harbor' });
    expect(await screen.findByText('Saving…')).toBeVisible();
    finish(asset({ id: 'a1', name: 'Glass Harbor' }));
    expect(await screen.findByText('Saved')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Glass Harbor' }),
    ).toBeVisible();
  });

  it('saves tags as a trimmed, de-duplicated list and skips unchanged fields', async () => {
    api.updateAsset.mockResolvedValue(
      asset({ id: 'a1', tags: ['keep', 'coast'] }),
    );
    const { user } = await open('/campaigns/campaign-blank/assets/a1');
    await user.click(await screen.findByLabelText('Name'));
    await user.tab();
    expect(api.updateAsset).not.toHaveBeenCalled();

    const tags = screen.getByLabelText(/Tags/);
    await user.clear(tags);
    await user.type(tags, ' keep, coast ,keep');
    await user.tab();
    expect(api.updateAsset).toHaveBeenCalledWith('a1', {
      tags: ['keep', 'coast'],
    });
  });

  it('rejects an empty name without calling the API', async () => {
    const { user } = await open('/campaigns/campaign-blank/assets/a1');
    const name = await screen.findByLabelText('Name');
    await user.clear(name);
    await user.tab();
    expect(api.updateAsset).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent(/1-120/);
    expect(screen.getByLabelText('Name')).toHaveValue('Harbor Map');
  });

  it('shows the details: category, size, source and created date', async () => {
    await open('/campaigns/campaign-blank/assets/a1');
    const details = await screen.findByRole('region', {
      name: 'Asset Harbor Map',
    });
    expect(within(details).getByText('maps')).toBeVisible();
    expect(within(details).getByText('2.0 KB')).toBeVisible();
    expect(within(details).getByText('Uploaded')).toBeVisible();
    expect(within(details).getByText('Created')).toBeVisible();
  });

  it('labels generated assets by their tag', async () => {
    await open('/campaigns/campaign-blank/assets/a4');
    const details = await screen.findByRole('region', {
      name: 'Asset Spare Cave',
    });
    expect(within(details).getByText('Generated')).toBeVisible();
    expect(within(details).queryByText('Created')).toBeNull();
  });

  it('blocks removal while the asset is used in this campaign', async () => {
    const { user } = await open('/campaigns/campaign-blank/assets/a1');
    await user.click(
      await screen.findByRole('button', { name: 'Remove asset' }),
    );
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/used in this campaign/i)).toBeVisible();
    expect(
      within(dialog).queryByRole('button', { name: 'Remove permanently' }),
    ).toBeNull();
    expect(api.deleteAsset).not.toHaveBeenCalled();
  });

  it('removes an unused asset after warning that it cannot be undone', async () => {
    api.deleteAsset.mockResolvedValue({ ok: true });
    const { user } = await open('/campaigns/campaign-blank/assets/a4');
    await user.click(
      await screen.findByRole('button', { name: 'Remove asset' }),
    );
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/cannot be undone/i)).toBeVisible();
    await user.click(
      within(dialog).getByRole('button', { name: 'Remove permanently' }),
    );
    await waitFor(() => expect(api.deleteAsset).toHaveBeenCalledWith('a4'));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/campaigns/campaign-blank/assets',
    );
    expect(
      screen.queryByRole('region', { name: 'Asset Spare Cave' }),
    ).toBeNull();
  });

  it('lists the server references when removal is refused with 409', async () => {
    api.deleteAsset.mockResolvedValue({
      ok: false,
      error: 'This asset is still used by campaign content.',
      references: [
        {
          campaignId: 'c2',
          campaignName: 'Crown of Cinders',
          objectId: 'o9',
          kind: 'campaign-map',
          title: 'Ash Gate',
        },
      ],
    });
    const { user } = await open('/campaigns/campaign-blank/assets/a4');
    await user.click(
      await screen.findByRole('button', { name: 'Remove asset' }),
    );
    const dialog = await screen.findByRole('alertdialog');
    await user.click(
      within(dialog).getByRole('button', { name: 'Remove permanently' }),
    );
    expect(
      await within(dialog).findByText(/Crown of Cinders: Ash Gate/),
    ).toBeVisible();
    expect(within(dialog).getByRole('alert')).toHaveTextContent(/still used/);
    expect(
      within(dialog).queryByRole('button', { name: 'Remove permanently' }),
    ).toBeNull();
  });

  it('uploads with the chosen category and selects the new asset', async () => {
    api.uploadAssetFile.mockResolvedValue(
      asset({ id: 'new1', name: 'fresh.png', category: 'tokens' }),
    );
    const { user } = await open();
    await user.selectOptions(screen.getByLabelText('Upload category'), 'tokens');
    const file = new File(['x'], 'fresh.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Choose image to upload'), file);
    await waitFor(() =>
      expect(api.uploadAssetFile).toHaveBeenCalledWith(file, 'tokens'),
    );
    expect(
      await screen.findByRole('region', { name: 'Asset fresh.png' }),
    ).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent('/assets/new1');
  });

  it('shows the upload problem the API reports', async () => {
    api.uploadAssetFile.mockRejectedValue(
      new Error('Use a PNG, JPEG or WebP image.'),
    );
    const { user } = await open();
    await user.upload(
      screen.getByLabelText('Choose image to upload'),
      new File(['x'], 'doc.png', { type: 'image/png' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Use a PNG, JPEG or WebP image.',
    );
  });
});
