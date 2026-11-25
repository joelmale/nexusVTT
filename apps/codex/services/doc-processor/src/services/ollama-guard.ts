import { UnrecoverableError } from 'bullmq';
import { env } from '../config/env';
import { sameModel, type OllamaEndpoint } from './ollama-endpoint';

/**
 * Preflight for the extract stage's Ollama. The extract stage shares one small
 * GPU with other tenants of the same Ollama (chat UIs, taggers) and with the
 * layout models, and used to discover a busy GPU the hard way: a candidate call
 * timing out or Ollama failing with "CUDA error: out of memory", then BullMQ
 * retrying into the same wall. This checks first, waits (bounded) for other
 * models to leave, and loads the model once with a generous timeout so the
 * per-candidate timeout only has to cover inference.
 */

export type GuardLog = {
  info(message: string): unknown;
  warn(message: string): unknown;
};

export type GuardDeps = {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<unknown>;
  now?: () => number;
};

export type LoadedModel = { name: string; sizeVram: number };

export type OllamaState = {
  /** Names Ollama can serve (/api/tags). */
  available: string[];
  /** Models currently resident (/api/ps). */
  loaded: LoadedModel[];
};

const PROBE_TIMEOUT_MS = 5000;

const GPU_MEMORY_ERROR = /out of memory|cudaMemGetInfo|llama-server startup failed|CUDA error/i;

/** Ollama failed because the GPU was already full, not because the request was wrong. */
export const isGpuMemoryError = (message: string) => GPU_MEMORY_ERROR.test(message);

const baseUrl = (endpoint: OllamaEndpoint) => endpoint.url.replace(/\/$/, '');
const defaultSleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const mib = (bytes: number) => Math.round(bytes / (1024 * 1024));

/** What Ollama can serve and what is loaded right now. Throws a readable error if it cannot be reached. */
export async function inspectOllama(endpoint: OllamaEndpoint, fetchImpl: typeof fetch = fetch): Promise<OllamaState> {
  const url = baseUrl(endpoint);
  let tags: Response;
  try {
    tags = await fetchImpl(`${url}/api/tags`, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
  } catch (error: any) {
    throw new Error(`Ollama ${url} unreachable: ${error?.message ?? error}`);
  }
  if (!tags.ok) throw new Error(`Ollama ${url} answered HTTP ${tags.status} to /api/tags`);
  const { models = [] } = (await tags.json()) as { models?: Array<{ name: string }> };

  // /api/ps is absent on old Ollama builds and not essential: treat any failure as "nothing loaded".
  let loaded: LoadedModel[] = [];
  try {
    const ps = await fetchImpl(`${url}/api/ps`, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    if (ps.ok) {
      const body = (await ps.json()) as { models?: Array<{ name: string; size_vram?: number }> };
      loaded = (body.models ?? []).map((m) => ({ name: m.name, sizeVram: m.size_vram ?? 0 }));
    }
  } catch {
    loaded = [];
  }
  return { available: models.map((m) => m.name), loaded };
}

const describeLoaded = (models: LoadedModel[]) =>
  models.map((m) => `${m.name} (${mib(m.sizeVram)} MiB in VRAM)`).join(', ');

export type PreflightResult = {
  waitedMs: number;
  /** Other models that were still resident when we gave up waiting; empty when the GPU was clear. */
  stillHeldBy: string[];
};

/**
 * Throws when Ollama is unreachable or the GPU stayed full after waiting for the
 * model to load; the stage then fails and BullMQ retries with its own backoff.
 * Throws UnrecoverableError only when Ollama answered and does not have the model.
 */
export async function prepareOllama(
  endpoint: OllamaEndpoint,
  log: GuardLog,
  deps: GuardDeps = {},
): Promise<PreflightResult> {
  const fetchImpl = deps.fetch ?? fetch;
  const sleep = deps.sleep ?? defaultSleep;
  const now = deps.now ?? Date.now;
  const started = now();
  const waited = () => now() - started;
  const maxWait = env.OLLAMA_GPU_WAIT_MAX_MS;
  const poll = env.OLLAMA_GPU_WAIT_POLL_MS;
  const seconds = (ms: number) => Math.round(ms / 1000);
  let stillHeldBy: string[] = [];

  // 1. Reachable, has the model, and (shared GPU only) nobody else is holding it.
  for (;;) {
    const state = await inspectOllama(endpoint, fetchImpl);
    if (!state.available.some((name) => sameModel(name, endpoint.model))) {
      throw new UnrecoverableError(
        `Ollama ${baseUrl(endpoint)} does not have ${endpoint.model}. Pull it there (ollama pull ${endpoint.model}) and reprocess the document.`,
      );
    }
    const others = state.loaded.filter((m) => !sameModel(m.name, endpoint.model));
    if (!endpoint.sharesGpu || others.length === 0) break;

    if (waited() >= maxWait) {
      stillHeldBy = others.map((m) => m.name);
      await log.warn(
        `GPU still held by ${describeLoaded(others)} after ${seconds(waited())}s; loading ${endpoint.model} anyway`,
      );
      break;
    }
    await log.warn(
      `GPU busy: ${describeLoaded(others)} loaded in the shared Ollama. Waiting for it to unload before loading ${endpoint.model} (${seconds(waited())}s of ${seconds(maxWait)}s)`,
    );
    await sleep(poll);
  }

  // 2. Load the model once. Retry while the failure is "GPU full", within the same budget.
  for (;;) {
    try {
      await warmUp(endpoint, fetchImpl);
      break;
    } catch (error: any) {
      const message = String(error?.message ?? error);
      if (!isGpuMemoryError(message) || waited() >= maxWait) {
        throw new Error(`Could not load ${endpoint.model} in Ollama ${baseUrl(endpoint)}: ${message}`);
      }
      await log.warn(
        `Ollama ran out of GPU memory loading ${endpoint.model}; waiting ${seconds(poll)}s for it to free up (${seconds(waited())}s of ${seconds(maxWait)}s)`,
      );
      await sleep(poll);
    }
  }

  const result = { waitedMs: waited(), stillHeldBy };
  await log.info(
    `Ollama ready: ${endpoint.model} loaded${result.waitedMs > 1000 ? ` after waiting ${seconds(result.waitedMs)}s` : ''}`,
  );
  return result;
}

/**
 * Loads the model with the same num_ctx the extraction calls use (a different
 * value would make Ollama reload it). The timeout stays under undici's fixed
 * 5-minute header wait, which would otherwise cut it off as "fetch failed".
 */
async function warmUp(endpoint: OllamaEndpoint, fetchImpl: typeof fetch) {
  const response = await fetchImpl(`${baseUrl(endpoint)}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(env.OLLAMA_WARMUP_TIMEOUT_MS),
    body: JSON.stringify({
      model: endpoint.model,
      prompt: '',
      stream: false,
      keep_alive: endpoint.keepAlive ?? env.OLLAMA_KEEP_ALIVE,
      options: { num_ctx: endpoint.numCtx ?? env.OLLAMA_NUM_CTX },
    }),
  });
  if (!response.ok) {
    throw new Error(`Ollama ${response.status}: ${await response.text().catch(() => '')}`);
  }
}
