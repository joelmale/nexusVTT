import { env } from '../config/env';

export type OcrServiceHealth = {
  status: string;
  embed?: { model: string; dim: number };
  layout?: { engine: string; version: string; installed?: boolean; modelsLoaded: boolean; device: string; error?: string | null };
  [key: string]: unknown;
};

const HEALTH_TIMEOUT_MS = 5000;

export class OcrHealthService {
  /**
   * GET ocr-service /health. Throws when the service is unconfigured,
   * unreachable or unhealthy, so a stage that depends on it fails (and BullMQ
   * retries it) before doing any work.
   */
  async check(purpose: string): Promise<OcrServiceHealth> {
    if (!env.OCR_SERVICE_URL) {
      throw new Error(`ocr-service required for ${purpose} but OCR_SERVICE_URL is unset`);
    }

    const baseUrl = env.OCR_SERVICE_URL.replace(/\/$/, '');
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
    } catch (error: any) {
      throw new Error(`ocr-service unreachable at ${baseUrl} (needed for ${purpose}): ${error?.message}`);
    }

    if (!response.ok) {
      throw new Error(`ocr-service /health returned HTTP ${response.status} (needed for ${purpose})`);
    }

    const health = (await response.json()) as OcrServiceHealth;
    if (health.status !== 'ok') {
      throw new Error(`ocr-service reports status "${health.status}" (needed for ${purpose})`);
    }

    return health;
  }

  /** Health gate for sidecar embeddings. A no-op for the hash and none providers. */
  async assertEmbeddingsReady(): Promise<OcrServiceHealth | null> {
    if (env.EMBEDDINGS_PROVIDER !== 'sidecar') return null;
    const health = await this.check('embeddings');
    if (health.embed?.model?.startsWith('fallback')) {
      throw new Error(`ocr-service embed model failed to load (serving ${health.embed.model})`);
    }
    return health;
  }
}

export const ocrHealthService = new OcrHealthService();
