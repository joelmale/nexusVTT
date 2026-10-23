import { useCallback, useState } from 'react';
import { create } from 'zustand';
import { useDeviceDetection } from '@/hooks/useDeviceDetection';
import {
  buildSimpleInviteUrl,
  isPlayerUiMode,
  readStoredUiMode,
  writeStoredUiMode,
  type PlayerUiMode,
} from '@/utils/simplePlayerMode';

export type { PlayerUiMode } from '@/utils/simplePlayerMode';
export type SimpleTabId = 'map' | 'hero' | 'rolls';

export const TABLET_SPLIT_MIN_WIDTH = 768;

export interface UseSimplePlayerModeOptions {
  /** Whether this client is the host (DM). Hosts default to full mode. */
  isHost: boolean;
  /**
   * False until the user's role is known (i.e. after joining). Auto-detection
   * waits for it so a DM on an iPad isn't flipped into simple mode.
   */
  roleKnown: boolean;
}

export interface UseSimplePlayerModeReturn {
  uiMode: PlayerUiMode;
  isSimpleMode: boolean;
  isTabletSplitView: boolean;
  canSplitView: boolean;
  activeTab: SimpleTabId;
  setActiveTab: (tab: SimpleTabId) => void;
  setUiMode: (mode: PlayerUiMode) => void;
  toggleUiMode: () => void;
  toggleTabletSplitView: () => void;
  buildSimpleInviteUrl: (roomCode: string) => string;
}

function readUrlMode(): PlayerUiMode | null {
  try {
    const mode = new URLSearchParams(window.location.search).get('mode');
    return isPlayerUiMode(mode) ? mode : null;
  } catch {
    return null;
  }
}

function prefersCoarsePointer(): boolean {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

/** URL parameter (persisted) beats the stored preference. */
function initialExplicitMode(): PlayerUiMode | null {
  const urlMode = readUrlMode();
  if (urlMode) {
    writeStoredUiMode(urlMode);
    return urlMode;
  }
  return readStoredUiMode();
}

interface UiModeState {
  /** An explicit choice (URL, stored, or toggled); null means auto-detect. */
  explicitMode: PlayerUiMode | null;
  setUiMode: (mode: PlayerUiMode) => void;
}

/**
 * Shared so the full VTT's "Simple Mode" button and the Simple Mode settings
 * sheet both flip the same switch that LinearGameLayout reads.
 */
export const useUiModeStore = create<UiModeState>()((set) => ({
  explicitMode: initialExplicitMode(),
  setUiMode: (mode) => {
    writeStoredUiMode(mode);
    set({ explicitMode: mode });
  },
}));

/** Re-reads URL and storage; for tests and fresh page loads. */
export function resetUiModeStore(): void {
  useUiModeStore.setState({ explicitMode: initialExplicitMode() });
}

/**
 * Resolves Simple Player Mode vs the full VTT.
 *
 * Precedence: `?mode=` URL parameter (persisted) > stored preference >
 * auto-detect. Auto-detect picks simple mode only for non-host players on a
 * coarse (touch) pointer; a width cutoff alone would miss iPads in landscape.
 */
export function useSimplePlayerMode({
  isHost,
  roleKnown,
}: UseSimplePlayerModeOptions): UseSimplePlayerModeReturn {
  const { viewport } = useDeviceDetection();
  const canSplitView = viewport.width >= TABLET_SPLIT_MIN_WIDTH;

  const explicitMode = useUiModeStore((s) => s.explicitMode);
  const setUiMode = useUiModeStore((s) => s.setUiMode);
  const [activeTab, setActiveTab] = useState<SimpleTabId>('map');
  const [splitPreferred, setSplitPreferred] = useState(true);

  const autoMode: PlayerUiMode =
    roleKnown && !isHost && prefersCoarsePointer() ? 'simple' : 'full';
  const uiMode = explicitMode ?? autoMode;

  const toggleUiMode = useCallback(() => {
    setUiMode(uiMode === 'simple' ? 'full' : 'simple');
  }, [setUiMode, uiMode]);

  const toggleTabletSplitView = useCallback(() => {
    setSplitPreferred((value) => !value);
  }, []);

  // A docked split view always shows the map, so its side panel falls back to
  // the hero tab when "map" is selected.
  const isTabletSplitView = canSplitView && splitPreferred;
  const effectiveTab: SimpleTabId =
    isTabletSplitView && activeTab === 'map' ? 'hero' : activeTab;

  return {
    uiMode,
    isSimpleMode: uiMode === 'simple',
    isTabletSplitView,
    canSplitView,
    activeTab: effectiveTab,
    setActiveTab,
    setUiMode,
    toggleUiMode,
    toggleTabletSplitView,
    buildSimpleInviteUrl: (roomCode: string) => buildSimpleInviteUrl(roomCode),
  };
}
