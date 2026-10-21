import { UnrecoverableError } from 'bullmq';
import { z } from 'zod/v4'; // zod 3.25 ships the v4 API with toJSONSchema
import { env } from '../config/env';
import type { EntityType } from '../extraction/schemas';
import type { OllamaEndpoint } from './ollama-endpoint';

/**
 * DeepSeek (platform.deepseek.com) as a second place to send extraction calls.
 * It is cheap and fast, but text-only: no images, and JSON mode instead of
 * schema-constrained output. In `auto` mode spells and items (text) go to it and
 * stat blocks, which send page crops, stay on the local VLM.
 *
 * Off unless an API key is configured. The key lives only in the resolved
 * config and on a non-enumerable endpoint property: it is sent as the
 * Authorization header and never logged, serialized or stored in results.
 */

/** `auto` = DeepSeek for the types in `for`, Ollama for the rest. */
export type LlmProviderMode = 'auto' | 'ollama' | 'deepseek';

export type DeepSeekConfig = {
  apiKey: string;
  url: string;
  model: string;
  maxTokens: number;
};

/** Where each kind of candidate goes. Resolved once per extract stage. */
export type LlmRouting = {
  mode: LlmProviderMode;
  /** Null when no API key is configured: DeepSeek is unavailable whatever the mode. */
  deepseek: DeepSeekConfig | null;
  /** Entity types sent to DeepSeek in `auto` mode. */
  for: EntityType[];
};

export type DeepSeekUsage = { promptTokens: number; completionTokens: number; cacheHitTokens: number };

/** Routing from environment variables alone (the settings page overlays this). */
export const envLlmRouting = (): LlmRouting => {
  const apiKey = env.DEEPSEEK_API_KEY.trim();
  return {
    mode: env.EXTRACT_PROVIDER,
    deepseek: apiKey
      ? { apiKey, url: env.DEEPSEEK_API_URL, model: env.DEEPSEEK_MODEL, maxTokens: env.DEEPSEEK_MAX_TOKENS }
      : null,
    for: env.DEEPSEEK_FOR,
  };
};

/** Which backend takes this entity type. DeepSeek is only chosen when a key exists. */
export const providerFor = (routing: LlmRouting, type: EntityType): 'deepseek' | 'ollama' => {
  if (!routing.deepseek || routing.mode === 'ollama') return 'ollama';
  if (routing.mode === 'deepseek') return 'deepseek';
  return routing.for.includes(type) ? 'deepseek' : 'ollama';
};

/** A pseudo endpoint so the stage and the extraction cache treat DeepSeek like any other model. */
export const deepseekEndpoint = (config: DeepSeekConfig): OllamaEndpoint => {
  const endpoint: OllamaEndpoint = { url: config.url, model: config.model, where: 'deepseek', sharesGpu: false };
  // Non-enumerable so JSON.stringify, spreads and log formatting skip the key.
  Object.defineProperty(endpoint, 'apiKey', { value: config.apiKey, enumerable: false });
  Object.defineProperty(endpoint, 'maxTokens', { value: config.maxTokens, enumerable: false });
  return endpoint;
};

/**
 * 401/403 (bad key), 402 (no balance) and 400/422 (our request) cannot be fixed
 * by retrying, so they fail the document with a message that says what to do.
 * 429 and 5xx are retried by BullMQ like any transient failure.
 */
export function deepseekHttpError(status: number, body: string): Error {
  const detail = body.slice(0, 300);
  if (status === 401 || status === 403) {
    return new UnrecoverableError(`DeepSeek rejected the API key (HTTP ${status}). Check the key in Settings or the stack environment.`);
  }
  if (status === 402) {
    return new UnrecoverableError('DeepSeek account has insufficient balance (HTTP 402). Top up at platform.deepseek.com, then reprocess.');
  }
  if (status === 400 || status === 422) {
    return new UnrecoverableError(`DeepSeek rejected the request (HTTP ${status}): ${detail}`);
  }
  return new Error(`DeepSeek HTTP ${status}: ${detail}`);
}

const JSON_INSTRUCTION = (schema: unknown) =>
  `\n\nRespond with a single JSON object and nothing else (JSON only, no prose, no code fences) that matches this JSON Schema:\n${JSON.stringify(schema)}`;

/**
 * One chat completion in JSON mode. A response that is not valid JSON or does not
 * match the schema does not throw (the caller validates per entity); a transport
 * or HTTP failure does.
 */
export async function extractWithDeepSeek(
  list: z.ZodType,
  systemPrompt: string,
  input: { text: string },
  endpoint: OllamaEndpoint,
  fetchImpl: typeof fetch = fetch,
): Promise<{ raw: string; usage: DeepSeekUsage }> {
  const apiKey = (endpoint as OllamaEndpoint & { apiKey?: string }).apiKey;
  if (!apiKey) throw new UnrecoverableError('DeepSeek endpoint has no API key');
  const maxTokens = (endpoint as OllamaEndpoint & { maxTokens?: number }).maxTokens ?? env.DEEPSEEK_MAX_TOKENS;

  const response = await fetchImpl(`${endpoint.url.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(env.LLM_TIMEOUT_MS),
    body: JSON.stringify({
      model: endpoint.model,
      stream: false,
      temperature: 0,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `${systemPrompt}${JSON_INSTRUCTION(z.toJSONSchema(list))}` },
        { role: 'user', content: `Source text for this region:\n\n${input.text}` },
      ],
    }),
  });
  if (!response.ok) throw deepseekHttpError(response.status, await response.text().catch(() => ''));

  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_cache_hit_tokens?: number };
  };
  return {
    raw: body.choices?.[0]?.message?.content ?? '',
    usage: {
      promptTokens: body.usage?.prompt_tokens ?? 0,
      completionTokens: body.usage?.completion_tokens ?? 0,
      cacheHitTokens: body.usage?.prompt_cache_hit_tokens ?? 0,
    },
  };
}
