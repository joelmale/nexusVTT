import { Prisma } from '@prisma/client';
import { OLLAMA_ENV_SNAPSHOT_ID, OLLAMA_SETTINGS_ID, OllamaSettingsSchema, type OllamaSettings } from '@nexus/document-contracts';
import { env } from '../config/env';
import { prisma } from './database.service';

/**
 * Ollama settings saved from the admin Settings page, applied over the
 * OLLAMA_* / VLM_MODEL environment for one extract stage. A field that was
 * never saved is absent and the environment value stands. Anything that goes
 * wrong (database down, saved value damaged) means no overrides plus a note, so
 * the stage still runs on the environment instead of failing on a settings problem.
 */

export type OllamaOverrides = OllamaSettings;
export type ResolvedOllamaOverrides = { overrides: OllamaOverrides; notes: string[] };

type SettingsRow = { value: unknown } | null;

export interface OllamaSettingsStore {
  read(): Promise<SettingsRow>;
}

const prismaStore: OllamaSettingsStore = {
  read: () => prisma.codexSetting.findUnique({ where: { key: OLLAMA_SETTINGS_ID }, select: { value: true } }),
};

export async function loadOllamaOverrides(store: OllamaSettingsStore = prismaStore): Promise<ResolvedOllamaOverrides> {
  let row: SettingsRow;
  try {
    row = await store.read();
  } catch (error: any) {
    return { overrides: {}, notes: [`Could not read saved Ollama settings (${error?.message ?? error}); using the environment settings`] };
  }
  if (!row) return { overrides: {}, notes: [] };
  const parsed = OllamaSettingsSchema.safeParse(row.value ?? {});
  if (!parsed.success) return { overrides: {}, notes: ['Saved Ollama settings are damaged; using the environment settings'] };
  return { overrides: parsed.data, notes: [] };
}

/** The values the environment alone gives, in the shape the Settings page shows beside each saved override. */
export const envOllamaSettings = (): OllamaSettings => ({
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

/**
 * doc-api has no OLLAMA_* variables, so doc-processor tells it what its
 * environment says. Called at startup; failure is logged and ignored.
 */
export async function publishOllamaEnvSnapshot(): Promise<void> {
  try {
    const value = JSON.parse(JSON.stringify(envOllamaSettings())) as Prisma.InputJsonValue;
    await prisma.codexSetting.upsert({
      where: { key: OLLAMA_ENV_SNAPSHOT_ID },
      create: { key: OLLAMA_ENV_SNAPSHOT_ID, value },
      update: { value },
    });
  } catch (error: any) {
    console.warn(`[doc-processor] could not publish the Ollama environment snapshot: ${error?.message ?? error}`);
  }
}
