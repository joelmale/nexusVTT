import { createWorker } from 'tesseract.js';
import { env } from '../config/env';
import { runWorkerPool, WorkerPoolResult } from './ocr-pool';

export interface SidecarOcrBlock {
  bbox: number[][];
  text: string;
  confidence: number;
}

export interface SidecarOcrResult {
  text: string;
  confidence: number;
  durationMs: number;
  blocks?: SidecarOcrBlock[];
}

class OcrService {
  /**
   * Calls the GPU-accelerated OCR sidecar microservice if configured.
   * Returns parsed OCR results or null if the service is disabled or errors out.
   */
  async callSidecarOcr(
    imageBuffer: Buffer,
    pageNumber: number = 1
  ): Promise<SidecarOcrResult | null> {
    if (!env.OCR_SERVICE_URL) {
      return null;
    }

    try {
      const baseUrl = env.OCR_SERVICE_URL.replace(/\/$/, '');
      const url = `${baseUrl}/ocr/bytes?page_number=${pageNumber}&reorder_columns=true`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: imageBuffer,
        signal: AbortSignal.timeout(env.OCR_SERVICE_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      return {
        text: data.text || '',
        confidence: typeof data.confidence === 'number' ? data.confidence : 1.0,
        durationMs: typeof data.duration_ms === 'number' ? data.duration_ms : 0,
        blocks: data.blocks,
      };
    } catch (error: any) {
      console.warn(`[OcrService] Sidecar OCR failed (${error?.message}). Falling back to Tesseract.`);
      return null;
    }
  }

  /**
   * Extract text from an image buffer using OCR.
   * Attempts GPU sidecar first; falls back to Tesseract.js if sidecar is unavailable or fails.
   */
  async extractTextFromImage(imageBuffer: Buffer): Promise<string> {
    const sidecarResult = await this.callSidecarOcr(imageBuffer, 1);
    if (sidecarResult !== null && sidecarResult.text.trim().length > 0) {
      return sidecarResult.text;
    }

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
    let worker: any = null;

    try {
      const results: string[] = [];

      for (let i = 0; i < imageBuffers.length; i++) {
        const buffer = imageBuffers[i];
        const sidecar = await this.callSidecarOcr(buffer, i + 1);
        if (sidecar !== null && sidecar.text.trim().length > 0) {
          results.push(sidecar.text);
          continue;
        }

        if (!worker) {
          worker = await createWorker('eng');
        }
        const { data } = await worker.recognize(buffer);
        results.push(data.text);
      }

      return results;
    } finally {
      if (worker) {
        await worker.terminate();
      }
    }
  }

  /**
   * Extract text from multiple pages using a worker pool
   */
  async extractTextFromImagesWithPool(
    imageBuffers: Buffer[],
    workerCount: number = env.OCR_WORKER_POOL_SIZE
  ): Promise<WorkerPoolResult<string>> {
    const poolSize = Math.max(1, Math.min(workerCount, imageBuffers.length || 1));
    const result = await runWorkerPool<Buffer, string, any>(
      imageBuffers,
      poolSize,
      () => createWorker('eng'),
      async (worker, buffer, index) => {
        const sidecar = await this.callSidecarOcr(buffer, index + 1);
        if (sidecar !== null && sidecar.text.trim().length > 0) {
          return sidecar.text;
        }

        const { data } = await worker.recognize(buffer);
        return data.text;
      },
      async (worker) => worker.terminate()
    );

    return result;
  }

  /**
   * Extract text from multiple pages on-demand using a worker pool.
   * Downloads each page buffer via loader only when a worker is free,
   * keeping RAM usage bounded to poolSize buffers at any time.
   * Attempts GPU sidecar first; falls back to Tesseract worker on failure.
   */
  async extractTextFromKeysWithPool(
    pageKeys: string[],
    loader: (key: string, index: number) => Promise<Buffer>,
    workerCount: number = env.OCR_WORKER_POOL_SIZE,
    onPageComplete?: (key: string, index: number, text: string) => Promise<void>
  ): Promise<WorkerPoolResult<string>> {
    const poolSize = Math.max(1, Math.min(workerCount, pageKeys.length || 1));
    const result = await runWorkerPool<string, string, any>(
      pageKeys,
      poolSize,
      () => createWorker('eng'),
      async (worker, key, index) => {
        const buffer = await loader(key, index);
        let text = '';

        // Attempt GPU sidecar first
        const sidecar = await this.callSidecarOcr(buffer, index + 1);
        if (sidecar !== null && sidecar.text.trim().length > 0) {
          text = sidecar.text;
        } else {
          // Fall back to local CPU Tesseract worker
          const { data } = await worker.recognize(buffer);
          text = data.text;
        }

        if (onPageComplete) {
          await onPageComplete(key, index, text);
        }
        return text;
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
