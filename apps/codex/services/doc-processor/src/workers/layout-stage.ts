import { Prisma } from '@prisma/client';
import { prisma } from '../services/database.service';
import { s3Service } from '../services/s3.service';
import { pdfService } from '../services/pdf.service';
import { loggingService } from '../services/logging.service';
import { ocrHealthService } from '../services/ocr-health.service';
import { layoutClientService } from '../services/layout-client.service';
import { splitMarkdownPages } from '../services/markdown-pages.service';
import { env } from '../config/env';
import { LayoutPage } from '../types/layout';
import { planPageBatches, StageCheckpoint } from './stage-utils';

export const MARKDOWN_ENGINE = 'markdown-sections';

export type LayoutStageDocument = {
  id: string;
  format: string;
  storageKey: string;
  pageCount: number;
  contentHash: string | null;
  metadata: unknown;
};

export type LayoutStageResult = {
  pageCount: number;
  engine: string;
  text: string;
  batchesRun: number;
  batchesSkipped: number;
  averageWordValidity?: number;
  pageQuality: Array<{ pageNumber: number; wordValidity?: number }>;
};

const layoutCheckpoint = (metadata: unknown): StageCheckpoint =>
  ((metadata as any)?.processing?.checkpoints?.stages?.layout as StageCheckpoint) || {};

const upsertPages = async (documentId: string, engine: string, pages: LayoutPage[]) => {
  await prisma.$transaction(
    pages.map((page) => {
      const data = {
        markdown: page.markdown,
        blocks: page.blocks as unknown as Prisma.InputJsonValue,
        widthPt: page.widthPt ?? null,
        heightPt: page.heightPt ?? null,
        previewKey: page.previewKey ?? null,
        quality: (page.quality ?? {}) as Prisma.InputJsonValue,
        engine,
      };
      return prisma.documentPage.upsert({
        where: { documentId_pageNumber: { documentId, pageNumber: page.pageNumber } },
        update: data,
        create: { documentId, pageNumber: page.pageNumber, ...data },
      });
    })
  );
};

/**
 * Records one completed batch in checkpoints.stages.layout.batches. Re-reads
 * the document so batches recorded earlier in this job are kept.
 */
const recordBatch = async (documentId: string, key: string, pages: number, contentHash: string | null) => {
  const current = await prisma.document.findUnique({ where: { id: documentId }, select: { metadata: true } });
  const metadata = (current?.metadata as any) || {};
  const processing = metadata.processing || {};
  const checkpoints = processing.checkpoints || { stages: {} };
  const stages = checkpoints.stages || {};
  const layout: StageCheckpoint = stages.layout || {};

  await prisma.document.update({
    where: { id: documentId },
    data: {
      metadata: {
        ...metadata,
        processing: {
          ...processing,
          checkpoints: {
            ...checkpoints,
            stages: {
              ...stages,
              layout: {
                ...layout,
                batches: {
                  ...(layout.batches || {}),
                  [key]: { completedAt: new Date().toISOString(), pages, contentHash: contentHash ?? undefined },
                },
              },
            },
          },
        },
      },
    },
  });
};

/**
 * v2 layout stage (replaces v1 render + ocr).
 *
 * PDFs go through ocr-service /layout/s3 in batches of LAYOUT_BATCH_PAGES.
 * Each batch upserts its DocumentPage rows and is then recorded as a
 * checkpoint, so a retry after a crash skips finished batches and a batch
 * interrupted between the two steps is redone without duplicating pages.
 * Markdown uploads need no layout model: pages are heading sections.
 *
 * Writes DocumentText(source=layout) as the concatenation of pages so existing
 * search and report code keeps working.
 */
export async function runLayoutStage(
  jobId: string,
  document: LayoutStageDocument,
  /** Called after each persisted batch (live processing view). */
  onBatch?: (pages: LayoutPage[], info: { pageCount: number; batchMs?: number }) => Promise<void>
): Promise<LayoutStageResult> {
  let engine: string;
  let pageCount: number;
  let batchesRun = 0;
  let batchesSkipped = 0;

  if (document.format === 'markdown') {
    const markdown = (await s3Service.downloadFile(document.storageKey)).toString('utf-8');
    const pages = splitMarkdownPages(markdown);
    engine = MARKDOWN_ENGINE;
    pageCount = pages.length;
    if (pages.length > 0) await upsertPages(document.id, engine, pages);
    if (onBatch && pages.length > 0) await onBatch(pages, { pageCount });
    await loggingService.logInfo(jobId, `Markdown split into ${pageCount} section pages`, 'layout');
  } else {
    const health = await ocrHealthService.check('layout');
    if (health.layout && health.layout.installed === false) {
      throw new Error('ocr-service image has no layout engine (built with INSTALL_LAYOUT=false)');
    }
    await loggingService.logInfo(
      jobId,
      `ocr-service layout engine: ${health.layout ? `${health.layout.engine}@${health.layout.version} on ${health.layout.device}` : 'not reported'}`,
      'layout'
    );

    pageCount = document.pageCount > 0
      ? document.pageCount
      : await pdfService.getPageCount(await s3Service.downloadFile(document.storageKey));

    const done = layoutCheckpoint(document.metadata).batches || {};
    engine = 'unknown';

    for (const batch of planPageBatches(pageCount, env.LAYOUT_BATCH_PAGES)) {
      const previous = done[batch.key];
      if (previous && (!document.contentHash || previous.contentHash === document.contentHash)) {
        batchesSkipped += 1;
        continue;
      }

      const batchStart = Date.now();
      const response = await layoutClientService.convertRange({
        bucket: env.S3_BUCKET,
        key: document.storageKey,
        pageStart: batch.start,
        pageEnd: batch.end,
        renderPreviews: true,
        previewPrefix: `page-previews/${document.id}/`,
      });
      engine = response.engine;
      await upsertPages(document.id, engine, response.pages);
      await recordBatch(document.id, batch.key, response.pages.length, document.contentHash);
      batchesRun += 1;
      if (onBatch) await onBatch(response.pages, { pageCount, batchMs: Date.now() - batchStart });
      await loggingService.logInfo(jobId, `Layout pages ${batch.key}/${pageCount} stored (${response.pages.length} pages)`, 'layout');
    }
  }

  // Pages beyond the current count belong to an older version of the file.
  await prisma.documentPage.deleteMany({ where: { documentId: document.id, pageNumber: { gt: pageCount } } });

  const pages = await prisma.documentPage.findMany({
    where: { documentId: document.id },
    orderBy: { pageNumber: 'asc' },
    select: { pageNumber: true, markdown: true, quality: true, engine: true },
  });
  if (engine === 'unknown' && pages[0]) engine = pages[0].engine;

  const text = pages.map((page) => page.markdown).join('\n\n');
  if (text.trim()) {
    await prisma.documentText.upsert({
      where: { documentId_source: { documentId: document.id, source: 'layout' } },
      update: { content: text },
      create: { documentId: document.id, source: 'layout', content: text },
    });
  }

  const validities = pages
    .map((page) => (page.quality as any)?.wordValidity)
    .filter((value): value is number => typeof value === 'number');
  const averageWordValidity = validities.length
    ? Math.round((validities.reduce((sum, value) => sum + value, 0) / validities.length) * 1000) / 1000
    : undefined;

  const pageQuality = pages.map((page) => ({
    pageNumber: page.pageNumber,
    wordValidity: (page.quality as any)?.wordValidity as number | undefined,
  }));

  return { pageCount, engine, text, batchesRun, batchesSkipped, averageWordValidity, pageQuality };
}
