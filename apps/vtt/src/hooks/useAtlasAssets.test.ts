import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAtlasAssets } from './useAtlasAssets';
import { CodexSourceAdapter } from './atlasSources/codex';
import { MapsSourceAdapter } from './atlasSources/maps';
import { TokensSourceAdapter } from './atlasSources/tokens';
import { PropsSourceAdapter } from './atlasSources/props';
import { LibrarySourceAdapter } from './atlasSources/library';

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
      vi.spyOn(LibrarySourceAdapter.prototype, 'list').mockResolvedValue(emptyResult),
    ];
    vi.spyOn(LibrarySourceAdapter.prototype, 'fetchFacets').mockResolvedValue({
      categories: [],
      tags: [],
    });
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

  it('registers the Library source adapter', async () => {
    renderHook(() => useAtlasAssets());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    const librarySpy = listSpies[4];
    expect(librarySpy).toHaveBeenCalled();
  });
});

describe('useAtlasAssets loadMore (C6b)', () => {
  const page1Asset = {
    id: 'maps:page1',
    source: 'maps' as const,
    name: 'Page 1 Asset',
    thumbnailUrl: 'http://example.com/1.png',
    resolveFullAsset: async () => 'http://example.com/1-full.png',
  };
  const page2Asset = {
    id: 'maps:page2',
    source: 'maps' as const,
    name: 'Page 2 Asset',
    thumbnailUrl: 'http://example.com/2.png',
    resolveFullAsset: async () => 'http://example.com/2-full.png',
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(CodexSourceAdapter.prototype, 'list').mockResolvedValue(emptyResult);
    vi.spyOn(TokensSourceAdapter.prototype, 'list').mockResolvedValue(emptyResult);
    vi.spyOn(PropsSourceAdapter.prototype, 'list').mockResolvedValue(emptyResult);
    vi.spyOn(LibrarySourceAdapter.prototype, 'list').mockResolvedValue(emptyResult);
    vi.spyOn(LibrarySourceAdapter.prototype, 'fetchFacets').mockResolvedValue({
      categories: [],
      tags: [],
    });

    vi.spyOn(MapsSourceAdapter.prototype, 'list')
      .mockResolvedValueOnce({ assets: [page1Asset], hasMore: true, total: 2 })
      .mockResolvedValueOnce({ assets: [page2Asset], hasMore: false, total: 2 });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('appends a second page when loadMore is called and reports hasMore correctly', async () => {
    const { result } = renderHook(() => useAtlasAssets());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(result.current.assets.map(a => a.id)).toEqual(['maps:page1']);
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.assets.map(a => a.id)).toEqual(['maps:page1', 'maps:page2']);
    expect(result.current.hasMore).toBe(false);
  });
});
