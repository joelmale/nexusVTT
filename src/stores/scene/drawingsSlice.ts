import { useGameStore } from '@/stores/gameStore';
import type { Drawing } from '@/types/game';

/**
 * Drawings slice — narrow selector module over `scene.drawings`. Storage
 * unchanged (inline array on `Scene`); see gridSlice.ts for the shared
 * rationale. `scene.drawings` gets a new array reference only when a
 * drawing on THAT scene is created/updated/deleted/cleared — sibling
 * fields (`placedTokens`, `gridSettings`, `backgroundImage`) are untouched
 * by Immer structural sharing, so this selector is isolated from
 * token/grid/background writes.
 */

/** All drawings for a scene, regardless of visibility (host view). */
export const useSceneDrawingsSlice = (sceneId: string): Drawing[] =>
  useGameStore((state) => {
    const scene = state.sceneState.scenes.find((s) => s.id === sceneId);
    return scene?.drawings || [];
  });

/** Drawings visible to the current user (host sees all; players filtered). */
export const useVisibleDrawingsSlice = (sceneId: string): Drawing[] =>
  useGameStore((state) => {
    const isHost = state.user.type === 'host';
    return state.getVisibleDrawings(sceneId, isHost);
  });
