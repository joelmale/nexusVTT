import React from 'react';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Child layers are irrelevant to input routing; stub them so the canvas can
// mount in jsdom without canvas/asset dependencies.
vi.mock('@/components/Scene/SceneGrid', () => ({ SceneGrid: () => null }));
vi.mock('@/components/Scene/SceneBackground', () => ({
  SceneBackground: () => null,
}));
vi.mock('@/components/Scene/DrawingTools', () => ({
  DrawingTools: () => null,
}));
vi.mock('@/components/Scene/RemoteCursors', () => ({
  RemoteCursors: () => null,
}));
vi.mock('@/components/Scene/DrawingRenderer', () => ({
  DrawingRenderer: () => null,
}));
vi.mock('@/components/Scene/SelectionOverlay', () => ({
  SelectionOverlay: () => null,
}));
vi.mock('@/components/Scene/DrawingPropertiesPanel', () => ({
  DrawingPropertiesPanel: () => null,
}));
vi.mock('@/components/Scene/SpellOverlayPropertiesPanel', () => ({
  SpellOverlayPropertiesPanel: () => null,
}));
vi.mock('@/components/Scene/SpellOverlayPatterns', () => ({
  SpellOverlayPatterns: () => null,
}));
vi.mock('@/components/Scene/CanvasInkLayer', () => ({
  CanvasInkLayer: () => null,
}));
vi.mock('@/components/Scene/FogLayer', () => ({ FogLayer: () => null }));
vi.mock('@/components/Scene/inkHitTest', () => ({
  createHitTestContext: () => ({}),
  hitTestDrawings: () => null,
}));
vi.mock('@/components/Scene/TokenRenderer', () => ({
  TokenRenderer: () => null,
}));
vi.mock('@/components/Scene/PropRenderer', () => ({
  PropRenderer: () => null,
}));
vi.mock('@/components/Props/PropToolbar', () => ({ PropToolbar: () => null }));
vi.mock('@/components/Scene/TokenDropZone', () => ({
  TokenDropZone: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));
vi.mock('@/services/websocket', () => ({
  webSocketService: {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    sendEvent: vi.fn(),
  },
}));
vi.mock('@/services/tokenAssets', () => ({
  tokenAssetManager: {
    initialize: vi.fn().mockResolvedValue(undefined),
    refreshCustomizations: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('@/services/propAssets', () => ({
  propAssetManager: {
    initialize: vi.fn().mockResolvedValue(undefined),
    refreshCustomLibraries: vi.fn().mockResolvedValue(undefined),
    getPropById: vi.fn(),
  },
}));

import { SceneCanvas } from '@/components/Scene/SceneCanvas';
import { useGameStore } from '@/stores/gameStore';
import { sceneUtils } from '@/utils/sceneUtils';
import type { Scene } from '@/types/game';

function makeScene(): Scene {
  return {
    ...sceneUtils.createDefaultScene('Test', 'host1'),
    id: 'scene-1',
    roomCode: 'ABCD',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  } as Scene;
}

function touchEvent(
  type: 'touchstart' | 'touchmove' | 'touchend',
  points: Array<{ x: number; y: number }>,
): TouchEvent {
  const touches = points.map(
    (p, i) => ({ identifier: i, clientX: p.x, clientY: p.y }) as Touch,
  );
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', { value: touches });
  return event as TouchEvent;
}

function getSvg(container: HTMLElement): SVGSVGElement {
  const svg = container.querySelector('[data-role="scene-canvas-root"]');
  if (!svg) throw new Error('scene canvas root not rendered');
  return svg as SVGSVGElement;
}

describe('SceneCanvas interactionProfile', () => {
  beforeEach(() => {
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    useGameStore.setState((state) => {
      state.user.id = 'p1';
      state.user.type = 'player';
      state.sceneState.followDM = false;
      state.sceneState.activeTool = 'select';
      state.sceneState.camera = { x: 0, y: 0, zoom: 1 };
    });
  });

  it('default profile leaves single-finger touches to the browser', () => {
    const onSceneTap = vi.fn();
    const { container } = render(
      <SceneCanvas scene={makeScene()} onSceneTap={onSceneTap} />,
    );
    const svg = getSvg(container);
    const start = touchEvent('touchstart', [{ x: 100, y: 100 }]);
    svg.dispatchEvent(start);
    svg.dispatchEvent(touchEvent('touchend', []));

    expect(start.defaultPrevented).toBe(false);
    expect(onSceneTap).not.toHaveBeenCalled();
    expect(
      container.querySelector('#tokens-layer')?.getAttribute('pointer-events'),
    ).toBeNull();
  });

  it('default profile still pinches with two fingers', () => {
    const { container } = render(<SceneCanvas scene={makeScene()} />);
    const pinch = touchEvent('touchstart', [
      { x: 10, y: 10 },
      { x: 60, y: 60 },
    ]);
    getSvg(container).dispatchEvent(pinch);
    expect(pinch.defaultPrevented).toBe(true);
  });

  it('simple profile reports a tap in world coordinates', () => {
    const onSceneTap = vi.fn();
    const { container } = render(
      <SceneCanvas
        scene={makeScene()}
        interactionProfile="simple"
        onSceneTap={onSceneTap}
      />,
    );
    const svg = getSvg(container);
    const start = touchEvent('touchstart', [{ x: 400, y: 300 }]);
    svg.dispatchEvent(start);
    svg.dispatchEvent(touchEvent('touchend', []));

    expect(start.defaultPrevented).toBe(true);
    expect(onSceneTap).toHaveBeenCalledTimes(1);
    const point = onSceneTap.mock.calls[0][0] as { x: number; y: number };
    expect(Number.isFinite(point.x)).toBe(true);
    expect(Number.isFinite(point.y)).toBe(true);
    expect(
      container.querySelector('#tokens-layer')?.getAttribute('pointer-events'),
    ).toBe('none');
    expect(
      container.querySelector('#props-layer')?.getAttribute('pointer-events'),
    ).toBe('none');
  });

  it('simple profile treats a one-finger drag as a pan, not a tap', () => {
    const onSceneTap = vi.fn();
    const { container } = render(
      <SceneCanvas
        scene={makeScene()}
        interactionProfile="simple"
        onSceneTap={onSceneTap}
      />,
    );
    const svg = getSvg(container);
    svg.dispatchEvent(touchEvent('touchstart', [{ x: 100, y: 100 }]));
    const move = touchEvent('touchmove', [{ x: 160, y: 140 }]);
    svg.dispatchEvent(move);
    svg.dispatchEvent(touchEvent('touchend', []));

    expect(move.defaultPrevented).toBe(true);
    expect(onSceneTap).not.toHaveBeenCalled();
  });

  it('simple profile still reports taps while following the DM', () => {
    useGameStore.setState((state) => {
      state.sceneState.followDM = true;
    });
    const onSceneTap = vi.fn();
    const { container } = render(
      <SceneCanvas
        scene={makeScene()}
        interactionProfile="simple"
        onSceneTap={onSceneTap}
      />,
    );
    const svg = getSvg(container);
    svg.dispatchEvent(touchEvent('touchstart', [{ x: 100, y: 100 }]));
    svg.dispatchEvent(touchEvent('touchend', []));
    expect(onSceneTap).toHaveBeenCalledTimes(1);
  });

  it('simple profile reports mouse clicks as taps', () => {
    const onSceneTap = vi.fn();
    const { container } = render(
      <SceneCanvas
        scene={makeScene()}
        interactionProfile="simple"
        onSceneTap={onSceneTap}
      />,
    );
    const svg = getSvg(container);
    svg.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, clientX: 50, clientY: 50 }),
    );
    svg.dispatchEvent(
      new MouseEvent('mouseup', { bubbles: true, clientX: 50, clientY: 50 }),
    );
    expect(onSceneTap).toHaveBeenCalledTimes(1);

    svg.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, clientX: 50, clientY: 50 }),
    );
    svg.dispatchEvent(
      new MouseEvent('mousemove', { bubbles: true, clientX: 150, clientY: 50 }),
    );
    svg.dispatchEvent(
      new MouseEvent('mouseup', { bubbles: true, clientX: 150, clientY: 50 }),
    );
    expect(onSceneTap).toHaveBeenCalledTimes(1);
  });
});
