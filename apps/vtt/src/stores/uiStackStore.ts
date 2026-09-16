import { create } from 'zustand';

export type PanelId =
  | 'playerCluster'
  | 'panelDock'
  | 'gameToolbar'
  | 'floatingPanel'
  | 'atlasDock'
  | 'tokens'
  | 'scene'
  | 'props'
  | 'generator'
  | 'initiative'
  | 'dice'
  | 'lobby'
  | 'settings'
  | 'chat'
  | 'sounds'
  | 'documents'
  | 'characters'
  | string;

/** Edge a panel can be docked to. Floating panels have no entry. */
export type DockZone = 'left' | 'right' | 'bottom';

export const DOCK_ZONES: DockZone[] = ['left', 'right', 'bottom'];

/** How close (px) a dragged panel must get to an edge to offer a dock. */
export const DOCK_EDGE_THRESHOLD = 64;

export interface UIStackState {
  panelStack: PanelId[];
  activePanels: PanelId[];
  poppedOutPanels: PanelId[];
  /**
   * Immersive mode: all floating chrome is hidden, leaving only the map.
   * Deliberately NOT persisted - reloading into a chrome-less UI with no
   * visible way out is a trap.
   */
  focusMode: boolean;
  /** Panels currently docked to a viewport edge, by panel id. */
  dockedPanels: Record<string, DockZone>;
  bringToFront: (id: PanelId) => void;
  resetLayout: () => void;
  togglePanel: (id: PanelId) => void;
  popOutPanel: (id: PanelId) => void;
  restorePanel: (id: PanelId) => void;
  setFocusMode: (on: boolean) => void;
  toggleFocusMode: () => void;
  dockPanel: (id: PanelId, zone: DockZone) => void;
  undockPanel: (id: PanelId) => void;
  /** Apply a whole layout at once (workspace restore) in a single update. */
  applyLayout: (layout: {
    activePanels: PanelId[];
    panelStack: PanelId[];
    dockedPanels?: Record<string, DockZone>;
  }) => void;
}

const DEFAULT_STACK: PanelId[] = [
  'gameToolbar',
  'playerCluster',
  'panelDock',
  'floatingPanel',
  'atlasDock',
];

const STACK_KEY = 'nexus-ui-stack';
const LEGACY_STACK_KEY = 'nexus_ui_stack';
const ACTIVE_PANELS_KEY = 'nexus-active-panels';
const POPPED_OUT_PANELS_KEY = 'nexus-popped-out-panels';
const DOCKED_PANELS_KEY = 'nexus-ui-docked-panels';

/** All per-panel position/collapse keys share these prefixes (see useDraggablePanel). */
export const UI_PREF_PREFIXES = ['nexus-ui-', 'nexus_ui_'] as const;

/**
 * ADR-0004 band clamp: floating chrome may reorder among itself but must stay
 * strictly inside the chrome range — above the scene layers, below
 * --z-modal-backdrop (79). A raised panel can never cover a modal, tooltip,
 * dice overlay, or character sheet.
 */
export const CHROME_Z_BASE = 60; // == --z-tool-ui
export const CHROME_Z_MAX = 78; // < --z-modal-backdrop (79)

/**
 * Map a panel's stack position into the chrome band.
 *
 * The band cannot be widened - `z-scale.test.ts` enforces both TS<->CSS parity
 * and strict ascension, and [60, 78] already straddles --z-panel (70) and
 * --z-popover (75). With 12 panels plus 5 chrome elements a naive
 * `base + index` runs out of headroom and silently clamps everything to 78, so
 * positions are *compressed* across the available range instead. Only relative
 * order matters, so collapsing adjacent entries onto the same integer when the
 * stack is deep is harmless.
 */
export function stackZIndex(stack: PanelId[], id: PanelId): number {
  const index = stack.indexOf(id);
  if (index === -1) return CHROME_Z_BASE;

  const span = CHROME_Z_MAX - CHROME_Z_BASE; // 18 distinct steps above base
  const lastIndex = stack.length - 1;
  if (lastIndex <= 0) return CHROME_Z_BASE;

  // Short stacks keep the exact 1:1 mapping they had before compression.
  if (lastIndex <= span) return CHROME_Z_BASE + index;

  return CHROME_Z_BASE + Math.round((index / lastIndex) * span);
}

