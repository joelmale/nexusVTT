import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cameraRef } from './cameraRef';
import { useGameStore } from '@/stores/gameStore';

describe('cameraRef', () => {
  beforeEach(() => {
    useGameStore.setState((state) => {
      state.sceneState.camera = { x: 0, y: 0, zoom: 0.54 };
    });
    cameraRef.reset();
  });

  afterEach(() => {
    cameraRef.reset();
  });

  it('falls back to the store camera when never seeded', () => {
    expect(cameraRef.isLive()).toBe(false);
    expect(cameraRef.get()).toEqual({ x: 0, y: 0, zoom: 0.54 });
  });

  it('falls back to a fresh store read every time while idle (not cached)', () => {
    expect(cameraRef.get()).toEqual({ x: 0, y: 0, zoom: 0.54 });

    useGameStore.setState((state) => {
      state.sceneState.camera = { x: 10, y: 20, zoom: 1 };
    });

    // Still not seeded/live - get() should reflect the new store value.
    expect(cameraRef.isLive()).toBe(false);
    expect(cameraRef.get()).toEqual({ x: 10, y: 20, zoom: 1 });
  });

  it('seed() makes the ref live and independent of the store', () => {
    cameraRef.seed({ x: 1, y: 2, zoom: 2 });
    expect(cameraRef.isLive()).toBe(true);
    expect(cameraRef.get()).toEqual({ x: 1, y: 2, zoom: 2 });

    // Store changes no longer affect get() while live.
    useGameStore.setState((state) => {
      state.sceneState.camera = { x: 999, y: 999, zoom: 999 };
    });
    expect(cameraRef.get()).toEqual({ x: 1, y: 2, zoom: 2 });
  });

  it('set() merges a partial update onto the current (or store-fallback) value', () => {
    // Not seeded yet - set() should merge onto the store camera.
    cameraRef.set({ zoom: 2 });
    expect(cameraRef.get()).toEqual({ x: 0, y: 0, zoom: 2 });
    expect(cameraRef.isLive()).toBe(true);

    cameraRef.set({ x: 5 });
    expect(cameraRef.get()).toEqual({ x: 5, y: 0, zoom: 2 });
  });

  it('reset() clears the live value so get() falls back to the store again', () => {
    cameraRef.seed({ x: 1, y: 1, zoom: 1 });
    expect(cameraRef.isLive()).toBe(true);

    cameraRef.reset();
    expect(cameraRef.isLive()).toBe(false);
    expect(cameraRef.get()).toEqual({ x: 0, y: 0, zoom: 0.54 });
  });

  it('subscribe() notifies listeners on every set(), not on seed()/reset()', () => {
    const seen: Array<{ x: number; y: number; zoom: number }> = [];
    const unsubscribe = cameraRef.subscribe((camera) => seen.push(camera));

    cameraRef.seed({ x: 0, y: 0, zoom: 1 });
    expect(seen).toHaveLength(0);

    cameraRef.set({ zoom: 1.5 });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual({ x: 0, y: 0, zoom: 1.5 });

    cameraRef.set({ x: 3 });
    expect(seen).toHaveLength(2);

    cameraRef.reset();
    expect(seen).toHaveLength(2);

    unsubscribe();
    cameraRef.set({ x: 10 });
    expect(seen).toHaveLength(2);
  });
});
