import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useSceneDrawings,
  useVisibleDrawings,
  usePlacedTokens,
  usePlacedProps,
  useVisibleProps,
} from '@/stores/gameStore';
import { useVisibleDrawingsSlice, useSceneDrawingsSlice } from './drawingsSlice';
import { useVisiblePropsSlice, usePlacedPropsSlice } from './propsSlice';
import { usePlacedTokensSlice } from './tokensSlice';

/**
 * Regression guard for the useSyncExternalStore snapshot-stability bug class
 * (S8: intermittent UI hangs — "The result of getSnapshot should be cached").
 *
 * A selector must return a REFERENTIALLY STABLE value when the underlying
 * state hasn't changed. Two failure shapes existed:
 *  - `scene?.x || []` — a fresh empty array per snapshot read whenever the
 *    scene id is (transiently) missing, e.g. during join/scene-switch;
 *  - `state.getVisibleX(...)` — a fresh `.filter()` array on EVERY read.
 * Either makes React's useSyncExternalStore re-render in a loop → hang.
 */
const MISSING_SCENE = 'no-such-scene-id';

const hooks: Array<[string, (sceneId: string) => unknown]> = [
  ['useSceneDrawings (legacy)', useSceneDrawings],
  ['useVisibleDrawings (legacy)', useVisibleDrawings],
  ['usePlacedTokens (legacy)', usePlacedTokens],
  ['usePlacedProps (legacy)', usePlacedProps],
  ['useVisibleProps (legacy)', useVisibleProps],
  ['useSceneDrawingsSlice', useSceneDrawingsSlice],
  ['useVisibleDrawingsSlice', useVisibleDrawingsSlice],
  ['usePlacedTokensSlice', usePlacedTokensSlice],
  ['usePlacedPropsSlice', usePlacedPropsSlice],
  ['useVisiblePropsSlice', useVisiblePropsSlice],
];

describe('selector snapshot stability (missing-scene fallback path)', () => {
  it.each(hooks)('%s returns a stable reference across rerenders', (_name, hook) => {
    const { result, rerender } = renderHook(() => hook(MISSING_SCENE));
    const first = result.current;
    rerender();
    rerender();
    expect(result.current).toBe(first);
  });
});
