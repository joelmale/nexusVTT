import '@testing-library/jest-dom/vitest';
import { screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  getFixtureBundle,
  type CampaignItem,
} from '@/demo/fixture-registry';
import { renderInSection } from '@/features/section-shell/testUtils';

import { ItemCard } from './ItemCard';

const baseBundle = getFixtureBundle('ashes-of-veyra')!;
const quest = baseBundle.quests[0]!;

const testItem: CampaignItem = {
  id: 'item-1',
  name: 'Sun Blade',
  itemType: 'weapon',
  rarity: 'rare',
  requiresAttunement: true,
  attunementNote: 'by a creature of good alignment',
  valueGp: 5000,
  weightLb: 3,
  quantity: 2,
  description: 'A glowing blade of solar energy.',
  mechanics: 'Deals 1d8 radiant damage.',
  discovered: false,
  identified: true,
  holder: { kind: 'none' },
  questIds: [quest.id],
};

describe('ItemCard', () => {
  it('renders title, book-style subtitle, and stats ribbon', () => {
    renderInSection(
      <ItemCard bundle={baseBundle} item={testItem} />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Sun Blade' })).toBeVisible();
    expect(
      screen.getByText(/Weapon, Rare \(requires attunement by a creature of good alignment\)/),
    ).toBeVisible();
    expect(screen.getByText('5,000 gp')).toBeVisible();
    expect(screen.getByText('3 lb')).toBeVisible();
    expect(screen.getByText('2')).toBeVisible();
    expect(screen.getByText('A glowing blade of solar energy.')).toBeVisible();
    expect(screen.getByText('Deals 1d8 radiant damage.')).toBeVisible();
    expect(screen.getByText(quest.title)).toBeVisible();
  });

  it('provides quick placement toggle buttons when editable and triggers callback', () => {
    const onQuickUpdate = vi.fn();
    renderInSection(
      <ItemCard
        bundle={baseBundle}
        editable
        item={testItem}
        onQuickUpdate={onQuickUpdate}
      />,
    );

    const discoveredBtn = screen.getByRole('button', {
      name: 'Mark as discovered',
    });
    fireEvent.click(discoveredBtn);
    expect(onQuickUpdate).toHaveBeenCalledWith({ discovered: true });

    const identifiedBtn = screen.getByRole('button', {
      name: 'Mark as unidentified',
    });
    fireEvent.click(identifiedBtn);
    expect(onQuickUpdate).toHaveBeenCalledWith({ identified: false });
  });

  it('renders party holder note when held by a party member', () => {
    const partyItem: CampaignItem = {
      ...testItem,
      holder: { kind: 'party-member', id: 'pc-1' },
    };
    renderInSection(
      <ItemCard
        bundle={baseBundle}
        heldBy="Kira Shadowchaser"
        item={partyItem}
        partyHolder
      />,
    );

    expect(screen.getByText('Kira Shadowchaser (party)')).toBeVisible();
  });

  it('renders legendary sheen styling for legendary items', () => {
    const legendaryItem: CampaignItem = {
      ...testItem,
      rarity: 'legendary',
    };
    renderInSection(
      <ItemCard bundle={baseBundle} item={legendaryItem} />,
    );

    const card = screen.getByTestId('item-card-item-1');
    expect(card.getAttribute('data-rarity')).toBe('legendary');
  });
});
