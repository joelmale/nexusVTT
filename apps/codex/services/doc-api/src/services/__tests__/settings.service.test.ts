import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsKeyError, decryptSecret, encryptSecret } from '@nexus/document-contracts';

const store = vi.hoisted(() => ({ row: null as any }));

vi.mock('../database.service', () => ({
  prisma: {
    codexSetting: {
      findUnique: vi.fn(async () => store.row),
      upsert: vi.fn(async ({ create, update }: any) => {
        store.row = store.row
          ? { ...store.row, ...update, updatedAt: new Date('2026-10-20T12:00:00Z') }
          : { secret: null, updatedBy: null, ...create, updatedAt: new Date('2026-10-20T12:00:00Z') };
        return store.row;
      }),
      update: vi.fn(async ({ data }: any) => {
        store.row = { ...store.row, ...data, updatedAt: new Date('2026-10-20T12:00:00Z') };
        return store.row;
      }),
    },
  },
}));

import { env } from '../../config/env';
import {
  SettingsKeyMissingError,
  checkDeepSeek,
  getLlmSettingsView,
  saveDeepSeekKey,
  saveLlmSettings,
} from '../settings.service';

const PASSPHRASE = 'a-long-random-passphrase-for-tests-123';
const KEY = 'sk-live-abcdef1234567890wxyz';

describe('encryptSecret / decryptSecret', () => {
  it('round-trips and never contains the plaintext', () => {
    const blob = encryptSecret(KEY, PASSPHRASE);
    expect(blob.startsWith('v1.')).toBe(true);
    expect(blob).not.toContain(KEY);
    expect(blob).not.toContain(Buffer.from(KEY).toString('base64'));
    expect(decryptSecret(blob, PASSPHRASE)).toBe(KEY);
  });

  it('uses a fresh IV each time', () => {
    expect(encryptSecret(KEY, PASSPHRASE)).not.toBe(encryptSecret(KEY, PASSPHRASE));
  });

  it('refuses a wrong passphrase, a tampered blob and a foreign format', () => {
    const blob = encryptSecret(KEY, PASSPHRASE);
    expect(() => decryptSecret(blob, 'a-different-long-passphrase-0000')).toThrow(SettingsKeyError);
    const [v, iv, tag, ct] = blob.split('.');
    const flipped = `${v}.${iv}.${tag}.${Buffer.from(Buffer.from(ct, 'base64').map((b) => b ^ 1)).toString('base64')}`;
    expect(() => decryptSecret(flipped, PASSPHRASE)).toThrow(SettingsKeyError);
    expect(() => decryptSecret('plain-text', PASSPHRASE)).toThrow('Unrecognised secret format');
  });

  it('rejects a passphrase that is too short', () => {
    expect(() => encryptSecret(KEY, 'short')).toThrow(SettingsKeyError);
  });
});

