import { Prisma } from '@prisma/client';
import {
  DEFAULT_LLM_SETTINGS,
  DEFAULT_LLM_ROUTES,
  LLM_SETTINGS_ID,
  LlmSettingsSchema,
  MIN_SETTINGS_KEY_LENGTH,
  SettingsKeyError,
  decryptSecret,
  encryptSecret,
  keyHint,
  type LlmSettings,
} from '@nexus/document-contracts';
import { env } from '../config/env';
import { prisma } from './database.service';

/**
 * Extraction LLM settings: which backend reads each kind of entity, and the
 * DeepSeek API key. Precedence for the key is the DEEPSEEK_API_KEY environment
 * variable, then the encrypted key saved here. The key is write-only: nothing
 * in this module returns it, only where it comes from and its last four characters.
 */

export class SettingsKeyMissingError extends Error {
  constructor() {
    super(
      `Saving an API key needs CODEX_SETTINGS_KEY (at least ${MIN_SETTINGS_KEY_LENGTH} characters) set on doc-api and doc-processor. Set it in the stack environment, redeploy, then try again.`,
    );
  }
}

export type KeySource = 'env' | 'saved' | 'none';

export type LlmSettingsView = {
  settings: LlmSettings;
  deepseek: {
    keySource: KeySource;
    /** Last four characters of the key in use, or of the saved key while the environment one wins. */
    keyHint: string | null;
    /** A key is saved but the environment variable overrides it. */
    savedKeyOverridden: boolean;
    /** CODEX_SETTINGS_KEY is configured, so a key can be saved. */
    canSaveKey: boolean;
    /** The saved key could not be decrypted (wrong or changed CODEX_SETTINGS_KEY). */
    savedKeyUnreadable: boolean;
    url: string;
    model: string;
    maxTokens: number;
  };
  /** What the environment alone would do, shown as the default beside each control. */
  environment: { mode: LlmSettings['mode']; routes: LlmSettings['routes'] };
  updatedAt: string | null;
  updatedBy: string | null;
};

const settingsPassphrase = () => (env.CODEX_SETTINGS_KEY ?? '').trim();
const canSaveKey = () => settingsPassphrase().length >= MIN_SETTINGS_KEY_LENGTH;

/** What DEEPSEEK_FOR / EXTRACT_PROVIDER resolve to when nothing has been saved. */
const environmentDefaults = (): LlmSettings => ({
  mode: env.EXTRACT_PROVIDER,
  routes: {
    monster: env.DEEPSEEK_FOR.includes('monster') ? 'deepseek' : 'ollama',
    spell: env.DEEPSEEK_FOR.includes('spell') ? 'deepseek' : 'ollama',
    item: env.DEEPSEEK_FOR.includes('item') ? 'deepseek' : 'ollama',
  },
});

type StoredRow = { value: unknown; secret: string | null; updatedAt: Date; updatedBy: string | null } | null;

const readRow = (): Promise<StoredRow> => prisma.codexSetting.findUnique({ where: { key: LLM_SETTINGS_ID } });

/** Saved settings over the environment defaults; a damaged saved value falls back to the defaults. */
const mergeSettings = (row: StoredRow): LlmSettings => {
  const base = environmentDefaults();
  const saved = LlmSettingsSchema.partial().safeParse(row?.value ?? {});
  if (!saved.success) return { ...DEFAULT_LLM_SETTINGS, ...base };
  return {
    mode: saved.data.mode ?? base.mode,
    routes: { ...base.routes, ...(saved.data.routes ?? {}) },
    ...(saved.data.deepseekModel ? { deepseekModel: saved.data.deepseekModel } : {}),
    ...(saved.data.deepseekMaxTokens ? { deepseekMaxTokens: saved.data.deepseekMaxTokens } : {}),
  };
};

function savedKey(row: StoredRow): { key: string | null; unreadable: boolean } {
  if (!row?.secret) return { key: null, unreadable: false };
  try {
    return { key: decryptSecret(row.secret, settingsPassphrase()), unreadable: false };
  } catch (error) {
    if (error instanceof SettingsKeyError) return { key: null, unreadable: true };
    throw error;
  }
}

