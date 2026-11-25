import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { z } from 'zod';

/**
 * Runtime settings for the extraction LLM (which backend reads each kind of
 * entity), shared by doc-api (writes them) and doc-processor (reads them at the
 * start of each extract stage). Stored in the `codex_settings` table under
 * LLM_SETTINGS_ID: the non-secret part as JSON, the DeepSeek API key as an
 * AES-256-GCM blob in `secret`.
 */

export const LLM_SETTINGS_ID = 'llm';

/** auto = use `routes`; ollama / deepseek send everything to one backend. */
export const LLM_MODES = ['auto', 'ollama', 'deepseek'] as const;
export type LlmMode = (typeof LLM_MODES)[number];

export const LLM_BACKENDS = ['ollama', 'deepseek'] as const;
export type LlmBackend = (typeof LLM_BACKENDS)[number];

export const EXTRACT_ENTITY_TYPES = ['monster', 'spell', 'item'] as const;
export type ExtractEntityType = (typeof EXTRACT_ENTITY_TYPES)[number];

/** Used by `auto` until someone chooses: DeepSeek reads the text-only types. */
export const DEFAULT_LLM_ROUTES: Record<ExtractEntityType, LlmBackend> = {
  monster: 'ollama',
  spell: 'deepseek',
  item: 'deepseek',
};

const backend = z.enum(LLM_BACKENDS);

export const LlmSettingsSchema = z.object({
  mode: z.enum(LLM_MODES),
  routes: z.object({ monster: backend, spell: backend, item: backend }),
  deepseekModel: z.string().trim().min(1).max(100).optional(),
  deepseekMaxTokens: z.number().int().min(256).max(8192).optional(),
});
export type LlmSettings = z.infer<typeof LlmSettingsSchema>;

/** Stored value for a row that has never been saved. */
export const DEFAULT_LLM_SETTINGS: LlmSettings = { mode: 'auto', routes: { ...DEFAULT_LLM_ROUTES } };

// ---------------------------------------------------------------------------
// Ollama (local VLM) settings. Saved values override the OLLAMA_* environment
// variables for the next extract stage; an absent field means "use the
// environment". doc-api writes them, doc-processor reads them per stage.
// ---------------------------------------------------------------------------

export const OLLAMA_SETTINGS_ID = 'ollama';
/** doc-processor publishes the environment values it would use here, so the Settings page can show them. */
export const OLLAMA_ENV_SNAPSHOT_ID = 'ollama-env';

const httpUrl = z
  .string()
  .trim()
  .max(300)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password;
    } catch {
      return false;
    }
  }, 'Must be an http(s) URL without a username or password');

/** Ollama's keep_alive: a duration like `10m`, plain seconds, or -1 (never unload). */
export const OLLAMA_KEEP_ALIVE_PATTERN = /^(-1|\d{1,6}(ms|s|m|h)?)$/;

export const OllamaSettingsSchema = z.object({
  /** Local Ollama (shares the GPU with the layout models). */
  url: httpUrl.optional(),
  /** The one model for text and image extraction; part of the extraction cache key. */
  model: z.string().trim().min(1).max(100).optional(),
  /** Optional second Ollama on the LAN. An empty string switches an environment-configured remote off. */
  remoteUrl: z.union([z.literal(''), httpUrl]).optional(),
  /** Model on the remote Ollama; empty means "same as `model`". */
  remoteModel: z.string().trim().max(100).optional(),
  numCtx: z.number().int().min(1024).max(262144).optional(),
  keepAlive: z.string().trim().regex(OLLAMA_KEEP_ALIVE_PATTERN, 'Use a duration such as 10m, seconds, or -1').optional(),
  /** Stat-block crops: render DPI and the box a crop is shrunk to fit inside. Not part of the extraction cache key. */
  cropDpi: z.number().int().min(72).max(600).optional(),
  cropMaxWidth: z.number().int().min(256).max(8192).optional(),
  cropMaxHeight: z.number().int().min(256).max(8192).optional(),
  /** Part of the extraction cache key; change it to re-read documents already extracted. */
  promptVersion: z.string().trim().min(1).max(20).optional(),
});
export type OllamaSettings = z.infer<typeof OllamaSettingsSchema>;

export const OLLAMA_SETTING_FIELDS = [
  'url',
  'model',
  'remoteUrl',
  'remoteModel',
  'numCtx',
  'keepAlive',
  'cropDpi',
  'cropMaxWidth',
  'cropMaxHeight',
  'promptVersion',
] as const;
export type OllamaSettingField = (typeof OLLAMA_SETTING_FIELDS)[number];

// ---------------------------------------------------------------------------
// Secret encryption. The passphrase (CODEX_SETTINGS_KEY) is an operator-chosen
// high-entropy secret, so a plain HKDF is enough to derive the AES key.
// ---------------------------------------------------------------------------

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';
const KEY_SALT = 'codex-settings-salt';
const KEY_INFO = 'codex-settings-v1';
/** Binds a ciphertext to its purpose so a blob cannot be replayed into another field. */
const AAD = Buffer.from('codex:llm:deepseekApiKey');

/** Shortest passphrase accepted; shorter is rejected rather than quietly weak. */
export const MIN_SETTINGS_KEY_LENGTH = 24;

export class SettingsKeyError extends Error {}

const deriveKey = (passphrase: string): Buffer => {
  if (passphrase.length < MIN_SETTINGS_KEY_LENGTH) {
    throw new SettingsKeyError(`CODEX_SETTINGS_KEY must be at least ${MIN_SETTINGS_KEY_LENGTH} characters`);
  }
  return Buffer.from(hkdfSync('sha256', passphrase, KEY_SALT, KEY_INFO, 32));
};

/** `v1.<iv>.<tag>.<ciphertext>`, each part base64. A fresh random IV per call. */
export function encryptSecret(plain: string, passphrase: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, deriveKey(passphrase), iv);
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [VERSION, iv.toString('base64'), cipher.getAuthTag().toString('base64'), ciphertext.toString('base64')].join('.');
}

/** Throws SettingsKeyError for a wrong passphrase or a damaged / foreign blob. */
export function decryptSecret(blob: string, passphrase: string): string {
  const [version, iv, tag, ciphertext] = blob.split('.');
  if (version !== VERSION || !iv || !tag || ciphertext === undefined) {
    throw new SettingsKeyError('Unrecognised secret format');
  }
  try {
    const decipher = createDecipheriv(ALGORITHM, deriveKey(passphrase), Buffer.from(iv, 'base64'));
    decipher.setAAD(AAD);
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8');
  } catch (error) {
    if (error instanceof SettingsKeyError) throw error;
    throw new SettingsKeyError('Could not decrypt the saved key: wrong CODEX_SETTINGS_KEY or damaged value');
  }
}

/** What the UI may show about a key: its last four characters, never more. */
export const keyHint = (key: string): string => (key.length > 8 ? `…${key.slice(-4)}` : '…');
