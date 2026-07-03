import { useGameStore } from '@/stores/gameStore';
import type { Camera } from '@/types/game';

/**
 * Camera slice — narrow selector module over `sceneState.camera`.
 *
 * Storage-shape note (A4): the camera continues to live at
 * `state.sceneState.camera` inside the monolithic gameStore, and
 * `updateCamera` continues to be the single mutating action (unchanged —
 * A2/A3's `cameraRef.ts` and `cameraGestureEngine.ts` call
 * `useGameStore.getState().sceneState.camera` / `updateCamera()` directly
 * and must keep working byte-for-byte). This module does not relocate that
 * state; it exposes a selector-isolation boundary on top of it so
 * components can subscribe to just the camera without also re-rendering on
 * unrelated sceneState writes that don't touch `camera` itself.
 *
 * Isolation mechanism: gameStore uses the Immer middleware, so a `set()`
 * that mutates e.g. `state.sceneState.scenes[i].placedTokens[j].x` produces
 * new references for `scenes`, `scenes[i]`, and `scenes[i].placedTokens`,
 * but leaves `state.sceneState.camera` referentially untouched (Immer
 * structural sharing). A selector that reads only `state.sceneState.camera`
 * therefore does not re-fire on token/grid/drawing writes, and vice versa.
 */

/** Narrow camera selector — identical value/semantics to the legacy `useCamera`. */
export const useCamera = (): Camera =>
  useGameStore((state) => state.sceneState.camera);

/** Compat re-export of the camera mutation action (unchanged signature). */
export const useUpdateCamera = () =>
  useGameStore((state) => state.updateCamera);
