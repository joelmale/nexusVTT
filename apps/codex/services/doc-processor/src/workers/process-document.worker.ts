import { Job } from 'bullmq';
import { ProcessDocumentJob, enqueueStage, enqueueAssetStage } from '../services/queue.service';
import { prisma } from '../services/database.service';
import { s3Service } from '../services/s3.service';
import { pdfService } from '../services/pdf.service';
import { layoutService } from '../services/layout.service';
import { thumbnailService } from '../services/thumbnail.service';
import { pageImageService } from '../services/page-image.service';
import { elasticService } from '../services/elastic.service';
import { ocrService } from '../services/ocr.service';
import { markdownService } from '../services/markdown.service';
import { extractionService } from '../services/extraction.service';
import { contentHashService } from '../services/content-hash.service';
import { loggingService } from '../services/logging.service';
import { chunkingService, DocumentChunkInput } from '../services/chunking.service';
import { embeddingsService } from '../services/embeddings.service';
import { ocrHealthService } from '../services/ocr-health.service';
import { entityResolverService } from '../services/entity-resolver.service';
import { entityLinkingService } from '../services/entity-linking.service';
import { env } from '../config/env';
import { canvasBackend } from '../utils/canvas';
import {
  Stage,
  PipelineVersion,
  ProcessingCheckpoints,
  isStageComplete,
  getNextStage,
  getFollowingStage,
  resolvePipelineVersion,
} from './stage-utils';
import { runLayoutStage } from './layout-stage';
import { runExtractStage } from './extract-stage';
import { detectCandidates } from '../extraction/candidates';
import {
  processingEvents,
  candidateEvents,
  describePageLayout,
  describePageMarkdown,
  describeQuality,
  describeStageCompleted,
  describeStageFailed,
  gpuTelemetry,
  stageLabel,
} from '../services/processing-events.service';

const MAX_TEXT_SAMPLE_LENGTH = 500;
const CONFIDENCE_THRESHOLD = 0.6;
type ProcessingMetadata = {
  pipelineVersion?: PipelineVersion;
  // Groups ProcessingEvent rows; a new one per ingest (processing run).
  runId?: string;
  stage?: Stage;
  stageUpdatedAt?: string;
  checkpoints?: ProcessingCheckpoints;
  ocr?: {
    detected?: boolean;
    performed?: boolean;
    status?: string;
    reason?: string;
    pageKeys?: string[];
    pagesRendered?: number;
    textLength?: number;
  };
  extraction?: {
    spells?: number;
    monsters?: number;
    items?: number;
    // v2 only
    candidates?: number;
    needsReview?: number;
    cachedCalls?: number;
    model?: string;
    /** Which Ollama served the stage: the server's own or OLLAMA_REMOTE_URL. */
    ollama?: 'local' | 'remote';
    promptVersion?: string;
  };
  chunks?: {
    count?: number;
    source?: string;
    embeddingModel?: string;
  };
  search?: {
    indexed?: boolean;
    indexId?: string | null;
    indexedAt?: string;
    indexDurationMs?: number;
  };
  pageImages?: {
    count?: number;
    totalBytes?: number;
  };
  layout?: {
    pages: Array<{ pageNumber: number; columns: number; confidence: number }>;
    confidence?: number;
    failureReason?: string;
  };
  // v2 layout stage summary (DocumentPage rows hold the detail).
  pages?: {
    count: number;
    engine: string;
    batchesRun: number;
    batchesSkipped: number;
    averageWordValidity?: number;
  };
  format?: string;
  textLength?: number;
  textSample?: string;
  textCharsPerPage?: number;
};

const getProcessingState = (document: any) => {
  const metadata = (document.metadata as any) || {};
  const processing: ProcessingMetadata = metadata.processing || {};
  const checkpoints: ProcessingCheckpoints = processing.checkpoints || { stages: {} };
  return { metadata, processing, checkpoints };
};

const buildNextProcessing = (
  processing: ProcessingMetadata,
  stage: Stage,
  checkpointUpdate: { completedAt?: string; durationMs?: number; error?: string },
  patch: Partial<ProcessingMetadata> = {}
): ProcessingMetadata => {
  const checkpoints = processing.checkpoints || { stages: {} };
  const patchCheckpoints = patch.checkpoints || {};
  const stages = { ...(checkpoints.stages || {}), ...(patchCheckpoints.stages || {}) };
  stages[stage] = { ...(stages[stage] || {}), ...checkpointUpdate };
  return {
    ...processing,
    ...patch,
    stage,
    stageUpdatedAt: new Date().toISOString(),
    checkpoints: {
      ...checkpoints,
      ...patchCheckpoints,
      stages,
    },
  };
};

const updateProcessing = async (
  documentId: string,
  document: any,
  stage: Stage,
  checkpointUpdate: { completedAt?: string; durationMs?: number; error?: string },
  patch: Partial<ProcessingMetadata> = {},
  extraUpdates: Record<string, any> = {},
  metadataPatch: Record<string, any> = {}
) => {
  const { metadata, processing } = getProcessingState(document);
  const nextProcessing = buildNextProcessing(processing, stage, checkpointUpdate, patch);
  await prisma.document.update({
    where: { id: documentId },
    data: {
      metadata: {
        ...metadata,
        ...metadataPatch,
        processing: nextProcessing,
      },
      ...extraUpdates,
    },
  });
  if (checkpointUpdate.completedAt && !checkpointUpdate.error && nextProcessing.runId) {
    await processingEvents.emit({
      documentId,
      runId: nextProcessing.runId,
      stage,
      kind: 'stage_completed',
      message: describeStageCompleted(stage, checkpointUpdate.durationMs),
      payload: { durationMs: checkpointUpdate.durationMs },
    });
  }
};

