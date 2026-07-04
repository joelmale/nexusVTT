/**
 * src/stores/scene — per-layer slice modules over gameStore's `sceneState`.
 *
 * A4 (roadmap packet): splits sceneState access into narrow, provably
 * isolated selectors mapping 1:1 onto render layers (ADR-0005):
 * camera, grid, background, drawings, tokens, props (+ reserved fog shape
 * for A9). See each slice file's header comment for the storage-shape
 * rationale (state stays in gameStore.ts; these are selector-isolation
 * boundaries, not a physical relocation of state or actions).
 *
 * All pre-existing hooks exported from gameStore.ts (useCamera,
 * useSceneState, usePlacedTokens, etc.) are UNCHANGED and remain the
 * canonical compat surface — nothing here replaces them. This module adds
 * NEW narrow selectors for consumers that want tighter subscriptions.
 */

export { useCamera as useCameraSlice, useUpdateCamera } from './cameraSlice';
export {
  useGridSettings,
  useSceneGridSettings,
  type GridSettings,
} from './gridSlice';
export {
  useBackgroundImage,
  useSceneBackgroundImage,
  type BackgroundImage,
} from './backgroundSlice';
export {
  useSceneDrawingsSlice,
  useVisibleDrawingsSlice,
} from './drawingsSlice';
export {
  useTokenPosition,
  useTokenPositionInScene,
  usePlacedTokensSlice,
  useTokenIdsSlice,
  useTokenRenderData,
  type TokenRenderData,
} from './tokensSlice';
export {
  usePropPosition,
  usePlacedPropsSlice,
  useVisiblePropsSlice,
  usePropIdsSlice,
  usePropRenderData,
  type PropRenderData,
} from './propsSlice';

/**
 * Reserved fog-of-war slice shape (populated in A9). Not yet backed by any
 * state — placeholder so A9 has a stable module to fill in without
 * re-touching this barrel's export list.
 */
export interface FogSliceReserved {
  __reserved: true;
}
