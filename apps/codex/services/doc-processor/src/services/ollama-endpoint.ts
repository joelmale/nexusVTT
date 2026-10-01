import { env } from '../config/env';

/**
 * Where an extract stage sends its VLM calls. `local` is the Ollama on the
 * Dockhand server, which shares the 6 GB GPU with the layout models and so
 * needs the GPU handoff. `remote` is an optional Ollama on another machine
 * (e.g. a workstation GPU) that shares nothing with ocr-service.
 */
export type OllamaEndpoint = {
  url: string;
  model: string;
  where: 'local' | 'remote';
  sharesGpu: boolean;
};

export const localEndpoint = (): OllamaEndpoint => ({
  url: env.OLLAMA_URL,
  model: env.VLM_MODEL,
  where: 'local',
  sharesGpu: true,
});

const remoteModel = () => env.OLLAMA_REMOTE_MODEL || env.VLM_MODEL;

/** Ollama lists untagged models as `name:latest`. */
const sameModel = (listed: string, wanted: string) =>
  listed === wanted || listed === `${wanted}:latest` || `${listed}:latest` === wanted;

/**
 * Picks the endpoint once per extract stage. The remote endpoint is used only
 * when it answers /api/tags quickly and already has the model, so a laptop
 * that is asleep, away or missing the model falls back to the local Ollama
 * instead of failing the stage. Never throws.
 */
export async function resolveOllamaEndpoint(): Promise<{ endpoint: OllamaEndpoint; reason: string }> {
  if (!env.OLLAMA_REMOTE_URL) {
    return { endpoint: localEndpoint(), reason: 'no remote Ollama configured' };
  }
  const url = env.OLLAMA_REMOTE_URL.replace(/\/$/, '');
  const model = remoteModel();
  try {
    const response = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(env.OLLAMA_REMOTE_PROBE_MS) });
    if (!response.ok) {
      return { endpoint: localEndpoint(), reason: `remote Ollama ${url} answered HTTP ${response.status}` };
    }
    const { models = [] } = (await response.json()) as { models?: Array<{ name: string }> };
    if (!models.some((m) => sameModel(m.name, model))) {
      return { endpoint: localEndpoint(), reason: `remote Ollama ${url} does not have ${model}` };
    }
    return { endpoint: { url, model, where: 'remote', sharesGpu: false }, reason: `remote Ollama ${url} is up` };
  } catch (error: any) {
    return { endpoint: localEndpoint(), reason: `remote Ollama ${url} unreachable: ${error?.message ?? error}` };
  }
}
