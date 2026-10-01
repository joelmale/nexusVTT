import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../config/env';
import { localEndpoint, resolveOllamaEndpoint } from '../ollama-endpoint';

describe('resolveOllamaEndpoint', () => {
  const originalFetch = globalThis.fetch;
  const saved: Record<string, unknown> = {};
  const keys = ['OLLAMA_URL', 'VLM_MODEL', 'OLLAMA_REMOTE_URL', 'OLLAMA_REMOTE_MODEL'] as const;

  beforeEach(() => {
    for (const key of keys) saved[key] = (env as any)[key];
    Object.assign(env as any, {
      OLLAMA_URL: 'http://ollama:11434',
      VLM_MODEL: 'qwen3-vl:4b',
      OLLAMA_REMOTE_URL: 'http://192.168.100.206:11434/',
      OLLAMA_REMOTE_MODEL: '',
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    Object.assign(env as any, saved);
  });

  const tags = (...names: string[]) =>
    (globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ models: names.map((name) => ({ name })) }) }) as any);

  it('uses the local Ollama, which shares the GPU, when no remote is configured', async () => {
    (env as any).OLLAMA_REMOTE_URL = '';
    globalThis.fetch = vi.fn() as any;
    const { endpoint } = await resolveOllamaEndpoint();
    expect(endpoint).toEqual({ url: 'http://ollama:11434', model: 'qwen3-vl:4b', where: 'local', sharesGpu: true });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('uses the remote Ollama when it is up and has the model', async () => {
    tags('qwen2.5-coder:7b', 'qwen3-vl:4b');
    const { endpoint } = await resolveOllamaEndpoint();
    expect(endpoint).toEqual({ url: 'http://192.168.100.206:11434', model: 'qwen3-vl:4b', where: 'remote', sharesGpu: false });
    expect((globalThis.fetch as any).mock.calls[0][0]).toBe('http://192.168.100.206:11434/api/tags');
  });

  it('honours OLLAMA_REMOTE_MODEL and matches untagged models as :latest', async () => {
    (env as any).OLLAMA_REMOTE_MODEL = 'qwen3-vl';
    tags('qwen3-vl:latest');
    const { endpoint } = await resolveOllamaEndpoint();
    expect(endpoint).toMatchObject({ where: 'remote', model: 'qwen3-vl' });
  });

  it('falls back to local when the remote lacks the model', async () => {
    tags('qwen2.5-coder:7b');
    const { endpoint, reason } = await resolveOllamaEndpoint();
    expect(endpoint).toEqual(localEndpoint());
    expect(reason).toContain('does not have qwen3-vl:4b');
  });

  it('falls back to local when the remote answers an error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 }) as any;
    const { endpoint, reason } = await resolveOllamaEndpoint();
    expect(endpoint.where).toBe('local');
    expect(reason).toContain('HTTP 503');
  });

  it('falls back to local when the remote is unreachable', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('connect ETIMEDOUT')) as any;
    const { endpoint, reason } = await resolveOllamaEndpoint();
    expect(endpoint.where).toBe('local');
    expect(reason).toContain('unreachable: connect ETIMEDOUT');
  });
});
