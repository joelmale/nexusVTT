import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  optimizeIconImage,
  optimizeIconDataUrl,
  findContentBounds,
  removeBackgroundFromImageData,
  processCanvasImage,
  MAX_ICON_FILE_SIZE,
} from '@/utils/imageOptimizer';

describe('imageOptimizer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('exports MAX_ICON_FILE_SIZE of 5MB', () => {
    expect(MAX_ICON_FILE_SIZE).toBe(5 * 1024 * 1024);
  });

  it('rejects files exceeding the size limit', async () => {
    const hugeFile = new File(['x'.repeat(100)], 'huge.png', {
      type: 'image/png',
    });
    // Set custom maxFileSize to 50 bytes so hugeFile exceeds it
    await expect(
      optimizeIconImage(hugeFile, { maxFileSize: 50 }),
    ).rejects.toThrow(/exceeds/i);
  });

  it('rejects files with unsupported non-image mime types', async () => {
    const textFile = new File(['hello world'], 'notes.txt', {
      type: 'text/plain',
    });
    await expect(optimizeIconImage(textFile)).rejects.toThrow(
      /unsupported file type/i,
    );
  });

  it('processes and preserves SVG vector files', async () => {
    const svgContent =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="gold"/></svg>';
    const svgFile = new File([svgContent], 'token-icon.svg', {
      type: 'image/svg+xml',
    });

    const result = await optimizeIconImage(svgFile);
    expect(result).toBeTruthy();
    expect(result).toMatch(/^data:image\/svg\+xml/);
  });

  it('processes raster images (PNG) and resizes to 256x256 square', async () => {
    const pngFile = new File(['fake-png-content'], 'test-icon.png', {
      type: 'image/png',
    });

    // Mock FileReader to return a valid base64 data URL
    const originalFileReader = global.FileReader;
    const mockDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    class MockFileReader {
      result: string | ArrayBuffer | null = null;
      onload: (() => void) | null = null;
      onerror: ((err: unknown) => void) | null = null;

      readAsDataURL() {
        this.result = mockDataUrl;
        setTimeout(() => {
          this.onload?.();
        }, 0);
      }
    }

    // @ts-expect-error Mocking FileReader for testing
    global.FileReader = MockFileReader;

    // Mock Image
    const originalImage = global.Image;
    class MockImage {
      width = 512;
      height = 512;
      src = '';
      onload: (() => void) | null = null;
      onerror: ((err: unknown) => void) | null = null;

      constructor() {
        setTimeout(() => {
          this.onload?.();
        }, 0);
      }
    }
    // @ts-expect-error Mocking Image for testing
    global.Image = MockImage;

    // Mock canvas context
    const mockCtx = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
    };
    const mockToDataURL = vi.fn().mockReturnValue('data:image/png;base64,resizedMock');

    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        const canvas = origCreateElement('canvas');
        canvas.getContext = vi.fn().mockReturnValue(mockCtx);
        canvas.toDataURL = mockToDataURL;
        return canvas;
      }
      return origCreateElement(tag);
    });

    try {
      const result = await optimizeIconImage(pngFile);
      expect(result).toBe('data:image/png;base64,resizedMock');
      expect(mockCtx.clearRect).toHaveBeenCalledWith(0, 0, 256, 256);
      expect(mockCtx.drawImage).toHaveBeenCalled();
    } finally {
      global.FileReader = originalFileReader;
      global.Image = originalImage;
    }
  });

  it('rejects if image fails to decode', async () => {
    const corruptFile = new File(['corrupt-data'], 'bad.png', {
      type: 'image/png',
    });

    const originalFileReader = global.FileReader;
    class MockFileReader {
      result = 'data:image/png;base64,invalid';
      onload: (() => void) | null = null;
      onerror: ((err: unknown) => void) | null = null;
      readAsDataURL() {
        setTimeout(() => this.onload?.(), 0);
      }
    }
    // @ts-expect-error Mocking FileReader
    global.FileReader = MockFileReader;

    const originalImage = global.Image;
    class MockFailingImage {
      onload: (() => void) | null = null;
      onerror: ((err: unknown) => void) | null = null;
      src = '';
      constructor() {
        setTimeout(() => this.onerror?.(new Error('Decode error')), 0);
      }
    }
    // @ts-expect-error Mocking Image
    global.Image = MockFailingImage;

    try {
      await expect(optimizeIconImage(corruptFile)).rejects.toThrow(
        /failed to decode image/i,
      );
    } finally {
      global.FileReader = originalFileReader;
      global.Image = originalImage;
    }
  });

  it('falls back gracefully when 2D canvas context is unavailable', async () => {
    const pngFile = new File(['data'], 'fallback.png', {
      type: 'image/png',
    });

    const mockDataUrl = 'data:image/png;base64,rawFallback';
    const originalFileReader = global.FileReader;
    class MockFileReader {
      result = mockDataUrl;
      onload: (() => void) | null = null;
      readAsDataURL() {
        setTimeout(() => this.onload?.(), 0);
      }
    }
    // @ts-expect-error Mocking FileReader
    global.FileReader = MockFileReader;

    const originalImage = global.Image;
    class MockImage {
      width = 100;
      height = 100;
      src = '';
      onload: (() => void) | null = null;
      constructor() {
        setTimeout(() => this.onload?.(), 0);
      }
    }
    // @ts-expect-error Mocking Image
    global.Image = MockImage;

    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        const canvas = origCreateElement('canvas');
        canvas.getContext = vi.fn().mockReturnValue(null);
        return canvas;
      }
      return origCreateElement(tag);
    });

    try {
      const result = await optimizeIconImage(pngFile);
      expect(result).toBe(mockDataUrl);
    } finally {
      global.FileReader = originalFileReader;
      global.Image = originalImage;
    }
  });

  it('recognizes .svg extension even when mime type is not preset', async () => {
    const svgFile = new File(['<svg></svg>'], 'custom-vector.svg', {
      type: '',
    });
    const result = await optimizeIconImage(svgFile);
    expect(result).toMatch(/^data:/);
  });

  it('rejects if SVG FileReader encounters an error', async () => {
    const svgFile = new File(['<svg></svg>'], 'test.svg', {
      type: 'image/svg+xml',
    });

    const originalFileReader = global.FileReader;
    class MockErrorFileReader {
      error = new Error('Disk read error');
      onload: (() => void) | null = null;
      onerror: ((err: unknown) => void) | null = null;
      readAsDataURL() {
        setTimeout(() => this.onerror?.(this.error), 0);
      }
    }
    // @ts-expect-error Mocking FileReader
    global.FileReader = MockErrorFileReader;

    try {
      await expect(optimizeIconImage(svgFile)).rejects.toThrow('Disk read error');
    } finally {
      global.FileReader = originalFileReader;
    }
  });

  it('rejects if SVG FileReader returns non-string result', async () => {
    const svgFile = new File(['<svg></svg>'], 'test.svg', {
      type: 'image/svg+xml',
    });

    const originalFileReader = global.FileReader;
    class MockNullFileReader {
      result = null;
      onload: (() => void) | null = null;
      onerror: ((err: unknown) => void) | null = null;
      readAsDataURL() {
        setTimeout(() => this.onload?.(), 0);
      }
    }
    // @ts-expect-error Mocking FileReader
    global.FileReader = MockNullFileReader;

    try {
      await expect(optimizeIconImage(svgFile)).rejects.toThrow(/Failed to read SVG file content/i);
    } finally {
      global.FileReader = originalFileReader;
    }
  });

  it('rejects if raster FileReader encounters an error', async () => {
    const pngFile = new File(['dummy'], 'test.png', {
      type: 'image/png',
    });

    const originalFileReader = global.FileReader;
    class MockErrorFileReader {
      error = new Error('Raster read error');
      onload: (() => void) | null = null;
      onerror: ((err: unknown) => void) | null = null;
      readAsDataURL() {
        setTimeout(() => this.onerror?.(this.error), 0);
      }
    }
    // @ts-expect-error Mocking FileReader
    global.FileReader = MockErrorFileReader;

    try {
      await expect(optimizeIconImage(pngFile)).rejects.toThrow('Raster read error');
    } finally {
      global.FileReader = originalFileReader;
    }
  });

  it('rejects if raster FileReader returns non-string result', async () => {
    const pngFile = new File(['dummy'], 'test.png', {
      type: 'image/png',
    });

    const originalFileReader = global.FileReader;
    class MockNullFileReader {
      result = null;
      onload: (() => void) | null = null;
      onerror: ((err: unknown) => void) | null = null;
      readAsDataURL() {
        setTimeout(() => this.onload?.(), 0);
      }
    }
    // @ts-expect-error Mocking FileReader
    global.FileReader = MockNullFileReader;

    try {
      await expect(optimizeIconImage(pngFile)).rejects.toThrow(/Failed to load image file into memory/i);
    } finally {
      global.FileReader = originalFileReader;
    }
  });

  describe('findContentBounds', () => {
    it('returns null for an empty or completely transparent image', () => {
      const emptyData = {
        width: 10,
        height: 10,
        data: new Uint8ClampedArray(10 * 10 * 4),
      } as ImageData;

      expect(findContentBounds(emptyData)).toBeNull();
    });

    it('calculates the tight bounding box for non-transparent pixels', () => {
      const width = 20;
      const height = 20;
      const data = new Uint8ClampedArray(width * height * 4);

      // Place a 4x4 non-transparent block at x: 5..8, y: 10..13
      for (let y = 10; y <= 13; y++) {
        for (let x = 5; x <= 8; x++) {
          const idx = (y * width + x) * 4;
          data[idx] = 255; // R
          data[idx + 1] = 0; // G
          data[idx + 2] = 0; // B
          data[idx + 3] = 255; // Alpha
        }
      }

      const imgData = { width, height, data } as ImageData;
      const bounds = findContentBounds(imgData);

      expect(bounds).not.toBeNull();
      expect(bounds?.minX).toBe(5);
      expect(bounds?.maxX).toBe(8);
      expect(bounds?.minY).toBe(10);
      expect(bounds?.maxY).toBe(13);
      expect(bounds?.width).toBe(4);
      expect(bounds?.height).toBe(4);
    });

    it('respects custom alphaThreshold', () => {
      const width = 10;
      const height = 10;
      const data = new Uint8ClampedArray(width * height * 4);

      // Pixel with alpha 15
      const idx = (2 * width + 2) * 4;
      data[idx + 3] = 15;

      const imgData = { width, height, data } as ImageData;

      // With default threshold (10), it is detected
      expect(findContentBounds(imgData, 10)).not.toBeNull();

      // With higher threshold (20), it is ignored
      expect(findContentBounds(imgData, 20)).toBeNull();
    });
  });

  describe('removeBackgroundFromImageData', () => {
    it('returns false if image has 0 dimensions', () => {
      const zeroData = { width: 0, height: 0, data: new Uint8ClampedArray(0) } as ImageData;
      expect(removeBackgroundFromImageData(zeroData)).toBe(false);
    });

    it('returns false if corners are already transparent', () => {
      const width = 10;
      const height = 10;
      const data = new Uint8ClampedArray(width * height * 4);
      // All alpha is 0
      const imgData = { width, height, data } as ImageData;
      expect(removeBackgroundFromImageData(imgData)).toBe(false);
    });

    it('flood-fills and removes solid border background while preserving interior pixels', () => {
      const width = 10;
      const height = 10;
      const data = new Uint8ClampedArray(width * height * 4);

      // Fill entire image with white background (255, 255, 255, 255)
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = 255;
      }

      // Draw a dark ring around an interior white region:
      // Ring at x: 2..7, y: 2..7 with color (10, 10, 10, 255)
      for (let y = 2; y <= 7; y++) {
        for (let x = 2; x <= 7; x++) {
          if (x === 2 || x === 7 || y === 2 || y === 7) {
            const idx = (y * width + x) * 4;
            data[idx] = 10;
            data[idx + 1] = 10;
            data[idx + 2] = 10;
            data[idx + 3] = 255;
          }
        }
      }

      // Inside ring: center (4, 4) is white (255, 255, 255)
      const centerIdx = (4 * width + 4) * 4;
      expect(data[centerIdx]).toBe(255);

      const imgData = { width, height, data } as ImageData;
      const result = removeBackgroundFromImageData(imgData, 30);

      expect(result).toBe(true);

      // Outer border (0, 0) should now be transparent
      const cornerIdx = 0;
      expect(data[cornerIdx + 3]).toBe(0);

      // Dark ring border should still be opaque
      const ringIdx = (2 * width + 2) * 4;
      expect(data[ringIdx + 3]).toBe(255);

      // Interior white pixel (4, 4) should remain intact (not reached by flood fill)
      expect(data[centerIdx + 3]).toBe(255);
      expect(data[centerIdx]).toBe(255);
    });
  });

  describe('processCanvasImage and optimizeIconDataUrl', () => {
    it('returns SVG data URLs untouched in optimizeIconDataUrl', async () => {
      const svgData = 'data:image/svg+xml;utf8,<svg></svg>';
      const result = await optimizeIconDataUrl(svgData);
      expect(result).toBe(svgData);
    });

    it('falls back to img.src when canvas context is unavailable', () => {
      const mockImg = {
        width: 100,
        height: 100,
        src: 'data:image/png;base64,fallbackSource',
      } as HTMLImageElement;

      const origCreate = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'canvas') {
          const c = origCreate('canvas');
          c.getContext = vi.fn().mockReturnValue(null);
          return c;
        }
        return origCreate(tag);
      });

      const res = processCanvasImage(mockImg);
      expect(res).toBe('data:image/png;base64,fallbackSource');
    });

    it('crops tightly with autoCrop: true and handles removeBackground: true', () => {
      const mockImg = {
        width: 100,
        height: 100,
        src: 'data:image/png;base64,img',
      } as HTMLImageElement;

      const mockData = new Uint8ClampedArray(100 * 100 * 4);
      // Put a 20x20 subject in the middle at (40, 40)
      for (let y = 40; y < 60; y++) {
        for (let x = 40; x < 60; x++) {
          const idx = (y * 100 + x) * 4;
          mockData[idx] = 255;
          mockData[idx + 3] = 255;
        }
      }

      const mockSrcCtx = {
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue({
          width: 100,
          height: 100,
          data: mockData,
        }),
        putImageData: vi.fn(),
      };

      const mockDestCtx = {
        clearRect: vi.fn(),
        drawImage: vi.fn(),
      };

      const origCreate = document.createElement.bind(document);
      let canvasCount = 0;
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'canvas') {
          canvasCount++;
          const c = origCreate('canvas');
          c.getContext = vi.fn().mockReturnValue(canvasCount === 1 ? mockSrcCtx : mockDestCtx);
          c.toDataURL = vi.fn().mockReturnValue('data:image/png;base64,croppedResult');
          return c;
        }
        return origCreate(tag);
      });

      const result = processCanvasImage(mockImg, {
        autoCrop: true,
        removeBackground: true,
      });

      expect(result).toBe('data:image/png;base64,croppedResult');
      expect(mockSrcCtx.getImageData).toHaveBeenCalledWith(0, 0, 100, 100);
      expect(mockDestCtx.clearRect).toHaveBeenCalledWith(0, 0, 256, 256);
      expect(mockDestCtx.drawImage).toHaveBeenCalled();
    });

    it('processes raster data URLs via optimizeIconDataUrl', async () => {
      const origImage = global.Image;
      class MockSuccessImage {
        width = 100;
        height = 100;
        src = '';
        crossOrigin = '';
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor() {
          setTimeout(() => this.onload?.(), 0);
        }
      }
      // @ts-expect-error Mocking Image
      global.Image = MockSuccessImage;

      const origCreate = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'canvas') {
          const c = origCreate('canvas');
          c.getContext = vi.fn().mockReturnValue({
            clearRect: vi.fn(),
            drawImage: vi.fn(),
          });
          c.toDataURL = vi.fn().mockReturnValue('data:image/png;base64,dataUrlProcessed');
          return c;
        }
        return origCreate(tag);
      });

      try {
        const res = await optimizeIconDataUrl('data:image/png;base64,initial');
        expect(res).toBe('data:image/png;base64,dataUrlProcessed');
      } finally {
        global.Image = origImage;
      }
    });

    it('rejects optimizeIconDataUrl on decode failure', async () => {
      const origImage = global.Image;
      class MockFailingImage {
        src = '';
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor() {
          setTimeout(() => this.onerror?.(), 0);
        }
      }
      // @ts-expect-error Mocking Image
      global.Image = MockFailingImage;

      try {
        await expect(optimizeIconDataUrl('data:image/png;base64,corrupt')).rejects.toThrow(
          /Failed to decode image data URL/i,
        );
      } finally {
        global.Image = origImage;
      }
    });
  });
});
