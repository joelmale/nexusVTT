import { describe, it, expect, beforeEach } from 'vitest';
import {
  useLayoutWorkspaceStore,
  migrateWorkspaceFile,
  WORKSPACES_KEY,
} from './layoutWorkspaceStore';
import { useUIStackStore, type PanelId } from './uiStackStore';
import { WORKSPACE_SCHEMA_VERSION } from '@/types/layout';

const DEFAULT_ORDER: PanelId[] = [
  'gameToolbar',
  'playerCluster',
  'panelDock',
  'floatingPanel',
  'atlasDock',
];

function seedGeometry(id: string, x: number, y: number) {
  localStorage.setItem(`nexus-ui-${id}-pos`, JSON.stringify({ x, y }));
  localStorage.setItem(
    `nexus-ui-${id}-size`,
    JSON.stringify({ width: 320, height: 600 }),
  );
  localStorage.setItem(`nexus-ui-${id}-collapsed`, JSON.stringify(false));
}

beforeEach(() => {
  localStorage.clear();
  useUIStackStore.setState({
    panelStack: [...DEFAULT_ORDER],
    activePanels: [],
    poppedOutPanels: [],
    dockedPanels: {},
    focusMode: false,
  });
  useLayoutWorkspaceStore.setState({
    workspaces: [],
    lastAppliedId: null,
    applySeq: 0,
    pendingGeometry: {},
  });
});