// Helper to load stack from localStorage
const loadStack = (): PanelId[] => {
  try {
    const saved = localStorage.getItem(STACK_KEY) ?? localStorage.getItem(LEGACY_STACK_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return [...DEFAULT_STACK];
};

const loadActivePanels = (): PanelId[] => {
  try {
    const saved = localStorage.getItem(ACTIVE_PANELS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore parse errors
  }
  return [];
};

/**
 * Pop-out state is persisted for diagnostics, but panels always come back
 * DOCKED on load.
 *
 * Both `documentPictureInPicture.requestWindow()` and `window.open()` require
 * transient activation. Restoring a popped-out panel on page load has no user
 * gesture behind it, so the browser blocks it unconditionally and the panel
 * tears itself straight back down. Let the user re-pop deliberately instead.
 */
const loadPoppedOutPanels = (): PanelId[] => [];

const loadDockedPanels = (): Record<string, DockZone> => {
  try {
    const saved = localStorage.getItem(DOCKED_PANELS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, DockZone>;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return {};
};

const persistDockedPanels = (docked: Record<string, DockZone>) => {
  try {
    localStorage.setItem(DOCKED_PANELS_KEY, JSON.stringify(docked));
  } catch {
    // Ignore localStorage errors
  }
};

const SETTINGS_STORAGE_KEY = 'nexus-settings';

/**
 * Read `persistOpenPanels` without importing gameStore.
 *
 * uiStackStore previously imported gameStore at module scope purely for this
 * one boolean, which put a store->store edge in the graph that
 * `npm run check:cycles` only tolerates by luck. gameStore writes
 * `nexus-settings` on every settings change (see `saveSettingsToStorage`), so
 * reading it back here is equivalent and keeps this store a leaf.
 */
const shouldPersistOpenPanels = (): boolean => {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return true;
    const parsed = JSON.parse(raw);
    return parsed?.persistOpenPanels !== false;
  } catch {
    return true;
  }
};

export const useUIStackStore = create<UIStackState>((set) => ({
  panelStack: loadStack(),
  activePanels: loadActivePanels(),
  poppedOutPanels: loadPoppedOutPanels(),
  dockedPanels: loadDockedPanels(),
  focusMode: false,

  dockPanel: (id: PanelId, zone: DockZone) =>
    set((state) => {
      if (state.dockedPanels[id] === zone) return state;
      const dockedPanels = { ...state.dockedPanels, [id]: zone };
      persistDockedPanels(dockedPanels);
      return { dockedPanels };
    }),

  undockPanel: (id: PanelId) =>
    set((state) => {
      if (!(id in state.dockedPanels)) return state;
      const dockedPanels = { ...state.dockedPanels };
      delete dockedPanels[id];
      persistDockedPanels(dockedPanels);
      return { dockedPanels };
    }),

  setFocusMode: (on: boolean) => set({ focusMode: on }),
  toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),

  applyLayout: ({ activePanels, panelStack, dockedPanels }) =>
    set(() => {
      // One update rather than N bringToFront calls, so panels re-render once.
      try {
        localStorage.setItem(STACK_KEY, JSON.stringify(panelStack));
      } catch {
        // Ignore localStorage errors
      }

      // The open set still respects persistOpenPanels: applying a workspace is
      // explicit, but "remember open panels" governs what survives a reload.
      if (shouldPersistOpenPanels()) {
        try {
          localStorage.setItem(ACTIVE_PANELS_KEY, JSON.stringify(activePanels));
        } catch {
          // Ignore localStorage errors
        }
      }

      if (dockedPanels) persistDockedPanels(dockedPanels);

      return {
        activePanels: [...activePanels],
        panelStack: [...panelStack],
        ...(dockedPanels ? { dockedPanels: { ...dockedPanels } } : {}),
      };
    }),

  bringToFront: (id: PanelId) =>
    set((state) => {
      if (state.panelStack[state.panelStack.length - 1] === id) {
        return state;
      }

      const filteredStack = state.panelStack.filter((panelId) => panelId !== id);
      const newStack = [...filteredStack, id];

      try {
        localStorage.setItem(STACK_KEY, JSON.stringify(newStack));
      } catch {
        // Ignore localStorage errors
      }

      return { panelStack: newStack };
    }),

  togglePanel: (id: PanelId) =>
    set((state) => {
      // Read the setting from persisted storage - see shouldPersistOpenPanels.
      const persist = shouldPersistOpenPanels();
      const isActive = state.activePanels.includes(id);
      
      const newActive = isActive 
        ? state.activePanels.filter(p => p !== id)
        : [...state.activePanels, id];

      const newStack = isActive
        ? state.panelStack
        : [...state.panelStack.filter(p => p !== id), id];
        
      if (persist) {
        try {
          localStorage.setItem(ACTIVE_PANELS_KEY, JSON.stringify(newActive));
        } catch {
          // Ignore localStorage errors
        }
      }

      if (!isActive) {
        try {
          localStorage.setItem(STACK_KEY, JSON.stringify(newStack));
        } catch {
          // Ignore localStorage errors
        }
      }
      
      return { activePanels: newActive, panelStack: newStack };
    }),

  popOutPanel: (id: PanelId) =>
    set((state) => {
      const persist = shouldPersistOpenPanels();
      if (state.poppedOutPanels.includes(id)) return state;
      
      const newPoppedOut = [...state.poppedOutPanels, id];
      
      if (persist) {
        try {
          localStorage.setItem(POPPED_OUT_PANELS_KEY, JSON.stringify(newPoppedOut));
        } catch {
          // Ignore localStorage errors
        }
      }
      
      return { poppedOutPanels: newPoppedOut };
    }),

  restorePanel: (id: PanelId) =>
    set((state) => {
      const persist = shouldPersistOpenPanels();
      if (!state.poppedOutPanels.includes(id)) return state;
      
      const newPoppedOut = state.poppedOutPanels.filter(p => p !== id);
      
      if (persist) {
        try {
          localStorage.setItem(POPPED_OUT_PANELS_KEY, JSON.stringify(newPoppedOut));
        } catch {
          // Ignore localStorage errors
        }
      }
      
      return { poppedOutPanels: newPoppedOut };
    }),

  resetLayout: () => {
    try {
      const keysToRemove: string[] = [
        ACTIVE_PANELS_KEY,
        POPPED_OUT_PANELS_KEY,
        DOCKED_PANELS_KEY,
      ];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && UI_PREF_PREFIXES.some((p) => key.startsWith(p))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {
      // Ignore
    }
    set({
      panelStack: [...DEFAULT_STACK],
      activePanels: [],
      poppedOutPanels: [],
      dockedPanels: {},
      focusMode: false,
    });
  },
}));

/** Clamped z-index for a floating chrome panel, derived from stack order. */
export const useStackZIndex = (id: PanelId): number =>
  useUIStackStore((state) => stackZIndex(state.panelStack, id));

/**
 * The open panel highest in the stack, or null when no panel is open.
 * `panelStack` also holds non-panel chrome (toolbar, docks), so the topmost
 * *panel* is the last stack entry that is actually in `activePanels`.
 */
export function topmostPanel(
  stack: PanelId[],
  activePanels: PanelId[],
): PanelId | null {
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    if (activePanels.includes(stack[i])) return stack[i];
  }
  return null;
}

/** The dock zone for a panel, or null when it is floating. */
export const useDockZone = (id: PanelId): DockZone | null =>
  useUIStackStore((state) => state.dockedPanels[id] ?? null);

/**
 * Which edge a point is close enough to dock against, or null.
 * Bottom wins over the sides in the corners, because a bottom dock spans the
 * full width and is the more common target for chat/initiative.
 */
export function dockZoneForPoint(
  x: number,
  y: number,
  viewportWidth: number,
  viewportHeight: number,
  threshold = DOCK_EDGE_THRESHOLD,
): DockZone | null {
  if (viewportHeight - y <= threshold) return 'bottom';
  if (x <= threshold) return 'left';
  if (viewportWidth - x <= threshold) return 'right';
  return null;
}

/** Immersive mode flag - see UIStackState.focusMode. */
export const useFocusMode = (): boolean =>
  useUIStackStore((state) => state.focusMode);

/** True when `id` is the frontmost open panel - used to scope Escape handling. */
export const useIsTopmostPanel = (id: PanelId): boolean =>
  useUIStackStore(
    (state) => topmostPanel(state.panelStack, state.activePanels) === id,
  );
