import { useGameStore } from '@/stores/gameStore';
import type { SceneFog } from '@/types/fog';

/**
 * Fog slice — narrow selector module over `scene.fog` (A9). Storage
 * unchanged (inline optional field on `Scene`); see gridSlice.ts /
 * drawingsSlice.ts for the shared rationale. `scene.fog` gets a new object
 * reference only when fog on THAT scene is toggled/painted/cleared — sibling
 * fields (`placedTokens`, `drawings`, `gridSettings`, `backgroundImage`) are
 * untouched by Immer structural sharing, so this selector is isolated from
 * token/drawing/grid/background writes (same isolation guarantee as A4).
 *
 * Wire contract: fog mutations (`fog/update`, `fog/clear`) always ship the
 * COMPLETE `SceneFog` (full-state replace, not incremental) — see
 * gameStore's `'fog/update'` / `'fog/clear'` event handlers and the
 * `setFogEnabled` / `addFogShape` / `clearFog` actions.
 */

// Stable fallback so the selector snapshot is referentially stable when the
// scene doesn't exist or has no fog configured — returning a fresh object on
// every snapshot read makes useSyncExternalStore loop ("The result of
// getSnapshot should be cached"), mirroring EMPTY_TOKENS/EMPTY_DRAWINGS.
const EMPTY_FOG: SceneFog | null = null;

/**
 * useSceneFog — the scene's fog config (enabled flag + reveal shapes), or
 * `null` when the scene doesn't exist or has no fog configured yet. No
 * useShallow needed: `scene.fog` is read directly (not derived/filtered per
 * call), so Immer's structural sharing already gives referential stability
 * across unrelated writes.
 */
export const useSceneFog = (sceneId: string): SceneFog | null =>
  useGameStore((state) => {
    const scene = state.sceneState.scenes.find((s) => s.id === sceneId);
    return scene?.fog ?? EMPTY_FOG;
  });
