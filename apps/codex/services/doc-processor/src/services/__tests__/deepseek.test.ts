import { UnrecoverableError } from 'bullmq';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../config/env';
import { ENTITY_LISTS } from '../../extraction/schemas';
import {
  deepseekEndpoint,
  deepseekHttpError,
  envLlmRouting,
  extractWithDeepSeek,
  providerFor,
  type LlmRouting,
} from '../deepseek';

const config = { apiKey: 'sk-test-secret', url: 'https://api.deepseek.com/', model: 'deepseek-chat', maxTokens: 4096 };
const SPELLS_AND_ITEMS = { monster: 'ollama', spell: 'deepseek', item: 'deepseek' } as const;
const routing = (overrides: Partial<LlmRouting> = {}): LlmRouting => ({ mode: 'auto', deepseek: config, routes: SPELLS_AND_ITEMS, ...overrides });

describe('providerFor', () => {
  it('auto: text types go to DeepSeek, stat blocks stay on Ollama', () => {
    expect(providerFor(routing(), 'spell')).toBe('deepseek');
    expect(providerFor(routing(), 'item')).toBe('deepseek');
    expect(providerFor(routing(), 'monster')).toBe('ollama');
  });

  it('auto follows the per-type routes, including a stat block sent to DeepSeek', () => {
    const onlyMonsters = routing({ routes: { monster: 'deepseek', spell: 'ollama', item: 'ollama' } });
    expect(providerFor(onlyMonsters, 'monster')).toBe('deepseek');
    expect(providerFor(onlyMonsters, 'spell')).toBe('ollama');
    expect(providerFor(onlyMonsters, 'item')).toBe('ollama');
  });

  it('deepseek mode sends everything there, ollama mode sends nothing', () => {
    for (const type of ['monster', 'spell', 'item'] as const) {
      expect(providerFor(routing({ mode: 'deepseek' }), type)).toBe('deepseek');
      expect(providerFor(routing({ mode: 'ollama' }), type)).toBe('ollama');
    }
  });

  it('never picks DeepSeek without a key, whatever the mode', () => {
    for (const mode of ['auto', 'deepseek', 'ollama'] as const) {
      expect(providerFor(routing({ mode, deepseek: null }), 'spell')).toBe('ollama');
    }
  });
});

describe('envLlmRouting', () => {
  const keys = ['DEEPSEEK_API_KEY', 'DEEPSEEK_API_URL', 'DEEPSEEK_MODEL', 'DEEPSEEK_MAX_TOKENS', 'DEEPSEEK_FOR', 'EXTRACT_PROVIDER'] as const;
  const saved: Record<string, unknown> = {};
  beforeEach(() => keys.forEach((key) => (saved[key] = (env as any)[key])));
  afterEach(() => Object.assign(env as any, saved));

  it('has no DeepSeek config when the key is empty or blank', () => {
    (env as any).DEEPSEEK_API_KEY = '   ';
    expect(envLlmRouting().deepseek).toBeNull();
  });

  it('reads key, endpoint, model, limits and mode from the environment', () => {
    Object.assign(env as any, {
      DEEPSEEK_API_KEY: ' sk-abc ',
      DEEPSEEK_API_URL: 'https://api.deepseek.com',
      DEEPSEEK_MODEL: 'deepseek-chat',
      DEEPSEEK_MAX_TOKENS: 2000,
      DEEPSEEK_FOR: ['spell'],
      EXTRACT_PROVIDER: 'deepseek',
    });
    expect(envLlmRouting()).toEqual({
      mode: 'deepseek',
      deepseek: { apiKey: 'sk-abc', url: 'https://api.deepseek.com', model: 'deepseek-chat', maxTokens: 2000 },
      routes: { monster: 'ollama', spell: 'deepseek', item: 'ollama' },
    });
  });
});

