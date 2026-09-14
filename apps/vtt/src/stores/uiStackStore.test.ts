import { describe, it, expect, beforeEach } from 'vitest';
import {
  useUIStackStore,
  stackZIndex,
  CHROME_Z_BASE,
  CHROME_Z_MAX,
  type PanelId,
} from './uiStackStore';

const DEFAULT_ORDER: PanelId[] = [
  'gameToolbar',
  'playerCluster',
  'panelDock',
  'floatingPanel',
  'atlasDock',
];

describe('uiStackStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useUIStackStore.setState({ panelStack: [...DEFAULT_ORDER] });
  });

  it('bringToFront moves the panel to the top of the stack', () => {
    useUIStackStore.getState().bringToFront('gameToolbar');
    const stack = useUIStackStore.getState().panelStack;
    expect(stack[stack.length - 1]).toBe('gameToolbar');
    expect(stack).toHaveLength(DEFAULT_ORDER.length);
  });

  it('bringToFront on the already-top panel is a no-op (same reference)', () => {
    const before = useUIStackStore.getState().panelStack;
    useUIStackStore.getState().bringToFront('atlasDock');
    expect(useUIStackStore.getState().panelStack).toBe(before);
  });

  it('persists stack order under the nexus-ui-stack key', () => {
    useUIStackStore.getState().bringToFront('panelDock');
    const saved = JSON.parse(localStorage.getItem('nexus-ui-stack')!);
    expect(saved[saved.length - 1]).toBe('panelDock');
  });

  it('resetLayout restores default order and sweeps all UI pref keys (both prefixes)', () => {
    localStorage.setItem('nexus-ui-floatingPanel-pos', '{"x":1,"y":2}');
    localStorage.setItem('nexus_ui_gameToolbar_pos', '{"x":3,"y":4}');
    localStorage.setItem('nexus-unrelated', 'keep');
    useUIStackStore.getState().bringToFront('gameToolbar');

    useUIStackStore.getState().resetLayout();

    expect(useUIStackStore.getState().panelStack).toEqual(DEFAULT_ORDER);
    expect(localStorage.getItem('nexus-ui-floatingPanel-pos')).toBeNull();
    expect(localStorage.getItem('nexus_ui_gameToolbar_pos')).toBeNull();
    expect(localStorage.getItem('nexus-ui-stack')).toBeNull();
    expect(localStorage.getItem('nexus-unrelated')).toBe('keep');
  });

  describe('stackZIndex — ADR-0004 chrome band clamp', () => {
    it('assigns ascending z by stack position starting at the chrome base', () => {
      expect(stackZIndex(DEFAULT_ORDER, 'gameToolbar')).toBe(CHROME_Z_BASE);
      expect(stackZIndex(DEFAULT_ORDER, 'atlasDock')).toBe(CHROME_Z_BASE + 4);
    });

    it('unknown ids get the base, never -1 math', () => {
      expect(stackZIndex(DEFAULT_ORDER, 'nonexistent')).toBe(CHROME_Z_BASE);
    });

    it('NEVER exceeds CHROME_Z_MAX (below --z-modal-backdrop), even with a huge stack', () => {
      const huge: PanelId[] = Array.from({ length: 50 }, (_, i) => `panel-${i}`);
      for (const id of huge) {
        expect(stackZIndex(huge, id)).toBeLessThanOrEqual(CHROME_Z_MAX);
      }
      expect(CHROME_Z_MAX).toBeLessThan(79); // --z-modal-backdrop
      expect(CHROME_Z_BASE).toBe(60); // --z-tool-ui
    });
  });
});
