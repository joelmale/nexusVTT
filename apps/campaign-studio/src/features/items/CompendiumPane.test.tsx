import '@testing-library/jest-dom/vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getFixtureBundle } from '@/demo/fixture-registry';
import { renderInSection } from '@/features/section-shell/testUtils';

import { CompendiumPane } from './CompendiumPane';
import { clearCatalogCache } from './useSrdCatalog';

const base = getFixtureBundle('ashes-of-veyra')!;

const MOCK_SRD_ITEMS = {
  entities: [
    {
      id: 'srd-potion-healing',
      ruleset: '2024',
      data: {
        name: 'Potion of Healing',
        category: 'potion',
        rarity: 'common',
        weight: 0.5,
        cost: { quantity: 50, unit: 'gp' },
        text: 'You regain 2d4 + 2 hit points when you drink this potion.',
      },
    },
    {
      id: 'srd-flame-tongue',
      ruleset: '2024',
      data: {
        name: 'Flame Tongue',
        category: 'weapon',
        rarity: 'rare',
        weight: 3,
        requiresAttunement: true,
        text: 'You can use a bonus action to speak this magic sword command word.',
      },
    },
    {
      id: 'srd-bag-holding',
      ruleset: '2024',
      data: {
        name: 'Bag of Holding',
        category: 'wondrous',
        rarity: 'uncommon',
        weight: 15,
        text: 'This bag has an interior space considerably larger than its outside dimensions.',
      },
    },
  ],
};

