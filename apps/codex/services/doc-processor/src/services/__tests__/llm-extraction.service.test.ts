import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => new Map<string, Buffer>());
vi.mock('../s3.service', () => ({
  s3Service: {
    downloadFileIfExists: vi.fn(async (key: string) => store.get(key) ?? null),
    uploadFile: vi.fn(async (key: string, body: Buffer) => {
      store.set(key, body);
    }),
  },
}));

import { env } from '../../config/env';
import { ENTITY_LISTS } from '../../extraction/schemas';
import { extractionCacheKey, extractWithSchema, LlmExtractionService } from '../llm-extraction.service';

const recorded = (name: string) =>
  JSON.parse(readFileSync(join(__dirname, '../../extraction/__tests__/fixtures/ollama', name), 'utf8'));

const ollamaReturns = (...names: string[]) => {
  const fetchMock = vi.fn();
  for (const name of names) {
    fetchMock.mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue(recorded(name)) });
  }
  globalThis.fetch = fetchMock as any;
  return fetchMock;
};

const params = {
  documentId: 'doc-1',
  contentHash: 'hash-a',
  candidateKey: 'spell:p13:p13-b4',
  blockHash: 'block-hash',
  type: 'spell' as const,
  text: '#### Fireball\n\n*3rd-level evocation*',
};

describe('LlmExtractionService', () => {
  const originalFetch = globalThis.fetch;
  let origModel: string;
  let origPrompt: string;

  beforeEach(() => {
    store.clear();
    origModel = env.VLM_MODEL;
    origPrompt = env.EXTRACT_PROMPT_VERSION;
    (env as any).OLLAMA_URL = 'http://ollama:11434/';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    (env as any).VLM_MODEL = origModel;
    (env as any).EXTRACT_PROMPT_VERSION = origPrompt;
  });

  it('sends a structured-output request with the JSON schema, temperature 0 and keep_alive', async () => {
    const fetchMock = ollamaReturns('spell-fireball.json');
    const { parsed } = await extractWithSchema(ENTITY_LISTS.spell, 'system', { text: 'Fireball' });

    const [url, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(url).toBe('http://ollama:11434/api/chat');
    expect(body).toMatchObject({ model: env.VLM_MODEL, stream: false, keep_alive: env.OLLAMA_KEEP_ALIVE, options: { temperature: 0 } });
    expect(body.format.properties.entities.items.required).toEqual(
      expect.arrayContaining(['name', 'level', 'school', 'castingTime', 'range', 'components', 'duration', 'description'])
    );
    expect(body.messages[1].images).toBeUndefined();
    expect(parsed?.entities[0].name).toBe('Fireball');
  });

  it('attaches image crops as base64 for the VLM', async () => {
    const fetchMock = ollamaReturns('monster-gorgon.json');
    await extractWithSchema(ENTITY_LISTS.monster, 'system', { text: 'Gorgon', images: [Buffer.from('png-1'), Buffer.from('png-2')] });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[1].images).toEqual([Buffer.from('png-1').toString('base64'), Buffer.from('png-2').toString('base64')]);
  });

  it('throws when Ollama errors so the stage fails and retries', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, text: vi.fn().mockResolvedValue('model not found') }) as any;
    await expect(extractWithSchema(ENTITY_LISTS.spell, 's', { text: 't' })).rejects.toThrow('Ollama 500: model not found');
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as any;
    await expect(extractWithSchema(ENTITY_LISTS.spell, 's', { text: 't' })).rejects.toThrow('ECONNREFUSED');
  });

  it('caches the raw response in S3 and reuses it on retry', async () => {
    const fetchMock = ollamaReturns('spell-fireball.json');
    const service = new LlmExtractionService();

    const first = await service.extractCandidate(params);
    const key = extractionCacheKey('hash-a', 'block-hash', env.VLM_MODEL, env.EXTRACT_PROMPT_VERSION);
    expect(first).toMatchObject({ cached: false, parseFailed: false, cacheKey: key });
    expect(store.has(`extract-cache/doc-1/${key}.json`)).toBe(true);

    const second = await service.extractCandidate(params);
    expect(second.cached).toBe(true);
    expect(second.entities).toEqual(first.entities);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a changed model or prompt version misses the cache', async () => {
    const fetchMock = ollamaReturns('spell-fireball.json', 'spell-fireball.json', 'spell-fireball.json');
    const service = new LlmExtractionService();
    await service.extractCandidate(params);
    (env as any).VLM_MODEL = 'qwen3-vl:8b';
    expect((await service.extractCandidate(params)).cached).toBe(false);
    (env as any).EXTRACT_PROMPT_VERSION = '2';
    expect((await service.extractCandidate(params)).cached).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('a schema-invalid response does not throw and keeps the raw response', async () => {
    ollamaReturns('spell-schema-invalid.json');
    const outcome = await new LlmExtractionService().extractCandidate(params);
    expect(outcome.entities).toEqual([]);
    expect(outcome.parseFailed).toBe(true);
    expect(JSON.parse(outcome.raw).entities[0].level).toBe('third');
    expect(store.size).toBe(1);
  });

  it('unloadModel asks Ollama to free the model immediately', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as any;
    await new LlmExtractionService().unloadModel();
    expect(fetchMock.mock.calls[0][0]).toBe('http://ollama:11434/api/generate');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ model: env.VLM_MODEL, keep_alive: 0 });
  });
});