export async function getLlmSettingsView(): Promise<LlmSettingsView> {
  const row = await readRow();
  const settings = mergeSettings(row);
  const envKey = env.DEEPSEEK_API_KEY.trim();
  const saved = savedKey(row);
  const hasSavedSecret = Boolean(row?.secret);
  const inUse = envKey || saved.key;

  return {
    settings,
    deepseek: {
      keySource: envKey ? 'env' : saved.key ? 'saved' : 'none',
      keyHint: inUse ? keyHint(inUse) : null,
      savedKeyOverridden: Boolean(envKey) && hasSavedSecret,
      canSaveKey: canSaveKey(),
      savedKeyUnreadable: saved.unreadable,
      url: env.DEEPSEEK_API_URL,
      model: settings.deepseekModel ?? env.DEEPSEEK_MODEL,
      maxTokens: settings.deepseekMaxTokens ?? env.DEEPSEEK_MAX_TOKENS,
    },
    environment: { mode: environmentDefaults().mode, routes: environmentDefaults().routes },
    updatedAt: row?.updatedAt.toISOString() ?? null,
    updatedBy: row?.updatedBy ?? null,
  };
}

export type LlmSettingsPatch = {
  mode?: LlmSettings['mode'];
  routes?: Partial<LlmSettings['routes']>;
  deepseekModel?: string | null;
  deepseekMaxTokens?: number | null;
};

/** Saves the non-secret routing settings, merged over what is already saved. */
export async function saveLlmSettings(patch: LlmSettingsPatch, actor: string | null): Promise<LlmSettingsView> {
  const row = await readRow();
  const current = mergeSettings(row);
  const next = {
    mode: patch.mode ?? current.mode,
    routes: { ...current.routes, ...(patch.routes ?? {}) },
    deepseekModel: patch.deepseekModel === null ? undefined : (patch.deepseekModel ?? current.deepseekModel),
    deepseekMaxTokens: patch.deepseekMaxTokens === null ? undefined : (patch.deepseekMaxTokens ?? current.deepseekMaxTokens),
  };
  const value = LlmSettingsSchema.parse(next);
  const json = JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  await prisma.codexSetting.upsert({
    where: { key: LLM_SETTINGS_ID },
    create: { key: LLM_SETTINGS_ID, value: json, updatedBy: actor },
    update: { value: json, updatedBy: actor },
  });
  return getLlmSettingsView();
}

/** Stores (or, with null, removes) the DeepSeek key, encrypted. Refuses without CODEX_SETTINGS_KEY. */
export async function saveDeepSeekKey(apiKey: string | null, actor: string | null): Promise<LlmSettingsView> {
  if (apiKey === null) {
    const row = await readRow();
    if (row) await prisma.codexSetting.update({ where: { key: LLM_SETTINGS_ID }, data: { secret: null, updatedBy: actor } });
    return getLlmSettingsView();
  }
  if (!canSaveKey()) throw new SettingsKeyMissingError();
  const secret = encryptSecret(apiKey, settingsPassphrase());
  await prisma.codexSetting.upsert({
    where: { key: LLM_SETTINGS_ID },
    create: { key: LLM_SETTINGS_ID, value: {}, secret, updatedBy: actor },
    update: { secret, updatedBy: actor },
  });
  return getLlmSettingsView();
}

export type DeepSeekCheck =
  | { ok: true; available: boolean; balances: Array<{ currency: string; total: string }> }
  | { ok: false; reason: string };

/**
 * Asks DeepSeek for the account balance with the key currently in use. A cheap
 * way to prove the key works and the account has funds, without extracting
 * anything. Never includes the key in what it returns.
 */
export async function checkDeepSeek(fetchImpl: typeof fetch = fetch): Promise<DeepSeekCheck> {
  const row = await readRow();
  const key = env.DEEPSEEK_API_KEY.trim() || savedKey(row).key;
  if (!key) return { ok: false, reason: 'No API key is configured.' };

  let response: Response;
  try {
    response = await fetchImpl(`${env.DEEPSEEK_API_URL.replace(/\/$/, '')}/user/balance`, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error: any) {
    return { ok: false, reason: `Could not reach DeepSeek: ${error?.message ?? error}` };
  }
  if (response.status === 401 || response.status === 403) return { ok: false, reason: 'DeepSeek rejected the key.' };
  if (!response.ok) return { ok: false, reason: `DeepSeek answered HTTP ${response.status}.` };

  const body = (await response.json().catch(() => ({}))) as {
    is_available?: boolean;
    balance_infos?: Array<{ currency?: string; total_balance?: string }>;
  };
  return {
    ok: true,
    available: body.is_available !== false,
    balances: (body.balance_infos ?? []).map((info) => ({ currency: info.currency ?? '?', total: info.total_balance ?? '0' })),
  };
}

export { DEFAULT_LLM_ROUTES };
