import { beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('falls back to hash embeddings when sidecar request fails', async () => {
    const origProvider = env.EMBEDDINGS_PROVIDER;
    const origUrl = env.OCR_SERVICE_URL;
    (env as any).EMBEDDINGS_PROVIDER = 'sidecar';
    (env as any).OCR_SERVICE_URL = 'http://localhost:8000';

    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

    const service = new EmbeddingsService();
    const vectors = await service.embedTexts(['Fallback text']);
    expect(vectors).toHaveLength(1);
    expect(vectors[0]).toHaveLength(env.EMBEDDINGS_DIM);

    (env as any).EMBEDDINGS_PROVIDER = origProvider;
    (env as any).OCR_SERVICE_URL = origUrl;
  });

  it('falls back to hash embeddings when sidecar responds with non-200 status', async () => {
    const origProvider = env.EMBEDDINGS_PROVIDER;
    const origUrl = env.OCR_SERVICE_URL;
    (env as any).EMBEDDINGS_PROVIDER = 'sidecar';
    (env as any).OCR_SERVICE_URL = 'http://localhost:8000';

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    }) as any;

    const service = new EmbeddingsService();
    const vectors = await service.embedTexts(['Error fallback']);
    expect(vectors).toHaveLength(1);
    expect(vectors[0]).toHaveLength(env.EMBEDDINGS_DIM);

    (env as any).EMBEDDINGS_PROVIDER = origProvider;
    (env as any).OCR_SERVICE_URL = origUrl;
  });

  it('falls back to hash embeddings when OCR_SERVICE_URL is unset', async () => {
    const origProvider = env.EMBEDDINGS_PROVIDER;
    const origUrl = env.OCR_SERVICE_URL;
    (env as any).EMBEDDINGS_PROVIDER = 'sidecar';
    (env as any).OCR_SERVICE_URL = '';

    const service = new EmbeddingsService();
    const vectors = await service.embedTexts(['No URL fallback']);
    expect(vectors).toHaveLength(1);
    expect(vectors[0]).toHaveLength(env.EMBEDDINGS_DIM);

    (env as any).EMBEDDINGS_PROVIDER = origProvider;
    (env as any).OCR_SERVICE_URL = origUrl;
  });
});