const resolveTextForProcessing = async (documentId: string, preferOcr: boolean, version: PipelineVersion = 'v1') => {
  if (version === 'v2') {
    const layoutText = await prisma.documentText.findFirst({
      where: { documentId, source: 'layout' },
    });
    if (layoutText?.content) return layoutText.content;
  }

  if (preferOcr) {
    const ocrText = await prisma.documentText.findFirst({
      where: { documentId, source: 'ocr' },
    });
    if (ocrText?.content) return ocrText.content;
  }

  const pdfText = await prisma.documentText.findFirst({
    where: { documentId, source: 'pdf_extraction' },
  });
  if (pdfText?.content) return pdfText.content;

  const markdownText = await prisma.documentText.findFirst({
    where: { documentId, source: 'markdown' },
  });
  return markdownText?.content || '';
};

/**
 * Embeds chunks before anything is deleted, so an embeddings failure leaves the
 * previous chunks in place and fails the stage for BullMQ to retry. Every row
 * is labelled with the model that produced its vector (or `none`).
 */
const embedChunks = async (jobId: string, chunks: DocumentChunkInput[]) => {
  if (chunks.length === 0) return { rows: [], model: embeddingsService.getProviderName() };

  const health = await ocrHealthService.assertEmbeddingsReady();
  if (health?.embed) {
    await loggingService.logInfo(jobId, `ocr-service embed model: ${health.embed.model} (dim ${health.embed.dim})`);
  }

  const { embeddings, model } = await embeddingsService.embedTextsWithModel(chunks.map((chunk) => chunk.content));
  if (model !== 'none' && embeddings.length !== chunks.length) {
    throw new Error(`Embedding count mismatch: expected ${chunks.length}, got ${embeddings.length}`);
  }

  const rows = chunks.map((chunk, index) => ({
    ...chunk,
    embedding: embeddings[index] ?? [],
    embeddingModel: model,
  }));
  return { rows, model };
};

/** ocr-service GPU telemetry for the console; null when the service or GPU is unavailable. */
const readGpu = async () => gpuTelemetry(await ocrHealthService.check('telemetry'));

const queueNextStage = async (documentId: string, stage: Stage, skipOcr: boolean, version: PipelineVersion = 'v1') => {
  const next = getFollowingStage(stage, skipOcr, version);
  if (!next) return;
  if (next === 'assets') {
    await enqueueAssetStage(documentId);
    return;
  }
  await enqueueStage(documentId, next);
};

