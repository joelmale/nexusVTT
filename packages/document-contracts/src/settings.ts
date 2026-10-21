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