describe('layoutWorkspaceStore', () => {
  it('round-trips save -> apply', () => {
    seedGeometry('chat', 100, 200);
    useUIStackStore.setState({
      activePanels: ['chat'],
      panelStack: [...DEFAULT_ORDER, 'chat'],
    });

    const saved = useLayoutWorkspaceStore.getState().saveWorkspace('Combat');
    expect(saved.activePanels).toEqual(['chat']);
    expect(saved.geometry.chat.position).toEqual({ x: 100, y: 200 });

    // Drift away from the saved layout.
    useUIStackStore.setState({ activePanels: [], panelStack: [...DEFAULT_ORDER] });
    localStorage.setItem(`nexus-ui-chat-pos`, JSON.stringify({ x: 0, y: 0 }));

    useLayoutWorkspaceStore.getState().applyWorkspace(saved.id);

    expect(useUIStackStore.getState().activePanels).toEqual(['chat']);
    expect(JSON.parse(localStorage.getItem('nexus-ui-chat-pos')!)).toEqual({
      x: 100,
      y: 200,
    });
  });

  it('bumps applySeq and publishes pendingGeometry so mounted panels can react', () => {
    seedGeometry('dice', 40, 60);
    useUIStackStore.setState({ activePanels: ['dice'] });
    const saved = useLayoutWorkspaceStore.getState().saveWorkspace('Rolling');

    const before = useLayoutWorkspaceStore.getState().applySeq;
    useLayoutWorkspaceStore.getState().applyWorkspace(saved.id);

    const state = useLayoutWorkspaceStore.getState();
    expect(state.applySeq).toBe(before + 1);
    expect(state.pendingGeometry.dice.position).toEqual({ x: 40, y: 60 });
  });

  it('saving under an existing name overwrites it and bumps updatedAt', () => {
    seedGeometry('chat', 10, 10);
    useUIStackStore.setState({ activePanels: ['chat'] });
    const first = useLayoutWorkspaceStore.getState().saveWorkspace('Combat');

    seedGeometry('chat', 50, 50);
    const second = useLayoutWorkspaceStore.getState().saveWorkspace('Combat');

    expect(useLayoutWorkspaceStore.getState().workspaces).toHaveLength(1);
    expect(second.id).toBe(first.id);
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.updatedAt).toBeGreaterThanOrEqual(first.updatedAt);
    expect(second.geometry.chat.position).toEqual({ x: 50, y: 50 });
  });

  it('delete removes the workspace and clears lastAppliedId when it pointed at it', () => {
    seedGeometry('chat', 10, 10);
    const saved = useLayoutWorkspaceStore.getState().saveWorkspace('Combat');
    useLayoutWorkspaceStore.getState().applyWorkspace(saved.id);
    expect(useLayoutWorkspaceStore.getState().lastAppliedId).toBe(saved.id);

    useLayoutWorkspaceStore.getState().deleteWorkspace(saved.id);

    expect(useLayoutWorkspaceStore.getState().workspaces).toEqual([]);
    expect(useLayoutWorkspaceStore.getState().lastAppliedId).toBeNull();
  });

  it('applying an unknown id is a no-op', () => {
    const before = useLayoutWorkspaceStore.getState().applySeq;
    useLayoutWorkspaceStore.getState().applyWorkspace('does-not-exist');
    expect(useLayoutWorkspaceStore.getState().applySeq).toBe(before);
  });

  it('restores a preset that names a panel with no stored geometry', () => {
    // 'ghost' was open when saved but has no -pos key; capture skips it and
    // apply must still restore the rest rather than throwing.
    seedGeometry('chat', 10, 20);
    useUIStackStore.setState({ activePanels: ['chat', 'ghost'] });

    const saved = useLayoutWorkspaceStore.getState().saveWorkspace('Mixed');
    expect(saved.geometry.ghost).toBeUndefined();
    expect(saved.activePanels).toContain('ghost');

    expect(() =>
      useLayoutWorkspaceStore.getState().applyWorkspace(saved.id),
    ).not.toThrow();
    expect(useUIStackStore.getState().activePanels).toEqual(['chat', 'ghost']);
  });

  it('applying honours persistOpenPanels for the open set but always updates memory', () => {
    localStorage.setItem(
      'nexus-settings',
      JSON.stringify({ persistOpenPanels: false }),
    );
    seedGeometry('chat', 10, 20);
    useUIStackStore.setState({ activePanels: ['chat'] });
    const saved = useLayoutWorkspaceStore.getState().saveWorkspace('Combat');

    useUIStackStore.setState({ activePanels: [] });
    useLayoutWorkspaceStore.getState().applyWorkspace(saved.id);

    expect(useUIStackStore.getState().activePanels).toEqual(['chat']);
    expect(localStorage.getItem('nexus-active-panels')).toBeNull();
  });

  it('captures and restores docked panels', () => {
    seedGeometry('chat', 10, 20);
    useUIStackStore.setState({ activePanels: ['chat'] });
    useUIStackStore.getState().dockPanel('chat', 'bottom');

    const saved = useLayoutWorkspaceStore.getState().saveWorkspace('Combat');
    expect(saved.dockedPanels).toEqual({ chat: 'bottom' });

    useUIStackStore.getState().undockPanel('chat');
    expect(useUIStackStore.getState().dockedPanels).toEqual({});

    useLayoutWorkspaceStore.getState().applyWorkspace(saved.id);
    expect(useUIStackStore.getState().dockedPanels).toEqual({ chat: 'bottom' });
  });

  it('applies a pre-docking preset that has no dockedPanels field', () => {
    seedGeometry('chat', 10, 20);
    useUIStackStore.setState({ activePanels: ['chat'] });
    const saved = useLayoutWorkspaceStore.getState().saveWorkspace('Legacy');

    // Simulate a preset written before item 7 landed.
    useLayoutWorkspaceStore.setState({
      workspaces: [{ ...saved, dockedPanels: undefined as never }],
    });
    useUIStackStore.getState().dockPanel('chat', 'left');

    useLayoutWorkspaceStore.getState().applyWorkspace(saved.id);
    expect(useUIStackStore.getState().dockedPanels).toEqual({});
  });

  it('resetLayout() clears saved workspaces (the nexus-ui- prefix is swept)', () => {
    seedGeometry('chat', 10, 10);
    useLayoutWorkspaceStore.getState().saveWorkspace('Combat');
    expect(localStorage.getItem(WORKSPACES_KEY)).not.toBeNull();

    useUIStackStore.getState().resetLayout();

    expect(localStorage.getItem(WORKSPACES_KEY)).toBeNull();
    useLayoutWorkspaceStore.getState().reload();
    expect(useLayoutWorkspaceStore.getState().workspaces).toEqual([]);
  });
});

describe('migrateWorkspaceFile', () => {
  it('returns an empty file for junk input', () => {
    expect(migrateWorkspaceFile(null).workspaces).toEqual([]);
    expect(migrateWorkspaceFile('nope').workspaces).toEqual([]);
    expect(migrateWorkspaceFile({}).workspaces).toEqual([]);
  });

  it('accepts a current-version file', () => {
    const file = {
      version: WORKSPACE_SCHEMA_VERSION,
      workspaces: [{ id: 'a', name: 'A' }],
      lastAppliedId: 'a',
    };
    const migrated = migrateWorkspaceFile(file);
    expect(migrated.workspaces).toHaveLength(1);
    expect(migrated.lastAppliedId).toBe('a');
  });

  it('ignores a file written by a NEWER version rather than downgrading it', () => {
    const future = {
      version: WORKSPACE_SCHEMA_VERSION + 1,
      workspaces: [{ id: 'a', name: 'A' }],
      lastAppliedId: 'a',
    };
    expect(migrateWorkspaceFile(future).workspaces).toEqual([]);
  });
});
