import { describe, expect, it, vi } from 'vitest';
import { sceneImageStore, sceneUtils } from '@/utils/sceneUtils';
import { cameraRef } from '@/utils/cameraRef';

describe('scene utilities', () => {
  it('validates scene data, computes camera geometry, and converts coordinate systems', () => {
    expect(sceneUtils.createDefaultScene()).toMatchObject({ name: 'New Scene', gridSettings: { enabled: true } });
    expect(sceneUtils.validateScene({ name: '', description: 'x'.repeat(501), gridSettings: { size: 5, opacity: 2 } as never })).toMatchObject({ valid: false, errors: expect.arrayContaining(['Scene name is required', 'Grid size must be between 10 and 200 pixels']) });
    const scene = { backgroundImage: { width: 400, height: 200, offsetX: 10, offsetY: 20, scale: 1 } } as never;
    expect(sceneUtils.getSceneBounds(scene)).toEqual({ width: 400, height: 200, centerX: 210, centerY: 120 });
    expect(sceneUtils.calculateFitToSceneCamera(scene, 1000, 800)).toMatchObject({ x: 210, y: 120, zoom: 2 });
    expect(sceneUtils.snapToGrid(26, 74, 50)).toEqual({ x: 50, y: 50 }); expect(sceneUtils.snapToGrid(26, 74, 50, false)).toEqual({ x: 26, y: 74 });
    const camera = { x: 10, y: 20, zoom: 2 }; const world = sceneUtils.screenToWorld(120, 140, camera, 200, 200);
    expect(world).toEqual({ x: 20, y: 40 }); expect(sceneUtils.worldToScreen(world.x, world.y, camera, 200, 200)).toEqual({ x: 120, y: 140 });
    expect(sceneUtils.cameraTransform(camera, 200, 100)).toContain('scale(2)'); expect(sceneUtils.viewportWorldRect(camera, 200, 100)).toEqual({ x: -40, y: -5, width: 100, height: 50 });
  });

  it('handles image validation, URL validation, live camera reads, and external URLs without IndexedDB', async () => {
    const tooLarge = new File([new Uint8Array(6 * 1024 * 1024)], 'large.png', { type: 'image/png' });
    expect(sceneUtils.validateImageFile(tooLarge)).toMatchObject({ valid: false });
    expect(sceneUtils.validateImageFile(new File(['x'], 'x.txt', { type: 'text/plain' }))).toMatchObject({ valid: false });
    expect(sceneUtils.validateImageFile(new File(['x'], 'x.png', { type: 'image/png' }))).toEqual({ valid: true });
    expect(sceneUtils.validateImageUrl('https://example.test/map.png')).toEqual({ valid: true }); expect(sceneUtils.validateImageUrl('not a url')).toMatchObject({ valid: false });
    cameraRef.set({ x: 5, y: 6, zoom: 2 }); expect(sceneUtils.screenToWorldLive(100, 50, 200, 100)).toEqual({ x: 5, y: 6 });
    expect(await sceneImageStore.getImageUrl('https://example.test/image.png')).toBe('https://example.test/image.png');
    await expect(sceneImageStore.deleteImage('https://example.test/image.png')).resolves.toBeUndefined();
    const element = document.createElement('div'); Object.defineProperty(element, 'getBoundingClientRect', { value: () => ({ left: 10, top: 20, width: 100, height: 100 }) });
    expect(sceneUtils.clientToWorld(60, 70, { x: 0, y: 0, zoom: 1 }, element)).toEqual({ x: 0, y: 0 }); expect(sceneUtils.clientToWorld(1, 1, { x: 0, y: 0, zoom: 1 }, null)).toEqual({ x: 0, y: 0 });
    expect(sceneUtils.getSceneBounds({} as never)).toBeNull(); expect(sceneUtils.calculateFitToSceneCamera({} as never, 100, 100)).toEqual({ x: 0, y: 0, zoom: 1 });
    vi.spyOn(Math, 'random').mockReturnValue(0); expect(sceneUtils.generateRandomColor()).toBe('hsl(0, 70%, 45%)'); expect(sceneUtils.formatFileSize(0)).toBe('0 Bytes'); expect(sceneUtils.formatFileSize(1536)).toBe('1.5 KB');
  });

  it('converts an image URL through a canvas after image load', async () => {
    class MockImage {
      naturalWidth = 40;
      naturalHeight = 20;
      crossOrigin = '';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) { this.onload?.(); }
    }
    vi.stubGlobal('Image', MockImage);
    const context = { drawImage: vi.fn() }; const canvas = document.createElement('canvas'); vi.spyOn(document, 'createElement').mockReturnValueOnce(canvas); vi.spyOn(canvas, 'getContext').mockReturnValue(context as never); vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/webp;base64,abc');
    await expect(sceneUtils.loadImageFromUrl('https://example.test/map.png')).resolves.toMatchObject({ width: 40, height: 20, dataUrl: 'data:image/webp;base64,abc' });
  });
});
