import {
  LLM_SETTINGS_ID,
  LlmSettingsSchema,
  SettingsKeyError,
  decryptSecret,
} from '@nexus/document-contracts';
import { env } from '../config/env';
import { prisma } from './database.service';
import { envLlmRouting, type LlmRouting } from './deepseek';

/**
 * The extraction routing for one extract stage: the environment's defaults,
 * overridden by what was saved on the admin Settings page.
 *
 * - Mode and per-type routes: a saved value wins over the environment.
 * - API key: a DEEPSEEK_API_KEY in the environment wins over a saved one.
 * - Anything that goes wrong (database down, saved value damaged, key cannot be
 *   decrypted) falls back to the environment settings and says so in `notes`,
 *   so the stage still runs instead of failing on a settings problem.
 */

export type ResolvedRouting = { routing: LlmRouting; notes: string[] };

type SettingsRow = { value: unknown; secret: string | null } | null;

export interface LlmSettingsStore {
  read(): Promise<SettingsRow>;
}

const prismaStore: LlmSettingsStore = {
  read: () => prisma.codexSetting.findUnique({ where: { key: LLM_SETTINGS_ID }, select: { value: true, secret: true } }),
};

export async function loadLlmRouting(store: LlmSettingsStore = prismaStore): Promise<ResolvedRouting> {
  const base = envLlmRouting();
  const notes: string[] = [];

  let row: SettingsRow;
  try {
    row = await store.read();
  } catch (error: any) {
    return { routing: base, notes: [`Could not read saved LLM settings (${error?.message ?? error}); using the environment settings`] };
  }
  if (!row) return { routing: base, notes };

  const parsed = LlmSettingsSchema.partial().safeParse(row.value ?? {});
  if (!parsed.success) notes.push('Saved LLM settings are damaged; using the environment settings');
  const saved = parsed.success ? parsed.data : {};

  // The key: environment first, then the encrypted saved one.
  let deepseek = base.deepseek;
  if (!deepseek && row.secret) {
    const passphrase = (env.CODEX_SETTINGS_KEY ?? '').trim();
    if (!passphrase) {
      notes.push('A DeepSeek key is saved but CODEX_SETTINGS_KEY is not set on doc-processor; DeepSeek is off');
    } else {
      try {
        deepseek = {
          apiKey: decryptSecret(row.secret, passphrase),
          url: env.DEEPSEEK_API_URL,
          model: env.DEEPSEEK_MODEL,
          maxTokens: env.DEEPSEEK_MAX_TOKENS,
        };
      } catch (error) {
        if (!(error instanceof SettingsKeyError)) throw error;
        notes.push('The saved DeepSeek key could not be decrypted (CODEX_SETTINGS_KEY changed?); DeepSeek is off');
      }
    }
  }
  if (deepseek) {
    deepseek = {
      ...deepseek,
      model: saved.deepseekModel ?? deepseek.model,
      maxTokens: saved.deepseekMaxTokens ?? deepseek.maxTokens,
    };
  }

  return {
    routing: {
      mode: saved.mode ?? base.mode,
      deepseek,
      routes: { ...base.routes, ...(saved.routes ?? {}) },
    },
    notes,
  };
}
