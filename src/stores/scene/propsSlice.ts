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

// Stable fallback so the selector snapshot is referentially stable when the
// scene (or its prop array) doesn't exist — returning a fresh `[]` on every
// snapshot read makes useSyncExternalStore loop (mirrors EMPTY_TOKENS in
// tokensSlice.ts).
const EMPTY_PROPS: PlacedProp[] = [];

/** All placed props for a scene (array identity preserved by Immer — same as legacy usePlacedProps). */
export const usePlacedPropsSlice = (sceneId: string): PlacedProp[] =>
  useGameStore((state) => {
    const scene = state.sceneState.scenes.find((s) => s.id === sceneId);
    return scene?.placedProps || EMPTY_PROPS;
  });

/** Props visible to the current user (host sees all; players filtered). */
export const useVisiblePropsSlice = (sceneId: string): PlacedProp[] =>
  useGameStore((state) => {
    const isHost = state.user.type === 'host';
    return state.getVisibleProps(sceneId, isHost);
  });

/**
 * useIdsSlice — stable list of placed-prop ids for a scene (A5), mirroring
 * useTokenIdsSlice in tokensSlice.ts: drives `.map()` key iteration in the
 * orchestrator without subscribing to full prop records.
 */
export const usePropIdsSlice = (sceneId: string): string[] =>
  useGameStore(
    useShallow((state) => {
      const scene = state.sceneState.scenes.find((s) => s.id === sceneId);
      return (scene?.placedProps || []).map((p) => p.id);
    }),
  );

/**
 * usePropRenderData — subscribes to every field PropRenderer needs to paint
 * a single prop (A5), mirroring useTokenRenderData. Isolated from
 * grid/background/drawing writes and from other props' writes.
 */
export interface PropRenderData {
  x: number;
  y: number;
  rotation: number;
  scale: number;
  propId: string;
  width?: number;
  height?: number;
  visibleToPlayers: boolean;
  dmNotesOnly: boolean;
  revealed?: boolean;
  currentStats: PlacedProp['currentStats'];
  placedBy: string;
}

export const usePropRenderData = (placedPropId: string): PropRenderData | null =>
  useGameStore(
    useShallow((state) => {
      const { scenes, activeSceneId } = state.sceneState;
      const prop = findProp(scenes, activeSceneId, placedPropId);
      if (!prop) return null;
      return {
        x: prop.x,
        y: prop.y,
        rotation: prop.rotation,
        scale: prop.scale,
        propId: prop.propId,
        width: prop.width,
        height: prop.height,
        visibleToPlayers: prop.visibleToPlayers,
        dmNotesOnly: prop.dmNotesOnly,
        revealed: prop.revealed,
        currentStats: prop.currentStats,
        placedBy: prop.placedBy,
      };
    }),
  );
