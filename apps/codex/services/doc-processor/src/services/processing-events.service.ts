import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from './database.service';
import { LayoutPage } from '../types/layout';
import type { Candidate } from '../extraction/candidates';
import type { CandidateResult } from '../workers/extract-stage';
import type { Monster, Spell, Item } from '../extraction/schemas';

/**
 * Structured events for the admin UI's Live Proof canvas and Action Feed
 * (ingestion v2 plan: "Event stream"). Emitting never fails a stage: the
 * events are a view of the work, not part of it.
 */

export type ProcessingEventKind =
  | 'stage_started'
  | 'page_layout'
  | 'page_markdown'
  | 'entity_extracted'
  | 'entity_rejected'
  | 'quality'
  | 'stage_completed'
  | 'stage_failed';

export type ProcessingEventInput = {
  documentId: string;
  runId: string;
  stage: string;
  kind: ProcessingEventKind;
  message: string;
  pageNumber?: number;
  payload?: Record<string, unknown>;
};

/** Runs kept per document, including the one starting now. */
export const KEEP_RUNS = 3;

/** Provisional text-cleanliness line until the gold set calibrates it. */
export const LOW_QUALITY_THRESHOLD = 0.9;

const STAGE_LABELS: Record<string, string> = {
  ingest: 'Ingest',
  render: 'Render',
  ocr: 'OCR',
  layout: 'Layout',
  extract: 'Extraction',
  index: 'Index',
  assets: 'Assets',
};

export const stageLabel = (stage: string) => STAGE_LABELS[stage] ?? stage;

const seconds = (ms?: number) => (ms === undefined ? '' : ` in ${(ms / 1000).toFixed(1)}s`);
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

export const describeStageCompleted = (stage: string, durationMs?: number) => `${stageLabel(stage)} completed${seconds(durationMs)}`;

export const describeStageFailed = (stage: string, error: string) => `${stageLabel(stage)} failed: ${error}`;

/** Document-level text cleanliness, plus the pages to check first. */
export const describeQuality = (pages: Array<{ pageNumber: number; wordValidity?: number }>) => {
  const scored = pages.filter((p): p is { pageNumber: number; wordValidity: number } => typeof p.wordValidity === 'number');
  if (scored.length === 0) return { message: 'Text cleanliness: no scored pages', average: undefined, lowPages: [] as number[] };
  const average = scored.reduce((sum, p) => sum + p.wordValidity, 0) / scored.length;
  const lowPages = scored.filter((p) => p.wordValidity < LOW_QUALITY_THRESHOLD).map((p) => p.pageNumber);
  const low = lowPages.length
    ? `; ${lowPages.length} below ${percent(LOW_QUALITY_THRESHOLD)}: p. ${lowPages.slice(0, 10).join(', ')}${lowPages.length > 10 ? ', ...' : ''}`
    : '';
  return {
    message: `Text cleanliness ${percent(average)} average over ${plural(scored.length, 'page')}${low}`,
    average: Math.round(average * 10000) / 10000,
    lowPages,
  };
};

/** 1 or 2: whether narrow body blocks sit on both halves of the page. */
export const estimateColumns = (page: LayoutPage) => {
  const narrow = page.blocks.filter((b) => (b.class === 'body' || b.class === 'heading') && b.bbox[2] - b.bbox[0] < 0.6);
  const left = narrow.some((b) => (b.bbox[0] + b.bbox[2]) / 2 < 0.5);
  const right = narrow.some((b) => (b.bbox[0] + b.bbox[2]) / 2 >= 0.5);
  return left && right ? 2 : 1;
};

export const describePageLayout = (page: LayoutPage) => {
  const count = (cls: string) => page.blocks.filter((b) => b.class === cls).length;
  const parts = [`${estimateColumns(page) === 2 ? 'two' : 'one'}-column layout`, plural(page.blocks.length - count('art') - count('furniture'), 'text block')];
  if (count('table')) parts.push(plural(count('table'), 'table'));
  if (count('sidebar')) parts.push(`${plural(count('sidebar'), 'sidebar')} (heuristic)`);
  if (count('art')) parts.push(`${plural(count('art'), 'art region')} excluded`);
  if (count('furniture')) parts.push(`${count('furniture')} header/footer excluded`);
  return `Page ${page.pageNumber}: ${parts.join(', ')}`;
};

export const describePageMarkdown = (page: LayoutPage) => {
  const words = page.quality?.wordCount ?? page.markdown.split(/\s+/).filter(Boolean).length;
  const validity = page.quality?.wordValidity;
  return `Page ${page.pageNumber} Markdown: ${plural(words, 'word')}${validity !== undefined ? `, text cleanliness ${percent(validity)}` : ''}`;
};

