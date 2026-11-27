import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Keep drawing controls mounted while stubbing asset and bitmap layers.
vi.mock('@/components/Scene/SceneGrid', () => ({ SceneGrid: () => null }));
vi.mock('@/components/Scene/SceneBackground', () => ({
  SceneBackground: () => null,
}));
vi.mock('@/components/Scene/RemoteCursors', () => ({
  RemoteCursors: () => null,
}));
vi.mock('@/components/Scene/DrawingPropertiesPanel', () => ({
  DrawingPropertiesPanel: () => null,
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
vi.mock('@/services/drawingPersistence', () => ({
  drawingPersistenceService: { saveScene: vi.fn(async () => undefined) },
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
import { webSocketService } from '@/services/websocket';
import { useGameStore } from '@/stores/gameStore';
import { defaultDrawingStyle, ELEMENT_THEMES } from '@/types/drawing';
import type { SpellRingDrawing } from '@/types/drawing';
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

function getDrawingToolSurface(container: HTMLElement): SVGRectElement {
  const surface = container.querySelector<SVGRectElement>(
    '.drawing-tools > rect',
  );
  if (!surface) throw new Error('drawing tools are inactive');
  return surface;
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

describe('SceneCanvas drawing edits', () => {
  const initialState = useGameStore.getState();
  let scene: Scene;
  let spell: SpellRingDrawing;
  let portal: HTMLDivElement;

  beforeEach(() => {
    portal = document.createElement('div');
    portal.id = 'portal-root';
    document.body.append(portal);
    scene = makeScene();
    spell = {
      type: 'spell-ring',
      id: 'spell-ring',
      roomCode: scene.roomCode,
      layer: 'effects',
      createdAt: 1,
      updatedAt: 1,
      createdBy: 'host1',
      center: { x: 100, y: 100 },
      outerRadius: 40,
      innerRadius: 20,
      style: {
        ...defaultDrawingStyle,
        ...ELEMENT_THEMES.arcane,
        elementType: 'arcane',
        gridSnap: false,
      },
    };
    scene.drawings = [spell];
    useGameStore.setState((state) => {
      state.user.id = 'host1';
      state.user.type = 'host';
      state.sceneState.scenes = [scene];
      state.sceneState.activeSceneId = scene.id;
      state.sceneState.activeTool = 'select';
      state.sceneState.selectedObjectIds = [];
      state.sceneState.camera = { x: 0, y: 0, zoom: 2 };
    });
  });

  afterEach(() => {
    portal.remove();
    useGameStore.setState(initialState, true);
  });

  async function renderCanvas() {
    const view = render(<SceneCanvas scene={scene} />);
    await act(async () => {});
    return view.container;
  }

  it('starts moving an unselected spell ring on its first drag and commits once', async () => {
    const container = await renderCanvas();
    const surface = getDrawingToolSurface(container);
    fireEvent.mouseDown(surface, { clientX: 260, clientY: 200 });
    fireEvent.mouseMove(surface, { clientX: 280, clientY: 220 });
    fireEvent.mouseMove(surface, { clientX: 300, clientY: 240 });

    expect(useGameStore.getState().sceneState.selectedObjectIds).toEqual([
      spell.id,
    ]);
    expect(webSocketService.sendEvent).not.toHaveBeenCalled();
    expect(
      container.querySelector('.selection-handle')?.getAttribute('x'),
    ).toBe('157.5');
    fireEvent.mouseUp(surface, { clientX: 300, clientY: 240 });

    expect(
      useGameStore.getState().sceneState.scenes[0].drawings[0],
    ).toMatchObject({
      center: { x: 120, y: 120 },
    });
    expect(webSocketService.sendEvent).toHaveBeenCalledExactlyOnceWith({
      type: 'drawing/update',
      data: {
        sceneId: scene.id,
        drawingId: spell.id,
        updates: { center: { x: 120, y: 120 } },
      },
    });
  });

  it('resizes a spell ring via its radial handle and keeps its center and proportions', async () => {
    const container = await renderCanvas();
    fireEvent.mouseDown(getDrawingToolSurface(container), {
      clientX: 260,
      clientY: 200,
    });
    fireEvent.mouseUp(window, { clientX: 260, clientY: 200 });
    const handle = container.querySelector('.selection-handle')!;
    fireEvent.mouseDown(handle, { clientX: 280, clientY: 200 });
    fireEvent.mouseMove(window, { clientX: 320, clientY: 200 });
    fireEvent.mouseUp(window, { clientX: 320, clientY: 200 });

    expect(
      useGameStore.getState().sceneState.scenes[0].drawings[0],
    ).toMatchObject({
      center: spell.center,
      outerRadius: 60,
      innerRadius: 30,
    });
    const panel = screen.getByRole('dialog', {
      name: 'Spell effect properties',
    });
    expect(within(panel).getByText('6 ft')).toBeInTheDocument();
  });

  it('shows resize handles immediately after drawing a rectangle', async () => {
    useGameStore.getState().setActiveTool('rectangle');
    const container = await renderCanvas();
    const surface = getDrawingToolSurface(container);
    fireEvent.mouseDown(surface, { clientX: 20, clientY: 40 });
    fireEvent.mouseMove(surface, { clientX: 100, clientY: 140 });
    fireEvent.mouseUp(surface, { clientX: 100, clientY: 140 });

    expect(useGameStore.getState().sceneState.activeTool).toBe('select');
    expect(container.querySelectorAll('.selection-handle')).toHaveLength(4);
  });

  it('removes a spell from the scene and closes its properties', async () => {
    const container = await renderCanvas();
    fireEvent.mouseDown(getDrawingToolSurface(container), {
      clientX: 260,
      clientY: 200,
    });
    fireEvent.mouseUp(window, { clientX: 260, clientY: 200 });
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete spell effect' }),
    );

    expect(useGameStore.getState().sceneState.scenes[0].drawings).toEqual([]);
    expect(useGameStore.getState().sceneState.selectedObjectIds).toEqual([]);
    expect(
      screen.queryByRole('dialog', { name: 'Spell effect properties' }),
    ).toBeNull();
    await vi.waitFor(() =>
      expect(webSocketService.sendEvent).toHaveBeenCalledWith({
        type: 'drawing/delete',
        data: { sceneId: scene.id, drawingId: spell.id },
      }),
    );
  });
});