describe('LLM settings', () => {
  const keys = ['CODEX_SETTINGS_KEY', 'DEEPSEEK_API_KEY', 'EXTRACT_PROVIDER', 'DEEPSEEK_FOR', 'DEEPSEEK_MODEL', 'DEEPSEEK_MAX_TOKENS'] as const;
  const saved: Record<string, unknown> = {};

  beforeEach(() => {
    store.row = null;
    for (const key of keys) saved[key] = (env as any)[key];
    Object.assign(env as any, {
      CODEX_SETTINGS_KEY: PASSPHRASE,
      DEEPSEEK_API_KEY: '',
      EXTRACT_PROVIDER: 'auto',
      DEEPSEEK_FOR: ['spell', 'item'],
      DEEPSEEK_MODEL: 'deepseek-chat',
      DEEPSEEK_MAX_TOKENS: 4096,
    });
  });

  afterEach(() => Object.assign(env as any, saved));

  describe('getLlmSettingsView', () => {
    it('shows the environment defaults before anything is saved', async () => {
      const view = await getLlmSettingsView();
      expect(view.settings).toEqual({ mode: 'auto', routes: { monster: 'ollama', spell: 'deepseek', item: 'deepseek' } });
      expect(view.deepseek).toMatchObject({ keySource: 'none', keyHint: null, canSaveKey: true, model: 'deepseek-chat', maxTokens: 4096, savedKeyOverridden: false });
      expect(view.updatedAt).toBeNull();
    });

    it('reports that a key cannot be saved without CODEX_SETTINGS_KEY', async () => {
      (env as any).CODEX_SETTINGS_KEY = undefined;
      expect((await getLlmSettingsView()).deepseek.canSaveKey).toBe(false);
    });

    it('survives a damaged saved value by falling back to the environment defaults', async () => {
      store.row = { key: 'llm', value: { mode: 'nonsense' }, secret: null, updatedAt: new Date(), updatedBy: null };
      expect((await getLlmSettingsView()).settings.mode).toBe('auto');
    });
  });

  describe('saveLlmSettings', () => {
    it('saves the mode and per-type routes and merges later patches', async () => {
      await saveLlmSettings({ mode: 'auto', routes: { monster: 'deepseek' } }, 'user-1');
      const view = await saveLlmSettings({ routes: { spell: 'ollama' } }, 'user-2');
      expect(view.settings).toEqual({ mode: 'auto', routes: { monster: 'deepseek', spell: 'ollama', item: 'deepseek' } });
      expect(view.updatedBy).toBe('user-2');
      expect(view.updatedAt).toBe('2026-10-20T12:00:00.000Z');
    });

    it('stores model and token overrides and clears them with null', async () => {
      let view = await saveLlmSettings({ deepseekModel: 'deepseek-reasoner', deepseekMaxTokens: 2048 }, null);
      expect(view.deepseek).toMatchObject({ model: 'deepseek-reasoner', maxTokens: 2048 });
      view = await saveLlmSettings({ deepseekModel: null, deepseekMaxTokens: null }, null);
      expect(view.deepseek).toMatchObject({ model: 'deepseek-chat', maxTokens: 4096 });
    });

    it('rejects values outside the allowed range', async () => {
      await expect(saveLlmSettings({ deepseekMaxTokens: 10 }, null)).rejects.toThrow();
      await expect(saveLlmSettings({ mode: 'nope' as any }, null)).rejects.toThrow();
    });
  });

  describe('saveDeepSeekKey', () => {
    it('stores the key encrypted and never returns it', async () => {
      const view = await saveDeepSeekKey(KEY, 'user-1');
      expect(store.row.secret).toBeTruthy();
      expect(store.row.secret).not.toContain(KEY);
      expect(decryptSecret(store.row.secret, PASSPHRASE)).toBe(KEY);
      expect(view.deepseek).toMatchObject({ keySource: 'saved', keyHint: '…wxyz' });
      expect(JSON.stringify(view)).not.toContain(KEY);
      expect(JSON.stringify(view)).not.toContain(store.row.secret);
    });

    it('keeps the saved routing when only the key changes', async () => {
      await saveLlmSettings({ mode: 'deepseek' }, null);
      await saveDeepSeekKey(KEY, null);
      expect((await getLlmSettingsView()).settings.mode).toBe('deepseek');
    });

    it('refuses to store a key without CODEX_SETTINGS_KEY', async () => {
      (env as any).CODEX_SETTINGS_KEY = undefined;
      await expect(saveDeepSeekKey(KEY, null)).rejects.toBeInstanceOf(SettingsKeyMissingError);
      expect(store.row).toBeNull();
    });

    it('removes a saved key with null, without needing CODEX_SETTINGS_KEY', async () => {
      await saveDeepSeekKey(KEY, null);
      (env as any).CODEX_SETTINGS_KEY = undefined;
      const view = await saveDeepSeekKey(null, null);
      expect(store.row.secret).toBeNull();
      expect(view.deepseek.keySource).toBe('none');
    });

    it('the environment key wins and the saved one is reported as overridden', async () => {
      await saveDeepSeekKey(KEY, null);
      (env as any).DEEPSEEK_API_KEY = 'sk-from-environment-0000';
      const view = await getLlmSettingsView();
      expect(view.deepseek).toMatchObject({ keySource: 'env', keyHint: '…0000', savedKeyOverridden: true });
    });

    it('flags a saved key that cannot be decrypted instead of failing', async () => {
      await saveDeepSeekKey(KEY, null);
      (env as any).CODEX_SETTINGS_KEY = 'a-changed-long-passphrase-for-tests-9';
      const view = await getLlmSettingsView();
      expect(view.deepseek).toMatchObject({ keySource: 'none', savedKeyUnreadable: true });
    });
  });

  describe('checkDeepSeek', () => {
    const reply = (status: number, body: unknown = {}) =>
      vi.fn(async () => ({ ok: status >= 200 && status < 300, status, json: async () => body })) as unknown as typeof fetch;

    it('says so when no key is configured', async () => {
      expect(await checkDeepSeek(reply(200))).toEqual({ ok: false, reason: 'No API key is configured.' });
    });

    it('returns the balance for a working key and sends it only as a bearer token', async () => {
      await saveDeepSeekKey(KEY, null);
      const fetchImpl = reply(200, { is_available: true, balance_infos: [{ currency: 'USD', total_balance: '4.20' }] });
      const result = await checkDeepSeek(fetchImpl);
      expect(result).toEqual({ ok: true, available: true, balances: [{ currency: 'USD', total: '4.20' }] });
      const [url, init] = (fetchImpl as any).mock.calls[0];
      expect(url).toBe('https://api.deepseek.com/user/balance');
      expect(init.headers.Authorization).toBe(`Bearer ${KEY}`);
      expect(JSON.stringify(result)).not.toContain(KEY);
    });

    it('uses the environment key before the saved one', async () => {
      await saveDeepSeekKey(KEY, null);
      (env as any).DEEPSEEK_API_KEY = 'sk-from-environment-0000';
      const fetchImpl = reply(200, { is_available: true, balance_infos: [] });
      await checkDeepSeek(fetchImpl);
      expect((fetchImpl as any).mock.calls[0][1].headers.Authorization).toBe('Bearer sk-from-environment-0000');
    });

    it.each([
      [401, 'DeepSeek rejected the key.'],
      [500, 'DeepSeek answered HTTP 500.'],
    ])('reports HTTP %i without leaking the key', async (status, reason) => {
      await saveDeepSeekKey(KEY, null);
      const result = await checkDeepSeek(reply(status));
      expect(result).toEqual({ ok: false, reason });
    });

    it('reports an unreachable DeepSeek', async () => {
      await saveDeepSeekKey(KEY, null);
      const down = vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND api.deepseek.com')) as unknown as typeof fetch;
      const result = await checkDeepSeek(down);
      expect(result).toMatchObject({ ok: false });
      expect((result as any).reason).toContain('Could not reach DeepSeek');
      expect(JSON.stringify(result)).not.toContain(KEY);
    });
  });
});
