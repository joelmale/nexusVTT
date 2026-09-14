import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AtlasDock } from './AtlasDock';
import * as useAtlasAssetsModule from '@/hooks/useAtlasAssets';
import type { AtlasAsset } from '@/hooks/atlasSources/types';

function makeAssets(count: number, source: AtlasAsset['source'] = 'library'): AtlasAsset[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${source}:${i}`,
    source,
    name: `Asset ${i}`,
    thumbnailUrl: `http://example.com/${i}.png`,
    resolveFullAsset: async () => `http://example.com/${i}-full.png`,
  }));
}

const baseHookReturn = {
  query: '',
  setQuery: vi.fn(),
  category: 'all',
  setCategory: vi.fn(),
  assets: [] as AtlasAsset[],
  loading: false,
  loadingMore: false,
  offlineSources: [] as string[],
  loadMore: vi.fn(),
  hasMore: false,
  libraryFacets: { categories: [], tags: [] },
  refresh: vi.fn(),
};

describe('AtlasDock virtualization + attribution (C6b)', () => {
  let observeSpy: ReturnType<typeof vi.fn>;
  let observerCallback: IntersectionObserverCallback | null;
  let originalIO: typeof IntersectionObserver;

  beforeEach(() => {
    // Ensure Portal has somewhere to render.
    if (!document.getElementById('portal-root')) {
      const portalRoot = document.createElement('div');
      portalRoot.id = 'portal-root';
      document.body.appendChild(portalRoot);
    }

    observeSpy = vi.fn();
    observerCallback = null;
    originalIO = global.IntersectionObserver;

    class FakeIntersectionObserver {
      constructor(cb: IntersectionObserverCallback) {
        observerCallback = cb;
      }
      observe = observeSpy;
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    global.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    global.IntersectionObserver = originalIO;
    vi.restoreAllMocks();
    document.getElementById('portal-root')?.remove();
  });

  it('renders a large result set (1000+ assets) using content-visibility cards without error', () => {
    const assets = makeAssets(1200);
    vi.spyOn(useAtlasAssetsModule, 'useAtlasAssets').mockReturnValue({
      ...baseHookReturn,
      assets,
      hasMore: true,
    });

    render(<AtlasDock />);

    // Cards are present in the DOM (uniform, content-visibility:auto lets the
    // browser skip layout/paint work for offscreen ones — jsdom doesn't
    // enforce that CSS behavior, so we assert the mechanism is wired: every
    // card carries contentVisibility:auto rather than being unmounted).
    const cards = document.querySelectorAll('[style*="content-visibility"]');
    expect(cards.length).toBe(1200);
    for (const card of Array.from(cards)) {
      expect((card as HTMLElement).style.contentVisibility).toBe('auto');
    }
  });

  it('renders a sentinel and calls loadMore when it intersects, while hasMore is true', () => {
    const loadMore = vi.fn();
    vi.spyOn(useAtlasAssetsModule, 'useAtlasAssets').mockReturnValue({
      ...baseHookReturn,
      assets: makeAssets(50),
      hasMore: true,
      loadMore,
    });

    render(<AtlasDock />);

    expect(observeSpy).toHaveBeenCalled();
    expect(observerCallback).not.toBeNull();

    act(() => {
      observerCallback!(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it('does not call loadMore when the sentinel intersects but hasMore is false', () => {
    const loadMore = vi.fn();
    vi.spyOn(useAtlasAssetsModule, 'useAtlasAssets').mockReturnValue({
      ...baseHookReturn,
      assets: makeAssets(50),
      hasMore: false,
      loadMore,
    });

    render(<AtlasDock />);

    act(() => {
      observerCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(loadMore).not.toHaveBeenCalled();
  });

  it('shows the Too Many Tokens attribution footer when library assets are present', () => {
    vi.spyOn(useAtlasAssetsModule, 'useAtlasAssets').mockReturnValue({
      ...baseHookReturn,
      assets: makeAssets(3, 'library'),
    });

    render(<AtlasDock />);

    expect(screen.getByText(/Too Many Tokens/i)).toBeTruthy();
    const link = screen.getByRole('link', { name: /Too Many Tokens/i });
    expect(link.getAttribute('href')).toBe('https://github.com/IsThisMyRealName/too-many-tokens-dnd');
  });

  it('does not show the attribution footer when no library assets are present', () => {
    vi.spyOn(useAtlasAssetsModule, 'useAtlasAssets').mockReturnValue({
      ...baseHookReturn,
      assets: makeAssets(3, 'maps'),
    });

    render(<AtlasDock />);

    expect(screen.queryByText(/Too Many Tokens/i)).toBeNull();
  });

  it('renders facet-derived category options for the Library source', () => {
    vi.spyOn(useAtlasAssetsModule, 'useAtlasAssets').mockReturnValue({
      ...baseHookReturn,
      assets: makeAssets(3, 'library'),
      libraryFacets: {
        categories: [{ name: 'Goblin', count: 42 }, { name: 'Ghoul', count: 12 }],
        tags: [],
      },
    });

    render(<AtlasDock />);

    expect(screen.getByRole('option', { name: /Goblin \(42\)/ })).toBeTruthy();
    expect(screen.getByRole('option', { name: /Ghoul \(12\)/ })).toBeTruthy();
  });
});
