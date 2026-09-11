import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { PanelDock } from './PanelDock';

// Hover-dock redesign (Joel, 2026-07-07): ConnectionStatus moved out of
// PanelDock into PlayerClusterFloating, so this suite no longer stubs or
// asserts it — the dock now owns only the panel tab buttons.

afterEach(() => {
  cleanup();
});

const panels = [
  { id: 'tokens' as const, icon: '👤', label: 'Tokens' },
  { id: 'scene' as const, icon: '🖼', label: 'Scene' },
  { id: 'dice' as const, icon: '🎲', label: 'Dice' },
];

describe('PanelDock', () => {
  it('renders one tab button per panel', () => {
    render(
      <PanelDock
        panels={panels}
        activePanel="tokens"
        isOpen={true}
        onSelect={() => {}}
      />,
    );

    for (const panel of panels) {
      expect(screen.getByRole('tab', { name: panel.label })).not.toBeNull();
    }
  });

  it('sets aria-pressed/aria-selected only on the active+open panel', () => {
    render(
      <PanelDock
        panels={panels}
        activePanel="scene"
        isOpen={true}
        onSelect={() => {}}
      />,
    );

    const sceneTab = screen.getByRole('tab', { name: 'Scene' });
    const tokensTab = screen.getByRole('tab', { name: 'Tokens' });

    expect(sceneTab.getAttribute('aria-pressed')).toBe('true');
    expect(sceneTab.getAttribute('aria-selected')).toBe('true');
    expect(tokensTab.getAttribute('aria-pressed')).toBe('false');
    expect(tokensTab.getAttribute('aria-selected')).toBe('false');
  });

  it('does not mark any panel active when the FloatingPanel is closed', () => {
    render(
      <PanelDock
        panels={panels}
        activePanel="scene"
        isOpen={false}
        onSelect={() => {}}
      />,
    );

    const sceneTab = screen.getByRole('tab', { name: 'Scene' });
    expect(sceneTab.getAttribute('aria-pressed')).toBe('false');
  });

  it('calls onSelect with the panel id when clicked', () => {
    const onSelect = vi.fn();
    render(
      <PanelDock
        panels={panels}
        activePanel="tokens"
        isOpen={true}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Dice' }));
    expect(onSelect).toHaveBeenCalledWith('dice');
  });

  it('moves roving tabindex focus with ArrowRight/ArrowLeft', () => {
    render(
      <PanelDock
        panels={panels}
        activePanel="tokens"
        isOpen={true}
        onSelect={() => {}}
      />,
    );

    const tokensTab = screen.getByRole('tab', { name: 'Tokens' });
    const sceneTab = screen.getByRole('tab', { name: 'Scene' });
    const diceTab = screen.getByRole('tab', { name: 'Dice' });

    // Initial roving target is the active panel.
    expect(tokensTab.getAttribute('tabindex')).toBe('0');
    expect(sceneTab.getAttribute('tabindex')).toBe('-1');

    tokensTab.focus();
    fireEvent.keyDown(tokensTab, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(sceneTab);
    expect(sceneTab.getAttribute('tabindex')).toBe('0');
    expect(tokensTab.getAttribute('tabindex')).toBe('-1');

    fireEvent.keyDown(sceneTab, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(tokensTab);

    // Wraps around at the ends.
    fireEvent.keyDown(tokensTab, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(diceTab);

    fireEvent.keyDown(diceTab, { key: 'End' });
    expect(document.activeElement).toBe(diceTab);

    fireEvent.keyDown(diceTab, { key: 'Home' });
    expect(document.activeElement).toBe(tokensTab);
  });
});
