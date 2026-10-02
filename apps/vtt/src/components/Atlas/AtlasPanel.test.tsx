import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AtlasPanel } from './AtlasPanel';
import * as useAtlasAssetsModule from '@/hooks/useAtlasAssets';
import * as useDockToCanvasDragModule from '@/hooks/useDockToCanvasDrag';
import type { AtlasAsset } from '@/hooks/atlasSources/types';

function makeAssets(count: number, source: AtlasAsset['source'] = 'library'): AtlasAsset[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${source}:${i}`,
    source,
    name: `Asset ${i}`,
    thumbnailUrl: `http://example.com/${i}.png`,
    resolveFullAsset: async () => `http://example.com/${i}-full.png`,
    category: source === 'props' ? 'props' : 'tokens',
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

describe('AtlasPanel (Unified Tactical Asset Studio)', () => {
  let observeSpy: ReturnType<typeof vi.fn>;
  let observerCallback: IntersectionObserverCallback | null;
  let originalIO: typeof IntersectionObserver;

  beforeEach(() => {
    localStorage.clear();
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
    localStorage.clear();
  });

  it('renders search input, category chips, and density toggle controls', () => {
    const setQuery = vi.fn();
    const setCategory = vi.fn();
    vi.spyOn(useAtlasAssetsModule, 'useAtlasAssets').mockReturnValue({
      ...baseHookReturn,
      setQuery,
      setCategory,
    });

    render(<AtlasPanel />);

    expect(screen.getByPlaceholderText(/Search tactical assets/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Compact density/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Standard density/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Detailed density/i })).toBeInTheDocument();

    // Category pills (No maps!)
    expect(screen.getByRole('button', { name: /All/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /PCs/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Monsters/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Props/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Maps$/i })).toBeNull();
  });

  it('triggers search query and category updates on user interaction', () => {
    const setQuery = vi.fn();
    const setCategory = vi.fn();
    vi.spyOn(useAtlasAssetsModule, 'useAtlasAssets').mockReturnValue({
      ...baseHookReturn,
      query: 'dragon',
      setQuery,
      setCategory,
    });

    render(<AtlasPanel />);

    const searchInput = screen.getByPlaceholderText(/Search tactical assets/i);
    fireEvent.change(searchInput, { target: { value: 'goblin' } });
    expect(setQuery).toHaveBeenCalledWith('goblin');

    // Click clear search button
    const clearButton = screen.getByRole('button', { name: /Clear search/i });
    fireEvent.click(clearButton);
    expect(setQuery).toHaveBeenCalledWith('');

    // Click monster category pill
    const monsterPill = screen.getByRole('button', { name: /Monsters/i });
    fireEvent.click(monsterPill);
    expect(setCategory).toHaveBeenCalledWith('monster');
  });

  it('toggles grid density and persists setting to localStorage', () => {
    vi.spyOn(useAtlasAssetsModule, 'useAtlasAssets').mockReturnValue(baseHookReturn);

    render(<AtlasPanel />);

    const smallBtn = screen.getByRole('button', { name: /Compact density/i });
    fireEvent.click(smallBtn);
    expect(localStorage.getItem('nexus-atlas-density')).toBe('S');

    const largeBtn = screen.getByRole('button', { name: /Detailed density/i });
    fireEvent.click(largeBtn);
    expect(localStorage.getItem('nexus-atlas-density')).toBe('L');
  });

  it('pins an asset to the GM Stage Tray, persists it, and allows removing/clearing', () => {
    const assets = makeAssets(3, 'tokens');
    vi.spyOn(useAtlasAssetsModule, 'useAtlasAssets').mockReturnValue({
      ...baseHookReturn,
      assets,
    });

    render(<AtlasPanel />);

    // Stage tray should not be visible initially when empty
    expect(screen.queryByTestId('atlas-stage-tray')).toBeNull();

    // Pin first card
    const pinBtn = screen.getByRole('button', { name: `Pin ${assets[0].name}` });
    fireEvent.click(pinBtn);

    // Stage tray should now appear with 1 item
    const stageTray = screen.getByTestId('atlas-stage-tray');
    expect(stageTray).toBeInTheDocument();
    expect(screen.getByText(/Quick Stage Tray \(1\)/i)).toBeInTheDocument();
    expect(stageTray).toHaveTextContent(assets[0].name);
    expect(localStorage.getItem('nexus-atlas-staged-assets')).toContain(assets[0].id);

    // Remove from stage via individual remove button
    const removeBtn = screen.getByRole('button', { name: `Remove ${assets[0].name} from stage` });
    fireEvent.click(removeBtn);
    expect(screen.queryByTestId('atlas-stage-tray')).toBeNull();

    // Pin again and test Clear Tray
    fireEvent.click(pinBtn);
    expect(screen.getByTestId('atlas-stage-tray')).toBeInTheDocument();
    const clearTrayBtn = screen.getByRole('button', { name: /Clear all staged assets/i });
    fireEvent.click(clearTrayBtn);
    expect(screen.queryByTestId('atlas-stage-tray')).toBeNull();
  });

  it('virtualizes cards using content-visibility:auto (ADR-0008) and connects pagination sentinel', () => {
    const loadMore = vi.fn();
    const assets = makeAssets(50);
    vi.spyOn(useAtlasAssetsModule, 'useAtlasAssets').mockReturnValue({
      ...baseHookReturn,
      assets,
      hasMore: true,
      loadMore,
    });

    render(<AtlasPanel />);

    const cards = document.querySelectorAll('[style*="content-visibility"]');
    expect(cards.length).toBe(50);

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

  it('displays Too Many Tokens attribution footer when library assets exist', () => {
    vi.spyOn(useAtlasAssetsModule, 'useAtlasAssets').mockReturnValue({
      ...baseHookReturn,
      assets: makeAssets(2, 'library'),
    });

    render(<AtlasPanel />);

    expect(screen.getByText(/Too Many Tokens/i)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Too Many Tokens/i });
    expect(link.getAttribute('href')).toBe('https://github.com/IsThisMyRealName/too-many-tokens-dnd');
  });

  it('initiates drag gesture with useDockToCanvasDrag on pointer down', () => {
    const handlePointerDown = vi.fn();
    vi.spyOn(useDockToCanvasDragModule, 'useDockToCanvasDrag').mockReturnValue({
      isDragging: false,
      handlePointerDown,
      handlePointerMove: vi.fn(),
      handlePointerUp: vi.fn(),
      ghostImage: null,
      ghostPosition: null,
      overCanvas: false,
    });

    const assets = makeAssets(1, 'props');
    vi.spyOn(useAtlasAssetsModule, 'useAtlasAssets').mockReturnValue({
      ...baseHookReturn,
      assets,
    });

    render(<AtlasPanel />);

    const card = document.querySelector('[style*="content-visibility"]') as HTMLElement;
    fireEvent.pointerDown(card);

    expect(handlePointerDown).toHaveBeenCalled();
    const callArgs = handlePointerDown.mock.calls[0];
    expect(callArgs[1].category).toBe('props');
    expect(callArgs[1].id).toBe(assets[0].id);
  });

  it('renders library facets and allows selecting facet categories', () => {
    const setCategory = vi.fn();
    vi.spyOn(useAtlasAssetsModule, 'useAtlasAssets').mockReturnValue({
      ...baseHookReturn,
      libraryFacets: {
        categories: [{ name: 'Undead', count: 18 }],
        tags: [],
      },
      setCategory,
    });

    render(<AtlasPanel />);

    const facetBtn = screen.getByRole('button', { name: /Undead \(18\)/i });
    expect(facetBtn).toBeInTheDocument();
    fireEvent.click(facetBtn);
    expect(setCategory).toHaveBeenCalledWith('Undead');
  });

  it('allows dragging an item from the GM Stage Tray onto the canvas', () => {
    const handlePointerDown = vi.fn();
    vi.spyOn(useDockToCanvasDragModule, 'useDockToCanvasDrag').mockReturnValue({
      isDragging: false,
      handlePointerDown,
      handlePointerMove: vi.fn(),
      handlePointerUp: vi.fn(),
      ghostImage: null,
      ghostPosition: null,
      overCanvas: false,
    });

    const staged = [
      {
        id: 'tokens:staged-1',
        name: 'Staged Goblin',
        thumbnailUrl: 'http://example.com/staged.png',
        category: 'tokens' as const,
      },
    ];
    localStorage.setItem('nexus-atlas-staged-assets', JSON.stringify(staged));

    render(<AtlasPanel />);

    const stagedItem = screen.getByTitle(/Staged Goblin - Drag to place on canvas/i);
    expect(stagedItem).toBeInTheDocument();
    fireEvent.pointerDown(stagedItem);

    expect(handlePointerDown).toHaveBeenCalled();
    const callArgs = handlePointerDown.mock.calls[0];
    expect(callArgs[1].id).toBe('tokens:staged-1');
  });

  it('renders drag ghost image portal when dragging over canvas', () => {
    vi.spyOn(useDockToCanvasDragModule, 'useDockToCanvasDrag').mockReturnValue({
      isDragging: true,
      handlePointerDown: vi.fn(),
      handlePointerMove: vi.fn(),
      handlePointerUp: vi.fn(),
      ghostImage: 'http://example.com/ghost.png',
      ghostPosition: { x: 100, y: 150 },
      overCanvas: true,
    });

    render(<AtlasPanel />);

    const ghost = screen.getByAltText('ghost');
    expect(ghost).toBeInTheDocument();
    expect(ghost.getAttribute('src')).toBe('http://example.com/ghost.png');
  });
});
