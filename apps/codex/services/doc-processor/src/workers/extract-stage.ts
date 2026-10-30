import { Prisma } from '@prisma/client';
import { prisma } from '../services/database.service';
import { s3Service } from '../services/s3.service';
import { loggingService } from '../services/logging.service';
import { prepareOllama } from '../services/ollama-guard';
import { deepseekEndpoint, envLlmRouting, providerFor, type LlmRouting } from '../services/deepseek';
import { entityResolverService } from '../services/entity-resolver.service';
import { entityLinkingService } from '../services/entity-linking.service';
import { layoutClientService } from '../services/layout-client.service';
import { llmExtractionService } from '../services/llm-extraction.service';
import { localEndpoint, OllamaEndpoint, resolveOllamaEndpoint } from '../services/ollama-endpoint';
import type { OllamaOverrides } from '../services/ollama-settings.service';
import { monsterCropService, type CropResult } from '../services/monster-crop.service';
import { env } from '../config/env';
import { Candidate, CandidatePage, detectCandidates } from '../extraction/candidates';
import { EntityType, ExtractedEntity, Item, Monster, Spell } from '../extraction/schemas';
import { Review, reviewEntity } from '../extraction/validation';
import { LayoutBlock } from '../types/layout';

export type ExtractStageDocument = {
  id: string;
  format: string;
  storageKey: string;
  contentHash: string | null;
};

export type CandidateResult = {
  candidate: Candidate;
  cached: boolean;
  parseFailed: boolean;
  /** Model call time (0-ish when served from the extraction cache). */
  durationMs?: number;
  /** The model that read this candidate (differs per candidate when routing is mixed). */
  model?: string;
  entities: Array<{ name: string; entity: ExtractedEntity; review: Review }>;
};

export type ExtractStageResult = {
  counts: Record<EntityType, number>;
  needsReview: number;
  candidates: number;
  cachedCalls: number;
  results: CandidateResult[];
  /** The Ollama endpoint and model this stage used. */
  endpoint: OllamaEndpoint;
};

const searchTextFor = (type: EntityType, entity: ExtractedEntity) => {
  if (type === 'spell') {
    const s = entity as Spell;
    return `${s.name} ${s.school} ${s.level}`.toLowerCase();
  }
  if (type === 'monster') {
    const m = entity as Monster;
    return `${m.name} ${m.size} ${m.type}`.toLowerCase();
  }
  const i = entity as Item;
  return `${i.name} ${i.type} ${i.rarity}`.toLowerCase();
};

/**
 * v2 extract stage (plan: Extraction). DocumentPage blocks -> candidate
 * detection -> one cached LLM/VLM call per candidate -> zod validation and
 * cross-checks -> StructuredData rows via the entity resolver.
 *
 * Spells and items are text-only; monsters send ~200 DPI crops with the text.
 * With GPU_HANDOFF the layout models are unloaded first and the VLM after,
 * because the 6 GB GPU cannot hold both. A remote Ollama (OLLAMA_REMOTE_URL)
 * shares no GPU with ocr-service, so the handoff is skipped when one is used. Writes are delete-then-createMany per
 * document, as in v1, so a retry is idempotent; the extraction cache makes it
 * cheap.
 */
export type ExtractStageHooks = {
  /** After detection and endpoint selection, before any model call. */
  onCandidates?: (candidates: Candidate[], endpoint: OllamaEndpoint) => Promise<void>;
  /** After each candidate is extracted and validated. */
  onCandidate?: (result: CandidateResult) => Promise<void>;
  /** Just before a candidate goes to the model; `target` is the backend that will read it. */
  onDispatch?: (candidate: Candidate, crops: Array<Omit<CropResult, 'buffer'>>, target: OllamaEndpoint) => Promise<void>;
};

