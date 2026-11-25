import { describe, expect, it } from 'vitest';
import { env } from '../../config/env';
import { envOllamaSettings, loadOllamaOverrides } from '../ollama-settings.service';

const store = (read: () => Promise<{ value: unknown } | null>) => ({ read });

describe('loadOllamaOverrides', () => {
  it('returns no overrides when nothing is saved', async () => {
    expect(await loadOllamaOverrides(store(async () => null))).toEqual({ overrides: {}, notes: [] });
  });

  it('returns the saved fields', async () => {
    const result = await loadOllamaOverrides(store(async () => ({ value: { remoteUrl: 'http://192.168.100.148:11434', numCtx: 16384 } })));
    expect(result).toEqual({ overrides: { remoteUrl: 'http://192.168.100.148:11434', numCtx: 16384 }, notes: [] });
  });

  it('falls back to the environment, with a note, when the saved value is damaged', async () => {
    const result = await loadOllamaOverrides(store(async () => ({ value: { numCtx: 5, url: 'ftp://nope' } })));
    expect(result.overrides).toEqual({});
    expect(result.notes[0]).toContain('damaged');
  });

  it('falls back to the environment, with a note, when the database is down', async () => {
    const result = await loadOllamaOverrides(store(async () => Promise.reject(new Error('connection refused'))));
    expect(result.overrides).toEqual({});
    expect(result.notes[0]).toContain('connection refused');
  });
});

describe('envOllamaSettings', () => {
  it('reports the values the environment gives', () => {
    expect(envOllamaSettings()).toEqual({
      url: env.OLLAMA_URL,
      model: env.VLM_MODEL,
      remoteUrl: env.OLLAMA_REMOTE_URL,
      remoteModel: env.OLLAMA_REMOTE_MODEL,
      numCtx: env.OLLAMA_NUM_CTX,
      keepAlive: env.OLLAMA_KEEP_ALIVE,
      cropDpi: env.EXTRACT_CROP_DPI,
      cropMaxWidth: env.EXTRACT_CROP_MAX_WIDTH,
      cropMaxHeight: env.EXTRACT_CROP_MAX_HEIGHT,
      promptVersion: env.EXTRACT_PROMPT_VERSION,
    });
  });
});
