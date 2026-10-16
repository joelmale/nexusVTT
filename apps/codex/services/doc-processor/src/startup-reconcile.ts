/**
 * Startup reconcile: re-queues documents that a previous run left `failed` or
 * `pending` with no job to finish them (for example a worker killed between a
 * status write and the next enqueue).
 *
 * It must be safe to run on every boot, so it:
 *  - skips documents that already have a job waiting, active or delayed;
 *  - keeps checkpoints of stages that succeeded (ingest resumes at the first
 *    incomplete stage) and drops only those that failed;
 *  - stops after MAX_RECONCILE_ATTEMPTS so a document that can never succeed is
 *    not re-run on every restart. A manual reprocess or a completed run resets
 *    the budget.
 */

export const MAX_RECONCILE_ATTEMPTS = 3;

export type ReconcileDocument = {
  id: string;
  title: string;
  ocrStatus: string;
  metadata: unknown;
};

export type ReconcileDeps = {
  findDocuments: () => Promise<ReconcileDocument[]>;
  getLiveJobDocumentIds: () => Promise<Set<string>>;
  updateMetadata: (documentId: string, ocrStatus: 'pending', metadata: Record<string, unknown>) => Promise<void>;
  enqueueIngest: (documentId: string) => Promise<unknown>;
  log?: (message: string) => void;
};

export type ReconcileResult = { requeued: string[]; skippedLive: string[]; exhausted: string[] };

/** Metadata for a re-run: failed stages are dropped, completed ones kept. */
export function buildReconcileMetadata(metadata: Record<string, any>, now = new Date()): Record<string, unknown> {
  const processing = metadata.processing || {};
  const checkpoints = processing.checkpoints || {};
  const stages: Record<string, unknown> = { ...(checkpoints.stages || {}) };

  for (const [name, checkpoint] of Object.entries<any>(stages)) {
    if (checkpoint?.error || checkpoint?.status === 'failed') delete stages[name];
  }

  // Documents written before OCR failures threw finished the pipeline with the
  // OCR stage "completed" but ocr.status 'failed'. Re-run from OCR onwards.
  let ocr = processing.ocr;
  if (ocr?.status === 'failed') {
    for (const name of ['render', 'ocr', 'index', 'assets']) delete stages[name];
    ocr = { ...ocr, status: undefined, reason: undefined };
  }

  return {
    ...metadata,
    processing: {
      ...processing,
      ...(ocr ? { ocr } : {}),
      reconcileAttempts: (processing.reconcileAttempts ?? 0) + 1,
      stage: 'ingest',
      stageUpdatedAt: now.toISOString(),
      checkpoints: { ...checkpoints, stages },
    },
  };
}

export async function reconcileDocuments(deps: ReconcileDeps): Promise<ReconcileResult> {
  const log = deps.log ?? (() => undefined);
  const result: ReconcileResult = { requeued: [], skippedLive: [], exhausted: [] };

  const documents = await deps.findDocuments();
  const candidates = documents.filter((doc) => doc.ocrStatus === 'failed' || doc.ocrStatus === 'pending');
  if (candidates.length === 0) return result;

  const live = await deps.getLiveJobDocumentIds();

  for (const doc of candidates) {
    if (live.has(doc.id)) {
      result.skippedLive.push(doc.id);
      continue;
    }
    const metadata = ((doc.metadata as Record<string, any>) || {}) as Record<string, any>;
    if ((metadata.processing?.reconcileAttempts ?? 0) >= MAX_RECONCILE_ATTEMPTS) {
      result.exhausted.push(doc.id);
      log(`Not re-queueing "${doc.title}" (${doc.id}): ${MAX_RECONCILE_ATTEMPTS} startup retries used. Reprocess it manually.`);
      continue;
    }
    log(`Re-queueing "${doc.title}" (${doc.id}), status ${doc.ocrStatus}`);
    await deps.updateMetadata(doc.id, 'pending', buildReconcileMetadata(metadata));
    await deps.enqueueIngest(doc.id);
    result.requeued.push(doc.id);
  }
  return result;
}
