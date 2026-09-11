import type { Camera } from '@/types/game';
import { useGameStore } from '@/stores/gameStore';

/**
 * Module-level live camera state (A3 — transient camera pan/zoom).
 *
 * This is a plain mutable module, NOT a Zustand store: writing to it never
 * triggers a React re-render. It exists so that pan/wheel-zoom gestures can
 * update the camera every animation frame without going through
 * `useGameStore.setState`, mirroring the A2 transient-drag pattern
 * (`useTransientDrag.ts`) applied to the camera instead of a token.
 *
 * Source-of-truth model:
 * - The Zustand store's `sceneState.camera` remains the AUTHORITATIVE,
 *   committed camera. It is what gets persisted, broadcast on commit, and
 *   read by every non-gesture consumer (toolbar positioning, drop-to-scene
 *   math, `screenToWorld`, etc).
 * - This ref is the source of truth ONLY *during* an active local pan/zoom
 *   gesture. SceneCanvas seeds it from the store at gesture start, mutates
 *   it imperatively on every move/wheel-tick, writes it to the DOM `<g>`
 *   transform directly (rAF-batched), and commits it back to the store
 *   exactly once at gesture end (see SceneCanvas's pan/wheel handlers).
 *
 * Fallback semantics: `get()` returns whatever was last `set()` on this
 * module. Since no gesture has ever run before the first camera-consuming
 * code executes, `get()` lazily falls back to the current store camera the
 * first time it's called with no prior `set()` — after that, the ref's own
 * value is authoritative for subsequent `get()` calls until the next
 * `sync()`/gesture reseed. This means non-gesture readers (e.g.
 * `useTransientDrag`'s mid-drag `screenToWorldLive` calls when no camera
 * gesture is running) still see a value consistent with the committed store
 * camera rather than a stale `{0,0,1}` default.
 */

let live: Camera | null = null;

function storeCamera(): Camera {
  return useGameStore.getState().sceneState.camera;
}

type Listener = (camera: Camera) => void;
const listeners = new Set<Listener>();

export const cameraRef = {
  /**
   * Returns the current live camera. Falls back to (and does not cache) the
   * store's camera if no gesture has ever seeded this ref yet, so callers
   * always get a value consistent with committed state when idle.
   */
  get(): Camera {
    return live ?? storeCamera();
  },

  /** Overwrite the live camera (partial update merges onto the current value). */
  set(update: Partial<Camera>): Camera {
    const base = live ?? storeCamera();
    live = { ...base, ...update };
    listeners.forEach((listener) => listener(live as Camera));
    return live;
  },

  /** Seed the ref from an explicit camera (typically the store camera at gesture start). */
  seed(camera: Camera): void {
    live = { ...camera };
  },

  /**
   * Clear the ref so the next `get()` falls back to reading the store fresh.
   * Called at gesture end after the commit, so the ref doesn't shadow store
   * updates that happen outside of gestures (Follow DM remote apply, scene
   * switch, etc).
   */
  reset(): void {
    live = null;
  },

  /** True if a gesture has seeded the ref and it hasn't been reset yet. */
  isLive(): boolean {
    return live !== null;
  },

  /** Subscribe to imperative live-camera writes (fires on every `set()`). */
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export type CameraRef = typeof cameraRef;
