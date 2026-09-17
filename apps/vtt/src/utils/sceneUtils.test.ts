import { describe, it, expect, afterEach, vi } from 'vitest';
import { sceneUtils } from './sceneUtils';
import { cameraRef } from './cameraRef';
import type { Scene } from '@/types/game';

const VIEWPORT = { width: 1000, height: 800 };

const makeScene = (overrides: Partial<Scene> = {}): Scene => ({
  id: 'scene-1',
  roomCode: 'ABCD',
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
  ...sceneUtils.createDefaultScene('Test Scene', 'user-1'),
  ...overrides,
});

const withBackground = (
  background: Partial<NonNullable<Scene['backgroundImage']>> = {},
): Scene =>
  makeScene({
    backgroundImage: {
      url: 'nexus-image://abc',
      width: 2000,
      height: 1000,
      offsetX: 0,
      offsetY: 0,
      scale: 1,
      ...background,
    },
  });

const makeFile = (name: string, type: string, size: number): File => {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('sceneUtils', () => {
  afterEach(() => {
    cameraRef.reset();
    vi.restoreAllMocks();
  });

  describe('createDefaultScene', () => {
    it('falls back to a placeholder name and unknown author', () => {
      const scene = sceneUtils.createDefaultScene();

      expect(scene.name).toBe('New Scene');
      expect(scene.createdBy).toBe('unknown');
    });

    it('uses the supplied name and author', () => {
      const scene = sceneUtils.createDefaultScene('Goblin Ambush', 'dm-7');

      expect(scene.name).toBe('Goblin Ambush');
      expect(scene.createdBy).toBe('dm-7');
    });

    it('treats an empty name as absent', () => {
      expect(sceneUtils.createDefaultScene('').name).toBe('New Scene');
    });

    it('starts with a snapping square grid and no content', () => {
      const scene = sceneUtils.createDefaultScene();

      expect(scene.gridSettings).toMatchObject({
        enabled: true,
        type: 'square',
        size: 50,
        snapToGrid: true,
      });
      expect(scene.drawings).toEqual([]);
      expect(scene.placedTokens).toEqual([]);
      expect(scene.placedProps).toEqual([]);
      expect(scene.isActive).toBe(false);
      expect(scene.backgroundImage).toBeUndefined();
    });

    it('produces a scene that passes its own validation', () => {
      expect(sceneUtils.validateScene(sceneUtils.createDefaultScene())).toEqual(
        {
          valid: true,
          errors: [],
        },
      );
    });
  });

  describe('validateScene', () => {
    it('rejects a missing name', () => {
      const result = sceneUtils.validateScene({});

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Scene name is required');
    });

    it('rejects a whitespace-only name', () => {
      const result = sceneUtils.validateScene({ name: '   ' });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Scene name is required');
    });

    it('accepts a name of exactly 100 characters', () => {
      expect(sceneUtils.validateScene({ name: 'a'.repeat(100) }).valid).toBe(
        true,
      );
    });

    it('rejects a name longer than 100 characters', () => {
      const result = sceneUtils.validateScene({ name: 'a'.repeat(101) });

      expect(result.errors).toContain(
        'Scene name must be 100 characters or less',
      );
    });

    it('rejects a description longer than 500 characters', () => {
      const result = sceneUtils.validateScene({
        name: 'Ok',
        description: 'd'.repeat(501),
      });

      expect(result.errors).toContain(
        'Scene description must be 500 characters or less',
      );
    });

    it('accepts a description of exactly 500 characters', () => {
      expect(
        sceneUtils.validateScene({ name: 'Ok', description: 'd'.repeat(500) })
          .valid,
      ).toBe(true);
    });

    it('accepts grid size at both ends of the allowed range', () => {
      const grid = sceneUtils.createDefaultScene().gridSettings;

      expect(
        sceneUtils.validateScene({
          name: 'Ok',
          gridSettings: { ...grid, size: 10 },
        }).valid,
      ).toBe(true);
      expect(
        sceneUtils.validateScene({
          name: 'Ok',
          gridSettings: { ...grid, size: 200 },
        }).valid,
      ).toBe(true);
    });

    it('rejects grid size outside the allowed range', () => {
      const grid = sceneUtils.createDefaultScene().gridSettings;

      expect(
        sceneUtils.validateScene({
          name: 'Ok',
          gridSettings: { ...grid, size: 9 },
        }).errors,
      ).toContain('Grid size must be between 10 and 200 pixels');
      expect(
        sceneUtils.validateScene({
          name: 'Ok',
          gridSettings: { ...grid, size: 201 },
        }).errors,
      ).toContain('Grid size must be between 10 and 200 pixels');
    });

    it('rejects grid opacity outside 0..1', () => {
      const grid = sceneUtils.createDefaultScene().gridSettings;

      expect(
        sceneUtils.validateScene({
          name: 'Ok',
          gridSettings: { ...grid, opacity: -0.1 },
        }).errors,
      ).toContain('Grid opacity must be between 0 and 1');
      expect(
        sceneUtils.validateScene({
          name: 'Ok',
          gridSettings: { ...grid, opacity: 1.1 },
        }).errors,
      ).toContain('Grid opacity must be between 0 and 1');
    });

    it('accepts grid opacity at both bounds', () => {
      const grid = sceneUtils.createDefaultScene().gridSettings;

      expect(
        sceneUtils.validateScene({
          name: 'Ok',
          gridSettings: { ...grid, opacity: 0 },
        }).valid,
      ).toBe(true);
      expect(
        sceneUtils.validateScene({
          name: 'Ok',
          gridSettings: { ...grid, opacity: 1 },
        }).valid,
      ).toBe(true);
    });

    it('reports every problem at once rather than stopping at the first', () => {
      const grid = sceneUtils.createDefaultScene().gridSettings;
      const result = sceneUtils.validateScene({
        name: '',
        description: 'd'.repeat(501),
        gridSettings: { ...grid, size: 5, opacity: 4 },
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(4);
    });
  });

  describe('getSceneBounds', () => {
    it('returns null when the scene has no background image', () => {
      expect(sceneUtils.getSceneBounds(makeScene())).toBeNull();
    });

    it('returns the unscaled size centered on the image offset', () => {
      const bounds = sceneUtils.getSceneBounds(
        withBackground({ offsetX: 100, offsetY: 50 }),
      );

      expect(bounds).toEqual({
        width: 2000,
        height: 1000,
        centerX: 1100,
        centerY: 550,
      });
    });

    it('applies the background scale to both size and center', () => {
      const bounds = sceneUtils.getSceneBounds(withBackground({ scale: 0.5 }));

      expect(bounds).toEqual({
        width: 1000,
        height: 500,
        centerX: 500,
        centerY: 250,
      });
    });
  });

  describe('calculateFitToSceneCamera', () => {
    it('returns an identity camera when there is nothing to fit', () => {
      expect(
        sceneUtils.calculateFitToSceneCamera(
          makeScene(),
          VIEWPORT.width,
          VIEWPORT.height,
        ),
      ).toEqual({ x: 0, y: 0, zoom: 1 });
    });

    it('centers on the background and fits the tighter axis', () => {
      const camera = sceneUtils.calculateFitToSceneCamera(
        withBackground(),
        VIEWPORT.width,
        VIEWPORT.height,
      );

      expect(camera.x).toBe(1000);
      expect(camera.y).toBe(500);
      // width is the binding axis: (1000 - 200) / 2000 = 0.4, vs 0.6 for height
      expect(camera.zoom).toBeCloseTo(0.4, 10);
    });

    it('accounts for the 100px padding on each side', () => {
      const camera = sceneUtils.calculateFitToSceneCamera(
        withBackground({ width: 400, height: 4000 }),
        VIEWPORT.width,
        VIEWPORT.height,
      );

      expect(camera.zoom).toBeCloseTo((VIEWPORT.height - 200) / 4000, 10);
    });

    it('caps zoom at 2x for a tiny background', () => {
      const camera = sceneUtils.calculateFitToSceneCamera(
        withBackground({ width: 10, height: 10 }),
        VIEWPORT.width,
        VIEWPORT.height,
      );

      expect(camera.zoom).toBe(2);
    });

    it('floors zoom at 0.1x for an enormous background', () => {
      const camera = sceneUtils.calculateFitToSceneCamera(
        withBackground({ width: 1_000_000, height: 1_000_000 }),
        VIEWPORT.width,
        VIEWPORT.height,
      );

      expect(camera.zoom).toBe(0.1);
    });
  });

  describe('snapToGrid', () => {
    it('snaps to the nearest multiple of the grid size', () => {
      expect(sceneUtils.snapToGrid(74, 126, 50)).toEqual({ x: 50, y: 150 });
    });

    it('rounds half-cells up', () => {
      expect(sceneUtils.snapToGrid(25, 25, 50)).toEqual({ x: 50, y: 50 });
    });

    it('snaps negative coordinates toward the nearest cell', () => {
      expect(sceneUtils.snapToGrid(-74, -126, 50)).toEqual({ x: -50, y: -150 });
    });

    it('passes coordinates through untouched when disabled', () => {
      expect(sceneUtils.snapToGrid(74.5, 126.25, 50, false)).toEqual({
        x: 74.5,
        y: 126.25,
      });
    });

    it('snaps by default when the flag is omitted', () => {
      expect(sceneUtils.snapToGrid(74, 74, 50)).toEqual({ x: 50, y: 50 });
    });
  });

  describe('coordinate conversion', () => {
    const camera = { x: 300, y: -200, zoom: 2 };

    it('maps the viewport center to the camera position', () => {
      expect(
        sceneUtils.screenToWorld(
          VIEWPORT.width / 2,
          VIEWPORT.height / 2,
          camera,
          VIEWPORT.width,
          VIEWPORT.height,
        ),
      ).toEqual({ x: camera.x, y: camera.y });
    });

    it('divides screen offsets by zoom', () => {
      const world = sceneUtils.screenToWorld(
        VIEWPORT.width / 2 + 100,
        VIEWPORT.height / 2 + 50,
        camera,
        VIEWPORT.width,
        VIEWPORT.height,
      );

      expect(world).toEqual({ x: camera.x + 50, y: camera.y + 25 });
    });

    it('round-trips screenToWorld -> worldToScreen', () => {
      const world = sceneUtils.screenToWorld(
        137,
        612,
        camera,
        VIEWPORT.width,
        VIEWPORT.height,
      );
      const screen = sceneUtils.worldToScreen(
        world.x,
        world.y,
        camera,
        VIEWPORT.width,
        VIEWPORT.height,
      );

      expect(screen.x).toBeCloseTo(137, 10);
      expect(screen.y).toBeCloseTo(612, 10);
    });

    it('agrees with the camera transform it renders with', () => {
      // The <g> transform must place a world point at the same screen pixel
      // that worldToScreen reports, or declarative and imperative renders drift.
      const transform = sceneUtils.cameraTransform(
        camera,
        VIEWPORT.width,
        VIEWPORT.height,
      );
      const [, tx, ty, scale] = transform
        .match(/translate\(([-\d.]+), ([-\d.]+)\) scale\(([-\d.]+)\)/)!
        .map(Number);
      const world = { x: 420, y: 90 };
      const expected = sceneUtils.worldToScreen(
        world.x,
        world.y,
        camera,
        VIEWPORT.width,
        VIEWPORT.height,
      );

      expect(world.x * scale + tx).toBeCloseTo(expected.x, 10);
      expect(world.y * scale + ty).toBeCloseTo(expected.y, 10);
    });

    it('describes the visible world rectangle consistently with screenToWorld', () => {
      const rect = sceneUtils.viewportWorldRect(
        camera,
        VIEWPORT.width,
        VIEWPORT.height,
      );
      const topLeft = sceneUtils.screenToWorld(
        0,
        0,
        camera,
        VIEWPORT.width,
        VIEWPORT.height,
      );
      const bottomRight = sceneUtils.screenToWorld(
        VIEWPORT.width,
        VIEWPORT.height,
        camera,
        VIEWPORT.width,
        VIEWPORT.height,
      );

      expect(rect.x).toBeCloseTo(topLeft.x, 10);
      expect(rect.y).toBeCloseTo(topLeft.y, 10);
      expect(rect.width).toBeCloseTo(bottomRight.x - topLeft.x, 10);
      expect(rect.height).toBeCloseTo(bottomRight.y - topLeft.y, 10);
    });

    it('shows more world area as zoom decreases', () => {
      const zoomedIn = sceneUtils.viewportWorldRect(
        { x: 0, y: 0, zoom: 4 },
        VIEWPORT.width,
        VIEWPORT.height,
      );
      const zoomedOut = sceneUtils.viewportWorldRect(
        { x: 0, y: 0, zoom: 0.5 },
        VIEWPORT.width,
        VIEWPORT.height,
      );

      expect(zoomedOut.width).toBeGreaterThan(zoomedIn.width);
      expect(zoomedOut.height).toBeGreaterThan(zoomedIn.height);
    });
  });

  describe('clientToWorld', () => {
    const camera = { x: 0, y: 0, zoom: 1 };

    const elementWithRect = (rect: Partial<DOMRect>): Element => {
      const element = document.createElement('div');
      element.getBoundingClientRect = () =>
        ({
          left: 0,
          top: 0,
          width: VIEWPORT.width,
          height: VIEWPORT.height,
          ...rect,
        }) as DOMRect;
      return element;
    };

    it('returns the origin when there is no viewport element', () => {
      expect(sceneUtils.clientToWorld(500, 400, camera, null)).toEqual({
        x: 0,
        y: 0,
      });
    });

    it('subtracts the element offset before converting', () => {
      const element = elementWithRect({ left: 200, top: 100 });

      // Client point sits exactly at the element's center.
      expect(
        sceneUtils.clientToWorld(
          200 + VIEWPORT.width / 2,
          100 + VIEWPORT.height / 2,
          camera,
          element,
        ),
      ).toEqual({ x: 0, y: 0 });
    });

    it('uses the element size, not the window size, as the viewport', () => {
      const element = elementWithRect({
        left: 0,
        top: 0,
        width: 200,
        height: 100,
      });

      expect(sceneUtils.clientToWorld(0, 0, camera, element)).toEqual({
        x: -100,
        y: -50,
      });
    });
  });

  describe('screenToWorldLive', () => {
    it('reads the live camera ref rather than a passed-in camera', () => {
      cameraRef.seed({ x: 500, y: 250, zoom: 2 });

      expect(
        sceneUtils.screenToWorldLive(
          VIEWPORT.width / 2,
          VIEWPORT.height / 2,
          VIEWPORT.width,
          VIEWPORT.height,
        ),
      ).toEqual({ x: 500, y: 250 });
    });

    it('tracks mid-gesture camera writes', () => {
      cameraRef.seed({ x: 0, y: 0, zoom: 1 });
      const before = sceneUtils.screenToWorldLive(
        0,
        0,
        VIEWPORT.width,
        VIEWPORT.height,
      );

      cameraRef.set({ x: 1000 });
      const after = sceneUtils.screenToWorldLive(
        0,
        0,
        VIEWPORT.width,
        VIEWPORT.height,
      );

      expect(after.x - before.x).toBe(1000);
    });

    it('matches screenToWorld given the same camera', () => {
      const camera = { x: -40, y: 90, zoom: 1.5 };
      cameraRef.seed(camera);

      expect(
        sceneUtils.screenToWorldLive(321, 654, VIEWPORT.width, VIEWPORT.height),
      ).toEqual(
        sceneUtils.screenToWorld(
          321,
          654,
          camera,
          VIEWPORT.width,
          VIEWPORT.height,
        ),
      );
    });
  });

  describe('generateRandomColor', () => {
    it('stays inside the documented saturation and lightness bands', () => {
      for (let i = 0; i < 50; i++) {
        const match = sceneUtils
          .generateRandomColor()
          .match(/^hsl\((\d+), (\d+)%, (\d+)%\)$/);

        expect(match).not.toBeNull();
        const [, hue, saturation, lightness] = match!.map(Number);
        expect(hue).toBeGreaterThanOrEqual(0);
        expect(hue).toBeLessThanOrEqual(359);
        expect(saturation).toBeGreaterThanOrEqual(70);
        expect(saturation).toBeLessThanOrEqual(89);
        expect(lightness).toBeGreaterThanOrEqual(45);
        expect(lightness).toBeLessThanOrEqual(54);
      }
    });

    it('produces the low end of each band', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);

      expect(sceneUtils.generateRandomColor()).toBe('hsl(0, 70%, 45%)');
    });

    it('produces the high end of each band', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.999999);

      expect(sceneUtils.generateRandomColor()).toBe('hsl(359, 89%, 54%)');
    });
  });

  describe('formatFileSize', () => {
    it('special-cases zero', () => {
      expect(sceneUtils.formatFileSize(0)).toBe('0 Bytes');
    });

    it('formats each unit', () => {
      expect(sceneUtils.formatFileSize(512)).toBe('512 Bytes');
      expect(sceneUtils.formatFileSize(1024)).toBe('1 KB');
      expect(sceneUtils.formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(sceneUtils.formatFileSize(1024 ** 3)).toBe('1 GB');
    });

    it('rounds to two decimals and drops trailing zeros', () => {
      expect(sceneUtils.formatFileSize(1536)).toBe('1.5 KB');
      expect(sceneUtils.formatFileSize(1_500_000)).toBe('1.43 MB');
    });

    it('stays in the lower unit just below the next boundary', () => {
      expect(sceneUtils.formatFileSize(1023)).toBe('1023 Bytes');
    });
  });

  describe('validateImageFile', () => {
    it('accepts each allowed image type', () => {
      for (const type of [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
      ]) {
        expect(
          sceneUtils.validateImageFile(makeFile('map', type, 1024)),
        ).toEqual({ valid: true });
      }
    });

    it('rejects a disallowed type', () => {
      const result = sceneUtils.validateImageFile(
        makeFile('map.bmp', 'image/bmp', 1024),
      );

      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/Invalid file type/);
    });

    it('accepts a file of exactly 5MB', () => {
      expect(
        sceneUtils.validateImageFile(
          makeFile('map.png', 'image/png', 5 * 1024 * 1024),
        ).valid,
      ).toBe(true);
    });

    it('rejects a file over 5MB and names the limit', () => {
      const result = sceneUtils.validateImageFile(
        makeFile('map.png', 'image/png', 5 * 1024 * 1024 + 1),
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('5 MB');
    });

    it('reports size before type when a file violates both', () => {
      const result = sceneUtils.validateImageFile(
        makeFile('map.bmp', 'image/bmp', 10 * 1024 * 1024),
      );

      expect(result.error).toMatch(/File size too large/);
    });
  });

  describe('validateImageUrl', () => {
    it('accepts each supported extension', () => {
      for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'gif']) {
        expect(
          sceneUtils.validateImageUrl(`https://example.com/map.${ext}`),
        ).toEqual({ valid: true });
      }
    });

    it('ignores extension casing', () => {
      expect(
        sceneUtils.validateImageUrl('https://example.com/MAP.PNG').valid,
      ).toBe(true);
    });

    it('ignores query strings and fragments', () => {
      expect(
        sceneUtils.validateImageUrl('https://example.com/map.png?w=200#top')
          .valid,
      ).toBe(true);
    });

    it('rejects a URL without an image extension', () => {
      const result = sceneUtils.validateImageUrl('https://example.com/map');

      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/must point to an image file/);
    });

    it('is not fooled by an extension that only appears in the query string', () => {
      expect(
        sceneUtils.validateImageUrl('https://example.com/redirect?to=map.png')
          .valid,
      ).toBe(false);
    });

    it('rejects a malformed URL', () => {
      const result = sceneUtils.validateImageUrl('not a url');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid URL format');
    });
  });

  describe('loadImageFromUrl', () => {
    it('rejects an invalid URL before touching the network', () => {
      const image = vi.spyOn(globalThis, 'Image');

      return expect(
        sceneUtils.loadImageFromUrl('https://example.com/not-an-image'),
      )
        .rejects.toThrow(/must point to an image file/)
        .then(() => {
          expect(image).not.toHaveBeenCalled();
        });
    });
  });
});
