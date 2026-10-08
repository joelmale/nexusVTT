import { screen, waitFor, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createEmptyBundle,
  getFixtureBundle,
  type CampaignFixtureBundle,
  type CampaignItem,
} from '@/demo/fixture-registry';
import { EncountersSection } from '@/features/encounters/EncountersSection';
import {
  TEST_CAMPAIGN,
  renderInSection,
} from '@/features/section-shell/testUtils';

import { ItemsSection } from './ItemsSection';
import { buildItemsModel } from './itemsModel';

const ITEMS = '/campaigns/campaign-blank/items';

const ROUTED = (
  <Routes>
    <Route element={<ItemsSection />} path="/campaigns/:id/items/:itemId?" />
  </Routes>
);

const base = getFixtureBundle('ashes-of-veyra')!;
const npc = base.npcs[0]!;
const encounter = base.encounters[0]!;
const pc = base.campaign.playerCharacters[0]!;
const quest = base.quests[0]!;

const mk = (id: string, extra: Partial<CampaignItem> = {}): CampaignItem => ({
  id,
  campaignId: base.campaignId,
  name: `Item ${id}`,
  itemType: 'wondrous_item',
  rarity: 'rare',
  requiresAttunement: false,
  quantity: 1,
  description: 'A thing.',
  holder: { kind: 'none' },
  discovered: false,
  identified: false,
  questIds: [],
  ...extra,
});

function bundleWith(items: CampaignItem[]): CampaignFixtureBundle {
  return { ...base, items };
}

const ITEM_SET = [
  mk('sword', {
    name: 'Flame Tongue',
    rarity: 'rare',
    holder: { kind: 'npc', id: npc.id },
    discovered: true,
  }),
  mk('ring', {
    name: 'Ring of Mending',
    rarity: 'uncommon',
    holder: { kind: 'party-member', id: pc.id },
    discovered: true,
  }),
  mk('hoard', {
    name: 'Dragon Hoard',
    rarity: 'none',
    itemType: 'treasure',
    holder: { kind: 'encounter', id: encounter.id },
  }),
  mk('loose', { name: 'Loose Gem', rarity: 'common' }),
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildItemsModel', () => {
  it('groups by holder kind and filters by discovery, rarity and text', () => {
    const bundle = bundleWith(ITEM_SET);
    const model = buildItemsModel(bundle);
    expect(model.groups.map((group) => group.label)).toEqual([
      'Party',
      'NPCs',
      'Encounters',
      'Unassigned',
    ]);
    expect(
      buildItemsModel(bundle, { discovery: 'undiscovered' }).visibleCount,
    ).toBe(2);
    expect(buildItemsModel(bundle, { rarity: 'rare' }).visibleCount).toBe(1);
    expect(buildItemsModel(bundle, { holder: 'npc' }).visibleCount).toBe(1);
    expect(buildItemsModel(bundle, { q: 'gem' }).visibleCount).toBe(1);
  });
});

