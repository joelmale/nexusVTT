import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/stores/gameStore';
import type { PlacedToken } from '@/types/token';

/**
 * Tokens slice — narrow selector module over `scene.placedTokens`.
 *
 * Storage-shape choice (A4): ARRAY, not a keyed `Record<id, PlacedToken>`.
 * The brief's "simpler alternative" (constraint #3) is taken deliberately:
 * `placedTokens` is read and mutated by ~15 call sites across the event
 * handler registry (`token/place`, `token/move`, `token/update`,
 * `token/delete`, ~L683-830) and the action block (`placeToken`, `moveToken`,
 * `updateToken`, `deleteToken`, `moveTokenOptimistic` ~L3124, `getSceneTokens`
 * ~L2922), all as `Scene.placedTokens: PlacedToken[]`. Rekeying to a map
 * would require touching every one of those call sites plus the
 * `PendingUpdate`/rollback machinery (`localState: PlacedToken & {sceneId}`)
 * that the A2 optimistic-drag contract depends on — high blast radius for a
 * single packet. Per the brief, selector isolation (not storage shape) is
 * the actual exit criterion, and Immer already gives us that for free: a
 * write to `scenes[i].placedTokens[j]` produces new references for
 * `placedTokens` and that one token, while `scenes[i].gridSettings` /
 * `backgroundImage` / `drawings` keep prior identity. So a selector scoped
 * to a single token's fields is isolated from grid/background/drawing
 * writes on the same scene without any storage change.
 *
 * If a future packet needs O(1) token lookup by id at scale, layering a
 * `Map<id, index>` *index* (not a state relocation) alongside the array is
 * the lower-risk next step — see recommendations in the A4 handoff.
 */

function findToken(
  scenes: { id: string; placedTokens?: PlacedToken[] }[],
  sceneId: string | null,
  tokenId: string,
): PlacedToken | undefined {
  if (!sceneId) return undefined;
  const scene = scenes.find((s) => s.id === sceneId);
  return scene?.placedTokens?.find((t) => t.id === tokenId);
}

/**
 * useTokenPosition — subscribes only to a single token's position/rotation
 * within the ACTIVE scene. Required narrow selector per the A4 exit
 * criteria: a write to grid/background settings on the same scene must not
 * notify this selector's subscribers, and a position write to a DIFFERENT
 * token must not notify it either.
 *
 * Uses `useShallow` so the freshly-derived `{x, y, rotation}` object is
 * compared by value — subscribers only re-render when the token's own
 * position/rotation actually changes, not on every store update.
 */
export const useTokenPosition = (
  tokenId: string,
): { x: number; y: number; rotation: number } | null =>
  useGameStore(
    useShallow((state) => {
      const { scenes, activeSceneId } = state.sceneState;
      const token = findToken(scenes, activeSceneId, tokenId);
      if (!token) return null;
      return { x: token.x, y: token.y, rotation: token.rotation };
    }),
  );

/** Same as useTokenPosition but scoped to an explicit scene id. */
export const useTokenPositionInScene = (
  sceneId: string,
  tokenId: string,
): { x: number; y: number; rotation: number } | null =>
  useGameStore(
    useShallow((state) => {
      const token = findToken(state.sceneState.scenes, sceneId, tokenId);
      if (!token) return null;
      return { x: token.x, y: token.y, rotation: token.rotation };
    }),
  );

/** All placed tokens for a scene (array identity preserved by Immer — same as legacy usePlacedTokens). */
export const usePlacedTokensSlice = (sceneId: string): PlacedToken[] =>
  useGameStore((state) => {
    const scene = state.sceneState.scenes.find((s) => s.id === sceneId);
    return scene?.placedTokens || [];
  });