export async function runExtractStage(
  jobId: string,
  document: ExtractStageDocument,
  hooks: ExtractStageHooks = {},
  routing: LlmRouting = envLlmRouting(),
  ollama: OllamaOverrides = {}
): Promise<ExtractStageResult> {
  const pages = await prisma.documentPage.findMany({
    where: { documentId: document.id },
    orderBy: { pageNumber: 'asc' },
    select: { pageNumber: true, markdown: true, blocks: true },
  });
  const candidates = detectCandidates(
    pages.map((page): CandidatePage => ({
      pageNumber: page.pageNumber,
      markdown: page.markdown,
      blocks: (page.blocks as unknown as LayoutBlock[]) || [],
    }))
  );
  await loggingService.logInfo(jobId, `Detected ${candidates.length} extraction candidates`, 'extract');

  // Which backend takes each candidate. DeepSeek only applies when a key is
  // configured; everything else, including all stat blocks in `auto` mode
  // (they need page crops), goes to Ollama.
  const backendOf = (candidate: Candidate) => providerFor(routing, candidate.type);
  const usesOllama = candidates.some((c) => backendOf(c) === 'ollama');
  const usesDeepSeek = candidates.some((c) => backendOf(c) === 'deepseek');
  const deepseek = routing.deepseek && usesDeepSeek ? deepseekEndpoint(routing.deepseek) : null;
  if (candidates.length > 0) {
    const toDeepSeek = candidates.filter((c) => backendOf(c) === 'deepseek').length;
    await loggingService.logInfo(
      jobId,
      `Extraction routing (${routing.mode}): ${toDeepSeek} to DeepSeek${deepseek ? ` (${deepseek.model})` : ''}, ${candidates.length - toDeepSeek} to Ollama`,
      'extract'
    );
  }

  // Pick the Ollama endpoint once per stage; a retry re-probes, so a laptop that
  // drops out mid-stage is replaced by the local Ollama on the next attempt.
  let endpoint = localEndpoint(ollama);
  if (usesOllama) {
    const resolved = await resolveOllamaEndpoint(ollama);
    endpoint = resolved.endpoint;
    await loggingService.logInfo(
      jobId,
      `Extraction via ${endpoint.where} Ollama ${endpoint.url} (${endpoint.model}): ${resolved.reason}`,
      'extract'
    );
  } else if (deepseek) {
    endpoint = deepseek;
  }
  const handoff = env.GPU_HANDOFF && endpoint.sharesGpu && usesOllama;
  if (hooks.onCandidates) await hooks.onCandidates(candidates, endpoint);

  if (handoff) {
    const unloaded = await layoutClientService.unloadModels();
    await loggingService.logInfo(jobId, `GPU handoff: layout models ${unloaded ? 'unloaded' : 'not unloaded'}`, 'extract');
  }

  // Only stat blocks that go to a vision model need crops.
  const monsters = candidates.filter((c) => c.type === 'monster' && backendOf(c) === 'ollama');
  let crops = new Map<string, CropResult[]>();
  if (document.format === 'pdf' && monsters.length > 0) {
    try {
      const pdf = await s3Service.downloadFile(document.storageKey);
      crops = await monsterCropService.cropRegionsWithGeometry(pdf, new Map(monsters.map((c) => [c.key, c.regions])), ollama);
    } catch (error: any) {
      // Text still anchors the extraction; the missing crop is a review reason.
      await loggingService.logWarn(jobId, `Monster crops failed, extracting from text only: ${error.message}`, 'extract');
    }
  }

  const rows: Prisma.StructuredDataCreateManyInput[] = [];
  const results: CandidateResult[] = [];
  const mentions: Array<{ entityId: string; rawSnippet: string }> = [];
  const counts: Record<EntityType, number> = { spell: 0, monster: 0, item: 0 };
  let needsReview = 0;
  let cachedCalls = 0;
  let ollamaReady = !(env.OLLAMA_PREFLIGHT && usesOllama);
  const spend = { calls: 0, promptTokens: 0, cacheHitTokens: 0, completionTokens: 0 };

  try {
    for (const candidate of candidates) {
      const viaDeepSeek = backendOf(candidate) === 'deepseek' && deepseek !== null;
      if (!viaDeepSeek && !ollamaReady) {
        // First Ollama-bound candidate: check the server and GPU now, not for
        // a run that is all DeepSeek.
        await prepareOllama(endpoint, {
          info: (message) => loggingService.logInfo(jobId, message, 'extract'),
          warn: (message) => loggingService.logWarn(jobId, message, 'extract'),
        });
        ollamaReady = true;
      }
      const candidateCrops = candidate.type === 'monster' && !viaDeepSeek ? crops.get(candidate.key) : undefined;
      const images = candidateCrops?.map((crop) => crop.buffer);
      if (hooks.onDispatch) {
        await hooks.onDispatch(
          candidate,
          (candidateCrops ?? []).map(({ buffer: _buffer, ...geometry }) => geometry),
          viaDeepSeek ? deepseek : endpoint
        );
      }
      const callStart = Date.now();
      const outcome = await llmExtractionService.extractCandidate({
        documentId: document.id,
        contentHash: document.contentHash || 'unhashed',
        candidateKey: candidate.key,
        blockHash: candidate.blockHash,
        type: candidate.type,
        text: candidate.markdown,
        images,
        endpoint: viaDeepSeek ? deepseek : endpoint,
        promptVersion: ollama.promptVersion,
      });
      if (outcome.cached) cachedCalls += 1;
      if (outcome.usage) {
        spend.calls += 1;
        spend.promptTokens += outcome.usage.promptTokens;
        spend.cacheHitTokens += outcome.usage.cacheHitTokens;
        spend.completionTokens += outcome.usage.completionTokens;
      }

      const firstRegion = candidate.regions[0];
      const source = {
        pageNumber: candidate.pageNumber,
        blockIds: candidate.blockIds,
        bbox: firstRegion?.bbox,
        regions: candidate.regions,
        candidateKey: candidate.key,
        model: outcome.model,
        promptVersion: outcome.promptVersion,
        cacheKey: outcome.cacheKey,
      };

      const result: CandidateResult = {
        candidate,
        cached: outcome.cached,
        parseFailed: outcome.parseFailed,
        model: outcome.model,
        entities: [],
        durationMs: Date.now() - callStart,
      };

      for (const entity of outcome.entities) {
        const review = reviewEntity(candidate.type, entity, candidate.markdown);
        if (candidate.type === 'monster' && document.format === 'pdf' && !images?.length) {
          review.reasons.push('no_image_crop');
          review.status = 'needs_review';
        }
        if (outcome.parseFailed) {
          review.reasons.push('sibling_entity_failed_schema');
          review.status = 'needs_review';
        }
        const entityId = await entityResolverService.resolveEntity({
          name: entity.name,
          type: candidate.type,
          sourceDocumentId: document.id,
        });
        rows.push({
          documentId: document.id,
          type: candidate.type,
          name: entity.name,
          entityId,
          pageNumber: candidate.pageNumber,
          data: {
            ...entity,
            review,
            source,
            // v1-compatible fields read by existing UI and linking code.
            confidence: review.confidence,
            needsReview: review.status === 'needs_review',
            rawSnippet: candidate.markdown.slice(0, 4000),
          } as unknown as Prisma.InputJsonValue,
          searchText: searchTextFor(candidate.type, entity),
        });
        counts[candidate.type] += 1;
        if (review.status === 'needs_review') needsReview += 1;
        if (candidate.type === 'monster') mentions.push({ entityId, rawSnippet: candidate.markdown });
        result.entities.push({ name: entity.name, entity, review });
      }

      // Nothing valid came back: keep the candidate visible for review, with
      // the raw response left in the cache. No entity is resolved for it.
      if (outcome.entities.length === 0 && outcome.parseFailed) {
        const review: Review = { status: 'needs_review', confidence: 0, reasons: [outcome.failureReason ?? 'schema_invalid'], baseline: 'not_found' };
        rows.push({
          documentId: document.id,
          type: candidate.type,
          name: candidate.title || `Unparsed ${candidate.type} (p. ${candidate.pageNumber})`,
          pageNumber: candidate.pageNumber,
          data: { review, source, confidence: 0, needsReview: true, rawSnippet: candidate.markdown.slice(0, 4000) } as Prisma.InputJsonValue,
          searchText: `${candidate.title} ${candidate.type}`.toLowerCase(),
        });
        needsReview += 1;
      }

      results.push(result);
      if (hooks.onCandidate) await hooks.onCandidate(result);
    }
    if (spend.calls > 0 && deepseek) {
      await loggingService.logInfo(
        jobId,
        `DeepSeek ${deepseek.model}: ${spend.calls} calls, ${spend.promptTokens} prompt tokens (${spend.cacheHitTokens} cached), ${spend.completionTokens} completion tokens`,
        'extract'
      );
    }
  } finally {
    if (handoff) {
      await llmExtractionService.unloadModel(endpoint);
    }
  }

  await prisma.structuredData.deleteMany({ where: { documentId: document.id } });
  if (rows.length > 0) {
    await prisma.structuredData.createMany({ data: rows });
  }
  if (mentions.length > 0) {
    await entityLinkingService.linkSpellMentions({ documentId: document.id, monsters: mentions });
  }

  return { counts, needsReview, candidates: candidates.length, cachedCalls, results, endpoint };
}
