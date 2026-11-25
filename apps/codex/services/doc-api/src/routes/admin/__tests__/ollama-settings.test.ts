import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rows = vi.hoisted(() => ({ byKey: new Map<string, any>() }));

vi.mock('../../../services/database.service', () => ({
  prisma: {
    codexSetting: {
      findUnique: vi.fn(async ({ where }: any) => rows.byKey.get(where.key) ?? null),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const existing = rows.byKey.get(where.key);
        const next = existing ? { ...existing, ...update, updatedAt: new Date() } : { secret: null, updatedBy: null, ...create, updatedAt: new Date() };
        rows.byKey.set(where.key, next);
        return next;
      }),
    },
  },
}));

import { adminSettingsRoutes } from '../settings';
import { checkOllama } from '../../../services/ollama-settings.service';

const ENV = {
  url: 'http://ollama:11434',
  model: 'qwen3-vl:4b-instruct',
  remoteUrl: '',
  remoteModel: '',
  numCtx: 8192,
  keepAlive: '10m',
  cropDpi: 200,
  cropMaxWidth: 1200,
  cropMaxHeight: 1600,
  promptVersion: '1',
};
const REMOTE = 'http://192.168.100.148:11434';

describe('admin Ollama settings routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    rows.byKey.clear();
    rows.byKey.set('ollama-env', { value: ENV, updatedAt: new Date(), updatedBy: null });
    app = Fastify();
    await app.register(adminSettingsRoutes);
  });
  afterEach(() => app.close());

  const put = (payload: unknown) => app.inject({ method: 'PUT', url: '/api/admin/settings/ollama', payload: payload as object });

  it('GET shows what is saved, the environment and the effective values', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/settings/ollama' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ saved: {}, environment: ENV, effective: ENV, updatedAt: null });
  });

  it('GET still works before doc-processor has published its environment', async () => {
    rows.byKey.delete('ollama-env');
    const res = await app.inject({ method: 'GET', url: '/api/admin/settings/ollama' });
    expect(res.json()).toMatchObject({ saved: {}, environment: null, effective: {} });
  });

  it('PUT saves overrides over the environment and records who changed them', async () => {
    const res = await put({ remoteUrl: REMOTE, remoteModel: 'qwen3-vl:8b', numCtx: 16384, updatedBy: 'user-7' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      saved: { remoteUrl: REMOTE, remoteModel: 'qwen3-vl:8b', numCtx: 16384 },
      effective: { ...ENV, remoteUrl: REMOTE, remoteModel: 'qwen3-vl:8b', numCtx: 16384 },
      updatedBy: 'user-7',
    });
  });

  it('PUT saves crop tuning and the extraction version', async () => {
    const res = await put({ cropMaxWidth: 1600, cropMaxHeight: 2200, cropDpi: 250, promptVersion: '2' });
    expect(res.json()).toMatchObject({
      saved: { cropMaxWidth: 1600, cropMaxHeight: 2200, cropDpi: 250, promptVersion: '2' },
      effective: { ...ENV, cropMaxWidth: 1600, cropMaxHeight: 2200, cropDpi: 250, promptVersion: '2' },
    });
  });

  it('PUT with null clears one override and keeps the rest', async () => {
    await put({ remoteUrl: REMOTE, numCtx: 16384 });
    const res = await put({ remoteUrl: null });
    expect(res.json().saved).toEqual({ numCtx: 16384 });
    expect(res.json().effective.remoteUrl).toBe('');
  });

  it('PUT leaves the empty string in place so an environment remote can be switched off', async () => {
    const res = await put({ remoteUrl: '' });
    expect(res.json().saved).toEqual({ remoteUrl: '' });
  });

  it.each([
    [{ url: 'ftp://host' }],
    [{ url: 'http://user:pass@host:11434' }],
    [{ url: 'not a url' }],
    [{ numCtx: 100 }],
    [{ numCtx: 1e9 }],
    [{ keepAlive: 'forever' }],
    [{ cropDpi: 20 }],
    [{ cropMaxWidth: 99999 }],
    [{ cropMaxHeight: 1.5 }],
    [{ promptVersion: '' }],
    [{ model: '' }],
    [{ unexpected: true }],
  ])('PUT rejects %j', async (payload) => {
    const res = await put(payload);
    expect(res.statusCode).toBe(400);
    expect(rows.byKey.has('ollama')).toBe(false);
  });

  it('test rejects an unknown target and never takes an address from the request', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/admin/settings/ollama/test', payload: { target: 'elsewhere' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/admin/settings/ollama/test', payload: { target: 'remote', url: 'http://evil' } })).statusCode).toBe(400);
  });
});

describe('checkOllama', () => {
  beforeEach(() => {
    rows.byKey.clear();
    rows.byKey.set('ollama-env', { value: ENV, updatedAt: new Date(), updatedBy: null });
  });

  const fetchOf = (tags: string[], version = '0.40.13') =>
    vi.fn(async (url: any) =>
      String(url).endsWith('/api/version')
        ? ({ ok: true, json: async () => ({ version }) } as Response)
        : ({ ok: true, json: async () => ({ models: tags.map((name) => ({ name })) }) } as Response),
    ) as unknown as typeof fetch;

  it('reports the server, its version and whether the model is installed', async () => {
    rows.byKey.set('ollama', { value: { remoteUrl: `${REMOTE}/`, remoteModel: 'qwen3-vl:8b' }, updatedAt: new Date(), updatedBy: null });
    const fetchImpl = fetchOf(['qwen2.5vl:7b', 'qwen3-vl:8b']);
    expect(await checkOllama('remote', fetchImpl)).toEqual({
      ok: true,
      url: REMOTE,
      version: '0.40.13',
      model: 'qwen3-vl:8b',
      hasModel: true,
      models: ['qwen2.5vl:7b', 'qwen3-vl:8b'],
    });
    expect((fetchImpl as any).mock.calls[0][0]).toBe(`${REMOTE}/api/tags`);
  });

  it('says so when the model is missing', async () => {
    const result = await checkOllama('local', fetchOf(['qwen2.5vl:7b']));
    expect(result).toMatchObject({ ok: true, hasModel: false, model: 'qwen3-vl:4b-instruct' });
  });

  it('says so when no remote is configured', async () => {
    expect(await checkOllama('remote', fetchOf([]))).toEqual({ ok: false, url: null, reason: 'No remote Ollama is configured.' });
  });

  it('reports an unreachable server instead of throwing', async () => {
    const down = vi.fn(async () => Promise.reject(new Error('connect ETIMEDOUT'))) as unknown as typeof fetch;
    const result = await checkOllama('local', down);
    expect(result).toMatchObject({ ok: false, url: 'http://ollama:11434' });
    expect((result as { reason: string }).reason).toContain('connect ETIMEDOUT');
  });
});
