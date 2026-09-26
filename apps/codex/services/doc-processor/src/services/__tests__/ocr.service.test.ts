import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockWorker = {
  recognize: vi.fn(),
  terminate: vi.fn(),
};

vi.mock('tesseract.js', () => ({
  createWorker: vi.fn().mockImplementation(() => Promise.resolve(mockWorker)),
}));

import { ocrService } from '../ocr.service';
import { env } from '../../config/env';

describe('OCRService', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = originalFetch;
    mockWorker.recognize.mockResolvedValue({ data: { text: 'Extracted sample text' } });
    mockWorker.terminate.mockResolvedValue(undefined);
  });

  describe('isImageBasedPage', () => {
    it('should return true for very short text (likely scanned image)', () => {
      const text = '   \n  \n   ';
      expect(ocrService.isImageBasedPage(text)).toBe(true);
    });

    it('should return true for text under 50 characters', () => {
      const text = 'Short text';
      expect(ocrService.isImageBasedPage(text)).toBe(true);
    });

    it('should return false for text over 50 characters', () => {
      const text = 'This is a longer text that has more than fifty characters in it.';
      expect(ocrService.isImageBasedPage(text)).toBe(false);
    });

    it('should return false for normal document text', () => {
      const text = `
        This is a typical document with multiple paragraphs of text.
        It has several sentences and should be detected as a text-based PDF
        rather than an image-based one that requires OCR processing.
      `;
      expect(ocrService.isImageBasedPage(text)).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(ocrService.isImageBasedPage('')).toBe(true);
    });

    it('should handle whitespace-only strings', () => {
      expect(ocrService.isImageBasedPage('     ')).toBe(true);
    });
  });

  describe('callSidecarOcr', () => {
    it('returns null if OCR_SERVICE_URL is unset', async () => {
      const originalUrl = env.OCR_SERVICE_URL;
      (env as any).OCR_SERVICE_URL = undefined;
      const result = await ocrService.callSidecarOcr(Buffer.from('img'), 1);
      expect(result).toBeNull();
      (env as any).OCR_SERVICE_URL = originalUrl;
    });

    it('calls sidecar URL and returns structured response when successful', async () => {
      (env as any).OCR_SERVICE_URL = 'http://localhost:8000';
      const mockSidecarData = {
        text: 'GPU extracted text',
        confidence: 0.97,
        duration_ms: 120,
        blocks: [{ bbox: [[0, 0], [10, 0], [10, 10], [0, 10]], text: 'GPU extracted text', confidence: 0.97 }],
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockSidecarData),
      }) as any;

      const result = await ocrService.callSidecarOcr(Buffer.from('img'), 2);
      expect(result).toEqual({
        text: 'GPU extracted text',
        confidence: 0.97,
        durationMs: 120,
        blocks: mockSidecarData.blocks,
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/ocr/bytes?page_number=2&reorder_columns=true',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
        })
      );
      (env as any).OCR_SERVICE_URL = undefined;
    });

    it('returns null and catches error when sidecar returns non-200 status', async () => {
      (env as any).OCR_SERVICE_URL = 'http://localhost:8000';
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      }) as any;

      const result = await ocrService.callSidecarOcr(Buffer.from('img'), 1);
      expect(result).toBeNull();
      (env as any).OCR_SERVICE_URL = undefined;
    });

    it('returns null and catches error when sidecar fetch rejects (timeout / connection error)', async () => {
      (env as any).OCR_SERVICE_URL = 'http://localhost:8000';
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

      const result = await ocrService.callSidecarOcr(Buffer.from('img'), 1);
      expect(result).toBeNull();
      (env as any).OCR_SERVICE_URL = undefined;
    });
  });

  describe('callSidecarOcrS3', () => {
    it('returns null if OCR_SERVICE_URL is unset', async () => {
      const originalUrl = env.OCR_SERVICE_URL;
      (env as any).OCR_SERVICE_URL = undefined;
      const result = await ocrService.callSidecarOcrS3('documents', 'key.png', 1);
      expect(result).toBeNull();
      (env as any).OCR_SERVICE_URL = originalUrl;
    });

    it('calls /ocr/s3 endpoint with bucket and key payload', async () => {
      (env as any).OCR_SERVICE_URL = 'http://localhost:8000';
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ text: 'S3 direct text', confidence: 0.99, duration_ms: 45 }),
      }) as any;

      const result = await ocrService.callSidecarOcrS3('documents', 'ocr-temp/page-1.png', 1);
      expect(result).toEqual({
        text: 'S3 direct text',
        confidence: 0.99,
        durationMs: 45,
        blocks: undefined,
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/ocr/s3',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bucket: 'documents',
            key: 'ocr-temp/page-1.png',
            page_number: 1,
            reorder_columns: true,
          }),
        })
      );
      (env as any).OCR_SERVICE_URL = undefined;
    });

    it('returns null and catches error when /ocr/s3 fails', async () => {
      (env as any).OCR_SERVICE_URL = 'http://localhost:8000';
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('S3 direct error'));

      const result = await ocrService.callSidecarOcrS3('documents', 'bad-key.png', 1);
      expect(result).toBeNull();
      (env as any).OCR_SERVICE_URL = undefined;
    });
  });

  describe('extractTextFromImage', () => {
    it('uses sidecar when available and non-empty', async () => {
      (env as any).OCR_SERVICE_URL = 'http://localhost:8000';
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ text: 'GPU accelerated text' }),
      }) as any;

      const text = await ocrService.extractTextFromImage(Buffer.from('test-image'));
      expect(text).toBe('GPU accelerated text');
      expect(mockWorker.recognize).not.toHaveBeenCalled();
      (env as any).OCR_SERVICE_URL = undefined;
    });

    it('recognizes text with Tesseract worker when sidecar is disabled or fails', async () => {
      const buffer = Buffer.from('fake image');
      const text = await ocrService.extractTextFromImage(buffer);

      expect(text).toBe('Extracted sample text');
      expect(mockWorker.recognize).toHaveBeenCalledWith(buffer);
      expect(mockWorker.terminate).toHaveBeenCalledTimes(1);
    });

    it('throws wrapped error if recognize fails', async () => {
      mockWorker.recognize.mockRejectedValueOnce(new Error('Tesseract crashed'));
      await expect(ocrService.extractTextFromImage(Buffer.from('bad'))).rejects.toThrow('OCR failed: Tesseract crashed');
    });
  });

  describe('extractTextFromImages', () => {
    it('recognizes text across multiple buffers with one worker', async () => {
      const buffers = [Buffer.from('page 1'), Buffer.from('page 2')];
      const results = await ocrService.extractTextFromImages(buffers);

      expect(results).toEqual(['Extracted sample text', 'Extracted sample text']);
      expect(mockWorker.recognize).toHaveBeenCalledTimes(2);
      expect(mockWorker.terminate).toHaveBeenCalledTimes(1);
    });

    it('uses sidecar for pages when sidecar is available', async () => {
      (env as any).OCR_SERVICE_URL = 'http://localhost:8000';
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ text: 'Sidecar page text' }),
      }) as any;

      const buffers = [Buffer.from('page 1'), Buffer.from('page 2')];
      const results = await ocrService.extractTextFromImages(buffers);

      expect(results).toEqual(['Sidecar page text', 'Sidecar page text']);
      expect(mockWorker.recognize).not.toHaveBeenCalled();
      (env as any).OCR_SERVICE_URL = undefined;
    });
  });

  describe('extractTextFromImagesWithPool', () => {
    it('processes image buffers using the worker pool', async () => {
      const buffers = [Buffer.from('page 1'), Buffer.from('page 2')];
      const res = await ocrService.extractTextFromImagesWithPool(buffers, 2);

      expect(res.results).toEqual(['Extracted sample text', 'Extracted sample text']);
      expect(mockWorker.recognize).toHaveBeenCalledTimes(2);
    });

    it('uses sidecar results when available in worker pool', async () => {
      (env as any).OCR_SERVICE_URL = 'http://localhost:8000';
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ text: 'Pool sidecar text' }),
      }) as any;

      const buffers = [Buffer.from('page 1')];
      const res = await ocrService.extractTextFromImagesWithPool(buffers, 1);

      expect(res.results).toEqual(['Pool sidecar text']);
      expect(mockWorker.recognize).not.toHaveBeenCalled();
      (env as any).OCR_SERVICE_URL = undefined;
    });
  });

  describe('extractTextFromKeysWithPool', () => {
    it('loads buffers on-demand via loader and calls onPageComplete', async () => {
      const keys = ['ocr-temp/doc/page-1.png', 'ocr-temp/doc/page-2.png'];
      const loadedKeys: string[] = [];
      const completedKeys: string[] = [];

      const loader = vi.fn().mockImplementation(async (key: string) => {
        loadedKeys.push(key);
        return Buffer.from(`data for ${key}`);
      });

      const onPageComplete = vi.fn().mockImplementation(async (key: string) => {
        completedKeys.push(key);
      });

      const res = await ocrService.extractTextFromKeysWithPool(keys, loader, 2, onPageComplete);

      expect(res.results).toHaveLength(2);
      expect(loadedKeys).toEqual(keys);
      expect(completedKeys).toEqual(keys);
      expect(mockWorker.recognize).toHaveBeenCalledTimes(2);
    });

    it('uses direct S3 handoff when s3Bucket is supplied, avoiding buffer loader download', async () => {
      (env as any).OCR_SERVICE_URL = 'http://localhost:8000';
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ text: 'Direct S3 Text' }),
      }) as any;

      const keys = ['ocr-temp/page-1.png'];
      const loader = vi.fn();

      const res = await ocrService.extractTextFromKeysWithPool(
        keys,
        loader,
        1,
        undefined,
        'documents'
      );

      expect(res.results).toEqual(['Direct S3 Text']);
      expect(loader).not.toHaveBeenCalled(); // Node RAM spared from image download
      expect(mockWorker.recognize).not.toHaveBeenCalled();
      (env as any).OCR_SERVICE_URL = undefined;
    });

    it('uses sidecar with fallback to worker on error in on-demand pool', async () => {
      (env as any).OCR_SERVICE_URL = 'http://localhost:8000';
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: true,
            json: async () => ({ text: 'Page 1 sidecar text' }),
          };
        }
        // Page 2 sidecar fails -> falls back to Tesseract worker
        throw new Error('GPU OOM or timeout');
      }) as any;

      const keys = ['page-1.png', 'page-2.png'];
      const loader = vi.fn().mockImplementation(async (key: string) => Buffer.from(key));
      const res = await ocrService.extractTextFromKeysWithPool(keys, loader, 1);

      expect(res.results).toEqual(['Page 1 sidecar text', 'Extracted sample text']);
      expect(mockWorker.recognize).toHaveBeenCalledTimes(1); // Only for page 2 fallback
      (env as any).OCR_SERVICE_URL = undefined;
    });
  });
});
