import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { CampaignItem } from '@/demo/fixture-registry';

import { getItemTypeIcon } from './itemTypeIcons';
import { ItemRow } from './ItemRow';

const testItem: CampaignItem = {
  id: 'sword-1',
  name: 'Sun Blade',
  itemType: 'weapon',
  rarity: 'rare',
  requiresAttunement: true,
  attunementNote: 'by a creature of good alignment',
  valueGp: 5000,
  weightLb: 3,
  quantity: 1,
  description: 'This item appears to be a longsword hilt.',
  discovered: true,
  identified: true,
  holder: { kind: 'none' },
  questIds: [],
};

describe('ItemRow', () => {
  it('renders primary line with name, rarity badge, and type icon', () => {
    render(<ItemRow item={testItem} />);

    expect(screen.getByText('Sun Blade')).toBeInTheDocument();
    expect(screen.getByText('Rare')).toBeInTheDocument();
    expect(screen.getByText(/5,000 gp/)).toBeInTheDocument();
    expect(screen.getByText(/3 lb/)).toBeInTheDocument();
    expect(screen.getByText(/Attune \(by a creature of good alignment\)/)).toBeInTheDocument();
  });

  it('renders quantity when quantity > 1', () => {
    render(<ItemRow item={{ ...testItem, quantity: 3 }} />);

    expect(screen.getByText('x3')).toBeInTheDocument();
  });

  it('renders undiscovered badge when discovered is false', () => {
    render(<ItemRow item={{ ...testItem, discovered: false }} />);

    expect(screen.getByRole('status', { name: 'Undiscovered by players' })).toBeInTheDocument();
  });

  it('renders holder name in meta line when provided', () => {
    render(<ItemRow heldBy="Kira (party)" item={testItem} />);

    expect(screen.getByText('Kira (party)')).toBeInTheDocument();
  });

  it('handles items without value or weight gracefully', () => {
    const minimalItem: CampaignItem = {
      ...testItem,
      valueGp: undefined,
      weightLb: undefined,
      requiresAttunement: false,
    };
    render(<ItemRow item={minimalItem} />);

    expect(screen.getByText('Sun Blade')).toBeInTheDocument();
    expect(screen.queryByText(/gp/)).toBeNull();
    expect(screen.queryByText(/lb/)).toBeNull();
    expect(screen.queryByText(/Attune/)).toBeNull();
  });
});

describe('getItemTypeIcon', () => {
  it('maps weapon, armor, potion, scroll, and wondrous items to icons', () => {
    expect(getItemTypeIcon('weapon')).toBeDefined();
    expect(getItemTypeIcon('armor')).toBeDefined();
    expect(getItemTypeIcon('potion')).toBeDefined();
    expect(getItemTypeIcon('scroll')).toBeDefined();
    expect(getItemTypeIcon('wondrous_item')).toBeDefined();
    expect(getItemTypeIcon('unknown-type')).toBeDefined();
  });
});
