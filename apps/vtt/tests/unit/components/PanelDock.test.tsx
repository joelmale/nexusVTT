import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PanelDock, type PanelDockPanel } from '../../../src/components/PanelDock';
import { useIconStore } from '../../../src/stores/iconStore';

describe('PanelDock component', () => {
  const mockPanels: PanelDockPanel[] = [
    { id: 'dice', icon: '🎲', label: 'Dice Roller' },
    { id: 'combat', icon: '⚔️', label: 'Combat Tracker' },
    { id: 'chat', icon: '💬', label: 'Chat Log' },
  ];

  beforeEach(() => {
    localStorage.clear();
    useIconStore.getState().clearAllLocalOverrides();
  });

  it('renders dock in collapsed state initially with panel buttons', () => {
    const handleSelect = vi.fn();
    render(
      <PanelDock
        panels={mockPanels}
        activePanels={['dice']}
        onSelect={handleSelect}
      />
    );

    expect(screen.getByRole('tablist', { name: 'Panels' })).toBeInTheDocument();
    expect(screen.getByText('📋 Panels')).toBeInTheDocument();

    const diceBtn = screen.getByRole('tab', { name: 'Dice Roller' });
    expect(diceBtn).toBeInTheDocument();
    expect(diceBtn).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(diceBtn);
    expect(handleSelect).toHaveBeenCalledWith('dice');
  });

  it('toggles pin state and persists to localStorage', () => {
    render(
      <PanelDock
        panels={mockPanels}
        activePanels={[]}
        onSelect={vi.fn()}
      />
    );

    const pinBtn = screen.getByRole('button', { name: 'Pin panel dock open' });
    expect(pinBtn).toBeInTheDocument();

    fireEvent.click(pinBtn);
    expect(localStorage.getItem('nexus-ui-panelDock-pinned')).toBe('true');
  });

  it('renders icons dynamically using Icon component', () => {
    render(
      <PanelDock
        panels={mockPanels}
        activePanels={[]}
        onSelect={vi.fn()}
      />
    );

    // Dice & Chat have registered catalog assets in nexus-vector-gold pack
    expect(screen.getByAltText('Dice Roller')).toBeInTheDocument();
    expect(screen.getByAltText('Game Chat')).toBeInTheDocument();
    // Combat is not in standard catalog, so it renders fallback emoji
    expect(screen.getByText('⚔️')).toBeInTheDocument();
  });

  it('renders all fallback emojis when default-emoji pack is selected', () => {
    useIconStore.getState().setGlobalCampaignPack('default-emoji');
    render(
      <PanelDock
        panels={mockPanels}
        activePanels={[]}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText('🎲')).toBeInTheDocument();
    expect(screen.getByText('⚔️')).toBeInTheDocument();
    expect(screen.getByText('💬')).toBeInTheDocument();
  });

  it('handles mouseEnter and mouseLeave hover states', () => {
    const { container } = render(
      <PanelDock
        panels={mockPanels}
        activePanels={[]}
        onSelect={vi.fn()}
      />
    );

    const dock = container.querySelector('[role="tablist"]');
    expect(dock).toBeTruthy();

    fireEvent.mouseEnter(dock!);
    expect(dock).toHaveAttribute('aria-expanded', 'true');

    fireEvent.mouseLeave(dock!);
  });

  it('handles keyboard navigation with arrow keys and Home/End', () => {
    render(
      <PanelDock
        panels={mockPanels}
        activePanels={[]}
        onSelect={vi.fn()}
      />
    );

    const diceBtn = screen.getByRole('tab', { name: 'Dice Roller' });
    diceBtn.focus();

    fireEvent.keyDown(diceBtn, { key: 'ArrowRight' });
    const combatBtn = screen.getByRole('tab', { name: 'Combat Tracker' });
    expect(document.activeElement).toBe(combatBtn);

    fireEvent.keyDown(combatBtn, { key: 'End' });
    const chatBtn = screen.getByRole('tab', { name: 'Chat Log' });
    expect(document.activeElement).toBe(chatBtn);

    fireEvent.keyDown(chatBtn, { key: 'Home' });
    expect(document.activeElement).toBe(diceBtn);
  });
});
