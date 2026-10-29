import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearCatalogCache, useSrdCatalog } from './useSrdCatalog';

describe('useSrdCatalog', () => {
  beforeEach(() => {
    clearCatalogCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearCatalogCache();
  });

  it('fetches items for ruleset and caches results', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        entities: [
          {
            id: 'srd-1',
            ruleset: '2024',
            data: { name: 'Item One', category: 'weapon', rarity: 'common' },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useSrdCatalog('2024'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.catalog.length).toBe(1);
    expect(result.current.catalog[0].name).toBe('Item One');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second hook call should use cache without additional fetch
    const { result: secondResult } = renderHook(() => useSrdCatalog('2024'));
    expect(secondResult.current.catalog.length).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('handles errors and allows reloading', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          entities: [
            {
              id: 'srd-2',
              ruleset: '2024',
              data: { name: 'Recovered Item', category: 'armor', rarity: 'rare' },
            },
          ],
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useSrdCatalog('2024'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeDefined();

    // Trigger reload
    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.error).toBeUndefined();
    expect(result.current.catalog.length).toBe(1);
    expect(result.current.catalog[0].name).toBe('Recovered Item');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to bundled SRD items when server catalog returns empty entities array', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ entities: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useSrdCatalog('2024'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should NOT error with 'No items found in the 2024 catalog'
    expect(result.current.error).toBeUndefined();
    expect(result.current.isFallback).toBe(true);
    expect(result.current.catalog.length).toBeGreaterThan(10);
    expect(result.current.catalog.some((item) => item.name === 'Longsword')).toBe(true);
    expect(result.current.catalog.some((item) => item.name === 'Bag of Holding')).toBe(true);
  });

  it('allows manual recovery to bundled catalog via useFallbackCatalog when server is down', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useSrdCatalog('2024'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeDefined();

    act(() => {
      result.current.useFallbackCatalog();
    });

    expect(result.current.error).toBeUndefined();
    expect(result.current.isFallback).toBe(true);
    expect(result.current.catalog.length).toBeGreaterThan(10);
  });

  it('loads bundled catalog immediately without network calls when offlineOnly is true', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() =>
      useSrdCatalog('2024', { offlineOnly: true }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.error).toBeUndefined();
    expect(result.current.isFallback).toBe(true);
    expect(result.current.catalog.length).toBeGreaterThan(10);
  });

  it('gracefully falls back to bundled catalog on unauthenticated 401 response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useSrdCatalog('2024'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeUndefined();
    expect(result.current.isFallback).toBe(true);
    expect(result.current.catalog.length).toBeGreaterThan(10);
  });
});
