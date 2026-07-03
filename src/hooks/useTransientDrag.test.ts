import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { useTransientDrag } from './useTransientDrag';
import { useGameStore } from '@/stores/gameStore';

/**
 * Proves the transient drag pattern's core contract:
 *   - zero store writes while the gesture is in progress (pointerdown..pointermove*)
 *   - exactly ONE store write, on pointerup
 *   - the final committed position matches the total pointer delta
 *
 * We subscribe directly to the real gameStore (not mocked) so the write
 * counter observes genuine `set()` calls, exactly as production code would.
 */

// jsdom does not implement the Pointer Capture API - stub it on the
// prototype so `target.setPointerCapture(...)` etc. don't throw.
beforeEach(() => {
  Object.defineProperty(Element.prototype, 'setPointerCapture', {
    value: vi.fn(),
    writable: true,
    configurable: true,
  });
  Object.defineProperty(Element.prototype, 'releasePointerCapture', {
    value: vi.fn(),
    writable: true,
    configurable: true,
  });
  Object.defineProperty(Element.prototype, 'hasPointerCapture', {
    value: vi.fn(() => false),
    writable: true,
    configurable: true,
  });

  // Run rAF callbacks synchronously so we don't need to wait a real frame.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const SVG_RECT = { left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 } as DOMRect;

interface HarnessProps {
  startX: number;
  startY: number;
  onCommit: (pos: { x: number; y: number }) => void;
  snapToGrid?: (pos: { x: number; y: number }) => { x: number; y: number };
}

/** Minimal harness mirroring TokenRenderer's SVG structure. */
const Harness: React.FC<HarnessProps> = ({ startX, startY, onCommit, snapToGrid }) => {
  const { onPointerDown } = useTransientDrag({
    getStartPosition: () => ({ x: startX, y: startY }),
    onCommit,
    snapToGrid,
  });

  return React.createElement(
    'svg',
    { 'data-testid': 'svg-root' },
    React.createElement('g', { className: 'scene-content' },
      React.createElement('g', {
        'data-testid': 'token',
        onPointerDown,
      }),
    ),
  );
};

function firePointerEvent(
  el: Element | Window,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  opts: { clientX: number; clientY: number; pointerId?: number },
) {
  const event = new Event(type, { bubbles: true, cancelable: true }) as unknown as PointerEvent;
  Object.assign(event, {
    clientX: opts.clientX,
    clientY: opts.clientY,
    pointerId: opts.pointerId ?? 1,
    button: 0,
  });
  el.dispatchEvent(event);
}

describe('useTransientDrag', () => {
  beforeEach(() => {
    // Reset camera to a known, simple value (zoom 1, centered at origin) so
    // screen deltas map 1:1 to world deltas for easy assertions.
    useGameStore.setState((state) => {
      state.sceneState.camera = { x: 0, y: 0, zoom: 1 };
    });
  });

  it('performs exactly ONE store write per gesture, with zero writes before pointerup', () => {
    let writeCount = 0;
    const unsubscribe = useGameStore.subscribe(() => {
      writeCount += 1;
    });

    const committed: Array<{ x: number; y: number }> = [];
    const onCommit = (pos: { x: number; y: number }) => {
      committed.push(pos);
      // Mirror real usage: the commit callback is what actually writes to
      // the store (e.g. moveTokenOptimistic). We do a trivial state write
      // here to simulate that single commit.
      useGameStore.setState((state) => {
        state.sceneState.camera = { ...state.sceneState.camera };
      });
    };

    const { getByTestId } = render(
      React.createElement(Harness, { startX: 100, startY: 100, onCommit }),
    );
    const svg = getByTestId('svg-root') as unknown as SVGSVGElement;
    const token = getByTestId('token');

    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue(SVG_RECT);

    // Baseline: reset counter after render-related store activity (there
    // should be none from rendering the harness, but be explicit).
    writeCount = 0;

    // pointerdown - starts the gesture, must not write to the store.
    firePointerEvent(token, 'pointerdown', { clientX: 200, clientY: 200 });
    expect(writeCount).toBe(0);

    // 5+ pointermoves - each should be rAF-batched imperative DOM writes
    // only, never a store write.
    const moves = [
      { clientX: 210, clientY: 205 },
      { clientX: 225, clientY: 215 },
      { clientX: 240, clientY: 230 },
      { clientX: 260, clientY: 250 },
      { clientX: 280, clientY: 270 },
      { clientX: 300, clientY: 290 },
    ];
    for (const move of moves) {
      firePointerEvent(window, 'pointermove', move);
      expect(writeCount).toBe(0);
    }

    // pointerup - the ONLY point at which a store write may occur.
    firePointerEvent(window, 'pointerup', { clientX: 300, clientY: 290 });

    expect(writeCount).toBe(1);
    expect(committed).toHaveLength(1);

    // Total screen delta was (300-200, 290-200) = (100, 90); at zoom 1 with
    // camera at origin, world delta == screen delta.
    expect(committed[0]).toEqual({ x: 200, y: 190 });

    unsubscribe();
  });

  it('applies grid snapping to the final committed position only', () => {
    const committed: Array<{ x: number; y: number }> = [];
    const snapToGrid = (pos: { x: number; y: number }) => ({
      x: Math.round(pos.x / 50) * 50,
      y: Math.round(pos.y / 50) * 50,
    });

    const { getByTestId } = render(
      React.createElement(Harness, {
        startX: 0,
        startY: 0,
        onCommit: (pos) => committed.push(pos),
        snapToGrid,
      }),
    );
    const svg = getByTestId('svg-root') as unknown as SVGSVGElement;
    const token = getByTestId('token');
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue(SVG_RECT);

    firePointerEvent(token, 'pointerdown', { clientX: 0, clientY: 0 });
    firePointerEvent(window, 'pointermove', { clientX: 60, clientY: 40 });
    firePointerEvent(window, 'pointerup', { clientX: 60, clientY: 40 });

    expect(committed).toHaveLength(1);
    expect(committed[0]).toEqual({ x: 50, y: 50 });
  });

  it('does not commit on pointercancel (aborted gesture)', () => {
    const onCommit = vi.fn();
    let writeCount = 0;
    const unsubscribe = useGameStore.subscribe(() => {
      writeCount += 1;
    });

    const { getByTestId } = render(
      React.createElement(Harness, { startX: 0, startY: 0, onCommit }),
    );
    const svg = getByTestId('svg-root') as unknown as SVGSVGElement;
    const token = getByTestId('token');
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue(SVG_RECT);

    writeCount = 0;
    firePointerEvent(token, 'pointerdown', { clientX: 0, clientY: 0 });
    firePointerEvent(window, 'pointermove', { clientX: 50, clientY: 50 });
    firePointerEvent(window, 'pointercancel', { clientX: 50, clientY: 50 });

    expect(onCommit).not.toHaveBeenCalled();
    expect(writeCount).toBe(0);

    unsubscribe();
  });
});
