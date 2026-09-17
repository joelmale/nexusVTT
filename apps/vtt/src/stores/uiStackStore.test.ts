import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  useUIStackStore,
  stackZIndex,
  topmostPanel,
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

  it('togglePanel adds an inactive panel to activePanels and brings it to the top of panelStack', () => {
    useUIStackStore.setState({ activePanels: [], panelStack: [...DEFAULT_ORDER] });

    useUIStackStore.getState().togglePanel('dice');
    expect(useUIStackStore.getState().activePanels).toContain('dice');
    const stack = useUIStackStore.getState().panelStack;
    expect(stack[stack.length - 1]).toBe('dice');

    // Toggling again removes it from activePanels
    useUIStackStore.getState().togglePanel('dice');
    expect(useUIStackStore.getState().activePanels).not.toContain('dice');
  });

  describe('selectPanel', () => {
    it('opens an inactive panel and places it at the top of the stack', () => {
      useUIStackStore.setState({ activePanels: [], panelStack: [...DEFAULT_ORDER] });

      useUIStackStore.getState().selectPanel('dice');
      expect(useUIStackStore.getState().activePanels).toEqual(['dice']);
      const stack = useUIStackStore.getState().panelStack;
      expect(stack[stack.length - 1]).toBe('dice');
    });

    it('brings an open buried panel to the front without closing it', () => {
      useUIStackStore.setState({
        activePanels: ['chat', 'dice'],
        panelStack: [...DEFAULT_ORDER, 'chat', 'dice'],
      });

      // chat is open but dice is topmost. Selecting chat must raise it to top of stack.
      useUIStackStore.getState().selectPanel('chat');
      expect(useUIStackStore.getState().activePanels).toContain('chat');
      expect(useUIStackStore.getState().activePanels).toContain('dice');
      const stack = useUIStackStore.getState().panelStack;
      expect(stack[stack.length - 1]).toBe('chat');
    });

    it('closes an open panel only if it is already topmost', () => {
      useUIStackStore.setState({
        activePanels: ['chat', 'dice'],
        panelStack: [...DEFAULT_ORDER, 'chat', 'dice'],
      });

      // dice is already topmost. Selecting dice must close it.
      useUIStackStore.getState().selectPanel('dice');
      expect(useUIStackStore.getState().activePanels).toEqual(['chat']);
    });
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

    it('compresses a deep stack instead of flattening everything onto the cap', () => {
      // 12 panels + 5 chrome is the real worst case for a host.
      const deep: PanelId[] = Array.from({ length: 30 }, (_, i) => `panel-${i}`);

      const first = stackZIndex(deep, deep[0]);
      const last = stackZIndex(deep, deep[deep.length - 1]);
      const middle = stackZIndex(deep, deep[15]);

      expect(first).toBe(CHROME_Z_BASE);
      expect(last).toBe(CHROME_Z_MAX);
      // The middle must land strictly between - the old `base + index` maths
      // clamped every entry past 18 onto CHROME_Z_MAX, destroying the ordering.
      expect(middle).toBeGreaterThan(first);
      expect(middle).toBeLessThan(last);
    });

    it('is monotonically non-decreasing along the stack', () => {
      const deep: PanelId[] = Array.from({ length: 40 }, (_, i) => `panel-${i}`);
      let previous = -Infinity;
      for (const id of deep) {
        const z = stackZIndex(deep, id);
        expect(z).toBeGreaterThanOrEqual(previous);
        previous = z;
      }
    });
  });

  describe('togglePanel persistence honours persistOpenPanels', () => {
    it('writes nexus-active-panels when the setting is absent (defaults on)', () => {
      useUIStackStore.setState({ activePanels: [], panelStack: [...DEFAULT_ORDER] });
      useUIStackStore.getState().togglePanel('chat');

      expect(JSON.parse(localStorage.getItem('nexus-active-panels')!)).toEqual([
        'chat',
      ]);
    });

    it('does NOT write nexus-active-panels when persistOpenPanels is false', () => {
      localStorage.setItem(
        'nexus-settings',
        JSON.stringify({ persistOpenPanels: false }),
      );
      useUIStackStore.setState({ activePanels: [], panelStack: [...DEFAULT_ORDER] });

      useUIStackStore.getState().togglePanel('chat');

      expect(useUIStackStore.getState().activePanels).toEqual(['chat']);
      expect(localStorage.getItem('nexus-active-panels')).toBeNull();
    });
  });

  describe('popOutPanel / restorePanel', () => {
    it('popOutPanel is idempotent and returns the same state object on a repeat', () => {
      useUIStackStore.setState({ poppedOutPanels: [] });

      useUIStackStore.getState().popOutPanel('chat');
      expect(useUIStackStore.getState().poppedOutPanels).toEqual(['chat']);

      const before = useUIStackStore.getState().poppedOutPanels;
      useUIStackStore.getState().popOutPanel('chat');
      expect(useUIStackStore.getState().poppedOutPanels).toBe(before);
    });

    it('restorePanel removes the panel and is a no-op when it is not popped out', () => {
      useUIStackStore.setState({ poppedOutPanels: ['chat'] });

      useUIStackStore.getState().restorePanel('chat');
      expect(useUIStackStore.getState().poppedOutPanels).toEqual([]);

      const before = useUIStackStore.getState().poppedOutPanels;
      useUIStackStore.getState().restorePanel('chat');
      expect(useUIStackStore.getState().poppedOutPanels).toBe(before);
    });
  });

  describe('topmostPanel', () => {
    it('returns the last stack entry that is actually an open panel', () => {
      const stack: PanelId[] = ['gameToolbar', 'chat', 'atlasDock', 'dice'];
      expect(topmostPanel(stack, ['chat', 'dice'])).toBe('dice');
    });

    it('ignores non-panel chrome sitting above every open panel', () => {
      const stack: PanelId[] = ['chat', 'dice', 'gameToolbar', 'atlasDock'];
      // gameToolbar/atlasDock are chrome, not entries in activePanels.
      expect(topmostPanel(stack, ['chat', 'dice'])).toBe('dice');
    });

    it('returns null when no panel is open', () => {
      expect(topmostPanel([...DEFAULT_ORDER], [])).toBeNull();
    });

    it('ignores open panels missing from the stack', () => {
      expect(topmostPanel(['gameToolbar'], ['chat'])).toBeNull();
    });
  });

  describe('popped-out panels always restore docked', () => {
    it('does not rehydrate poppedOutPanels from localStorage', async () => {
      // A restored pop-out would call window.open() with no user gesture and
      // be blocked, tearing the panel down again on every load.
      localStorage.setItem(
        'nexus-popped-out-panels',
        JSON.stringify(['chat', 'dice']),
      );
      vi.resetModules();
      const fresh = await import('./uiStackStore');
      expect(fresh.useUIStackStore.getState().poppedOutPanels).toEqual([]);
    });
  });
});
