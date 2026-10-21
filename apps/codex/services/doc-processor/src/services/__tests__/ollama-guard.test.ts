import { UnrecoverableError } from 'bullmq';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../config/env';
import { inspectOllama, isGpuMemoryError, prepareOllama } from '../ollama-guard';
import type { OllamaEndpoint } from '../ollama-endpoint';

const endpoint: OllamaEndpoint = { url: 'http://ollama:11434/', model: 'qwen3-vl:4b-instruct', where: 'local', sharesGpu: true };
const MIB = 1024 * 1024;

type Answer = { ok: boolean; status?: number; json?: unknown; text?: string };
type Route = (init: any) => Answer;

/** Scripted Ollama: each path takes a function so a test can change its answer per call. */
const ollama = (routes: Record<string, Route>) => {
  const calls: string[] = [];
  const fetchImpl = vi.fn(async (url: string, init: any) => {
    const path = new URL(url).pathname;
    calls.push(path);
    const answer = routes[path](init);
    return {
      ok: answer.ok,
      status: answer.status ?? (answer.ok ? 200 : 500),
      json: async () => answer.json,
      text: async () => answer.text ?? '',
    };
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
};

const tags = (...names: string[]): Route => () => ({ ok: true, json: { models: names.map((name) => ({ name })) } });
const ps = (...models: Array<[string, number]>): Route => () => ({
  ok: true,
  json: { models: models.map(([name, vram]) => ({ name, size_vram: vram })) },
});
const generateOk: Route = () => ({ ok: true, json: {} });

const log = () => ({ info: vi.fn(), warn: vi.fn() });

/** A clock the fake sleep advances, so waits are instant and measurable. */
const clock = () => {
  let t = 0;
  return { now: () => t, sleep: async (ms: number) => void (t += ms), elapsed: () => t };
};

describe('ollama-guard', () => {
  const saved: Record<string, unknown> = {};
  const keys = ['OLLAMA_GPU_WAIT_MAX_MS', 'OLLAMA_GPU_WAIT_POLL_MS', 'OLLAMA_WARMUP_TIMEOUT_MS', 'OLLAMA_KEEP_ALIVE', 'OLLAMA_NUM_CTX'] as const;

  beforeEach(() => {
    for (const key of keys) saved[key] = (env as any)[key];
    Object.assign(env as any, {
      OLLAMA_GPU_WAIT_MAX_MS: 60_000,
      OLLAMA_GPU_WAIT_POLL_MS: 15_000,
      OLLAMA_WARMUP_TIMEOUT_MS: 240_000,
      OLLAMA_KEEP_ALIVE: '10m',
      OLLAMA_NUM_CTX: 8192,
    });
  });

  afterEach(() => {
    Object.assign(env as any, saved);
  });

  describe('isGpuMemoryError', () => {
    it('recognises the failures Ollama reports when the GPU is full', () => {
      expect(isGpuMemoryError('llama-server startup failed after projector CPU offload retry: CUDA error: out of memory')).toBe(true);
      expect(isGpuMemoryError('ggml_backend_cuda_device_get_memory: cudaMemGetInfo failed')).toBe(true);
    });

    it('does not treat ordinary failures as GPU pressure', () => {
      expect(isGpuMemoryError('model "x" not found')).toBe(false);
      expect(isGpuMemoryError('The operation was aborted due to timeout')).toBe(false);
    });
  });

  describe('inspectOllama', () => {
    it('lists available and loaded models', async () => {
      const { fetchImpl } = ollama({ '/api/tags': tags('a:1', 'b:2'), '/api/ps': ps(['a:1', 5 * MIB]) });
      expect(await inspectOllama(endpoint, fetchImpl)).toEqual({ available: ['a:1', 'b:2'], loaded: [{ name: 'a:1', sizeVram: 5 * MIB }] });
    });

    it('treats a missing /api/ps as nothing loaded', async () => {
      const { fetchImpl } = ollama({ '/api/tags': tags('a:1'), '/api/ps': () => ({ ok: false, status: 404 }) });
      expect((await inspectOllama(endpoint, fetchImpl)).loaded).toEqual([]);
    });

    it('explains an unreachable server and a bad status', async () => {
      const down = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED')) as unknown as typeof fetch;
      await expect(inspectOllama(endpoint, down)).rejects.toThrow('Ollama http://ollama:11434 unreachable: connect ECONNREFUSED');
      const { fetchImpl } = ollama({ '/api/tags': () => ({ ok: false, status: 503 }), '/api/ps': ps() });
      await expect(inspectOllama(endpoint, fetchImpl)).rejects.toThrow('answered HTTP 503 to /api/tags');
    });
  });

  describe('prepareOllama', () => {
    it('loads the model straight away when the GPU is clear, using the extraction num_ctx', async () => {
      let warmBody: any;
      const { fetchImpl, calls } = ollama({
        '/api/tags': tags('qwen3-vl:4b-instruct'),
        '/api/ps': ps(),
        '/api/generate': (init) => {
          warmBody = JSON.parse(init.body);
          return { ok: true, json: {} };
        },
      });
      const c = clock();
      const messages = log();
      const result = await prepareOllama(endpoint, messages, { fetch: fetchImpl, sleep: c.sleep, now: c.now });

      expect(result).toEqual({ waitedMs: 0, stillHeldBy: [] });
      expect(calls).toEqual(['/api/tags', '/api/ps', '/api/generate']);
      expect(warmBody).toMatchObject({ model: 'qwen3-vl:4b-instruct', prompt: '', stream: false, keep_alive: '10m', options: { num_ctx: 8192 } });
      expect(messages.warn).not.toHaveBeenCalled();
      expect(messages.info).toHaveBeenCalledWith('Ollama ready: qwen3-vl:4b-instruct loaded');
    });

    it('waits, with a clear message, while another model holds the shared GPU', async () => {
      let polls = 0;
      const { fetchImpl } = ollama({
        '/api/tags': tags('qwen3-vl:4b-instruct', 'qwen2.5:7b'),
        '/api/ps': () => {
          polls += 1;
          return { ok: true, json: { models: polls <= 2 ? [{ name: 'qwen2.5:7b', size_vram: 200 * MIB }] : [] } };
        },
        '/api/generate': generateOk,
      });
      const c = clock();
      const messages = log();
      const result = await prepareOllama(endpoint, messages, { fetch: fetchImpl, sleep: c.sleep, now: c.now });

      expect(result.waitedMs).toBe(30_000);
      expect(result.stillHeldBy).toEqual([]);
      expect(messages.warn).toHaveBeenCalledTimes(2);
      expect(messages.warn.mock.calls[0][0]).toBe(
        'GPU busy: qwen2.5:7b (200 MiB in VRAM) loaded in the shared Ollama. Waiting for it to unload before loading qwen3-vl:4b-instruct (0s of 60s)',
      );
      expect(messages.info).toHaveBeenCalledWith('Ollama ready: qwen3-vl:4b-instruct loaded after waiting 30s');
    });

    it('stops waiting after the budget and loads anyway, naming what was still there', async () => {
      const { fetchImpl } = ollama({
        '/api/tags': tags('qwen3-vl:4b-instruct'),
        '/api/ps': ps(['qwen2.5:7b', 0]),
        '/api/generate': generateOk,
      });
      const c = clock();
      const messages = log();
      const result = await prepareOllama(endpoint, messages, { fetch: fetchImpl, sleep: c.sleep, now: c.now });

      expect(result.waitedMs).toBe(60_000);
      expect(result.stillHeldBy).toEqual(['qwen2.5:7b']);
      expect(messages.warn).toHaveBeenLastCalledWith('GPU still held by qwen2.5:7b (0 MiB in VRAM) after 60s; loading qwen3-vl:4b-instruct anyway');
    });

    it('does not wait for other models on a remote Ollama that has its own GPU', async () => {
      const remote: OllamaEndpoint = { ...endpoint, where: 'remote', sharesGpu: false };
      const { fetchImpl } = ollama({ '/api/tags': tags('qwen3-vl:4b-instruct'), '/api/ps': ps(['something:7b', 3000 * MIB]), '/api/generate': generateOk });
      const c = clock();
      const result = await prepareOllama(remote, log(), { fetch: fetchImpl, sleep: c.sleep, now: c.now });
      expect(result).toEqual({ waitedMs: 0, stillHeldBy: [] });
    });

    it('retries the load while Ollama reports the GPU is full, then succeeds', async () => {
      let loads = 0;
      const { fetchImpl } = ollama({
        '/api/tags': tags('qwen3-vl:4b-instruct'),
        '/api/ps': ps(),
        '/api/generate': () => {
          loads += 1;
          return loads < 3 ? { ok: false, status: 500, text: '{"error":"CUDA error: out of memory"}' } : { ok: true, json: {} };
        },
      });
      const c = clock();
      const messages = log();
      const result = await prepareOllama(endpoint, messages, { fetch: fetchImpl, sleep: c.sleep, now: c.now });

      expect(loads).toBe(3);
      expect(result.waitedMs).toBe(30_000);
      expect(messages.warn.mock.calls[0][0]).toContain('Ollama ran out of GPU memory loading qwen3-vl:4b-instruct; waiting 15s');
    });

    it('gives up with a readable error once the GPU stays full past the budget', async () => {
      const { fetchImpl } = ollama({
        '/api/tags': tags('qwen3-vl:4b-instruct'),
        '/api/ps': ps(),
        '/api/generate': () => ({ ok: false, status: 500, text: 'CUDA error: out of memory' }),
      });
      const c = clock();
      await expect(prepareOllama(endpoint, log(), { fetch: fetchImpl, sleep: c.sleep, now: c.now })).rejects.toThrow(
        'Could not load qwen3-vl:4b-instruct in Ollama http://ollama:11434: Ollama 500: CUDA error: out of memory',
      );
      expect(c.elapsed()).toBe(60_000);
    });

    it('does not retry a load that failed for another reason', async () => {
      let loads = 0;
      const { fetchImpl } = ollama({
        '/api/tags': tags('qwen3-vl:4b-instruct'),
        '/api/ps': ps(),
        '/api/generate': () => {
          loads += 1;
          return { ok: false, status: 500, text: 'model corrupt' };
        },
      });
      const c = clock();
      await expect(prepareOllama(endpoint, log(), { fetch: fetchImpl, sleep: c.sleep, now: c.now })).rejects.toThrow('model corrupt');
      expect(loads).toBe(1);
      expect(c.elapsed()).toBe(0);
    });

    it('fails permanently when Ollama is up but does not have the model', async () => {
      const { fetchImpl } = ollama({ '/api/tags': tags('llama3:8b'), '/api/ps': ps() });
      const error = await prepareOllama(endpoint, log(), { fetch: fetchImpl, sleep: async () => {}, now: () => 0 }).catch((e) => e);
      expect(error).toBeInstanceOf(UnrecoverableError);
      expect(error.message).toContain('ollama pull qwen3-vl:4b-instruct');
    });

    it('fails retryably when Ollama is unreachable', async () => {
      const down = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED')) as unknown as typeof fetch;
      const error = await prepareOllama(endpoint, log(), { fetch: down, sleep: async () => {}, now: () => 0 }).catch((e) => e);
      expect(error).not.toBeInstanceOf(UnrecoverableError);
      expect(error.message).toContain('unreachable');
    });

    it('treats name:latest and the bare name as the same model', async () => {
      const bare: OllamaEndpoint = { ...endpoint, model: 'qwen3-vl' };
      const { fetchImpl } = ollama({ '/api/tags': tags('qwen3-vl:latest'), '/api/ps': ps(['qwen3-vl:latest', 100]), '/api/generate': generateOk });
      const c = clock();
      const result = await prepareOllama(bare, log(), { fetch: fetchImpl, sleep: c.sleep, now: c.now });
      expect(result.waitedMs).toBe(0); // the loaded model is ours, not an intruder
    });
  });
});
