import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getFixtureBundle, type HomebrewMonster } from '@/demo/fixture-registry';
import type { BundleStore } from '@/features/section-shell/bundleStore';
import { renderInSection } from '@/features/section-shell/testUtils';
import { HomebrewMonstersPane } from './HomebrewMonstersPane';

const baseBundle = getFixtureBundle('ashes-of-veyra')!;

const sampleMonsters: HomebrewMonster[] = [
  {
    id: 'hb-1',
    campaignId: 'cmp-test',
    name: 'Gloom Wraith',
    cr: '4',
    size: 'Medium',
    type: 'undead',
    ac: 13,
    hp: 45,
    speed: 40,
    abilities: [6, 16, 12, 10, 14, 15],
    edition: '2024',
    notes: 'Incorporeal movement and life drain.',
  },
  {
    id: 'hb-2',
    campaignId: 'cmp-test',
    name: 'Infernal Hound',
    cr: '3',
    size: 'Large',
    type: 'fiend',
    ac: 15,
    hp: 52,
    speed: 50,
    abilities: [17, 12, 14, 6, 13, 8],
    edition: '2024',
    notes: 'Fire breath attack.',
  },
];

function mockStore(
  monsters: HomebrewMonster[] = sampleMonsters,
  extra: Partial<BundleStore> = {},
): Partial<BundleStore> {
  return {
    editable: true,
    bundle: {
      ...baseBundle,
      homebrewMonsters: monsters,
    },
    addItem: vi.fn().mockResolvedValue({ ok: true, id: 'hb-new' }),
    updateItem: vi.fn().mockResolvedValue({ ok: true }),
    removeItem: vi.fn().mockResolvedValue({ ok: true }),
    ...extra,
  };
}

describe('HomebrewMonstersPane', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders empty state when there are no homebrew monsters', () => {
    renderInSection(<HomebrewMonstersPane />, {
      store: mockStore([]),
    });

    expect(screen.getByText('No homebrew creatures authored yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Author First Creature' })).toBeInTheDocument();
  });

  it('renders creature cards with stats and badges', () => {
    renderInSection(<HomebrewMonstersPane />, {
      store: mockStore(sampleMonsters),
    });

    expect(screen.getByText('Gloom Wraith')).toBeInTheDocument();
    expect(screen.getByText('CR 4')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
    expect(screen.getByText('Infernal Hound')).toBeInTheDocument();
    expect(screen.getByText('CR 3')).toBeInTheDocument();
    expect(screen.getByText('52')).toBeInTheDocument();
  });

  it('filters monsters by search query', async () => {
    const { user } = renderInSection(<HomebrewMonstersPane />, {
      store: mockStore(sampleMonsters),
    });

    const searchInput = screen.getByLabelText('Search homebrew monsters');
    await user.type(searchInput, 'Wraith');

    expect(screen.getByText('Gloom Wraith')).toBeInTheDocument();
    expect(screen.queryByText('Infernal Hound')).not.toBeInTheDocument();
  });

  it('filters monsters by type', async () => {
    const { user } = renderInSection(<HomebrewMonstersPane />, {
      store: mockStore(sampleMonsters),
    });

    const typeSelect = screen.getByLabelText('Filter by creature type');
    await user.selectOptions(typeSelect, 'fiend');

    expect(screen.queryByText('Gloom Wraith')).not.toBeInTheDocument();
    expect(screen.getByText('Infernal Hound')).toBeInTheDocument();
  });

  it('opens create modal when clicking Author Creature button', async () => {
    const { user } = renderInSection(<HomebrewMonstersPane />, {
      store: mockStore(sampleMonsters),
    });

    await user.click(screen.getByRole('button', { name: 'Author creature' }));

    expect(screen.getByRole('heading', { name: 'Author Homebrew Creature' })).toBeInTheDocument();
  });

  it('opens edit modal when clicking Edit on a card', async () => {
    const { user } = renderInSection(<HomebrewMonstersPane />, {
      store: mockStore(sampleMonsters),
    });

    await user.click(screen.getByRole('button', { name: 'Edit Gloom Wraith' }));

    expect(screen.getByRole('heading', { name: 'Edit Homebrew Creature' })).toBeInTheDocument();
    expect(screen.getByLabelText('Creature Name')).toHaveValue('Gloom Wraith');
  });

  it('opens clone modal when clicking Duplicate on a card', async () => {
    const { user } = renderInSection(<HomebrewMonstersPane />, {
      store: mockStore(sampleMonsters),
    });

    await user.click(screen.getByRole('button', { name: 'Duplicate Gloom Wraith' }));

    expect(screen.getByRole('heading', { name: 'Author Homebrew Creature' })).toBeInTheDocument();
    expect(screen.getByLabelText('Creature Name')).toHaveValue('Gloom Wraith (Custom)');
  });

  it('calls removeItem when confirming deletion', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const removeItem = vi.fn().mockResolvedValue({ ok: true });

    const { user } = renderInSection(<HomebrewMonstersPane />, {
      store: mockStore(sampleMonsters, { removeItem }),
    });

    await user.click(screen.getByRole('button', { name: 'Delete Gloom Wraith' }));

    await waitFor(() => {
      expect(removeItem).toHaveBeenCalledWith('homebrew-monster', 'hb-1');
    });
  });

  it('hides edit and delete controls in read-only mode', () => {
    renderInSection(<HomebrewMonstersPane />, {
      store: mockStore(sampleMonsters, { editable: false }),
    });

    expect(screen.queryByRole('button', { name: 'Author creature' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Gloom Wraith' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete Gloom Wraith' })).not.toBeInTheDocument();
  });
});