export async function processDocumentWorker(job: Job<ProcessDocumentJob>): Promise<void> {
  const { documentId } = job.data;
  const stage = (job.data.stage || 'ingest') as Stage;
  const jobId = job.id || 'unknown';
  let runId: string | undefined;

  console.log(`[Worker] Processing document ${documentId} at stage ${stage}`);
  await loggingService.logInfo(jobId, `Stage ${stage} started for document ${documentId}`);

  try {
    const document = await prisma.document.findUnique({ where: { id: documentId } });

    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    const { processing, checkpoints } = getProcessingState(document);
    const contentHash = document.contentHash || checkpoints.contentHash || null;
    // Pinned at ingest; documents from before pipelineVersion existed stay on v1.
    const version = resolvePipelineVersion(processing, env.PIPELINE_VERSION);
    runId = processing.runId;
    // Sub-step events inside a stage (index: chunking, indexing) for the stepper.
    const emitStep = async (step: string, kind: 'step_started' | 'step_completed', message: string, payload: Record<string, unknown> = {}) => {
      if (!runId) return;
      await processingEvents.emit({ documentId, runId, stage, kind, message, payload: { step, ...payload } });
    };

    if (stage !== 'ingest' && contentHash && isStageComplete(checkpoints, stage, contentHash)) {
      await loggingService.logInfo(jobId, `Stage ${stage} already completed, skipping`);
      const skipOcr = processing.ocr?.detected === false;
      if (stage === 'assets') {
        const finalStatus = processing.ocr?.status === 'failed' ? 'failed' : 'completed';
        await prisma.document.update({
          where: { id: documentId },
          data: { ocrStatus: finalStatus },
        });
        return;
      }
      await queueNextStage(documentId, stage, skipOcr, version);
      return;
    }

    if (stage === 'ingest') {
      // Every ingest is a new processing run for the live view. Persist the
      // runId now (a resume returns before any checkpoint write) and in the
      // in-memory document so later writes in this job keep it.
      runId = await processingEvents.startRun(documentId);
      processing.runId = runId;
      document.metadata = { ...(document.metadata as any), processing: { ...processing } };
      await prisma.document.update({ where: { id: documentId }, data: { metadata: document.metadata as any } });
    }
    // v2 extract announces itself once candidates are known.
    if (runId && !(stage === 'extract' && version === 'v2')) {
      await processingEvents.emit({
        documentId,
        runId,
        stage,
        kind: 'stage_started',
        message: `${stageLabel(stage)} started${stage === 'ingest' ? ` (pipeline ${version})` : ''}`,
        payload: { pipelineVersion: version },
      });
    }

    switch (stage) {
      case 'ingest': {
        const start = Date.now();
        await prisma.document.update({
          where: { id: documentId },
          data: {
            ocrStatus: 'processing',
          },
        });
        await loggingService.logInfo(jobId, 'Updated document status to processing');

        console.log(`[Worker] Downloading document from S3: ${document.storageKey}`);
        await loggingService.logInfo(jobId, `Downloading document from S3: ${document.storageKey}`);
        const fileBuffer = await s3Service.downloadFile(document.storageKey);
        await loggingService.logInfo(jobId, `Downloaded file, size: ${fileBuffer.length} bytes`);

        console.log(`[Worker] Calculating content hash`);
        await loggingService.logInfo(jobId, 'Calculating content hash');
        const calculatedHash = contentHashService.calculateHash(fileBuffer);
        await contentHashService.storeHash(documentId, calculatedHash);
        await loggingService.logInfo(jobId, `Content hash calculated: ${calculatedHash}`);

        console.log(`[Worker] Checking for duplicate content`);
        await loggingService.logInfo(jobId, 'Checking for duplicate content');
        const duplicateId = await contentHashService.findDuplicate(calculatedHash, documentId);

        if (duplicateId) {
          console.log(`[Worker] Found duplicate document: ${duplicateId}`);
          await loggingService.logWarn(jobId, `Found duplicate document: ${duplicateId}`);

          await prisma.document.update({
            where: { id: documentId },
            data: {
              ocrStatus: 'completed',
              metadata: {
                ...(document.metadata as any),
                duplicateOf: duplicateId,
                detectedAt: new Date().toISOString(),
              },
            },
          });

          await loggingService.logInfo(jobId, `Document marked as duplicate of ${duplicateId}`);
          await updateProcessing(documentId, document, 'ingest', {
            completedAt: new Date().toISOString(),
            durationMs: Date.now() - start,
          }, {
            format: document.format,
            checkpoints: {
              ...checkpoints,
              contentHash: calculatedHash,
            },
          });
          return;
        }

        const checkpointMatches = checkpoints.contentHash && checkpoints.contentHash === calculatedHash;
        if (checkpointMatches) {
          const nextStage = getNextStage(checkpoints, processing.ocr?.detected === false, version);
          if (nextStage && nextStage !== 'ingest') {
            await loggingService.logInfo(jobId, `Resuming from stage ${nextStage}`);
            await enqueueStage(documentId, nextStage);
            return;
          }
        }

        await updateProcessing(documentId, document, 'ingest', {
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - start,
        }, {
          format: document.format,
          pipelineVersion: version,
          checkpoints: {
            ...checkpoints,
            contentHash: calculatedHash,
          },
        });

        await loggingService.logInfo(jobId, `Stage ingest completed (pipeline ${version})`);
        await queueNextStage(documentId, 'ingest', false, version);
        return;
      }
      case 'render': {
        const start = Date.now();
        const fileBuffer = await s3Service.downloadFile(document.storageKey);
        let text = '';
        let pageCount = 0;
        let needsOCR = false;
        let ocrPageKeys: string[] = [];
        let scannedPageNumbers: number[] = [];

        let layoutInfo: { pages: { pageNumber: number; columns: number; confidence: number }[]; confidence?: number; failureReason?: string } | undefined;

        if (document.format === 'pdf') {
          console.log(`[Worker] Extracting text from PDF`);
          await loggingService.logInfo(jobId, 'Extracting text from PDF');
          let layoutPages: { pageNumber: number; columns: number; confidence: number }[] = [];
          let layoutFailure: string | undefined;
          let extractedPageResults: { pageNumber: number; text: string; columns: number; confidence: number }[] = [];
          try {
            const extracted = await layoutService.extractTextWithLayout(fileBuffer);
            text = extracted.text;
            pageCount = extracted.pageCount;
            extractedPageResults = extracted.pages;
            layoutPages = extracted.pages.map((page) => ({
              pageNumber: page.pageNumber,
              columns: page.columns,
              confidence: page.confidence,
            }));
            await loggingService.logInfo(jobId, `Layout extraction completed: ${pageCount} pages`);
          } catch (layoutError: any) {
            layoutFailure = layoutError.message;
            await loggingService.logWarn(jobId, `Layout extraction failed, falling back: ${layoutError.message}`);
            const extracted = await pdfService.extractText(fileBuffer);
            text = extracted.text;
            pageCount = extracted.pageCount;
          }

          await loggingService.logInfo(jobId, `Extracted text: ${text.length} characters, ${pageCount} pages`);

          // Per-page OCR Gating: only trigger OCR for pages lacking digital text
          scannedPageNumbers = [];
          if (extractedPageResults.length > 0) {
            scannedPageNumbers = extractedPageResults
              .filter((p) => ocrService.isImageBasedPage(p.text))
              .map((p) => p.pageNumber);
          } else if (ocrService.isImageBasedPage(text)) {
            scannedPageNumbers = Array.from({ length: pageCount }, (_, i) => i + 1);
          }

          needsOCR = scannedPageNumbers.length > 0;
          if (needsOCR) {
            console.log(`[Worker] PDF contains ${scannedPageNumbers.length} image-based page(s), targeted OCR will be performed`);
            await loggingService.logWarn(jobId, `PDF contains ${scannedPageNumbers.length} image-based page(s), targeted OCR will be performed`);
          }
          const averageConfidence = layoutPages.length
            ? Math.round((layoutPages.reduce((sum, page) => sum + page.confidence, 0) / layoutPages.length) * 100) / 100
            : undefined;
          layoutInfo = {
            pages: layoutPages,
            confidence: averageConfidence,
            failureReason: layoutFailure,
          };
        } else if (document.format === 'markdown') {
          console.log(`[Worker] Extracting text from Markdown`);
          await loggingService.logInfo(jobId, 'Extracting text from Markdown');
          const markdownContent = fileBuffer.toString('utf-8');
          text = await markdownService.extractText(markdownContent);
          const headings = await markdownService.extractHeadings(markdownContent);
          pageCount = Math.max(1, headings.length);
          await loggingService.logInfo(jobId, `Extracted text: ${text.length} characters, ${pageCount} sections`);
        }

        if (text.trim().length > 0) {
          const textSource = document.format === 'markdown' ? 'markdown' : 'pdf_extraction';
          await prisma.documentText.upsert({
            where: {
              documentId_source: {
                documentId,
                source: textSource,
              },
            },
            update: { content: text },
            create: {
              documentId,
              source: textSource,
              content: text,
            },
          });
          await loggingService.logInfo(jobId, `Stored document text (${textSource})`);
        }

        if (document.format === 'pdf' && needsOCR) {
          console.log(`[Worker] Rendering OCR pages (${scannedPageNumbers.length} targeted)`);
          await loggingService.logInfo(jobId, `Rendering ${scannedPageNumbers.length} OCR pages`, undefined, { canvasBackend });
          ocrPageKeys = [];
          await pageImageService.renderOcrImages(fileBuffer, {
            targetPages: scannedPageNumbers.length > 0 ? scannedPageNumbers : undefined,
            onPage: async (page) => {
              const pageKey = `ocr-temp/${documentId}/page-${page.pageNumber}.png`;
              await s3Service.uploadFile(pageKey, page.buffer, 'image/png');
              ocrPageKeys.push(pageKey);
            },
            onProgress: ({ pageNumber, maxPages }) => {
              if (pageNumber % 10 === 0 || pageNumber === maxPages) {
                loggingService.logInfo(jobId, `Rendered OCR page ${pageNumber}/${maxPages}`, 'render').catch(() => {});
              }
            },
          });
          await loggingService.logInfo(jobId, `Uploaded ${ocrPageKeys.length} OCR pages`);
        }

        const textLength = text.length;
        const textSample = text.trim().slice(0, MAX_TEXT_SAMPLE_LENGTH);
        const textCharsPerPage = pageCount > 0 ? Math.round(textLength / pageCount) : 0;

        const nextProcessingPatch: Partial<ProcessingMetadata> = {
          format: document.format,
          textLength,
          textSample: textSample || undefined,
          textCharsPerPage,
          ...(layoutInfo ? { layout: layoutInfo } : {}),
          checkpoints: {
            contentHash: document.contentHash || checkpoints.contentHash,
          },
          ocr: {
            detected: needsOCR,
            performed: false,
            status: needsOCR ? 'pending' : 'not_required',
            reason: needsOCR ? 'Image-based PDF detected' : 'Text-based document',
            pageKeys: ocrPageKeys,
            pagesRendered: ocrPageKeys.length,
          },
        };

        await updateProcessing(documentId, document, 'render', {
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - start,
        }, nextProcessingPatch, {
          pageCount,
        });

        await loggingService.logInfo(jobId, 'Stage render completed');
        await queueNextStage(documentId, 'render', !needsOCR);
        return;
      }
      case 'ocr': {
        const start = Date.now();
        const skipOcr = processing.ocr?.detected === false;

        if (skipOcr) {
        await updateProcessing(documentId, document, 'ocr', {
          completedAt: new Date().toISOString(),
          durationMs: 0,
        }, {
          ocr: {
            ...(processing.ocr || {}),
            status: 'not_required',
            performed: false,
          },
        });
        await loggingService.logInfo(jobId, 'Stage ocr completed');
        await queueNextStage(documentId, 'ocr', true);
        return;
      }

        const pageKeys = processing.ocr?.pageKeys || [];
        if (pageKeys.length === 0) {
          await updateProcessing(documentId, document, 'ocr', {
            error: 'No rendered OCR pages available',
            durationMs: Date.now() - start,
          }, {
            ocr: {
              ...(processing.ocr || {}),
              status: 'failed',
              reason: 'No rendered OCR pages available',
              performed: false,
            },
          });
          await loggingService.logWarn(jobId, 'Stage ocr failed: no rendered OCR pages available');
          await queueNextStage(documentId, 'ocr', false);
          return;
        }

        await loggingService.logInfo(jobId, `Running OCR on ${pageKeys.length} pages (pool=${env.OCR_WORKER_POOL_SIZE})`);
        let ocrText = '';
        let ocrStatus: 'completed' | 'failed' = 'completed';

        try {
          const ocrResult = await ocrService.extractTextFromKeysWithPool(
            pageKeys,
            (key) => s3Service.downloadFile(key),
            env.OCR_WORKER_POOL_SIZE,
            async (key) => {
              try {
                await s3Service.deleteFile(key);
              } catch (error: any) {
                await loggingService.logWarn(jobId, `Failed to delete OCR temp file: ${key}`);
              }
            },
            env.S3_BUCKET
          );
          ocrText = ocrResult.results.join('\n');
          const durations = ocrResult.durations.filter((value) => Number.isFinite(value));
          const totalDuration = durations.reduce((sum, value) => sum + value, 0);
          const avgDuration = durations.length ? Math.round(totalDuration / durations.length) : 0;
          const maxDuration = durations.length ? Math.max(...durations) : 0;
          await loggingService.logInfo(jobId, `OCR timing: pages=${durations.length} avgMs=${avgDuration} maxMs=${maxDuration}`);
          await loggingService.logInfo(jobId, `OCR completed, extracted ${ocrText.length} characters`);
        } catch (ocrError: any) {
          ocrStatus = 'failed';
          await loggingService.logError(jobId, `OCR failed: ${ocrError.message}`);
          for (const key of pageKeys) {
            try {
              await s3Service.deleteFile(key);
            } catch (error: any) {
              await loggingService.logWarn(jobId, `Failed to delete OCR temp file on error: ${key}`);
            }
          }
        }

        if (ocrText.trim().length > 0) {
          await prisma.documentText.upsert({
            where: {
              documentId_source: {
                documentId,
                source: 'ocr',
              },
            },
            update: { content: ocrText },
            create: {
              documentId,
              source: 'ocr',
              content: ocrText,
            },
          });
        }

        await updateProcessing(documentId, document, 'ocr', {
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - start,
        }, {
          textLength: ocrText.length > 0 ? ocrText.length : processing.textLength,
          ocr: {
            ...(processing.ocr || {}),
            status: ocrStatus,
            performed: ocrStatus === 'completed',
            textLength: ocrText.length || undefined,
          },
        });

        await loggingService.logInfo(jobId, 'Stage ocr completed');
        await queueNextStage(documentId, 'ocr', false);
        return;
      }
      case 'layout': {
        const start = Date.now();
        const result = await runLayoutStage(jobId, document, async (pages, info) => {
          if (!runId) return;
          // Stat blocks the moment a page is segmented. Extraction re-detects
          // across the whole document (continuations over page breaks).
          const detected = detectCandidates(pages);
          const secondsPerPage = info.batchMs !== undefined ? info.batchMs / 1000 / Math.max(1, pages.length) : undefined;
          const events = pages.flatMap((page) => {
            const onPage = detected.filter((c) => c.pageNumber === page.pageNumber);
            return [
            {
              documentId,
              runId: runId as string,
              stage: 'layout',
              kind: 'page_layout' as const,
              pageNumber: page.pageNumber,
              message: describePageLayout(page, onPage),
              payload: {
                blocks: page.blocks.length,
                previewKey: page.previewKey ?? null,
                totalPages: info.pageCount,
                secondsPerPage,
                candidates: onPage.map((c) => ({ key: c.key, type: c.type, title: c.title, pageNumber: c.pageNumber, regions: c.regions })),
              },
            },
            {
              documentId,
              runId: runId as string,
              stage: 'layout',
              kind: 'page_markdown' as const,
              pageNumber: page.pageNumber,
              message: describePageMarkdown(page),
              payload: { quality: page.quality ?? {}, totalPages: info.pageCount },
            },
            ];
          });
          await processingEvents.emitMany(events);
          await processingEvents.emitTelemetry(documentId, runId, 'layout', readGpu);
        });
        if (runId) {
          const quality = describeQuality(result.pageQuality);
          await processingEvents.emit({
            documentId,
            runId,
            stage: 'layout',
            kind: 'quality',
            message: quality.message,
            payload: { average: quality.average, lowPages: quality.lowPages },
          });
        }
        await loggingService.logInfo(
          jobId,
          `Layout: ${result.pageCount} pages via ${result.engine} (${result.batchesRun} batches run, ${result.batchesSkipped} resumed)`
        );

        // Re-read: runLayoutStage recorded batch checkpoints after `document` was loaded.
        const current = await prisma.document.findUnique({ where: { id: documentId } });
        const textSample = result.text.trim().slice(0, MAX_TEXT_SAMPLE_LENGTH);
        await updateProcessing(documentId, current ?? document, 'layout', {
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - start,
          error: undefined,
        }, {
          format: document.format,
          textLength: result.text.length,
          textSample: textSample || undefined,
          textCharsPerPage: result.pageCount > 0 ? Math.round(result.text.length / result.pageCount) : 0,
          pages: {
            count: result.pageCount,
            engine: result.engine,
            batchesRun: result.batchesRun,
            batchesSkipped: result.batchesSkipped,
            averageWordValidity: result.averageWordValidity,
          },
        }, {
          pageCount: result.pageCount,
        });

        await loggingService.logInfo(jobId, 'Stage layout completed');
        await queueNextStage(documentId, 'layout', false, version);
        return;
      }
      case 'extract': {
        const start = Date.now();
        if (version === 'v2') {
          // The stage picks local or remote Ollama; report the model it chose.
          let model = env.VLM_MODEL;
          const result = await runExtractStage(jobId, document, {
            onCandidates: async (candidates, endpoint) => {
              model = endpoint.model;
              if (!runId) return;
              const byType = ['monster', 'spell', 'item']
                .map((type) => `${candidates.filter((c) => c.type === type).length} ${type}`)
                .join(', ');
              await processingEvents.emit({
                documentId,
                runId,
                stage: 'extract',
                kind: 'stage_started',
                message: `Extraction started: ${candidates.length} candidate${candidates.length === 1 ? '' : 's'} (${byType}) via ${model}`,
                payload: {
                  model,
                  candidates: candidates.map((c) => ({
                    key: c.key,
                    type: c.type,
                    title: c.title,
                    pageNumber: c.pageNumber,
                    regions: c.regions,
                  })),
                },
              });
            },
            onDispatch: async (candidate, crops) => {
              if (!runId) return;
              const crop = crops[0];
              await processingEvents.emit({
                documentId,
                runId,
                stage: 'extract',
                kind: 'crop_dispatched',
                pageNumber: candidate.pageNumber,
                message: crop
                  ? `Cropped ${candidate.type === 'monster' ? 'stat block' : candidate.type} "${candidate.title}" ` +
                    `[x: ${crop.left}, y: ${crop.top}, w: ${crop.width}, h: ${crop.height}]` +
                    `${crops.length > 1 ? ` + ${crops.length - 1} more` : ''} -> dispatched to Ollama (${model})`
                  : `Dispatched ${candidate.type} "${candidate.title}" (p. ${candidate.pageNumber}) as text to Ollama (${model})`,
                payload: { candidateKey: candidate.key, type: candidate.type, model, crops },
              });
            },
            onCandidate: async (candidateResult) => {
              if (!runId) return;
              const events = candidateEvents(candidateResult, model)
                .map((event) => ({ ...event, documentId, runId: runId as string }));
              await processingEvents.emitMany(events);
              await processingEvents.emitTelemetry(documentId, runId, 'extract', readGpu);
            },
          });
          await loggingService.logInfo(
            jobId,
            `Extracted ${result.counts.spell} spells, ${result.counts.monster} monsters, ${result.counts.item} items ` +
              `from ${result.candidates} candidates (${result.needsReview} need review, ${result.cachedCalls} cached)`
          );
          await updateProcessing(documentId, document, 'extract', {
            completedAt: new Date().toISOString(),
            durationMs: Date.now() - start,
            error: undefined,
          }, {
            extraction: {
              spells: result.counts.spell,
              monsters: result.counts.monster,
              items: result.counts.item,
              candidates: result.candidates,
              needsReview: result.needsReview,
              cachedCalls: result.cachedCalls,
              model: result.endpoint.model,
              ollama: result.endpoint.where,
              promptVersion: env.EXTRACT_PROMPT_VERSION,
            },
          });
          await loggingService.logInfo(jobId, 'Stage extract completed');
          await queueNextStage(documentId, 'extract', false, version);
          return;
        }

        const preferOcr = processing.ocr?.status === 'completed';
        const text = await resolveTextForProcessing(documentId, preferOcr, version);

        console.log(`[Worker] Extracting structured data`);
        await loggingService.logInfo(jobId, 'Extracting structured data');
        const extracted = extractionService.extractAll(text);
        await loggingService.logInfo(jobId, `Extracted ${extracted.spells.length} spells, ${extracted.monsters.length} monsters, ${extracted.items.length} items`);

        await prisma.structuredData.deleteMany({ where: { documentId: document.id } });
        await loggingService.logInfo(jobId, 'Cleared existing structured data entries');

        const spellRows = await Promise.all(
          extracted.spells.map(async (spell) => ({
            documentId: document.id,
            type: 'spell' as const,
            name: spell.entity.name,
            entityId: await entityResolverService.resolveEntity({
              name: spell.entity.name,
              type: 'spell',
              sourceDocumentId: document.id,
            }),
            data: {
              ...spell.entity,
              confidence: spell.confidence,
              needsReview: spell.confidence < CONFIDENCE_THRESHOLD,
              failureReason: spell.failureReason,
              rawSnippet: spell.rawSnippet,
            } as any,
            searchText: `${spell.entity.name} ${spell.entity.school || ''} ${spell.entity.level || ''}`.toLowerCase(),
          }))
        );

        const monsterRows = await Promise.all(
          extracted.monsters.map(async (monster) => ({
            documentId: document.id,
            type: 'monster' as const,
            name: monster.entity.name,
            entityId: await entityResolverService.resolveEntity({
              name: monster.entity.name,
              type: 'monster',
              sourceDocumentId: document.id,
            }),
            data: {
              ...monster.entity,
              confidence: monster.confidence,
              needsReview: monster.confidence < CONFIDENCE_THRESHOLD,
              failureReason: monster.failureReason,
              rawSnippet: monster.rawSnippet,
            } as any,
            searchText: `${monster.entity.name} ${monster.entity.size || ''} ${monster.entity.type || ''}`.toLowerCase(),
          }))
        );

        const itemRows = await Promise.all(
          extracted.items.map(async (item) => ({
            documentId: document.id,
            type: 'item' as const,
            name: item.entity.name,
            entityId: await entityResolverService.resolveEntity({
              name: item.entity.name,
              type: 'item',
              sourceDocumentId: document.id,
            }),
            data: {
              ...item.entity,
              confidence: item.confidence,
              needsReview: item.confidence < CONFIDENCE_THRESHOLD,
              failureReason: item.failureReason,
              rawSnippet: item.rawSnippet,
            } as any,
            searchText: `${item.entity.name} ${item.entity.type || ''} ${item.entity.rarity || ''}`.toLowerCase(),
          }))
        );

        const totalRows = spellRows.length + monsterRows.length + itemRows.length;
        if (totalRows > 0) {
          console.log(`[Worker] Saving ${totalRows} structured data entries (batch)`);
          await loggingService.logInfo(jobId, `Saving ${totalRows} structured data entries (batch)`);
          if (spellRows.length > 0) {
            await prisma.structuredData.createMany({ data: spellRows });
          }
          if (monsterRows.length > 0) {
            await prisma.structuredData.createMany({ data: monsterRows });
          }
          if (itemRows.length > 0) {
            await prisma.structuredData.createMany({ data: itemRows });
          }
          await loggingService.logInfo(jobId, 'Structured data saved successfully');
        }

        const monsterMentions = monsterRows
          .filter((monster) => monster.entityId && monster.data?.rawSnippet)
          .map((monster) => ({
            entityId: monster.entityId!,
            rawSnippet: monster.data.rawSnippet as string,
          }));

        if (monsterMentions.length > 0) {
          await entityLinkingService.linkSpellMentions({
            documentId: document.id,
            monsters: monsterMentions,
          });
          await loggingService.logInfo(jobId, `Linked ${monsterMentions.length} monster spell mentions`);
        }

        // v1 chunks here; v2 chunks per page in the index stage.
        let chunkSummary: ProcessingMetadata['chunks'];
        {
          const chunkSource = preferOcr ? 'ocr' : (document.format === 'markdown' ? 'markdown' : 'pdf_extraction');
          const chunks = chunkingService.chunkText({
            text,
            documentId: document.id,
            source: chunkSource,
            pageCount: document.pageCount || 0,
          });

          const embedded = await embedChunks(jobId, chunks);
          await prisma.documentChunk.deleteMany({ where: { documentId: document.id } });
          if (embedded.rows.length > 0) {
            await prisma.documentChunk.createMany({ data: embedded.rows });
            await loggingService.logInfo(jobId, `Stored ${chunks.length} document chunks (embeddingModel=${embedded.model})`);
          }
          chunkSummary = { count: chunks.length, source: chunkSource, embeddingModel: embedded.model };
        }

        await updateProcessing(documentId, document, 'extract', {
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - start,
        }, {
          extraction: {
            spells: extracted.spells.length,
            monsters: extracted.monsters.length,
            items: extracted.items.length,
          },
          ...(chunkSummary ? { chunks: chunkSummary } : {}),
        });

        await loggingService.logInfo(jobId, 'Stage extract completed');
        await queueNextStage(documentId, 'extract', preferOcr ? false : processing.ocr?.detected === false, version);
        return;
      }
      case 'index': {
        const start = Date.now();
        const preferOcr = processing.ocr?.status === 'completed';
        const text = await resolveTextForProcessing(documentId, preferOcr, version);

        let chunkSummary: ProcessingMetadata['chunks'];
        if (version === 'v2') {
          // Page-aware chunks: pageStart/pageEnd are exact.
          const pages = await prisma.documentPage.findMany({
            where: { documentId },
            orderBy: { pageNumber: 'asc' },
            select: { pageNumber: true, markdown: true },
          });
          const chunkStart = Date.now();
          await emitStep('chunking', 'step_started', 'Semantic chunking started');
          const chunks = chunkingService.chunkPages({ pages, documentId, source: 'layout' });
          const embedded = await embedChunks(jobId, chunks);
          await prisma.documentChunk.deleteMany({ where: { documentId } });
          if (embedded.rows.length > 0) {
            // Identical text on two pages hashes the same; keep the first.
            await prisma.documentChunk.createMany({ data: embedded.rows, skipDuplicates: true });
            await loggingService.logInfo(jobId, `Stored ${chunks.length} page-aware chunks (embeddingModel=${embedded.model})`);
          }
          chunkSummary = { count: chunks.length, source: 'layout', embeddingModel: embedded.model };
          await emitStep(
            'chunking',
            'step_completed',
            `${chunks.length} page-aware chunk${chunks.length === 1 ? '' : 's'} embedded (${embedded.model}) in ${((Date.now() - chunkStart) / 1000).toFixed(1)}s`,
            { count: chunks.length, embeddingModel: embedded.model, durationMs: Date.now() - chunkStart }
          );
          await emitStep('indexing', 'step_started', 'Indexing in Elasticsearch');
        }

        console.log(`[Worker] Indexing document in ElasticSearch`);
        await loggingService.logInfo(jobId, 'Indexing document in ElasticSearch');
        const indexStart = Date.now();
        const searchIndex = await elasticService.indexDocument({
          documentId: document.id,
          title: document.title,
          description: document.description,
          content: text,
          tags: document.tags,
          type: document.type,
          campaigns: document.campaigns,
          collections: document.collections,
          uploadedAt: document.uploadedAt,
        });
        const indexDurationMs = Date.now() - indexStart;
        await loggingService.logInfo(jobId, `Document indexed with ID: ${searchIndex} in ${indexDurationMs}ms`);
        if (version === 'v2') {
          await emitStep('indexing', 'step_completed', `Indexed in Elasticsearch in ${(indexDurationMs / 1000).toFixed(1)}s`, {
            durationMs: indexDurationMs,
          });
        }

        const ocrStatus = processing.ocr?.detected === false ? 'completed' : (processing.ocr?.status || 'completed');

        await updateProcessing(documentId, document, 'index', {
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - start,
        }, {
          search: {
            indexed: !!searchIndex,
            indexId: searchIndex,
            indexedAt: new Date().toISOString(),
            indexDurationMs,
          },
          ...(chunkSummary ? { chunks: chunkSummary } : {}),
        }, {
          searchIndex,
          ocrStatus,
        });

        await loggingService.logInfo(jobId, 'Stage index completed');
        await queueNextStage(documentId, 'index', processing.ocr?.detected === false, version);
        return;
      }
      case 'assets': {
        const start = Date.now();
        const fileBuffer = await s3Service.downloadFile(document.storageKey);
        let thumbnailKey: string | undefined;
        const pageImageKeys: string[] = [];
        let pageImagesTotalBytes = 0;

        console.log(`[Worker] Generating thumbnail`);
        await loggingService.logInfo(jobId, 'Generating thumbnail', undefined, { canvasBackend });
        try {
          const thumbnailBuffer = await thumbnailService.generateThumbnail(fileBuffer);
          thumbnailKey = `thumbnails/${documentId}.jpg`;
          console.log(`[Worker] Uploading thumbnail to S3: ${thumbnailKey}`);
          await loggingService.logInfo(jobId, `Uploading thumbnail to S3: ${thumbnailKey}`);
          await s3Service.uploadFile(thumbnailKey, thumbnailBuffer, 'image/jpeg');
          await loggingService.logInfo(jobId, 'Thumbnail uploaded successfully');
        } catch (thumbError: any) {
          thumbnailKey = undefined;
          console.warn(`[Worker] Thumbnail generation failed, continuing without thumbnail: ${thumbError.message}`);
          await loggingService.logWarn(jobId, `Thumbnail generation failed, continuing: ${thumbError.message}`, 'thumbnail', {
            error: thumbError?.stack || String(thumbError),
            canvasBackend,
          });
        }

        console.log(`[Worker] Rendering page images`);
        await loggingService.logInfo(jobId, 'Rendering page images', undefined, { canvasBackend });
        try {
          await pageImageService.renderPageImages(fileBuffer, {
            onPage: async (image) => {
              const pageKey = `page-images/${documentId}/page-${image.pageNumber}.webp`;
              pageImagesTotalBytes += image.buffer.length;
              await s3Service.uploadFile(pageKey, image.buffer, 'image/webp');
              pageImageKeys.push(pageKey);
            },
            onProgress: ({ pageNumber, maxPages }) => {
              if (pageNumber % 10 === 0 || pageNumber === maxPages) {
                loggingService.logInfo(jobId, `Rendered page ${pageNumber}/${maxPages}`, 'page_images').catch(() => {});
              }
            },
          });
          await loggingService.logInfo(jobId, `Uploaded ${pageImageKeys.length} page images`);
        } catch (pageError: any) {
          console.warn(`[Worker] Page image rendering failed, continuing without page images: ${pageError.message}`);
          await loggingService.logWarn(jobId, `Page image rendering failed, continuing: ${pageError.message}`, 'page_images', {
            error: pageError?.stack || String(pageError),
            canvasBackend,
          });
        }

        await updateProcessing(documentId, document, 'assets', {
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - start,
        }, {
          pageImages: {
            count: pageImageKeys.length,
            totalBytes: pageImagesTotalBytes,
          },
        }, {
          thumbnailKey,
          ocrStatus: 'completed',
        }, {
          pageImages: pageImageKeys,
        });

        await loggingService.logInfo(jobId, `Assets stage completed for ${documentId}`);
        return;
      }
      default:
        throw new Error(`Unknown stage: ${stage}`);
    }
  } catch (error: any) {
    console.error(`[Worker] Stage ${stage} failed for document ${documentId}:`, error.message);
    if (runId) {
      await processingEvents.emit({
        documentId,
        runId,
        stage,
        kind: 'stage_failed',
        message: describeStageFailed(stage, error.message),
        payload: { error: error.message, attempt: job.attemptsMade },
      });
    }
    await loggingService.logError(jobId, `Stage ${stage} failed: ${error.message}`, 'error', {
      error: error.message,
      stack: error.stack,
    });

    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (document) {
      const { metadata, processing } = getProcessingState(document);
      const nextProcessing = buildNextProcessing(processing, stage, {
        error: error.message,
      }, {});

      await prisma.document.update({
        where: { id: documentId },
        data: {
          ocrStatus: stage === 'assets' ? document.ocrStatus : 'failed',
          metadata: {
            ...metadata,
            processing: nextProcessing,
            error: error.message,
            failedAt: new Date().toISOString(),
          },
        },
      });
    }

    throw error;
  }
}
