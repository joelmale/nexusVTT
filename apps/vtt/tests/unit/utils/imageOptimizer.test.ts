import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  optimizeIconImage,
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
});
