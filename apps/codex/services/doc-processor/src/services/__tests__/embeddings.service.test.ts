import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../config/env';
import { EmbeddingsService } from '../embeddings.service';

describe('EmbeddingsService', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = originalFetch;
  });

  it('returns none provider when EMBEDDINGS_PROVIDER=none', async () => {
    const orig = env.EMBEDDINGS_PROVIDER;
    (env as any).EMBEDDINGS_PROVIDER = 'none';

    const service = new EmbeddingsService();
    expect(service.getProviderName()).toBe('none');
    expect(await service.embedTexts(['Hello world'])).toEqual([]);

    (env as any).EMBEDDINGS_PROVIDER = orig;
  });

  it('generates hash embeddings when EMBEDDINGS_PROVIDER=hash', async () => {
    const orig = env.EMBEDDINGS_PROVIDER;
    (env as any).EMBEDDINGS_PROVIDER = 'hash';

    const service = new EmbeddingsService();
    expect(service.getProviderName()).toBe('hash');
    const vectors = await service.embedTexts(['Fireball spell', 'Magic missile']);
    expect(vectors).toHaveLength(2);
    expect(vectors[0]).toHaveLength(env.EMBEDDINGS_DIM);

    (env as any).EMBEDDINGS_PROVIDER = orig;
  });

  it('generates sidecar embeddings when EMBEDDINGS_PROVIDER=sidecar and service is healthy', async () => {
    const origProvider = env.EMBEDDINGS_PROVIDER;
    const origUrl = env.OCR_SERVICE_URL;
    (env as any).EMBEDDINGS_PROVIDER = 'sidecar';
    (env as any).OCR_SERVICE_URL = 'http://localhost:8000';

    const mockEmbeddings = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]];
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ embeddings: mockEmbeddings }),
    }) as any;

    const service = new EmbeddingsService();
    expect(service.getProviderName()).toBe('sidecar');
    const vectors = await service.embedTexts(['Spell 1', 'Spell 2']);
    expect(vectors).toEqual(mockEmbeddings);

    (env as any).EMBEDDINGS_PROVIDER = origProvider;
    (env as any).OCR_SERVICE_URL = origUrl;
  });

  it('labels sidecar vectors with the model the sidecar reports', async () => {
    const origProvider = env.EMBEDDINGS_PROVIDER;
    const origUrl = env.OCR_SERVICE_URL;
    (env as any).EMBEDDINGS_PROVIDER = 'sidecar';
    (env as any).OCR_SERVICE_URL = 'http://localhost:8000';

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ embeddings: [[0.1]], model: 'BAAI/bge-small-en-v1.5' }),
    }) as any;

    const result = await new EmbeddingsService().embedTextsWithModel(['Spell']);
    expect(result.model).toBe('BAAI/bge-small-en-v1.5');

    (env as any).EMBEDDINGS_PROVIDER = origProvider;
    (env as any).OCR_SERVICE_URL = origUrl;
  });

  it('labels hash vectors as hash', async () => {
    const orig = env.EMBEDDINGS_PROVIDER;
    (env as any).EMBEDDINGS_PROVIDER = 'hash';

    const result = await new EmbeddingsService().embedTextsWithModel(['Fireball']);
    expect(result.model).toBe('hash');

    (env as any).EMBEDDINGS_PROVIDER = orig;
  });

  describe('sidecar failures throw instead of falling back to hash vectors', () => {
    let origProvider: typeof env.EMBEDDINGS_PROVIDER;
    let origUrl: string | undefined;

    beforeEach(() => {
      origProvider = env.EMBEDDINGS_PROVIDER;
      origUrl = env.OCR_SERVICE_URL;
      (env as any).EMBEDDINGS_PROVIDER = 'sidecar';
      (env as any).OCR_SERVICE_URL = 'http://localhost:8000';
    });

    afterEach(() => {
      (env as any).EMBEDDINGS_PROVIDER = origProvider;
      (env as any).OCR_SERVICE_URL = origUrl;
    });

    it('when the request fails', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));
      await expect(new EmbeddingsService().embedTexts(['text'])).rejects.toThrow('Connection refused');
    });

    it('when the sidecar responds with a non-200 status', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      }) as any;
      await expect(new EmbeddingsService().embedTexts(['text'])).rejects.toThrow('HTTP 500');
    });

    it('when OCR_SERVICE_URL is unset', async () => {
      (env as any).OCR_SERVICE_URL = '';
      await expect(new EmbeddingsService().embedTexts(['text'])).rejects.toThrow('OCR_SERVICE_URL is unset');
    });

    it('when the vector count does not match the input count', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ embeddings: [[0.1]], model: 'm' }),
      }) as any;
      await expect(new EmbeddingsService().embedTexts(['a', 'b'])).rejects.toThrow('1 vectors for 2 inputs');
    });

    it('when the sidecar itself is serving fallback vectors', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ embeddings: [[0.1]], model: 'fallback-hash-384' }),
      }) as any;
      await expect(new EmbeddingsService().embedTexts(['a'])).rejects.toThrow('fallback vectors');
    });

    it('when the model changes between batches', async () => {
      const origBatch = env.EMBEDDINGS_BATCH_SIZE;
      (env as any).EMBEDDINGS_BATCH_SIZE = 1;
      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ embeddings: [[0.1]], model: 'a' }) })
        .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ embeddings: [[0.2]], model: 'b' }) }) as any;
      await expect(new EmbeddingsService().embedTexts(['x', 'y'])).rejects.toThrow('changed mid-document');
      (env as any).EMBEDDINGS_BATCH_SIZE = origBatch;
    });
  });
});