describe('CompendiumPane', () => {
  beforeEach(() => {
    clearCatalogCache();
    vi.restoreAllMocks();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => MOCK_SRD_ITEMS,
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    clearCatalogCache();
    vi.unstubAllGlobals();
  });

  it('renders compendium items list and preview detail card', async () => {
    renderInSection(<CompendiumPane />, {
      path: '/demo/ashes-of-veyra/items?tab=compendium',
      store: { editable: true },
    });

    // Wait for items to be loaded
    await waitFor(() => {
      expect(screen.getByText('Potion of Healing')).toBeInTheDocument();
    });

    expect(screen.getByText('Flame Tongue')).toBeInTheDocument();
    expect(screen.getAllByText('Bag of Holding').length).toBeGreaterThanOrEqual(1);

    // Default selected item should be the first alphabetical item (Bag of Holding)
    expect(
      screen.getByRole('heading', { level: 2, name: 'Bag of Holding' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/This bag has an interior space considerably larger than its outside dimensions\./),
    ).toBeInTheDocument();
  });

  it('switches preview when clicking an item row', async () => {
    const user = userEvent.setup();
    renderInSection(<CompendiumPane />, {
      path: '/demo/ashes-of-veyra/items?tab=compendium',
      store: { editable: true },
    });

    await waitFor(() => {
      expect(screen.getByText('Flame Tongue')).toBeInTheDocument();
    });

    const flameTongueBtn = screen.getByRole('option', { name: /Flame Tongue/ });
    await user.click(flameTongueBtn);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Flame Tongue' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/You can use a bonus action to speak this magic sword command word\./),
    ).toBeInTheDocument();
  });

  it('adds an SRD item to the campaign with custom holder and quantity', async () => {
    const user = userEvent.setup();
    const onAdded = vi.fn();
    const mockAddItem = vi.fn().mockResolvedValue({ ok: true, id: 'new-potion-1' });

    renderInSection(<CompendiumPane onAddedItem={onAdded} />, {
      path: '/demo/ashes-of-veyra/items?tab=compendium',
      store: { editable: true, addItem: mockAddItem },
    });

    await waitFor(() => {
      expect(screen.getByText('Potion of Healing')).toBeInTheDocument();
    });

    // Select Potion of Healing
    const potionBtn = screen.getByRole('option', { name: /Potion of Healing/ });
    await user.click(potionBtn);

    // Change holder to party member
    const holderKindSelect = screen.getByLabelText('Give to');
    await user.selectOptions(holderKindSelect, 'party-member');

    // Select first PC
    const entitySelect = screen.getByLabelText('Select entity');
    const firstPc = base.campaign.playerCharacters[0];
    await user.selectOptions(entitySelect, firstPc.id);

    // Change quantity
    const qtyInput = screen.getByLabelText('Quantity');
    await user.clear(qtyInput);
    await user.type(qtyInput, '3');

    // Click Add to Campaign
    const addBtn = screen.getByRole('button', { name: 'Add to Campaign' });
    await user.click(addBtn);

    // Verify addItem was called with Potion of Healing
    await waitFor(() => {
      expect(mockAddItem).toHaveBeenCalledWith(
        'item',
        expect.objectContaining({
          name: 'Potion of Healing',
          quantity: 3,
          holder: { kind: 'party-member', id: firstPc.id },
          source: { ruleset: '2024', entityId: 'srd-potion-healing' },
        }),
      );
    });

    // Verify success notice appears
    await waitFor(() => {
      expect(screen.getByText('✓ Added to campaign!')).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /View in Campaign Items/ }),
      ).toBeInTheDocument();
    });

    expect(onAdded).toHaveBeenCalledWith('new-potion-1');
  });

  it('switches ruleset via the ruleset buttons', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const is2014 = url.includes('ruleset=2014');
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          entities: [
            {
              id: is2014 ? 'srd-2014-item' : 'srd-2024-item',
              ruleset: is2014 ? '2014' : '2024',
              data: {
                name: is2014 ? 'Legacy 2014 Item' : 'Modern 2024 Item',
                category: 'weapon',
                rarity: 'common',
              },
            },
          ],
        }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderInSection(<CompendiumPane />, {
      path: '/demo/ashes-of-veyra/items?tab=compendium',
      store: { editable: true },
    });

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 2, name: 'Modern 2024 Item' }),
      ).toBeInTheDocument();
    });

    const legacyBtn = screen.getByRole('button', { name: '2014 (legacy)' });
    await user.click(legacyBtn);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 2, name: 'Legacy 2014 Item' }),
      ).toBeInTheDocument();
    });
  });

  it('shows error notice and handles retry on fetch failure', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => MOCK_SRD_ITEMS,
      });
    vi.stubGlobal('fetch', fetchMock);

    renderInSection(<CompendiumPane />, {
      path: '/demo/ashes-of-veyra/items?tab=compendium',
      store: { editable: true },
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: 'Retry' });
    await user.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Potion of Healing')).toBeInTheDocument();
    });
  });

  it('gracefully falls back to bundled catalog and allows search when server entities array is empty', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ entities: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    renderInSection(<CompendiumPane />, {
      path: '/demo/ashes-of-veyra/items?tab=compendium',
      store: { editable: true },
    });

    // Should NOT show the error alert with "No items found in the 2024 catalog."
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByText(/Using bundled 2024 SRD catalog/)).toBeInTheDocument();
    });

    // Bundled items should be loaded and selectable
    expect(screen.getByText('Longsword')).toBeInTheDocument();
    expect(screen.getByText('Plate Armor')).toBeInTheDocument();
  });

  it('recovers from fetch error when clicking Use bundled catalog', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    renderInSection(<CompendiumPane />, {
      path: '/demo/ashes-of-veyra/items?tab=compendium',
      store: { editable: true },
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    const useBundledBtn = screen.getByRole('button', { name: 'Use bundled catalog' });
    await user.click(useBundledBtn);

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByText(/Using bundled 2024 SRD catalog/)).toBeInTheDocument();
      expect(screen.getByText('Longsword')).toBeInTheDocument();
    });
  });

  it('uses bundled catalog offline without network calls in read-only demo mode', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderInSection(<CompendiumPane />, {
      path: '/demo/ashes-of-veyra/items?tab=compendium',
      store: { editable: false },
    });

    await waitFor(() => {
      expect(screen.getByText(/Using bundled 2024 SRD catalog/)).toBeInTheDocument();
      expect(screen.getByText('Longsword')).toBeInTheDocument();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('assigns NPC, location, encounter holders and session when adding to campaign', async () => {
    const user = userEvent.setup();
    const mockAddItem = vi.fn().mockResolvedValue({ ok: true, id: 'new-item-2' });

    renderInSection(<CompendiumPane />, {
      path: '/demo/ashes-of-veyra/items?tab=compendium',
      store: { editable: true, addItem: mockAddItem },
    });

    await waitFor(() => {
      expect(screen.getByText('Potion of Healing')).toBeInTheDocument();
    });

    const holderKindSelect = screen.getByLabelText('Give to');
    await user.selectOptions(holderKindSelect, 'npc');
    const firstNpc = base.npcs[0];
    await user.selectOptions(screen.getByLabelText('Select entity'), firstNpc.id);

    const sessionSelect = screen.getByLabelText('Hand out in session');
    const firstSession = base.sessions[0];
    await user.selectOptions(sessionSelect, firstSession.id);

    await user.click(screen.getByRole('button', { name: 'Add to Campaign' }));

    await waitFor(() => {
      expect(mockAddItem).toHaveBeenCalledWith(
        'item',
        expect.objectContaining({
          holder: { kind: 'npc', id: firstNpc.id },
          sessionId: firstSession.id,
        }),
      );
    });
  });

  it('implements aria-activedescendant listbox pattern with Arrow navigation and Enter select (CS-46)', async () => {
    const user = userEvent.setup();
    renderInSection(<CompendiumPane />, {
      path: '/demo/ashes-of-veyra/items?tab=compendium',
      store: { editable: true },
    });

    await waitFor(() => {
      expect(screen.getByText('Potion of Healing')).toBeInTheDocument();
    });

    const listbox = screen.getByRole('listbox', { name: 'Compendium items list' });
    expect(listbox).toHaveAttribute('aria-activedescendant', 'compendium-option-srd-bag-holding');

    // Press ArrowDown to move to next item
    await user.keyboard('{ArrowDown}');
    expect(listbox).toHaveAttribute('aria-activedescendant', 'compendium-option-srd-flame-tongue');

    // Press Enter to select Flame Tongue
    await user.keyboard('{Enter}');
    expect(
      screen.getByRole('heading', { level: 2, name: 'Flame Tongue' }),
    ).toBeInTheDocument();

    // Press ArrowUp to move back
    await user.keyboard('{ArrowUp}');
    expect(listbox).toHaveAttribute('aria-activedescendant', 'compendium-option-srd-bag-holding');
  });

  it('focuses search input when / is pressed (CS-46)', async () => {
    const user = userEvent.setup();
    renderInSection(<CompendiumPane />, {
      path: '/demo/ashes-of-veyra/items?tab=compendium',
      store: { editable: true },
    });

    await waitFor(() => {
      expect(screen.getByText('Potion of Healing')).toBeInTheDocument();
    });

    const searchInput = screen.getByRole('searchbox');
    expect(searchInput).not.toHaveFocus();

    await user.keyboard('/');
    expect(searchInput).toHaveFocus();
  });

  it('clears search query when Escape is pressed (CS-46)', async () => {
    const user = userEvent.setup();
    renderInSection(<CompendiumPane />, {
      path: '/demo/ashes-of-veyra/items?tab=compendium&q=potion',
      store: { editable: true },
    });

    await waitFor(() => {
      expect(screen.getByText('Potion of Healing')).toBeInTheDocument();
    });

    const searchInput = screen.getByRole('searchbox');
    expect(searchInput).toHaveValue('potion');

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.getByRole('searchbox')).toHaveValue('');
    });
  });

  it('adds selected item to treasury when a/A is pressed (CS-46)', async () => {
    const user = userEvent.setup();
    const mockAddItem = vi.fn().mockResolvedValue({ ok: true, id: 'added-via-key' });

    renderInSection(<CompendiumPane />, {
      path: '/demo/ashes-of-veyra/items?tab=compendium',
      store: { editable: true, addItem: mockAddItem },
    });

    await waitFor(() => {
      expect(screen.getAllByText('Bag of Holding').length).toBeGreaterThanOrEqual(1);
    });

    // Press 'a'
    await user.keyboard('a');

    await waitFor(() => {
      expect(mockAddItem).toHaveBeenCalledWith(
        'item',
        expect.objectContaining({
          name: 'Bag of Holding',
        }),
      );
    });
  });
});