/** The few fields a stat card shows; the full entity lives in StructuredData. */
export const entitySummary = (type: Candidate['type'], entity: Monster | Spell | Item) => {
  if (type === 'monster') {
    const m = entity as Monster;
    return {
      armorClass: m.armorClass,
      hitPoints: m.hitPoints,
      hitDice: m.hitDice,
      challengeRating: m.challengeRating,
      sizeType: `${m.size} ${m.type}, ${m.alignment}`,
      speed: m.speed,
      abilities: m.abilities,
      traits: m.traits.map((t) => t.name),
      actions: m.actions.map((a) => a.name),
      legendaryActions: m.legendaryActions?.map((a) => a.name),
    };
  }
  if (type === 'spell') {
    const s = entity as Spell;
    return { level: s.level, school: s.school, castingTime: s.castingTime, range: s.range, components: s.components, duration: s.duration };
  }
  const i = entity as Item;
  return { itemType: i.type, rarity: i.rarity, requiresAttunement: i.requiresAttunement };
};

const headline = (type: Candidate['type'], entity: Monster | Spell | Item) => {
  if (type === 'monster') {
    const m = entity as Monster;
    return `${m.name} (AC ${m.armorClass}, HP ${m.hitPoints}, CR ${m.challengeRating.split(/\s+/)[0]})`;
  }
  if (type === 'spell') {
    const s = entity as Spell;
    return `${s.name} (${s.level === 0 ? `${s.school} cantrip` : `level ${s.level} ${s.school}`})`;
  }
  const i = entity as Item;
  return `${i.name} (${i.type}, ${i.rarity})`;
};

/** Events for one extracted candidate: one per entity, or one rejection. */
export const candidateEvents = (result: CandidateResult, model: string): Array<Omit<ProcessingEventInput, 'documentId' | 'runId'>> => {
  const { candidate } = result;
  const source = { pageNumber: candidate.pageNumber, blockIds: candidate.blockIds, regions: candidate.regions, candidateKey: candidate.key };
  const via = `${model}${result.cached ? ' (cached)' : ''}`;

  if (result.entities.length === 0) {
    return [{
      stage: 'extract',
      kind: 'entity_rejected',
      pageNumber: candidate.pageNumber,
      message: `${via}: no valid ${candidate.type} in "${candidate.title}" (p. ${candidate.pageNumber})${result.parseFailed ? ', response failed the schema' : ''}`,
      payload: { type: candidate.type, title: candidate.title, parseFailed: result.parseFailed, source },
    }];
  }

  return result.entities.map(({ entity, review }) => ({
    stage: 'extract',
    kind: 'entity_extracted' as const,
    pageNumber: candidate.pageNumber,
    message: `${via}: extracted ${headline(candidate.type, entity)}, ${
      review.status === 'auto' ? 'all values grounded' : `needs review (${review.reasons.slice(0, 3).join('; ')})`
    }`,
    payload: {
      type: candidate.type,
      name: entity.name,
      summary: entitySummary(candidate.type, entity),
      review,
      source,
      cached: result.cached,
    },
  }));
};

export class ProcessingEventsService {
  async emit(event: ProcessingEventInput): Promise<void> {
    await this.emitMany([event]);
  }

  async emitMany(events: ProcessingEventInput[]): Promise<void> {
    if (events.length === 0) return;
    try {
      await prisma.processingEvent.createMany({
        data: events.map((event) => ({
          documentId: event.documentId,
          runId: event.runId,
          stage: event.stage,
          kind: event.kind,
          message: event.message,
          pageNumber: event.pageNumber ?? null,
          payload: (event.payload ?? {}) as Prisma.InputJsonValue,
        })),
      });
    } catch (error: any) {
      console.warn(`[ProcessingEvents] Could not record ${events.length} event(s): ${error?.message}`);
    }
  }

  /**
   * Starts a run: returns a new runId and prunes events so that, with this
   * run, only the last KEEP_RUNS runs of the document remain.
   */
  async startRun(documentId: string): Promise<string> {
    const runId = randomUUID();
    try {
      const runs = await prisma.processingEvent.groupBy({
        by: ['runId'],
        where: { documentId },
        _max: { id: true },
      });
      const stale = runs
        .sort((a, b) => Number((b._max.id ?? 0n) - (a._max.id ?? 0n)))
        .slice(KEEP_RUNS - 1)
        .map((run) => run.runId);
      if (stale.length > 0) {
        await prisma.processingEvent.deleteMany({ where: { documentId, runId: { in: stale } } });
      }
    } catch (error: any) {
      console.warn(`[ProcessingEvents] Could not prune old runs: ${error?.message}`);
    }
    return runId;
  }
}

export const processingEvents = new ProcessingEventsService();
