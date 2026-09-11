import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { stackZIndex, useUIStackStore } from '@/stores/uiStackStore';
import { AnchoredPropertiesPanel } from './AnchoredPropertiesPanel';
import { calculateAnchoredPanelPosition } from './anchoredPanelPosition';

const DEFAULT_STACK = [
  'gameToolbar',
  'playerCluster',
  'panelDock',
  'floatingPanel',
  'atlasDock',
];

beforeEach(() => {
  const portalRoot = document.createElement('div');
  portalRoot.id = 'portal-root';
  document.body.appendChild(portalRoot);
  useUIStackStore.setState({ panelStack: [...DEFAULT_STACK] });
});

afterEach(() => {
  cleanup();
  document.getElementById('portal-root')?.remove();
});

describe('calculateAnchoredPanelPosition', () => {
  it('places a panel to the right of the selected object when it fits', () => {
    expect(
      calculateAnchoredPanelPosition(
        { left: 100, right: 150, top: 80, bottom: 140 },
        { width: 300, height: 200 },
        { width: 800, height: 600 },
      ),
    ).toEqual({ left: 162, top: 80 });
  });

  it('flips left and clamps vertically near viewport edges', () => {
    expect(
      calculateAnchoredPanelPosition(
        { left: 700, right: 780, top: 520, bottom: 580 },
        { width: 300, height: 200 },
        { width: 800, height: 600 },
      ),
    ).toEqual({ left: 388, top: 388 });
  });
});

describe('AnchoredPropertiesPanel', () => {
  it('portals the active properties panel above the floating tool pane', () => {
    render(
      <AnchoredPropertiesPanel
        anchor={{ left: 100, right: 150, top: 80, bottom: 140 }}
        label="Drawing properties"
      >
        <div>properties</div>
      </AnchoredPropertiesPanel>,
    );

    const panel = screen.getByRole('dialog', { name: 'Drawing properties' });
    const stack = useUIStackStore.getState().panelStack;

    expect(document.getElementById('portal-root')?.contains(panel)).toBe(true);
    expect(stack[stack.length - 1]).toBe('objectProperties');
    expect(Number(panel.style.zIndex)).toBeGreaterThan(
      stackZIndex(stack, 'floatingPanel'),
    );
  });
});
