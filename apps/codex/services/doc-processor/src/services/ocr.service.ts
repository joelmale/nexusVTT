import { createWorker } from 'tesseract.js';
import { env } from '../config/env';
import { runWorkerPool, WorkerPoolResult } from './ocr-pool';

class OcrService {
  /**
   * Extract text from an image buffer using OCR
   */
  async extractTextFromImage(imageBuffer: Buffer): Promise<string> {
    try {
      const worker = await createWorker('eng');

      const { data } = await worker.recognize(imageBuffer);

      await worker.terminate();

      return data.text;
    } catch (error) {
      console.error('OCR extraction error:', error);
      throw new Error(`OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract text from multiple pages (image buffers)
   */
  async extractTextFromImages(imageBuffers: Buffer[]): Promise<string[]> {
    const worker = await createWorker('eng');

    try {
      const results: string[] = [];

      for (const buffer of imageBuffers) {
        const { data } = await worker.recognize(buffer);
        results.push(data.text);
      }

      return results;
    } finally {
      await worker.terminate();
    }
  }

  /**
   * Extract text from multiple pages using a worker pool
   */
  async extractTextFromImagesWithPool(imageBuffers: Buffer[], workerCount: number = env.OCR_WORKER_POOL_SIZE): Promise<WorkerPoolResult<string>> {
    const poolSize = Math.max(1, Math.min(workerCount, imageBuffers.length || 1));
    const result = await runWorkerPool<Buffer, string, any>(
      imageBuffers,
      poolSize,
      () => createWorker('eng'),
      async (worker, buffer) => {
        const { data } = await worker.recognize(buffer);
        return data.text;
      },
      async (worker) => worker.terminate()
    );

    return result;
  }

  /**
   * Check if PDF page appears to be image-based (scanned)
   * This is a heuristic - checks if extracted text is very short
   */
  isImageBasedPage(extractedText: string): boolean {
    // If extracted text is very short or empty, likely an image-based PDF
    const trimmed = extractedText.trim();
    return trimmed.length < env.OCR_TEXT_MIN_CHARS || trimmed.split(/\s+/).length < env.OCR_TEXT_MIN_WORDS;
  }
}

export const ocrService = new OcrService();
