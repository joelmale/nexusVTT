import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encryptSecret } from '@nexus/document-contracts';

vi.mock('../database.service', () => ({ prisma: { codexSetting: { findUnique: vi.fn() } } }));

import { env } from '../../config/env';
import { loadLlmRouting, type LlmSettingsStore } from '../llm-settings.service';

const PASSPHRASE = 'a-long-random-passphrase-for-tests-123';
const KEY = 'sk-saved-key-abcdef1234567890';

const store = (row: { value: unknown; secret: string | null } | null): LlmSettingsStore => ({ read: async () => row });

describe('loadLlmRouting', () => {
  const keys = [
    'CODEX_SETTINGS_KEY',
    'DEEPSEEK_API_KEY',
    'DEEPSEEK_API_URL',
    'DEEPSEEK_MODEL',
    'DEEPSEEK_MAX_TOKENS',
    'DEEPSEEK_FOR',
    'EXTRACT_PROVIDER',
  ] as const;
  const saved: Record<string, unknown> = {};

  beforeEach(() => {
    for (const key of keys) saved[key] = (env as any)[key];
    Object.assign(env as any, {
      CODEX_SETTINGS_KEY: PASSPHRASE,
      DEEPSEEK_API_KEY: '',
      DEEPSEEK_API_URL: 'https://api.deepseek.com',
      DEEPSEEK_MODEL: 'deepseek-chat',
      DEEPSEEK_MAX_TOKENS: 4096,
      DEEPSEEK_FOR: ['spell', 'item'],
      EXTRACT_PROVIDER: 'auto',
    });
  });

  afterEach(() => Object.assign(env as any, saved));

  it('uses the environment when nothing has been saved', async () => {
    const { routing, notes } = await loadLlmRouting(store(null));
    expect(routing).toEqual({ mode: 'auto', deepseek: null, routes: { monster: 'ollama', spell: 'deepseek', item: 'deepseek' } });
    expect(notes).toEqual([]);
  });

  it('a saved mode and per-type routes override the environment', async () => {
    const { routing } = await loadLlmRouting(
      store({ value: { mode: 'deepseek', routes: { monster: 'deepseek', spell: 'ollama', item: 'ollama' } }, secret: null }),
    );
    expect(routing.mode).toBe('deepseek');
    expect(routing.routes).toEqual({ monster: 'deepseek', spell: 'ollama', item: 'ollama' });
  });

  it('decrypts a saved key when the environment has none', async () => {
    const { routing, notes } = await loadLlmRouting(store({ value: {}, secret: encryptSecret(KEY, PASSPHRASE) }));
    expect(routing.deepseek).toEqual({ apiKey: KEY, url: 'https://api.deepseek.com', model: 'deepseek-chat', maxTokens: 4096 });
    expect(notes).toEqual([]);
  });

  it('the environment key wins over a saved one', async () => {
    (env as any).DEEPSEEK_API_KEY = 'sk-from-environment';
    const { routing } = await loadLlmRouting(store({ value: {}, secret: encryptSecret(KEY, PASSPHRASE) }));
    expect(routing.deepseek?.apiKey).toBe('sk-from-environment');
  });

  it('applies the saved model and token limit to whichever key is in use', async () => {
    (env as any).DEEPSEEK_API_KEY = 'sk-from-environment';
    const { routing } = await loadLlmRouting(store({ value: { deepseekModel: 'deepseek-reasoner', deepseekMaxTokens: 1024 }, secret: null }));
    expect(routing.deepseek).toMatchObject({ apiKey: 'sk-from-environment', model: 'deepseek-reasoner', maxTokens: 1024 });
  });

  it('turns DeepSeek off, with a reason, when the saved key cannot be decrypted', async () => {
    (env as any).CODEX_SETTINGS_KEY = 'a-changed-long-passphrase-for-tests-9';
    const { routing, notes } = await loadLlmRouting(store({ value: { mode: 'deepseek' }, secret: encryptSecret(KEY, PASSPHRASE) }));
    expect(routing.deepseek).toBeNull();
    expect(notes).toEqual(['The saved DeepSeek key could not be decrypted (CODEX_SETTINGS_KEY changed?); DeepSeek is off']);
    expect(JSON.stringify({ routing, notes })).not.toContain(KEY);
  });

  it('turns DeepSeek off, with a reason, when a key is saved but doc-processor has no CODEX_SETTINGS_KEY', async () => {
    (env as any).CODEX_SETTINGS_KEY = undefined;
    const { routing, notes } = await loadLlmRouting(store({ value: {}, secret: encryptSecret(KEY, PASSPHRASE) }));
    expect(routing.deepseek).toBeNull();
    expect(notes[0]).toContain('CODEX_SETTINGS_KEY is not set on doc-processor');
  });

  it('falls back to the environment, with a note, when the saved value is damaged', async () => {
    const { routing, notes } = await loadLlmRouting(store({ value: { mode: 'turbo' }, secret: null }));
    expect(routing.mode).toBe('auto');
    expect(notes).toEqual(['Saved LLM settings are damaged; using the environment settings']);
  });

  it('falls back to the environment instead of failing the stage when the database is unavailable', async () => {
    const down: LlmSettingsStore = { read: async () => Promise.reject(new Error('connection refused')) };
    const { routing, notes } = await loadLlmRouting(down);
    expect(routing.mode).toBe('auto');
    expect(notes[0]).toContain('Could not read saved LLM settings (connection refused)');
  });
});
