import { createHash } from 'crypto';
import { z } from 'zod/v4'; // zod 3.25 ships the v4 API with toJSONSchema
import { env } from '../config/env';
import { s3Service } from './s3.service';
import { ENTITY_LISTS, ENTITY_SCHEMAS, EntityType, ExtractedEntity } from '../extraction/schemas';
import { localEndpoint, OllamaEndpoint } from './ollama-endpoint';
import { extractWithDeepSeek, type DeepSeekUsage } from './deepseek';

type ExtractInput = { text: string; images?: Buffer[] };

/**
 * Ollama aborts a generation that falls into a repetition loop with a 500.
 * At temperature 0 the same request loops the same way every time, so retrying
 * it unchanged (BullMQ, or the stage) cannot succeed.
 */
export class OllamaRepeatLimitError extends Error {
  constructor(body: string) {
    super(`Ollama 500: ${body}`);
    this.name = 'OllamaRepeatLimitError';
  }
}

const isRepeatLimit = (status: number, body: string) => status === 500 && /token repeat limit/i.test(body);

/** Sampling used for the one retry after a repeat-limit abort: breaks the greedy loop. */
const REPEAT_RETRY_OPTIONS = { temperature: 0.3, repeat_penalty: 1.15 };

const ollamaUrl = (endpoint: OllamaEndpoint, path: string) => `${endpoint.url.replace(/\/$/, '')}${path}`;

/**
 * One Ollama structured-output call (plan: "Ollama client"). A failure to
 * reach Ollama throws so the stage fails and BullMQ retries it; a response
 * that does not match the schema does not throw (parsed is null).
 */
