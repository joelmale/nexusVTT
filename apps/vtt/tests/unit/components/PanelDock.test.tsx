import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PanelDock, type PanelDockPanel } from '@/components/PanelDock';
import { useIconStore } from '@/stores/iconStore';

const mockPanels: PanelDockPanel[] = [
  { id: 'dice', icon: '🎲', label: 'Dice Roller' },
  { id: 'initiative', icon: '⚔️', label: 'Combat Tracker' },
  { id: 'chat', icon: '💬', label: 'Chat Log' },
];

function renderFavorites() {
  render(
    <PanelDock
      panels={mockPanels}
      activePanels={[]}
      onSelect={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  return within(screen.getByRole('group', { name: 'Favorite panels' }));
}

describe('PanelDock icons', () => {
  beforeEach(() => {
    localStorage.clear();
    useIconStore.getState().clearAllLocalOverrides();
  });

  afterEach(() => {
    cleanup();
    useIconStore.getState().setGlobalCampaignPack('nexus-vector-gold');
  });

  it('uses catalog assets when the vector pack is active', () => {
    useIconStore.getState().setGlobalCampaignPack('nexus-vector-gold');
    const favorites = renderFavorites();
    expect(favorites.getByAltText('Dice Roller')).toBeInTheDocument();
    expect(favorites.getByAltText('Game Chat')).toBeInTheDocument();
  });

  it('uses fallback emojis when the emoji pack is active', () => {
    useIconStore.getState().setGlobalCampaignPack('default-emoji');
    const favorites = renderFavorites();
    expect(favorites.getByText('🎲')).toBeInTheDocument();
    expect(favorites.getByText('⚔️')).toBeInTheDocument();
    expect(favorites.getByText('💬')).toBeInTheDocument();
  });
});
