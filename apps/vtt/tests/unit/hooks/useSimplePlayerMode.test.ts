import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resetUiModeStore,
  useSimplePlayerMode,
} from '@/hooks/useSimplePlayerMode';
import { UI_MODE_STORAGE_KEY } from '@/utils/simplePlayerMode';

const viewport = vi.hoisted(() => ({ width: 390, height: 844 }));
vi.mock('@/hooks/useDeviceDetection', () => ({
  useDeviceDetection: () => ({ viewport }),
}));

function setCoarsePointer(coarse: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(pointer: coarse)' ? coarse : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function setUrl(search: string) {
  window.history.replaceState({}, '', `/lobby/game/ABCD${search}`);
}

// The mode store reads URL/storage when (re)initialised, so each render
// starts from the state the test just arranged.
const renderModeHook: typeof renderHook = (callback, options) => {
  resetUiModeStore();
  return renderHook(callback, options);
};

describe('useSimplePlayerMode', () => {
  beforeEach(() => {
    localStorage.clear();
    setUrl('');
    viewport.width = 390;
    setCoarsePointer(true);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('auto-selects simple mode for a player on a touch device', () => {
    const { result } = renderModeHook(() =>
      useSimplePlayerMode({ isHost: false, roleKnown: true }),
    );
    expect(result.current.uiMode).toBe('simple');
    expect(result.current.isSimpleMode).toBe(true);
  });

  it('keeps hosts in full mode on touch devices', () => {
    const { result } = renderModeHook(() =>
      useSimplePlayerMode({ isHost: true, roleKnown: true }),
    );
    expect(result.current.uiMode).toBe('full');
  });

  it('keeps players on a fine pointer in full mode', () => {
    setCoarsePointer(false);
    const { result } = renderModeHook(() =>
      useSimplePlayerMode({ isHost: false, roleKnown: true }),
    );
    expect(result.current.uiMode).toBe('full');
  });

  it('does not auto-detect before the role is known', () => {
    const { result, rerender } = renderModeHook(
      (props: { roleKnown: boolean }) =>
        useSimplePlayerMode({ isHost: false, roleKnown: props.roleKnown }),
      { initialProps: { roleKnown: false } },
    );
    expect(result.current.uiMode).toBe('full');
    rerender({ roleKnown: true });
    expect(result.current.uiMode).toBe('simple');
  });

  it('treats matchMedia failures as a fine pointer', () => {
    window.matchMedia = vi.fn(() => {
      throw new Error('unsupported');
    }) as unknown as typeof window.matchMedia;
    const { result } = renderModeHook(() =>
      useSimplePlayerMode({ isHost: false, roleKnown: true }),
    );
    expect(result.current.uiMode).toBe('full');
  });

  it('lets the URL parameter win and persists it', () => {
    localStorage.setItem(UI_MODE_STORAGE_KEY, 'simple');
    setUrl('?mode=full');
    const { result } = renderModeHook(() =>
      useSimplePlayerMode({ isHost: false, roleKnown: true }),
    );
    expect(result.current.uiMode).toBe('full');
    expect(localStorage.getItem(UI_MODE_STORAGE_KEY)).toBe('full');
  });

  it('ignores an unknown URL mode', () => {
    setUrl('?mode=weird');
    const { result } = renderModeHook(() =>
      useSimplePlayerMode({ isHost: true, roleKnown: true }),
    );
    expect(result.current.uiMode).toBe('full');
  });

  it('uses the stored preference over auto-detection', () => {
    localStorage.setItem(UI_MODE_STORAGE_KEY, 'simple');
    const { result } = renderModeHook(() =>
      useSimplePlayerMode({ isHost: true, roleKnown: true }),
    );
    expect(result.current.uiMode).toBe('simple');
  });

  it('switches and persists modes', () => {
    const { result } = renderModeHook(() =>
      useSimplePlayerMode({ isHost: false, roleKnown: true }),
    );
    act(() => result.current.toggleUiMode());
    expect(result.current.uiMode).toBe('full');
    expect(localStorage.getItem(UI_MODE_STORAGE_KEY)).toBe('full');
    act(() => result.current.setUiMode('simple'));
    expect(result.current.uiMode).toBe('simple');
  });

  it('survives storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderModeHook(() =>
      useSimplePlayerMode({ isHost: false, roleKnown: true }),
    );
    act(() => result.current.setUiMode('full'));
    expect(result.current.uiMode).toBe('full');
  });

  it('only offers split view on wide screens and lets it toggle', () => {
    const phone = renderModeHook(() =>
      useSimplePlayerMode({ isHost: false, roleKnown: true }),
    );
    expect(phone.result.current.canSplitView).toBe(false);
    expect(phone.result.current.isTabletSplitView).toBe(false);
    expect(phone.result.current.activeTab).toBe('map');

    viewport.width = 1024;
    const tablet = renderModeHook(() =>
      useSimplePlayerMode({ isHost: false, roleKnown: true }),
    );
    expect(tablet.result.current.isTabletSplitView).toBe(true);
    // The docked panel never shows the map tab.
    expect(tablet.result.current.activeTab).toBe('hero');

    act(() => tablet.result.current.toggleTabletSplitView());
    expect(tablet.result.current.isTabletSplitView).toBe(false);
    act(() => tablet.result.current.setActiveTab('rolls'));
    expect(tablet.result.current.activeTab).toBe('rolls');
  });

  it('builds the invite URL', () => {
    const { result } = renderModeHook(() =>
      useSimplePlayerMode({ isHost: true, roleKnown: true }),
    );
    expect(result.current.buildSimpleInviteUrl('wxyz')).toBe(
      `${window.location.origin}/play/WXYZ`,
    );
  });
});
