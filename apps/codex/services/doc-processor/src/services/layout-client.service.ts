import { UnrecoverableError } from 'bullmq';
import { env } from '../config/env';
import { isPermanentHttpStatus } from './stage-retry';
import { LayoutBatchResponse } from '../types/layout';

/**
 * Client for ocr-service POST /layout/s3 (Marker on a page range). ocr-service
 * reads the PDF straight from S3 and, with renderPreviews, uploads page
 * previews under previewPrefix.
 */
export class LayoutClientService {
  async convertRange(params: {
    bucket: string;
    key: string;
    pageStart: number;
    pageEnd: number;
    renderPreviews: boolean;
    previewPrefix: string;
  }): Promise<LayoutBatchResponse> {
    if (!env.OCR_SERVICE_URL) {
      throw new Error('Layout stage requires OCR_SERVICE_URL');
    }

    const baseUrl = env.OCR_SERVICE_URL.replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/layout/s3`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(env.LAYOUT_SERVICE_TIMEOUT_MS),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      const message = `ocr-service /layout/s3 pages ${params.pageStart}-${params.pageEnd} failed: HTTP ${response.status} ${detail}`.trim();
      // A 4xx means the request is wrong (bad range, missing key): fail the job now instead of retrying.
      throw isPermanentHttpStatus(response.status) ? new UnrecoverableError(message) : new Error(message);
    }

    const data = (await response.json()) as LayoutBatchResponse;
    if (!Array.isArray(data.pages)) {
      throw new Error('ocr-service /layout/s3 returned no pages array');
    }
    for (const page of data.pages) {
      if (page.pageNumber < params.pageStart || page.pageNumber > params.pageEnd) {
        throw new Error(`ocr-service /layout/s3 returned page ${page.pageNumber} outside ${params.pageStart}-${params.pageEnd}`);
      }
    }
    return data;
  }

  /**
   * Asks ocr-service to drop the Marker models and free their VRAM (6 GB GPU
   * handoff to the VLM). They reload on the next /layout/s3 call. Best effort.
   */
  async unloadModels(): Promise<boolean> {
    if (!env.OCR_SERVICE_URL) return false;
    try {
      const response = await fetch(`${env.OCR_SERVICE_URL.replace(/\/$/, '')}/layout/unload`, {
        method: 'POST',
        signal: AbortSignal.timeout(30000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const layoutClientService = new LayoutClientService();
