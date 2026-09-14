import { create } from 'zustand';

export type PanelId =
  | 'playerCluster'
  | 'panelDock'
  | 'gameToolbar'
  | 'floatingPanel'
  | 'atlasDock'
  | string;

export interface UIStackState {
  panelStack: PanelId[];
  bringToFront: (id: PanelId) => void;
  resetLayout: () => void;
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

// Helper to load stack from localStorage (legacy underscore key read once for migration)
const loadStack = (): PanelId[] => {
  try {
    const saved =
      localStorage.getItem(STACK_KEY) ?? localStorage.getItem(LEGACY_STACK_KEY);
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

export const useUIStackStore = create<UIStackState>((set) => ({
  panelStack: loadStack(),

  bringToFront: (id: PanelId) =>
    set((state) => {
      if (state.panelStack[state.panelStack.length - 1] === id) {
        return state;
      }

      const filteredStack = state.panelStack.filter((panelId) => panelId !== id);
      const newStack = [...filteredStack, id];

      // Save to localStorage
      try {
        localStorage.setItem(STACK_KEY, JSON.stringify(newStack));
      } catch {
        // Ignore quota errors
      }

      return { panelStack: newStack };
    }),

  resetLayout: () => {
    // Single source of truth for the reset sweep: stack order plus every
    // per-panel position/collapse pref, both current and legacy key styles.
    try {
      const keysToRemove: string[] = [];
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
    set({ panelStack: [...DEFAULT_STACK] });
  },
}));

/** Clamped z-index for a floating chrome panel, derived from stack order. */
export const useStackZIndex = (id: PanelId): number =>
  useUIStackStore((state) => stackZIndex(state.panelStack, id));
