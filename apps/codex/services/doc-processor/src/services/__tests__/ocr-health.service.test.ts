import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../config/env';
import { OcrHealthService } from '../ocr-health.service';

describe('OcrHealthService', () => {
  const originalFetch = globalThis.fetch;
  let origProvider: typeof env.EMBEDDINGS_PROVIDER;
  let origUrl: string | undefined;

  beforeEach(() => {
    origProvider = env.EMBEDDINGS_PROVIDER;
    origUrl = env.OCR_SERVICE_URL;
    (env as any).EMBEDDINGS_PROVIDER = 'sidecar';
    (env as any).OCR_SERVICE_URL = 'http://ocr:8000/';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    (env as any).EMBEDDINGS_PROVIDER = origProvider;
    (env as any).OCR_SERVICE_URL = origUrl;
  });

  const mockHealth = (body: unknown, ok = true, status = 200) => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok, status, json: vi.fn().mockResolvedValue(body) }) as any;
  };

  it('returns the reported embed model when healthy', async () => {
    mockHealth({ status: 'ok', embed: { model: 'BAAI/bge-small-en-v1.5', dim: 384 } });
    const health = await new OcrHealthService().assertEmbeddingsReady();
    expect(health?.embed).toEqual({ model: 'BAAI/bge-small-en-v1.5', dim: 384 });
    expect(globalThis.fetch).toHaveBeenCalledWith('http://ocr:8000/health', expect.anything());
  });

  it('is a no-op for non-sidecar providers', async () => {
    (env as any).EMBEDDINGS_PROVIDER = 'hash';
    globalThis.fetch = vi.fn() as any;
    expect(await new OcrHealthService().assertEmbeddingsReady()).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('throws when the service is unreachable', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as any;
    await expect(new OcrHealthService().check('layout')).rejects.toThrow('unreachable');
  });

  it('throws on a non-200 health response', async () => {
    mockHealth({}, false, 503);
    await expect(new OcrHealthService().check('layout')).rejects.toThrow('HTTP 503');
  });

  it('throws when the embed model fell back to hash vectors', async () => {
    mockHealth({ status: 'ok', embed: { model: 'fallback-hash-384', dim: 384 } });
    await expect(new OcrHealthService().assertEmbeddingsReady()).rejects.toThrow('failed to load');
  });

  it('throws when OCR_SERVICE_URL is unset', async () => {
    (env as any).OCR_SERVICE_URL = '';
    await expect(new OcrHealthService().check('index')).rejects.toThrow('OCR_SERVICE_URL is unset');
  });
});
