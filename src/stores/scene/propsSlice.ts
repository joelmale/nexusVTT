import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/stores/gameStore';
import type { PlacedProp } from '@/types/game';

/**
 * Props slice — narrow selector module over `scene.placedProps`. Storage
 * choice mirrors tokensSlice.ts: kept as an array (see that file's header
 * comment for the full rationale — same call-site blast radius applies to
 * `placeProp`/`moveProp`/`updateProp`/`deleteProp` and the prop branches of
 * the optimistic-update/rollback machinery).
 */

function findProp(
  scenes: { id: string; placedProps?: PlacedProp[] }[],
  sceneId: string | null,
  propId: string,
): PlacedProp | undefined {
  if (!sceneId) return undefined;
  const scene = scenes.find((s) => s.id === sceneId);
  return scene?.placedProps?.find((p) => p.id === propId);
}

/** Subscribes only to a single prop's position/rotation within the ACTIVE scene. */
export const usePropPosition = (
  propId: string,
): { x: number; y: number; rotation: number } | null =>
  useGameStore(
    useShallow((state) => {
      const { scenes, activeSceneId } = state.sceneState;
      const prop = findProp(scenes, activeSceneId, propId);
      if (!prop) return null;
      return { x: prop.x, y: prop.y, rotation: prop.rotation };
    }),
  );

/** All placed props for a scene (array identity preserved by Immer — same as legacy usePlacedProps). */
export const usePlacedPropsSlice = (sceneId: string): PlacedProp[] =>
  useGameStore((state) => {
    const scene = state.sceneState.scenes.find((s) => s.id === sceneId);
    return scene?.placedProps || [];
  });

/** Props visible to the current user (host sees all; players filtered). */
export const useVisiblePropsSlice = (sceneId: string): PlacedProp[] =>
  useGameStore((state) => {
    const isHost = state.user.type === 'host';
    return state.getVisibleProps(sceneId, isHost);
  });