export async function extractWithSchema<T extends z.ZodType>(
  schema: T,
  systemPrompt: string,
  input: ExtractInput,
  endpoint: OllamaEndpoint = localEndpoint(),
  samplingOverrides: Record<string, number> = {},
): Promise<{ parsed: z.infer<T> | null; raw: string }> {
  const response = await fetch(ollamaUrl(endpoint, '/api/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(env.LLM_TIMEOUT_MS),
    body: JSON.stringify({
      model: endpoint.model, // one model for text and images
      stream: false,
      keep_alive: env.OLLAMA_KEEP_ALIVE,
      format: z.toJSONSchema(schema), // Ollama structured outputs
      options: { temperature: 0, num_ctx: env.OLLAMA_NUM_CTX, ...samplingOverrides },
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Source text for this region:\n\n${input.text}`,
          ...(input.images?.length ? { images: input.images.map((image) => image.toString('base64')) } : {}),
        },
      ],
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    if (isRepeatLimit(response.status, body)) throw new OllamaRepeatLimitError(body);
    throw new Error(`Ollama ${response.status}: ${body}`);
  }
  const raw = ((await response.json()) as { message: { content: string } }).message.content;
  return { parsed: parseRaw(schema, raw), raw };
}

const parseRaw = <T extends z.ZodType>(schema: T, raw: string): z.infer<T> | null => {
  try {
    const result = schema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
};

const COMMON_RULES = [
  'Extract only what is printed in the source. Never invent or complete values.',
  'Copy names, numbers and wording exactly as printed; keep dice notation such as "12d10 + 48".',
  'Omit an optional field when the source does not print it.',
  'Return {"entities": []} when the region holds no complete entry of this kind.',
  'The region may hold more than one entry; return each as its own entity.',
].join('\n');

export const SYSTEM_PROMPTS: Record<EntityType, string> = {
  monster: `You read Dungeons & Dragons 5th edition monster stat blocks.
The image is a crop of the printed stat block; the text is the same region read by a layout model.
Use the image for table and column structure (the STR..CHA row) and the text for spelling.
${COMMON_RULES}
challengeRating is the printed value, e.g. "5 (1,800 XP)". abilities are scores, not modifiers.`,
  spell: `You read Dungeons & Dragons 5th edition spell descriptions.
${COMMON_RULES}
level is 0 for a cantrip. school is the lower-case school name. components is the printed line, e.g. "V, S, M (a pinch of sulfur)".
concentration and ritual are true only when printed.`,
  item: `You read Dungeons & Dragons 5th edition magic item descriptions.
${COMMON_RULES}
type is the printed type line before the comma, e.g. "Wondrous item" or "Weapon (longsword)". rarity is the printed rarity, lower case.
requiresAttunement is true only when "requires attunement" is printed; put any "by a ..." qualifier in attunementDetail.`,
};

export type CachedExtraction = {
  raw: string;
  model: string;
  promptVersion: string;
  candidateKey: string;
  createdAt: string;
};

export type ExtractionOutcome = {
  entities: ExtractedEntity[]; // schema-valid entities only
  parseFailed: boolean; // the response, or at least one entity in it, failed validation
  raw: string;
  cacheKey: string;
  cached: boolean;
  model: string;
  promptVersion: string;
  /** Set when the model could not produce a response for this candidate (it is then kept for review). */
  failureReason?: 'model_repeat_limit';
  /** Token usage of a paid API call; absent for Ollama and for cache hits. */
  usage?: DeepSeekUsage;
};

/** sha256(contentHash, candidateBlockHash, model, promptVersion), as in the plan. */
export const extractionCacheKey = (contentHash: string, blockHash: string, model: string, promptVersion: string) =>
  createHash('sha256').update([contentHash, blockHash, model, promptVersion].join('\u0000')).digest('hex');

export class LlmExtractionService {
  /**
   * Extracts the entities of one candidate. The raw model response is cached at
   * extract-cache/<documentId>/<key>.json, so a retry or resume reuses it
   * instead of calling Ollama. A changed model or prompt version misses.
   */
  async extractCandidate(params: {
    documentId: string;
    contentHash: string;
    candidateKey: string;
    blockHash: string;
    type: EntityType;
    text: string;
    images?: Buffer[];
    endpoint?: OllamaEndpoint;
  }): Promise<ExtractionOutcome> {
    const endpoint = params.endpoint ?? localEndpoint();
    const model = endpoint.model;
    const promptVersion = env.EXTRACT_PROMPT_VERSION;
    const cacheKey = extractionCacheKey(params.contentHash, params.blockHash, model, promptVersion);
    const s3Key = `extract-cache/${params.documentId}/${cacheKey}.json`;
    const list = ENTITY_LISTS[params.type];

    let raw: string;
    let cached = false;
    let usage: DeepSeekUsage | undefined;
    const hit = await s3Service.downloadFileIfExists(s3Key);
    if (hit) {
      raw = (JSON.parse(hit.toString('utf-8')) as CachedExtraction).raw;
      cached = true;
    } else {
      const input = { text: params.text, images: params.images };
      if (endpoint.where === 'deepseek') {
        // Text only: DeepSeek takes no images, so a stat block routed here is read without its crop.
        const answer = await extractWithDeepSeek(list, SYSTEM_PROMPTS[params.type], { text: params.text }, endpoint);
        raw = answer.raw;
        usage = answer.usage;
      } else try {
        raw = (await extractWithSchema(list, SYSTEM_PROMPTS[params.type], input, endpoint)).raw;
      } catch (error) {
        if (!(error instanceof OllamaRepeatLimitError)) throw error;
        // One retry with sampling noise. If the model still loops, give up on
        // this candidate only: failing the stage would retry the same loop and
        // block every other entity in the document. Not cached, so a later
        // model or prompt change gets a fresh attempt.
        try {
          raw = (await extractWithSchema(list, SYSTEM_PROMPTS[params.type], input, endpoint, REPEAT_RETRY_OPTIONS)).raw;
        } catch (retryError) {
          if (!(retryError instanceof OllamaRepeatLimitError)) throw retryError;
          return {
            entities: [],
            parseFailed: true,
            raw: '',
            cacheKey,
            cached: false,
            model,
            promptVersion,
            failureReason: 'model_repeat_limit',
          };
        }
      }
      const entry: CachedExtraction = {
        raw,
        model,
        promptVersion,
        candidateKey: params.candidateKey,
        createdAt: new Date().toISOString(),
      };
      await s3Service.uploadFile(s3Key, Buffer.from(JSON.stringify(entry)), 'application/json');
    }

    // Validate per entity so one bad entry in a two-block region keeps the other.
    let entities: ExtractedEntity[] = [];
    let parseFailed = false;
    try {
      const body = JSON.parse(raw) as { entities?: unknown[] };
      if (!Array.isArray(body.entities)) throw new Error('no entities array');
      for (const candidate of body.entities) {
        const result = ENTITY_SCHEMAS[params.type].safeParse(candidate);
        if (result.success) entities.push(result.data as ExtractedEntity);
        else parseFailed = true;
      }
    } catch {
      entities = [];
      parseFailed = true;
    }

    return { entities, parseFailed, raw, cacheKey, cached, model, promptVersion, ...(usage ? { usage } : {}) };
  }

  /**
   * Frees the VLM's VRAM now instead of after OLLAMA_KEEP_ALIVE (6 GB GPU
   * handoff back to the layout engine). Best effort.
   */
  async unloadModel(endpoint: OllamaEndpoint = localEndpoint()): Promise<void> {
    try {
      await fetch(ollamaUrl(endpoint, '/api/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: endpoint.model, keep_alive: 0 }),
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      // Ollama frees it after keep_alive anyway.
    }
  }
}

export const llmExtractionService = new LlmExtractionService();