describe('ItemsSection', () => {
  it('lists items under their holder with rarity badges', () => {
    renderInSection(ROUTED, {
      path: ITEMS,
      store: { bundle: bundleWith(ITEM_SET), editable: true },
    });
    const nav = screen.getByRole('navigation', { name: 'Items list' });
    expect(within(nav).getAllByRole('link')).toHaveLength(4);
    expect(within(nav).getByText('Party')).toBeVisible();
    expect(within(nav).getByText('Unassigned')).toBeVisible();
    expect(within(nav).getByText('Uncommon')).toBeVisible();
  });

  it('shows only undiscovered items when filtered', () => {
    renderInSection(ROUTED, {
      path: `${ITEMS}?discovery=undiscovered`,
      store: { bundle: bundleWith(ITEM_SET), editable: true },
    });
    const nav = screen.getByRole('navigation', { name: 'Items list' });
    expect(within(nav).getAllByRole('link')).toHaveLength(2);
    expect(within(nav).queryByText('Flame Tongue')).toBeNull();
    expect(within(nav).getByText('Loose Gem')).toBeVisible();
  });

  it('offers Add item on an empty campaign and creates one', async () => {
    const addItem = vi.fn().mockResolvedValue({ ok: true, id: 'new' });
    const { user } = renderInSection(ROUTED, {
      path: ITEMS,
      store: {
        bundle: createEmptyBundle(TEST_CAMPAIGN),
        editable: true,
        addItem,
      },
    });
    expect(screen.getByText('No items yet.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: '+ Add item' }));
    await user.type(screen.getByLabelText('Add item name'), 'Gold Idol');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() =>
      expect(addItem).toHaveBeenCalledWith(
        'item',
        expect.objectContaining({ name: 'Gold Idol', itemType: 'other' }),
      ),
    );
  });

  it('assigns a holder and saves only the change', async () => {
    const updateItem = vi.fn().mockResolvedValue({ ok: true });
    const { user } = renderInSection(ROUTED, {
      path: `${ITEMS}/loose`,
      store: {
        bundle: bundleWith(ITEM_SET),
        editable: true,
        updateItem,
      },
    });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.selectOptions(screen.getByLabelText('Held by'), 'npc');
    await user.selectOptions(screen.getByLabelText('Who or where'), npc.id);
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() =>
      expect(updateItem).toHaveBeenLastCalledWith('item', 'loose', {
        holder: { kind: 'npc', id: npc.id },
      }),
    );
  });

  it('toggles discovered and links a quest', async () => {
    const updateItem = vi.fn().mockResolvedValue({ ok: true });
    const { user } = renderInSection(ROUTED, {
      path: `${ITEMS}/loose`,
      store: {
        bundle: bundleWith(ITEM_SET),
        editable: true,
        updateItem,
      },
    });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByLabelText('Discovered by the party'));
    await user.click(screen.getByRole('checkbox', { name: quest.title }));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => {
      expect(updateItem).toHaveBeenCalledWith('item', 'loose', {
        discovered: true,
      });
      expect(updateItem).toHaveBeenLastCalledWith(
        'item',
        'loose',
        expect.objectContaining({ questIds: [quest.id] }),
      );
    });
  });

  it('shows the holder as a link in the read view', () => {
    renderInSection(ROUTED, {
      path: `${ITEMS}/sword`,
      store: { bundle: bundleWith(ITEM_SET), editable: true },
    });
    expect(screen.getByRole('link', { name: npc.name })).toBeVisible();
  });

  it('hides Start from SRD when the catalog is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }),
    );
    const { user } = renderInSection(ROUTED, {
      path: ITEMS,
      store: { bundle: bundleWith(ITEM_SET), editable: true },
    });
    await user.click(screen.getByRole('button', { name: 'Start from SRD' }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Start from SRD' })).toBeNull(),
    );
  });

  it('creates an item prefilled from an SRD entry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          entities: [
            {
              id: 'srd-1',
              ruleset: '2024',
              data: {
                name: 'Bag of Holding',
                category: 'wondrous',
                rarity: 'uncommon',
                attunement: { required: false },
                cost: { amount: 500, unit: 'gp' },
                weight: 15,
                text: 'Holds a lot.',
              },
            },
          ],
        }),
      }),
    );
    const addItem = vi.fn().mockResolvedValue({ ok: true, id: 'new' });
    const { user } = renderInSection(ROUTED, {
      path: ITEMS,
      store: { bundle: bundleWith(ITEM_SET), editable: true, addItem },
    });
    await user.click(screen.getByRole('button', { name: 'Start from SRD' }));
    await user.click(await screen.findByRole('button', { name: /Bag of Holding/ }));
    await waitFor(() =>
      expect(addItem).toHaveBeenCalledWith(
        'item',
        expect.objectContaining({
          name: 'Bag of Holding',
          itemType: 'wondrous_item',
          rarity: 'uncommon',
          valueGp: 500,
          source: { ruleset: '2024', entityId: 'srd-1' },
        }),
      ),
    );
  });
});

describe('loot display', () => {
  it('lists an encounter\'s items under Loot', () => {
    renderInSection(
      <Routes>
        <Route
          element={<EncountersSection />}
          path="/campaigns/:id/encounters/:encounterId?"
        />
      </Routes>,
      {
        path: `/campaigns/campaign-blank/encounters/${encounter.id}`,
        store: { bundle: bundleWith(ITEM_SET), editable: true },
      },
    );
    const loot = screen.getByRole('region', { name: 'Loot' });
    expect(within(loot).getByRole('link', { name: 'Dragon Hoard' })).toBeVisible();
    expect(within(loot).queryByText('Flame Tongue')).toBeNull();
  });
});
