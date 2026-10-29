import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getFixtureBundle } from '../../../demo/fixture-registry';
import type { BundleStore } from '../../section-shell/bundleStore';
import { HoardBuilderModal } from './HoardBuilderModal';
import { mapHoardMagicItemType } from './magicItemType';
import * as hoardRoller from './hoardRoller';

describe('HoardBuilderModal', () => {
  const bundle = getFixtureBundle('ashes-of-veyra')!;

  let mockStore: BundleStore;

  beforeEach(() => {
    mockStore = {
      addItem: vi.fn().mockResolvedValue({ ok: true, id: 'item-new' }),
      updateItem: vi.fn().mockResolvedValue({ ok: true }),
      deleteItem: vi.fn().mockResolvedValue({ ok: true }),
      isEditable: true,
    } as unknown as BundleStore;
  });

  it('does not render when isOpen is false', () => {
    render(
      <HoardBuilderModal
        isOpen={false}
        onClose={vi.fn()}
        bundle={bundle}
        store={mockStore}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders modal dialog when open with initial rolled hoard', () => {
    render(
      <HoardBuilderModal
        isOpen={true}
        onClose={vi.fn()}
        bundle={bundle}
        store={mockStore}
      />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Treasure Hoard Builder/)).toBeInTheDocument();
    expect(screen.getByText(/Coins/)).toBeInTheDocument();
  });

  it('closes on Escape key press', () => {
    const handleClose = vi.fn();
    render(
      <HoardBuilderModal
        isOpen={true}
        onClose={handleClose}
        bundle={bundle}
        store={mockStore}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('switches challenge tier and re-rolls', () => {
    render(
      <HoardBuilderModal
        isOpen={true}
        onClose={vi.fn()}
        bundle={bundle}
        store={mockStore}
      />,
    );
    const tierSelect = screen.getByLabelText(/Challenge Tier/i);
    fireEvent.change(tierSelect, { target: { value: '5-10' } });

    const rollBtn = screen.getByRole('button', { name: /Roll/i });
    fireEvent.click(rollBtn);

    expect(screen.getByText(/Coins/)).toBeInTheDocument();
  });

  it('adds rolled items to the campaign with selected holder and session', async () => {
    const handleAdded = vi.fn();
    render(
      <HoardBuilderModal
        isOpen={true}
        onClose={vi.fn()}
        bundle={bundle}
        store={mockStore}
        onItemsAdded={handleAdded}
      />,
    );

    const pcId = bundle.campaign.playerCharacters[0].id;
    const sessionId = bundle.sessions[0].id;

    // Select PC holder
    const holderSelect = screen.getByLabelText(/Assign Holder/i);
    fireEvent.change(holderSelect, { target: { value: pcId } });

    // Select Session
    const sessionSelect = screen.getByLabelText(/Session Reward/i);
    fireEvent.change(sessionSelect, { target: { value: sessionId } });

    // Click Add All to Campaign
    const addBtn = screen.getByRole('button', { name: /Add All to Campaign/i });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(mockStore.addItem).toHaveBeenCalled();
      expect(handleAdded).toHaveBeenCalledTimes(1);
    });

    const callArgs = vi.mocked(mockStore.addItem).mock.calls;
    expect(callArgs.length).toBeGreaterThan(0);
    // Verified holder and canonical itemType / requiresAttunement fields were assigned
    expect(callArgs[0][1].holder).toEqual({ kind: 'party-member', id: pcId });
    expect(callArgs[0][1].sessionId).toBe(sessionId);
    expect(callArgs[0][1].itemType).toBe('treasure');
    expect(callArgs[0][1].requiresAttunement).toBe(false);
  });

  it('adds coins, valuables, and magic items with canonical itemType, requiresAttunement, and default holder', async () => {
    vi.spyOn(hoardRoller, 'rollTreasure').mockReturnValue({
      tier: '5-10',
      type: 'hoard',
      seed: 42,
      d100Roll: 95,
      coins: { cp: 100, sp: 200, ep: 0, gp: 500, pp: 10, totalGp: 621 },
      valuables: [
        {
          name: 'Amethyst (100 gp)',
          unitGp: 100,
          count: 3,
          totalGp: 300,
          category: 'gem',
        },
      ],
      magicItems: [
        {
          name: 'Ring of Protection',
          rarity: 'rare',
          type: 'ring' as unknown as hoardRoller.RolledMagicItem['type'],
          valueGp: 3500,
          attunement: true,
          sourceCompendiumId: 'srd-ring-protection',
        },
        {
          name: 'Flame Tongue',
          rarity: 'rare',
          type: 'weapon',
          valueGp: 4000,
          attunement: false,
        },
      ],
      totalGp: 8421,
    });

    render(
      <HoardBuilderModal
        isOpen={true}
        onClose={vi.fn()}
        bundle={bundle}
        store={mockStore}
      />,
    );

    const addBtn = screen.getByRole('button', { name: /Add All to Campaign/i });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(mockStore.addItem).toHaveBeenCalledTimes(4);
    });

    const calls = vi.mocked(mockStore.addItem).mock.calls;
    // 1. Coin pile
    expect(calls[0][1]).toEqual(
      expect.objectContaining({
        name: 'Coin Hoard (621 gp)',
        itemType: 'treasure',
        requiresAttunement: false,
        discovered: false,
        identified: true,
        holder: { kind: 'none' },
      }),
    );
    // 2. Gem valuable
    expect(calls[1][1]).toEqual(
      expect.objectContaining({
        name: 'Amethyst (100 gp)',
        itemType: 'treasure',
        requiresAttunement: false,
        quantity: 3,
        discovered: false,
        identified: true,
        holder: { kind: 'none' },
      }),
    );
    // 3. Magic item (ring -> wondrous_item, attunement: true -> requiresAttunement: true)
    expect(calls[2][1]).toEqual(
      expect.objectContaining({
        name: 'Ring of Protection',
        itemType: 'wondrous_item',
        requiresAttunement: true,
        discovered: false,
        identified: false,
        holder: { kind: 'none' },
        source: { ruleset: '2024', entityId: 'srd-ring-protection' },
      }),
    );
    // 4. Magic item (weapon -> weapon, attunement: false -> requiresAttunement: false)
    expect(calls[3][1]).toEqual(
      expect.objectContaining({
        name: 'Flame Tongue',
        itemType: 'weapon',
        requiresAttunement: false,
        discovered: false,
        identified: false,
        holder: { kind: 'none' },
      }),
    );

    vi.restoreAllMocks();
  });

  it('maps magic item categories to canonical CampaignItemType', () => {
    expect(mapHoardMagicItemType('wondrous')).toBe('wondrous_item');
    expect(mapHoardMagicItemType('ring')).toBe('wondrous_item');
    expect(mapHoardMagicItemType('rod')).toBe('wondrous_item');
    expect(mapHoardMagicItemType('staff')).toBe('wondrous_item');
    expect(mapHoardMagicItemType('wand')).toBe('wondrous_item');
    expect(mapHoardMagicItemType('weapon')).toBe('weapon');
    expect(mapHoardMagicItemType('armor')).toBe('armor');
    expect(mapHoardMagicItemType('potion')).toBe('potion');
    expect(mapHoardMagicItemType('scroll')).toBe('scroll');
    expect(mapHoardMagicItemType('unknown_category')).toBe('wondrous_item');
    expect(mapHoardMagicItemType(undefined)).toBe('wondrous_item');
  });
});
