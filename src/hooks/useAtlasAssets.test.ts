import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAtlasAssets } from './useAtlasAssets';
import { CodexSourceAdapter } from './atlasSources/codex';
import { MapsSourceAdapter } from './atlasSources/maps';
import { TokensSourceAdapter } from './atlasSources/tokens';
import { PropsSourceAdapter } from './atlasSources/props';

const emptyResult = { assets: [], hasMore: false, total: 0 };

describe('useAtlasAssets lazy fetch (ADR-0009)', () => {
  let listSpies: ReturnType<typeof vi.spyOn>[];

  beforeEach(() => {
    vi.useFakeTimers();
    listSpies = [
      vi.spyOn(CodexSourceAdapter.prototype, 'list').mockResolvedValue(emptyResult),
      vi.spyOn(MapsSourceAdapter.prototype, 'list').mockResolvedValue(emptyResult),
      vi.spyOn(TokensSourceAdapter.prototype, 'list').mockResolvedValue(emptyResult),
      vi.spyOn(PropsSourceAdapter.prototype, 'list').mockResolvedValue(emptyResult),
    ];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not fetch when enabled is false', async () => {
    renderHook(() => useAtlasAssets({ enabled: false }));

    // Advance well past the 250ms debounce window.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    for (const spy of listSpies) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it('fetches after enabled flips from false to true', async () => {
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useAtlasAssets({ enabled }),
      { initialProps: { enabled: false } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    for (const spy of listSpies) {
      expect(spy).not.toHaveBeenCalled();
    }

    rerender({ enabled: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    for (const spy of listSpies) {
      expect(spy).toHaveBeenCalled();
    }
  });

  it('defaults to enabled (back-compat) when no options are passed', async () => {
    renderHook(() => useAtlasAssets());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    for (const spy of listSpies) {
      expect(spy).toHaveBeenCalled();
    }
  });
});
