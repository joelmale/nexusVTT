import { create } from 'zustand';
import {
  BUILT_IN_PACKS,
  getIconDefinition,
  type IconThemePack,
} from '@/services/iconCatalog';

const LOCAL_STORAGE_KEY = 'nexus-user-icon-overrides';

function loadStoredOverrides(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStoredOverrides(overrides: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // Ignore storage quota errors
  }
}

export interface ResolvedIcon {
  id: string;
  name: string;
  url?: string;
  fallback: string;
  isCustomOverride: boolean;
}

export interface IconState {
  globalCampaignPackId: string;
  localUserOverrides: Record<string, string>;
  availablePacks: IconThemePack[];

  // Resolution
  getResolvedIcon: (id: string) => ResolvedIcon;

  // Actions
  setGlobalCampaignPack: (packId: string) => void;
  setLocalUserIcon: (iconId: string, dataUrlOrUrl: string) => void;
  clearLocalUserIcon: (iconId: string) => void;
  clearAllLocalOverrides: () => void;
  registerCustomPack: (pack: IconThemePack) => void;

  // Export / Import
  exportLocalPack: (name: string) => string;
  importLocalPack: (jsonString: string) => boolean;
}

export const useIconStore = create<IconState>((set, get) => ({
  globalCampaignPackId: 'nexus-vector-gold',
  localUserOverrides: loadStoredOverrides(),
  availablePacks: [...BUILT_IN_PACKS],

  getResolvedIcon: (id: string): ResolvedIcon => {
    const def = getIconDefinition(id);
    const name = def?.name || id;
    const fallback = def?.defaultFallback || '❓';

    // 1. Check player's local user override (IndexedDB/localStorage)
    const localOverride = get().localUserOverrides[id];
    if (localOverride) {
      return {
        id,
        name,
        url: localOverride,
        fallback,
        isCustomOverride: true,
      };
    }

    // 2. Check Host's active campaign global pack
    const activePack = get().availablePacks.find(
      (p) => p.id === get().globalCampaignPackId,
    );
    if (activePack) {
      if (activePack.id === 'default-emoji') {
        return {
          id,
          name,
          fallback,
          isCustomOverride: false,
        };
      }
      const packUrl = activePack.icons[id];
      if (packUrl) {
        return {
          id,
          name,
          url: packUrl,
          fallback,
          isCustomOverride: false,
        };
      }
    }

    // 3. Check system default static asset
    if (def?.defaultAsset) {
      return {
        id,
        name,
        url: def.defaultAsset,
        fallback,
        isCustomOverride: false,
      };
    }

    // 4. Fallback to clean Unicode emoji / symbol
    return {
      id,
      name,
      fallback,
      isCustomOverride: false,
    };
  },

  setGlobalCampaignPack: (packId: string) => {
    set({ globalCampaignPackId: packId });
  },

  setLocalUserIcon: (iconId: string, dataUrlOrUrl: string) => {
    set((state) => {
      const next = { ...state.localUserOverrides, [iconId]: dataUrlOrUrl };
      saveStoredOverrides(next);
      return { localUserOverrides: next };
    });
  },

  clearLocalUserIcon: (iconId: string) => {
    set((state) => {
      const next = { ...state.localUserOverrides };
      delete next[iconId];
      saveStoredOverrides(next);
      return { localUserOverrides: next };
    });
  },

  clearAllLocalOverrides: () => {
    saveStoredOverrides({});
    set({ localUserOverrides: {} });
  },

  registerCustomPack: (pack: IconThemePack) => {
    set((state) => {
      const filtered = state.availablePacks.filter((p) => p.id !== pack.id);
      return { availablePacks: [...filtered, pack] };
    });
  },

  exportLocalPack: (name: string): string => {
    const pack: IconThemePack = {
      id: `custom-pack-${Date.now()}`,
      name: name || 'Custom Player Pack',
      description: 'Exported personal icon pack from NexusVTT.',
      icons: { ...get().localUserOverrides },
      isBuiltIn: false,
    };
    return JSON.stringify(pack, null, 2);
  },

  importLocalPack: (jsonString: string): boolean => {
    try {
      const parsed = JSON.parse(jsonString) as Partial<IconThemePack>;
      if (!parsed.icons || typeof parsed.icons !== 'object') {
        return false;
      }
      set((state) => {
        const next = { ...state.localUserOverrides, ...parsed.icons };
        saveStoredOverrides(next);
        return { localUserOverrides: next };
      });
      return true;
    } catch {
      return false;
    }
  },
}));

/**
 * React hook to resolve a single icon with live re-rendering on pack/override changes.
 */
export function useIcon(id: string): ResolvedIcon {
  const getResolvedIcon = useIconStore((state) => state.getResolvedIcon);
  // Subscribe to pack & local overrides to trigger re-render on mutation
  useIconStore((state) => state.globalCampaignPackId);
  useIconStore((state) => state.localUserOverrides[id]);

  return getResolvedIcon(id);
}