describe('deepseekEndpoint', () => {
  it('keeps the API key out of anything that serializes or logs the endpoint', () => {
    const endpoint = deepseekEndpoint(config);
    expect(endpoint).toMatchObject({ where: 'deepseek', model: 'deepseek-chat', sharesGpu: false });
    expect(JSON.stringify(endpoint)).not.toContain('sk-test-secret');
    expect(JSON.stringify({ ...endpoint })).not.toContain('sk-test-secret');
    expect(Object.keys(endpoint)).not.toContain('apiKey');
    expect((endpoint as any).apiKey).toBe('sk-test-secret'); // still available to the client
  });
});

describe('deepseekHttpError', () => {
  it.each([401, 403])('HTTP %i is permanent and says what to check', (status) => {
    const error = deepseekHttpError(status, 'bad');
    expect(error).toBeInstanceOf(UnrecoverableError);
    expect(error.message).toContain('rejected the API key');
  });

  it('HTTP 402 is permanent and points at the balance', () => {
    const error = deepseekHttpError(402, '');
    expect(error).toBeInstanceOf(UnrecoverableError);
    expect(error.message).toContain('insufficient balance');
  });

  it.each([400, 422])('HTTP %i is permanent: retrying the same request cannot help', (status) => {
    expect(deepseekHttpError(status, 'bad schema')).toBeInstanceOf(UnrecoverableError);
  });

  it.each([429, 500, 503])('HTTP %i is retryable', (status) => {
    const error = deepseekHttpError(status, 'busy');
    expect(error).not.toBeInstanceOf(UnrecoverableError);
    expect(error.message).toContain(`HTTP ${status}`);
  });

  it('never echoes more than the start of the body', () => {
    expect(deepseekHttpError(500, 'x'.repeat(5000)).message.length).toBeLessThan(400);
  });
});

describe('extractWithDeepSeek', () => {
  const answer = (body: unknown, status = 200) =>
    vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    })) as unknown as typeof fetch;

  it('posts a JSON-mode chat completion with the schema in the prompt, no images, and returns tokens', async () => {
    const fetchImpl = answer({
      choices: [{ message: { content: '{"entities":[]}' } }],
      usage: { prompt_tokens: 300, completion_tokens: 12, prompt_cache_hit_tokens: 128 },
    });
    const result = await extractWithDeepSeek(ENTITY_LISTS.spell, 'You read spells.', { text: '#### Fireball' }, deepseekEndpoint(config), fetchImpl);

    expect(result).toEqual({ raw: '{"entities":[]}', usage: { promptTokens: 300, completionTokens: 12, cacheHitTokens: 128 } });
    const [url, init] = (fetchImpl as any).mock.calls[0];
    expect(url).toBe('https://api.deepseek.com/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer sk-test-secret');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ model: 'deepseek-chat', stream: false, temperature: 0, max_tokens: 4096, response_format: { type: 'json_object' } });
    expect(body.messages[0].content).toContain('You read spells.');
    expect(body.messages[0].content).toContain('JSON Schema');
    expect(body.messages[0].content).toContain('"castingTime"');
    expect(body.messages[1].content).toBe('Source text for this region:\n\n#### Fireball');
    expect(JSON.stringify(body)).not.toContain('sk-test-secret'); // the key is a header, never a body field
  });

  it('turns an HTTP failure into the classified error', async () => {
    const error = await extractWithDeepSeek(ENTITY_LISTS.item, 's', { text: 't' }, deepseekEndpoint(config), answer('no', 402)).catch((e) => e);
    expect(error).toBeInstanceOf(UnrecoverableError);
    expect(error.message).toContain('insufficient balance');
  });

  it('returns an empty answer and zero usage when the reply has no content', async () => {
    const result = await extractWithDeepSeek(ENTITY_LISTS.item, 's', { text: 't' }, deepseekEndpoint(config), answer({ choices: [] }));
    expect(result).toEqual({ raw: '', usage: { promptTokens: 0, completionTokens: 0, cacheHitTokens: 0 } });
  });

  it('refuses to call without a key', async () => {
    const keyless = { url: config.url, model: config.model, where: 'deepseek' as const, sharesGpu: false };
    const fetchImpl = answer({});
    await expect(extractWithDeepSeek(ENTITY_LISTS.item, 's', { text: 't' }, keyless, fetchImpl)).rejects.toThrow('no API key');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
