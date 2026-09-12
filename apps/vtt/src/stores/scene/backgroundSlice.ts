import { useGameStore } from '@/stores/gameStore';
import type { Scene } from '@/types/game';

export type BackgroundImage = Scene['backgroundImage'];

/**
 * Background slice — narrow selector module over the active scene's
 * `backgroundImage`. Storage unchanged (inline on `Scene`, see gridSlice.ts
 * for the shared rationale on why Immer gives us selector isolation for
 * free without relocating state).
 */

/**
 * useBackgroundImage — subscribes only to the ACTIVE scene's background
 * image config. Required narrow selector per the A4 exit criteria.
 */
export const useBackgroundImage = (): BackgroundImage | undefined =>
  useGameStore((state) => {
    const { scenes, activeSceneId } = state.sceneState;
    return scenes.find((s) => s.id === activeSceneId)?.backgroundImage;
  });

/** Same selector, but for an explicit scene id. */
export const useSceneBackgroundImage = (
  sceneId: string,
): BackgroundImage | undefined =>
  useGameStore((state) => {
    const scene = state.sceneState.scenes.find((s) => s.id === sceneId);
    return scene?.backgroundImage;
  });
