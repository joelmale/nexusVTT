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

// Stable fallback so the selector snapshot is referentially stable when the
// scene (or its token array) doesn't exist — returning a fresh `[]` on
// every snapshot read makes useSyncExternalStore loop ("The result of
// getSnapshot should be cached").
const EMPTY_TOKENS: PlacedToken[] = [];

/** All placed tokens for a scene (array identity preserved by Immer — same as legacy usePlacedTokens). */
export const usePlacedTokensSlice = (sceneId: string): PlacedToken[] =>
  useGameStore((state) => {
    const scene = state.sceneState.scenes.find((s) => s.id === sceneId);
    return scene?.placedTokens || EMPTY_TOKENS;
  });

/**
 * useTokenIdsSlice — stable list of placed-token ids for a scene, used to
 * drive `.map()` key iteration in the orchestrator (SceneCanvas) WITHOUT
 * subscribing to the full token records. Only changes on add/delete/reorder,
 * not on position/rotation/etc. writes to an individual token (Immer keeps
 * the ids the same string primitives, but the derived array itself is a new
 * reference each render if computed naively - `useShallow` on the id array
 * keeps this narrow: unless membership/order actually changes, this
 * selector's consumers don't re-render on a token move).
 */
export const useTokenIdsSlice = (sceneId: string): string[] =>
  useGameStore(
    useShallow((state) => {
      const scene = state.sceneState.scenes.find((s) => s.id === sceneId);
      return (scene?.placedTokens || []).map((t) => t.id);
    }),
  );

/**
 * useTokenRenderData — subscribes to every field TokenRenderer needs to
 * paint a single token: position/rotation (as useTokenPosition), plus scale,
 * dead/condition/visibility/ownership flags, and the underlying token
 * library id. Extends useTokenPosition's narrowness guarantee (isolated from
 * grid/background/drawing writes and from OTHER tokens' writes) to cover the
 * full prop surface TokenRenderer reads, so the per-token wrapper component
 * can drop the `placedToken` object prop entirely and self-subscribe.
 */
export interface TokenRenderData {
  x: number;
  y: number;
  rotation: number;
  scale: number;
  tokenId: string;
  isDead?: boolean;
  dmNotesOnly: boolean;
  visibleToPlayers: boolean;
  placedBy: string;
  conditions: PlacedToken['conditions'];
  nameOverride?: string;
}

export const useTokenRenderData = (
  placedTokenId: string,
): TokenRenderData | null =>
  useGameStore(
    useShallow((state) => {
      const { scenes, activeSceneId } = state.sceneState;
      const token = findToken(scenes, activeSceneId, placedTokenId);
      if (!token) return null;
      return {
        x: token.x,
        y: token.y,
        rotation: token.rotation,
        scale: token.scale,
        tokenId: token.tokenId,
        isDead: token.isDead,
        dmNotesOnly: token.dmNotesOnly,
        visibleToPlayers: token.visibleToPlayers,
        placedBy: token.placedBy,
        conditions: token.conditions,
        nameOverride: token.nameOverride,
      };
    }),
  );
