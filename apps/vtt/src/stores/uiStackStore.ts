import { create } from 'zustand';
import { useGameStore } from './gameStore';

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

export interface UIStackState {
  panelStack: PanelId[];
  activePanels: PanelId[];
  poppedOutPanels: PanelId[];
  bringToFront: (id: PanelId) => void;
  resetLayout: () => void;
  togglePanel: (id: PanelId) => void;
  popOutPanel: (id: PanelId) => void;
  restorePanel: (id: PanelId) => void;
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

export function stackZIndex(stack: PanelId[], id: PanelId): number {
  const index = stack.indexOf(id);
  return Math.min(CHROME_Z_BASE + (index === -1 ? 0 : index), CHROME_Z_MAX);
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

const loadPoppedOutPanels = (): PanelId[] => {
  try {
    const saved = localStorage.getItem(POPPED_OUT_PANELS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore parse errors
  }
  return [];
};

export const useUIStackStore = create<UIStackState>((set) => ({
  panelStack: loadStack(),
  activePanels: loadActivePanels(),
  poppedOutPanels: loadPoppedOutPanels(),

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
      // Safely access gameStore settings (prevents circular dep initialization issues)
      const persist = useGameStore.getState().settings.persistOpenPanels;
      const isActive = state.activePanels.includes(id);
      
      const newActive = isActive 
        ? state.activePanels.filter(p => p !== id)
        : [...state.activePanels, id];
        
      if (persist) {
        try {
          localStorage.setItem(ACTIVE_PANELS_KEY, JSON.stringify(newActive));
        } catch {
          // Ignore localStorage errors
        }
      }
      
      return { activePanels: newActive };
    }),

  popOutPanel: (id: PanelId) =>
    set((state) => {
      const persist = useGameStore.getState().settings.persistOpenPanels;
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
      const persist = useGameStore.getState().settings.persistOpenPanels;
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
      const keysToRemove: string[] = [ACTIVE_PANELS_KEY, POPPED_OUT_PANELS_KEY];
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
      poppedOutPanels: []
    });
  },
}));

/** Clamped z-index for a floating chrome panel, derived from stack order. */
export const useStackZIndex = (id: PanelId): number =>
  useUIStackStore((state) => stackZIndex(state.panelStack, id));
