import { describe, it, expect, beforeEach } from 'vitest';
import {
  dockZoneForPoint,
  useUIStackStore,
  DOCK_EDGE_THRESHOLD,
  type PanelId,
} from './uiStackStore';

const VW = 1000;
const VH = 800;

beforeEach(() => {
  localStorage.clear();
  useUIStackStore.setState({ dockedPanels: {} });
});

describe('dockZoneForPoint', () => {
  it('returns null well inside the viewport', () => {
    expect(dockZoneForPoint(500, 400, VW, VH)).toBeNull();
  });

  it('detects each edge', () => {
    expect(dockZoneForPoint(10, 400, VW, VH)).toBe('left');
    expect(dockZoneForPoint(VW - 10, 400, VW, VH)).toBe('right');
    expect(dockZoneForPoint(500, VH - 10, VW, VH)).toBe('bottom');
  });

  it('respects the threshold boundary exactly', () => {
    expect(dockZoneForPoint(DOCK_EDGE_THRESHOLD, 400, VW, VH)).toBe('left');
    expect(dockZoneForPoint(DOCK_EDGE_THRESHOLD + 1, 400, VW, VH)).toBeNull();
  });

  it('prefers bottom in the corners', () => {
    // A bottom dock spans the full width and is the more common target.
    expect(dockZoneForPoint(5, VH - 5, VW, VH)).toBe('bottom');
    expect(dockZoneForPoint(VW - 5, VH - 5, VW, VH)).toBe('bottom');
  });
});

describe('dockPanel / undockPanel', () => {
  it('docks a panel and persists it', () => {
    useUIStackStore.getState().dockPanel('chat' as PanelId, 'left');

    expect(useUIStackStore.getState().dockedPanels).toEqual({ chat: 'left' });
    expect(
      JSON.parse(localStorage.getItem('nexus-ui-docked-panels')!),
    ).toEqual({ chat: 'left' });
  });

  it('re-docking to the same zone is a no-op (same state object)', () => {
    useUIStackStore.getState().dockPanel('chat' as PanelId, 'left');
    const before = useUIStackStore.getState().dockedPanels;

    useUIStackStore.getState().dockPanel('chat' as PanelId, 'left');
    expect(useUIStackStore.getState().dockedPanels).toBe(before);
  });

  it('moves a panel between zones', () => {
    useUIStackStore.getState().dockPanel('chat' as PanelId, 'left');
    useUIStackStore.getState().dockPanel('chat' as PanelId, 'bottom');
    expect(useUIStackStore.getState().dockedPanels).toEqual({ chat: 'bottom' });
  });

  it('undocks and is a no-op for a panel that is not docked', () => {
    useUIStackStore.getState().dockPanel('chat' as PanelId, 'right');
    useUIStackStore.getState().undockPanel('chat' as PanelId);
    expect(useUIStackStore.getState().dockedPanels).toEqual({});

    const before = useUIStackStore.getState().dockedPanels;
    useUIStackStore.getState().undockPanel('chat' as PanelId);
    expect(useUIStackStore.getState().dockedPanels).toBe(before);
  });

  it('resetLayout clears docked panels and their storage key', () => {
    useUIStackStore.getState().dockPanel('chat' as PanelId, 'left');
    useUIStackStore.getState().resetLayout();

    expect(useUIStackStore.getState().dockedPanels).toEqual({});
    expect(localStorage.getItem('nexus-ui-docked-panels')).toBeNull();
  });

  it('applyLayout restores docked panels as part of a workspace', () => {
    useUIStackStore.getState().applyLayout({
      activePanels: ['chat'],
      panelStack: ['gameToolbar', 'chat'],
      dockedPanels: { chat: 'bottom' },
    });

    expect(useUIStackStore.getState().dockedPanels).toEqual({ chat: 'bottom' });
  });
});

describe('dock host registry', () => {
  it('a docked panel resolves its host through the registry, not a DOM query', async () => {
    // Regression guard: the dock regions are rendered in the same commit as
    // the panels, so a `document.querySelector` during render returns null on
    // first mount (a reload with a persisted dock) and the panel would render
    // nothing forever with no retry. The registry is populated by a callback
    // ref, which fires as the node attaches.
    const { useDockHostRef, useDockHost } = await import('@/hooks/useDocking');
    const { renderHook, act } = await import('@testing-library/react');

    const { result: refResult } = renderHook(() => useDockHostRef('left'));
    const { result: hostResult, rerender } = renderHook(() =>
      useDockHost('left'),
    );

    expect(hostResult.current).toBeNull();

    const el = document.createElement('div');
    act(() => {
      refResult.current(el);
    });
    rerender();

    expect(hostResult.current).toBe(el);

    act(() => {
      refResult.current(null);
    });
    rerender();
    expect(hostResult.current).toBeNull();
  });
});
