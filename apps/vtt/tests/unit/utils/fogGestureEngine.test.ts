import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FogGestureEngine } from '@/utils/fogGestureEngine';
import { cameraRef } from '@/utils/cameraRef';

function pointerEvent(target: SVGElement, x: number, y: number, pointerId = 1): never {
  return { button: 0, pointerId, clientX: x, clientY: y, currentTarget: target } as never;
}

describe('FogGestureEngine', () => {
  beforeEach(() => {
    cameraRef.set({ x: 0, y: 0, zoom: 1 });
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { callback(1); return 1; }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('commits a rectangle in world coordinates and releases capture', () => {
    const commits = vi.fn(); const preview = vi.fn();
    const engine = new FogGestureEngine(); engine.sync({ kind: 'rect', brushSize: 40, onCommit: commits, onPreview: preview });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    Object.defineProperty(svg, 'getBoundingClientRect', { value: () => ({ left: 10, top: 20, width: 100, height: 100 }) });
    const target = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); svg.append(target);
    Object.assign(target, { setPointerCapture: vi.fn(), hasPointerCapture: vi.fn(() => true), releasePointerCapture: vi.fn() });
    engine.handlePointerDown(pointerEvent(target, 60, 70));
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 80, clientY: 90 }));
    window.dispatchEvent(new PointerEvent('pointerup'));
    expect(commits).toHaveBeenCalledWith([{ x: 0, y: 0 }, { x: 20, y: 20 }]);
    expect(preview).toHaveBeenLastCalledWith(null); expect(target.releasePointerCapture).toHaveBeenCalledWith(1);
  });

  it('does not begin disabled or secondary-button gestures and cancels brush strokes', () => {
    const commits = vi.fn(); const preview = vi.fn(); const engine = new FogGestureEngine();
    engine.sync({ kind: 'brush', brushSize: 20, disabled: true, onCommit: commits, onPreview: preview });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); const target = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); svg.append(target);
    engine.handlePointerDown(pointerEvent(target, 1, 1)); expect(engine.isActive).toBe(false);
    engine.sync({ kind: 'brush', brushSize: 20, onCommit: commits, onPreview: preview });
    engine.handlePointerDown({ ...pointerEvent(target, 1, 1), button: 2 }); expect(engine.isActive).toBe(false);
    engine.dispose();
  });
});
