import { env } from '../config/env';
import type { OllamaOverrides } from './ollama-settings.service';

/**
 * Where an extract stage sends its VLM calls. `local` is the Ollama on the
 * Dockhand server, which shares the 6 GB GPU with the layout models and so
 * needs the GPU handoff. `remote` is an optional Ollama on another machine
 * (e.g. a workstation GPU) that shares nothing with ocr-service.
 *
 * `numCtx` and `keepAlive` are set only when saved in admin Settings; callers
 * fall back to OLLAMA_NUM_CTX / OLLAMA_KEEP_ALIVE when they are absent.
 */
export type OllamaEndpoint = {
  url: string;
  model: string;
  where: 'local' | 'remote' | 'deepseek';
  sharesGpu: boolean;
  numCtx?: number;
  keepAlive?: string;
};

const tuning = (overrides: OllamaOverrides) => ({
  ...(overrides.numCtx !== undefined ? { numCtx: overrides.numCtx } : {}),
  ...(overrides.keepAlive !== undefined ? { keepAlive: overrides.keepAlive } : {}),
});

export const localEndpoint = (overrides: OllamaOverrides = {}): OllamaEndpoint => ({
  url: overrides.url ?? env.OLLAMA_URL,
  model: overrides.model ?? env.VLM_MODEL,
  where: 'local',
  sharesGpu: true,
  ...tuning(overrides),
});

/** Saved settings over the environment; an empty saved remote model means "same as the local model". */
const remoteModel = (overrides: OllamaOverrides) =>
  (overrides.remoteModel ?? env.OLLAMA_REMOTE_MODEL) || (overrides.model ?? env.VLM_MODEL);

/** Ollama lists untagged models as `name:latest`. */
export const sameModel = (listed: string, wanted: string) =>
  listed === wanted || listed === `${wanted}:latest` || `${listed}:latest` === wanted;

/**
 * Picks the endpoint once per extract stage. The remote endpoint is used only
 * when it answers /api/tags quickly and already has the model, so a laptop
 * that is asleep, away or missing the model falls back to the local Ollama
 * instead of failing the stage. Never throws.
 */
export async function resolveOllamaEndpoint(
  overrides: OllamaOverrides = {},
): Promise<{ endpoint: OllamaEndpoint; reason: string }> {
  const local = localEndpoint(overrides);
  const remoteUrl = overrides.remoteUrl ?? env.OLLAMA_REMOTE_URL;
  if (!remoteUrl) {
    return { endpoint: local, reason: 'no remote Ollama configured' };
  }
  const url = remoteUrl.replace(/\/$/, '');
  const model = remoteModel(overrides);
  try {
    const response = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(env.OLLAMA_REMOTE_PROBE_MS) });
    if (!response.ok) {
      return { endpoint: local, reason: `remote Ollama ${url} answered HTTP ${response.status}` };
    }
    const { models = [] } = (await response.json()) as { models?: Array<{ name: string }> };
    if (!models.some((m) => sameModel(m.name, model))) {
      return { endpoint: local, reason: `remote Ollama ${url} does not have ${model}` };
    }
    return { endpoint: { url, model, where: 'remote', sharesGpu: false, ...tuning(overrides) }, reason: `remote Ollama ${url} is up` };
  } catch (error: any) {
    return { endpoint: local, reason: `remote Ollama ${url} unreachable: ${error?.message ?? error}` };
  }
}
