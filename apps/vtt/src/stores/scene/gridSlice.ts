import { useGameStore } from '@/stores/gameStore';
import type { Scene } from '@/types/game';

export type GridSettings = Scene['gridSettings'];

/**
 * Grid slice — narrow selector module over the active scene's `gridSettings`.
 *
 * Storage-shape note (A4): grid settings continue to live inline on each
 * `Scene` in `state.sceneState.scenes[]` (unchanged — the persisted JSON
 * shape and every mutating action, e.g. `updateGridSettings`, are untouched
 * by this packet). This module adds a selector-isolation boundary: because
 * gameStore uses Immer, a write to `scenes[i].gridSettings` produces a new
 * reference *only* for that scene's `gridSettings` object (and its
 * ancestors up to the array), while sibling fields on the same scene
 * (`placedTokens`, `drawings`, `backgroundImage`, ...) keep their prior
 * object identity. A selector that reads only `scene.gridSettings` will not
 * re-fire on a token move / drawing update to the same scene.
 */

/**
 * useGridSettings — subscribes only to the ACTIVE scene's grid settings.
 * Required narrow selector per the A4 exit criteria: writing a token
 * position must not notify this selector's subscribers.
 */
export const useGridSettings = (): GridSettings | undefined =>
  useGameStore((state) => {
    const { scenes, activeSceneId } = state.sceneState;
    return scenes.find((s) => s.id === activeSceneId)?.gridSettings;
  });

/** Same selector, but for an explicit scene id (used by non-active-scene UI, e.g. scene browser thumbnails). */
export const useSceneGridSettings = (
  sceneId: string,
): GridSettings | undefined =>
  useGameStore((state) => {
    const scene = state.sceneState.scenes.find((s) => s.id === sceneId);
    return scene?.gridSettings;
  });
