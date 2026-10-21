import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({ row: null as any }));

vi.mock('../../../services/database.service', () => ({
  prisma: {
    codexSetting: {
      findUnique: vi.fn(async () => store.row),
      upsert: vi.fn(async ({ create, update }: any) => {
        store.row = store.row ? { ...store.row, ...update, updatedAt: new Date() } : { secret: null, updatedBy: null, ...create, updatedAt: new Date() };
        return store.row;
      }),
      update: vi.fn(async ({ data }: any) => {
        store.row = { ...store.row, ...data, updatedAt: new Date() };
        return store.row;
      }),
    },
  },
}));

import { env } from '../../../config/env';
import { adminSettingsRoutes } from '../settings';

const PASSPHRASE = 'a-long-random-passphrase-for-tests-123';
const KEY = 'sk-live-abcdef1234567890wxyz';

describe('admin settings routes', () => {
  let app: FastifyInstance;
  const keys = ['CODEX_SETTINGS_KEY', 'DEEPSEEK_API_KEY', 'EXTRACT_PROVIDER', 'DEEPSEEK_FOR'] as const;
  const saved: Record<string, unknown> = {};

  beforeEach(async () => {
    store.row = null;
    for (const key of keys) saved[key] = (env as any)[key];
    Object.assign(env as any, { CODEX_SETTINGS_KEY: PASSPHRASE, DEEPSEEK_API_KEY: '', EXTRACT_PROVIDER: 'auto', DEEPSEEK_FOR: ['spell', 'item'] });
    app = Fastify();
    await app.register(adminSettingsRoutes);
  });

  afterEach(async () => {
    Object.assign(env as any, saved);
    await app.close();
  });

  it('GET returns the effective settings and where the key comes from', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/settings/llm' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      settings: { mode: 'auto', routes: { monster: 'ollama', spell: 'deepseek', item: 'deepseek' } },
      deepseek: { keySource: 'none', canSaveKey: true },
    });
  });

  it('PUT saves the mode and per-type routes', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/settings/llm',
      payload: { mode: 'deepseek', routes: { monster: 'deepseek' }, updatedBy: 'user-7' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ settings: { mode: 'deepseek', routes: { monster: 'deepseek' } }, updatedBy: 'user-7' });
  });

  it.each([
    [{ mode: 'turbo' }],
    [{ routes: { wizard: 'ollama' } }],
    [{ routes: { spell: 'openai' } }],
    [{ deepseekMaxTokens: 5 }],
    [{ unexpected: true }],
  ])('PUT rejects %j with a 400 and does not save', async (payload) => {
    const res = await app.inject({ method: 'PUT', url: '/api/admin/settings/llm', payload });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('Invalid settings');
    expect(store.row).toBeNull();
  });

  it('PUT key stores it encrypted and the response never contains it', async () => {
    const res = await app.inject({ method: 'PUT', url: '/api/admin/settings/llm/key', payload: { apiKey: KEY, updatedBy: 'user-7' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().deepseek).toMatchObject({ keySource: 'saved', keyHint: '…wxyz' });
    expect(res.body).not.toContain(KEY);
    expect(store.row.secret).not.toContain(KEY);
  });

  it('PUT key answers 409 with a fix when CODEX_SETTINGS_KEY is not set, and stores nothing', async () => {
    (env as any).CODEX_SETTINGS_KEY = undefined;
    const res = await app.inject({ method: 'PUT', url: '/api/admin/settings/llm/key', payload: { apiKey: KEY } });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ code: 'settings_key_missing' });
    expect(res.json().error).toContain('CODEX_SETTINGS_KEY');
    expect(res.body).not.toContain(KEY);
    expect(store.row).toBeNull();
  });

  it.each([[{ apiKey: 'short' }], [{ apiKey: 'has a space inside it' }], [{ apiKey: 123 }], [{}]])(
    'PUT key rejects %j without echoing it',
    async (payload) => {
      const res = await app.inject({ method: 'PUT', url: '/api/admin/settings/llm/key', payload });
      expect(res.statusCode).toBe(400);
      expect(res.body).not.toContain('has a space inside it');
    },
  );

  it('PUT key refuses null: removing a key is a DELETE', async () => {
    const res = await app.inject({ method: 'PUT', url: '/api/admin/settings/llm/key', payload: { apiKey: null } });
    expect(res.statusCode).toBe(400);
  });

  it('DELETE key removes the saved key', async () => {
    await app.inject({ method: 'PUT', url: '/api/admin/settings/llm/key', payload: { apiKey: KEY } });
    const res = await app.inject({ method: 'DELETE', url: '/api/admin/settings/llm/key' });
    expect(res.statusCode).toBe(200);
    expect(res.json().deepseek.keySource).toBe('none');
    expect(store.row.secret).toBeNull();
  });

  it('POST test reports that no key is configured', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/admin/settings/llm/test' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: false, reason: 'No API key is configured.' });
  });
});
