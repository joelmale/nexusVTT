import { Prisma } from '@prisma/client';
import { prisma } from '../services/database.service';
import { s3Service } from '../services/s3.service';
import { loggingService } from '../services/logging.service';
import { entityResolverService } from '../services/entity-resolver.service';
import { entityLinkingService } from '../services/entity-linking.service';
import { layoutClientService } from '../services/layout-client.service';
import { llmExtractionService } from '../services/llm-extraction.service';
import { monsterCropService } from '../services/monster-crop.service';
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
  entities: Array<{ name: string; entity: ExtractedEntity; review: Review }>;
};

export type ExtractStageResult = {
  counts: Record<EntityType, number>;
  needsReview: number;
  candidates: number;
  cachedCalls: number;
  results: CandidateResult[];
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
 * because the 6 GB GPU cannot hold both. Writes are delete-then-createMany per
 * document, as in v1, so a retry is idempotent; the extraction cache makes it
 * cheap.
 */
export type ExtractStageHooks = {
  /** After detection, before any model call. */
  onCandidates?: (candidates: Candidate[]) => Promise<void>;
  /** After each candidate is extracted and validated. */
  onCandidate?: (result: CandidateResult) => Promise<void>;
};

export async function runExtractStage(
  jobId: string,
  document: ExtractStageDocument,
  hooks: ExtractStageHooks = {}
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
  if (hooks.onCandidates) await hooks.onCandidates(candidates);

  if (env.GPU_HANDOFF && candidates.length > 0) {
    const unloaded = await layoutClientService.unloadModels();
    await loggingService.logInfo(jobId, `GPU handoff: layout models ${unloaded ? 'unloaded' : 'not unloaded'}`, 'extract');
  }

  const monsters = candidates.filter((c) => c.type === 'monster');
  let crops = new Map<string, Buffer[]>();
  if (document.format === 'pdf' && monsters.length > 0) {
    try {
      const pdf = await s3Service.downloadFile(document.storageKey);
      crops = await monsterCropService.cropRegions(pdf, new Map(monsters.map((c) => [c.key, c.regions])));
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

  try {
    for (const candidate of candidates) {
      const images = candidate.type === 'monster' ? crops.get(candidate.key) : undefined;
      const outcome = await llmExtractionService.extractCandidate({
        documentId: document.id,
        contentHash: document.contentHash || 'unhashed',
        candidateKey: candidate.key,
        blockHash: candidate.blockHash,
        type: candidate.type,
        text: candidate.markdown,
        images,
      });
      if (outcome.cached) cachedCalls += 1;

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

      const result: CandidateResult = { candidate, cached: outcome.cached, parseFailed: outcome.parseFailed, entities: [] };

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
        const review: Review = { status: 'needs_review', confidence: 0, reasons: ['schema_invalid'], baseline: 'not_found' };
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
  } finally {
    if (env.GPU_HANDOFF && candidates.length > 0) {
      await llmExtractionService.unloadModel();
    }
  }

  await prisma.structuredData.deleteMany({ where: { documentId: document.id } });
  if (rows.length > 0) {
    await prisma.structuredData.createMany({ data: rows });
  }
  if (mentions.length > 0) {
    await entityLinkingService.linkSpellMentions({ documentId: document.id, monsters: mentions });
  }

  return { counts, needsReview, candidates: candidates.length, cachedCalls, results };
}
