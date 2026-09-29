import { env } from '../config/env';
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
      throw new Error(`ocr-service /layout/s3 pages ${params.pageStart}-${params.pageEnd} failed: HTTP ${response.status} ${detail}`.trim());
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
}

export const layoutClientService = new LayoutClientService();
