import { create } from 'zustand';
import {
  EMPTY_WORKSPACE_FILE,
  WORKSPACE_SCHEMA_VERSION,
  type LayoutWorkspace,
  type PanelGeometry,
  type WorkspaceFile,
} from '@/types/layout';
import {
  useUIStackStore,
  UI_PREF_PREFIXES,
  type PanelId,
} from './uiStackStore';

/**
 * Deliberately under the `nexus-ui-` prefix so `uiStackStore.resetLayout()`
 * sweeps it: "Reset layout" is documented to clear saved workspaces too.
 */
export const WORKSPACES_KEY = 'nexus-ui-workspaces';

const posKey = (id: PanelId) => `nexus-ui-${id}-pos`;
const sizeKey = (id: PanelId) => `nexus-ui-${id}-size`;
const collapsedKey = (id: PanelId) => `nexus-ui-${id}-collapsed`;

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota errors
  }
}

/**
 * Parse the stored blob, upgrading old shapes.
 *
 * A blob from a NEWER version is ignored rather than rewritten - the user has
 * rolled back a deploy, and silently downgrading their presets would lose data.
 */
export function migrateWorkspaceFile(raw: unknown): WorkspaceFile {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_WORKSPACE_FILE };

  const file = raw as Partial<WorkspaceFile>;
  if (typeof file.version !== 'number' || !Array.isArray(file.workspaces)) {
    return { ...EMPTY_WORKSPACE_FILE };
  }
  if (file.version > WORKSPACE_SCHEMA_VERSION) {
    return { ...EMPTY_WORKSPACE_FILE };
  }

  return {
    version: WORKSPACE_SCHEMA_VERSION,
    workspaces: file.workspaces as LayoutWorkspace[],
    lastAppliedId: file.lastAppliedId ?? null,
  };
}

function loadFile(): WorkspaceFile {
  return migrateWorkspaceFile(readJSON<WorkspaceFile>(WORKSPACES_KEY));
}

/** Snapshot the live geometry of one panel straight out of localStorage. */
function captureGeometry(id: PanelId): PanelGeometry | null {
  const position = readJSON<{ x: number; y: number }>(posKey(id));
  if (!position) return null;

  const size = readJSON<{ width: number; height: number }>(sizeKey(id));
  const collapsed = readJSON<boolean>(collapsedKey(id));

  return {
    position,
    ...(size ? { size } : {}),
    ...(typeof collapsed === 'boolean' ? { collapsed } : {}),
  };
}

function makeId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

export interface LayoutWorkspaceState {
  workspaces: LayoutWorkspace[];
  lastAppliedId: string | null;
  /**
   * Bumped on every apply. Mounted panels subscribe to this and re-read their
   * own geometry keys, so a restore needs no remount and loses no panel state.
   */
  applySeq: number;
  /** Geometry published for the current apply, keyed by panel id. */
  pendingGeometry: Record<string, PanelGeometry>;

  saveWorkspace: (name: string) => LayoutWorkspace;
  applyWorkspace: (id: string) => void;
  deleteWorkspace: (id: string) => void;
  renameWorkspace: (id: string, name: string) => void;
  reload: () => void;
}

function persist(state: Pick<LayoutWorkspaceState, 'workspaces' | 'lastAppliedId'>) {
  writeJSON(WORKSPACES_KEY, {
    version: WORKSPACE_SCHEMA_VERSION,
    workspaces: state.workspaces,
    lastAppliedId: state.lastAppliedId,
  } satisfies WorkspaceFile);
}

const initial = loadFile();

export const useLayoutWorkspaceStore = create<LayoutWorkspaceState>(
  (set, get) => ({
    workspaces: initial.workspaces,
    lastAppliedId: initial.lastAppliedId,
    applySeq: 0,
    pendingGeometry: {},

    reload: () => {
      const file = loadFile();
      set({
        workspaces: file.workspaces,
        lastAppliedId: file.lastAppliedId,
      });
    },

    saveWorkspace: (name: string) => {
      const ui = useUIStackStore.getState();

      // Capture geometry for everything currently in the stack, not just open
      // panels: the toolbar and docks are part of the layout too.
      const ids = Array.from(
        new Set<PanelId>([...ui.panelStack, ...ui.activePanels]),
      );
      const geometry: Record<string, PanelGeometry> = {};
      for (const id of ids) {
        const captured = captureGeometry(id);
        if (captured) geometry[id] = captured;
      }

      const now = Date.now();
      const existing = get().workspaces.find((w) => w.name === name);

      const workspace: LayoutWorkspace = {
        id: existing?.id ?? makeId(),
        name,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        // An explicit "save this layout" always captures the open set, even
        // when persistOpenPanels is off - that setting governs implicit
        // save-on-change, not deliberate snapshots.
        activePanels: [...ui.activePanels],
        panelStack: [...ui.panelStack],
        dockedPanels: { ...ui.dockedPanels },
        geometry,
      };

      const workspaces = existing
        ? get().workspaces.map((w) => (w.id === existing.id ? workspace : w))
        : [...get().workspaces, workspace];

      set({ workspaces });
      persist({ workspaces, lastAppliedId: get().lastAppliedId });
      return workspace;
    },

    applyWorkspace: (id: string) => {
      const workspace = get().workspaces.find((w) => w.id === id);
      if (!workspace) return;

      // 1. Write geometry to localStorage FIRST. Panels that are about to
      //    mount read exactly these keys in their own mount effect, so newly
      //    opened panels land correctly with no extra plumbing.
      for (const [panelId, geometry] of Object.entries(workspace.geometry)) {
        writeJSON(posKey(panelId), geometry.position);
        if (geometry.size) writeJSON(sizeKey(panelId), geometry.size);
        if (typeof geometry.collapsed === 'boolean') {
          writeJSON(collapsedKey(panelId), geometry.collapsed);
        }
      }

      // 2. Update the stack store. Applying is an explicit user action, so it
      //    always updates in-memory state; whether the open set is persisted
      //    still honours persistOpenPanels via setActivePanels.
      useUIStackStore.getState().applyLayout({
        activePanels: workspace.activePanels,
        panelStack: workspace.panelStack,
        // Older presets predate docking and simply have no docked panels.
        dockedPanels: workspace.dockedPanels ?? {},
      });

      // 3. Publish geometry for already-mounted panels to pick up.
      set((state) => ({
        applySeq: state.applySeq + 1,
        pendingGeometry: workspace.geometry,
        lastAppliedId: workspace.id,
      }));
      persist({ workspaces: get().workspaces, lastAppliedId: workspace.id });
    },

    deleteWorkspace: (id: string) => {
      const workspaces = get().workspaces.filter((w) => w.id !== id);
      const lastAppliedId =
        get().lastAppliedId === id ? null : get().lastAppliedId;
      set({ workspaces, lastAppliedId });
      persist({ workspaces, lastAppliedId });
    },

    renameWorkspace: (id: string, name: string) => {
      const workspaces = get().workspaces.map((w) =>
        w.id === id ? { ...w, name, updatedAt: Date.now() } : w,
      );
      set({ workspaces });
      persist({ workspaces, lastAppliedId: get().lastAppliedId });
    },
  }),
);

/** Exported for tests: the prefixes resetLayout sweeps include WORKSPACES_KEY. */
export const WORKSPACES_KEY_IS_SWEPT = UI_PREF_PREFIXES.some((p) =>
  WORKSPACES_KEY.startsWith(p),
);
