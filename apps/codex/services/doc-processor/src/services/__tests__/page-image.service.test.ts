import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCanvas, mockDestroy, mockGetPage, mockWebpBuffer } = vi.hoisted(() => {
  const mockContext = {};
  const mockCanvasObj = {
    getContext: vi.fn().mockReturnValue(mockContext),
    toBuffer: vi.fn().mockReturnValue(Buffer.from('fake-png-data')),
  };
  const mockDestroyFn = vi.fn().mockResolvedValue(undefined);
  const mockGetPageFn = vi.fn().mockImplementation((_pageNumber: number) => ({
    getViewport: vi.fn().mockReturnValue({ width: 600, height: 800 }),
    render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
  }));
  const webpBuf = Buffer.from('fake-webp-data');

  return {
    mockCanvas: mockCanvasObj,
    mockDestroy: mockDestroyFn,
    mockGetPage: mockGetPageFn,
    mockWebpBuffer: webpBuf,
  };
});

vi.mock('../../utils/canvas', () => ({
  createCanvas: vi.fn().mockImplementation(() => mockCanvas),
  CanvasImage: {},
  canvasBackend: 'mock-canvas',
}));

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn().mockImplementation(() => ({
    promise: Promise.resolve({
      numPages: 2,
      getPage: mockGetPage,
    }),
    destroy: mockDestroy,
  })),
}));

vi.mock('sharp', () => ({
  default: vi.fn().mockReturnValue({
    webp: vi.fn().mockReturnValue({
      toBuffer: vi.fn().mockResolvedValue(mockWebpBuffer),
    }),
  }),
}));

import { pageImageService } from '../page-image.service';

describe('PageImageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('renderPageImages', () => {
    it('renders all pages to WebP buffers when no onPage callback is provided', async () => {
      const pdfBuffer = Buffer.from('sample pdf');
      const progressCalls: any[] = [];

      const images = await pageImageService.renderPageImages(pdfBuffer, {
        onProgress: (p) => progressCalls.push(p),
      });

      expect(images).toHaveLength(2);
      expect(images[0]).toEqual({
        pageNumber: 1,
        buffer: mockWebpBuffer,
        ocrBuffer: undefined,
      });
      expect(images[1]).toEqual({
        pageNumber: 2,
        buffer: mockWebpBuffer,
        ocrBuffer: undefined,
      });
      expect(progressCalls).toHaveLength(2);
      expect(mockDestroy).toHaveBeenCalledTimes(1);
    });

    it('streams pages via onPage callback and frees memory without accumulating in returned array', async () => {
      const pdfBuffer = Buffer.from('sample pdf');
      const streamedPages: number[] = [];

      const images = await pageImageService.renderPageImages(pdfBuffer, {
        onPage: async (page) => {
          streamedPages.push(page.pageNumber);
          expect(page.buffer).toEqual(mockWebpBuffer);
        },
      });

      expect(streamedPages).toEqual([1, 2]);
      expect(images).toEqual([]); // Memory is preserved by not storing in the array
      expect(mockDestroy).toHaveBeenCalledTimes(1);
    });

    it('includes ocrBuffer when includeOcrBuffer is requested', async () => {
      const pdfBuffer = Buffer.from('sample pdf');
      const images = await pageImageService.renderPageImages(pdfBuffer, {
        includeOcrBuffer: true,
      });

      expect(images[0].ocrBuffer).toBeDefined();
    });

    it('throws error if canvas 2d context is unavailable', async () => {
      mockCanvas.getContext.mockReturnValueOnce(null);
      await expect(
        pageImageService.renderPageImages(Buffer.from('pdf'))
      ).rejects.toThrow('Canvas 2d context unavailable');
      expect(mockDestroy).toHaveBeenCalledTimes(1);
    });
  });

  describe('renderOcrImages', () => {
    it('renders all pages to PNG buffers when no onPage callback is provided', async () => {
      const pdfBuffer = Buffer.from('sample pdf');
      const images = await pageImageService.renderOcrImages(pdfBuffer);

      expect(images).toHaveLength(2);
      expect(images[0].pageNumber).toBe(1);
      expect(images[0].buffer).toEqual(Buffer.from('fake-png-data'));
      expect(mockDestroy).toHaveBeenCalledTimes(1);
    });

    it('streams OCR pages via onPage callback to avoid holding all buffers in memory', async () => {
      const pdfBuffer = Buffer.from('sample pdf');
      const streamedPages: number[] = [];

      const images = await pageImageService.renderOcrImages(pdfBuffer, {
        onPage: async (page) => {
          streamedPages.push(page.pageNumber);
          expect(page.buffer).toEqual(Buffer.from('fake-png-data'));
        },
      });

      expect(streamedPages).toEqual([1, 2]);
      expect(images).toEqual([]);
      expect(mockDestroy).toHaveBeenCalledTimes(1);
    });

    it('renders only targetPages when targetPages option is supplied (per-page gating)', async () => {
      const pdfBuffer = Buffer.from('sample pdf');
      const renderedPages: number[] = [];

      const images = await pageImageService.renderOcrImages(pdfBuffer, {
        targetPages: [2],
        onPage: async (page) => {
          renderedPages.push(page.pageNumber);
        },
      });

      expect(renderedPages).toEqual([2]);
      expect(mockGetPage).toHaveBeenCalledWith(2);
      expect(mockGetPage).not.toHaveBeenCalledWith(1);
      expect(images).toEqual([]);
    });
  });
});
