import { Prisma } from '@prisma/client';
import {
  OLLAMA_ENV_SNAPSHOT_ID,
  OLLAMA_SETTINGS_ID,
  OLLAMA_SETTING_FIELDS,
  OllamaSettingsSchema,
  type OllamaSettings,
} from '@nexus/document-contracts';
import { prisma } from './database.service';

/**
 * Runtime overrides for the OLLAMA_* / VLM_MODEL environment variables, saved
 * from the admin Settings page and read by doc-processor at the start of each
 * extract stage. doc-api has no OLLAMA_* variables of its own, so the values
 * the environment would give are the snapshot doc-processor publishes at start.
 */

type Row = { value: unknown; updatedAt: Date; updatedBy: string | null } | null;

export type OllamaSettingsView = {
  /** What has been saved here; absent fields fall back to the environment. */
  saved: OllamaSettings;
  /** What doc-processor's environment gives, or null until doc-processor has started once. */
  environment: OllamaSettings | null;
  /** The value each setting resolves to (saved over environment). */
  effective: OllamaSettings;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type OllamaSettingsPatch = { [K in keyof OllamaSettings]?: OllamaSettings[K] | null };

const readRow = (key: string): Promise<Row> =>
  prisma.codexSetting.findUnique({ where: { key }, select: { value: true, updatedAt: true, updatedBy: true } });

/** A damaged stored value reads as "nothing saved" so the page still loads and can be fixed. */
const parse = (value: unknown): OllamaSettings => {
  const parsed = OllamaSettingsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
};

export async function getOllamaSettingsView(): Promise<OllamaSettingsView> {
  const [row, snapshot] = await Promise.all([readRow(OLLAMA_SETTINGS_ID), readRow(OLLAMA_ENV_SNAPSHOT_ID)]);
  const saved = parse(row?.value);
  const environment = snapshot ? parse(snapshot.value) : null;
  return {
    saved,
    environment,
    effective: { ...(environment ?? {}), ...saved },
    updatedAt: row?.updatedAt.toISOString() ?? null,
    updatedBy: row?.updatedBy ?? null,
  };
}

/** Merges the patch over what is saved. A null clears that override, reverting the setting to the environment. */
export async function saveOllamaSettings(patch: OllamaSettingsPatch, actor: string | null): Promise<OllamaSettingsView> {
  const current = parse((await readRow(OLLAMA_SETTINGS_ID))?.value);
  const next: Record<string, unknown> = { ...current };
  for (const field of OLLAMA_SETTING_FIELDS) {
    if (!(field in patch)) continue;
    if (patch[field] === null) delete next[field];
    else next[field] = patch[field];
  }
  const value = OllamaSettingsSchema.parse(next);
  const json = JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  await prisma.codexSetting.upsert({
    where: { key: OLLAMA_SETTINGS_ID },
    create: { key: OLLAMA_SETTINGS_ID, value: json, updatedBy: actor },
    update: { value: json, updatedBy: actor },
  });
  return getOllamaSettingsView();
}

export type OllamaCheck =
  | { ok: true; url: string; version: string | null; model: string; hasModel: boolean; models: string[] }
  | { ok: false; url: string | null; reason: string };

const sameModel = (listed: string, wanted: string) => listed === wanted || listed === `${wanted}:latest` || `${listed}:latest` === wanted;

/**
 * Probes an Ollama with the saved-or-environment settings: reachable, its
 * version, which models it has and whether the configured one is among them.
 * It only ever contacts the configured address, never one supplied with the request.
 */
export async function checkOllama(target: 'local' | 'remote', fetchImpl: typeof fetch = fetch): Promise<OllamaCheck> {
  const { effective } = await getOllamaSettingsView();
  const raw = target === 'remote' ? effective.remoteUrl : effective.url;
  if (!raw) {
    return {
      ok: false,
      url: null,
      reason: target === 'remote' ? 'No remote Ollama is configured.' : 'No local Ollama address is known yet; doc-processor has not started.',
    };
  }
  const url = raw.replace(/\/$/, '');
  const model = (target === 'remote' ? effective.remoteModel || effective.model : effective.model) ?? '';

  const get = async (path: string) => {
    const response = await fetchImpl(`${url}${path}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json().catch(() => ({}));
  };

  let tags: { models?: Array<{ name?: string }> };
  try {
    tags = (await get('/api/tags')) as typeof tags;
  } catch (error: any) {
    return { ok: false, url, reason: `Could not reach Ollama at ${url}: ${error?.message ?? error}` };
  }
  const version = ((await get('/api/version').catch(() => ({}))) as { version?: string }).version ?? null;
  const models = (tags.models ?? []).map((entry) => entry.name ?? '').filter(Boolean);
  return { ok: true, url, version, model, hasModel: Boolean(model) && models.some((name) => sameModel(name, model)), models };
}
