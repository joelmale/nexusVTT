export const PIPELINE_VERSIONS = ['v1', 'v2'] as const;
export type PipelineVersion = typeof PIPELINE_VERSIONS[number];

// v2 merges render + ocr into one layout stage, checkpointed per page batch.
export const STAGES_BY_VERSION = {
  v1: ['ingest', 'render', 'ocr', 'extract', 'index', 'assets'],
  v2: ['ingest', 'layout', 'extract', 'index', 'assets'],
} as const satisfies Record<PipelineVersion, readonly string[]>;

/** v1 stage order, kept for existing callers. */
export const STAGES = STAGES_BY_VERSION.v1;

export type Stage = typeof STAGES_BY_VERSION[PipelineVersion][number];

export type StageCheckpoint = {
  completedAt?: string;
  durationMs?: number;
  error?: string;
  /** layout only: `<start>-<end>` page ranges (1-based, inclusive) already persisted. */
  batches?: Record<string, { completedAt: string; pages: number; contentHash?: string }>;
};

export type ProcessingCheckpoints = {
  contentHash?: string;
  stages?: Record<string, StageCheckpoint>;
};

export const isStageComplete = (
  checkpoints: ProcessingCheckpoints,
  stage: Stage,
  contentHash?: string | null
) => {
  if (contentHash && checkpoints.contentHash && checkpoints.contentHash !== contentHash) {
    return false;
  }
  const cp = checkpoints.stages?.[stage];
  return Boolean(cp?.completedAt && !cp?.error);
};

/**
 * A document keeps the pipeline it was first processed with. One that has
 * never been processed takes the configured default; one processed before
 * pipelineVersion existed is v1.
 */
export const resolvePipelineVersion = (
  processing: { pipelineVersion?: string; checkpoints?: ProcessingCheckpoints },
  defaultVersion: PipelineVersion
): PipelineVersion => {
  if (processing.pipelineVersion === 'v1' || processing.pipelineVersion === 'v2') {
    return processing.pipelineVersion;
  }
  const hasHistory = Object.keys(processing.checkpoints?.stages || {}).length > 0;
  return hasHistory ? 'v1' : defaultVersion;
};

export const getStages = (version: PipelineVersion = 'v1'): readonly Stage[] => STAGES_BY_VERSION[version];

export const getNextStage = (
  checkpoints: ProcessingCheckpoints,
  skipOcr: boolean,
  version: PipelineVersion = 'v1'
) => {
  for (const stage of getStages(version)) {
    if (stage === 'ocr' && skipOcr) continue;
    const cp = checkpoints.stages?.[stage];
    if (!cp?.completedAt || cp?.error) {
      return stage;
    }
  }
  return null;
};

/** Stage after `stage` in the version's order, or null at the end. */
export const getFollowingStage = (stage: Stage, skipOcr: boolean, version: PipelineVersion = 'v1') => {
  const stages = getStages(version);
  const index = stages.indexOf(stage);
  if (index < 0) return null;
  return stages.slice(index + 1).find((candidate) => !(candidate === 'ocr' && skipOcr)) ?? null;
};

/** Contiguous 1-based inclusive page ranges of at most `batchSize` pages. */
export const planPageBatches = (pageCount: number, batchSize: number) => {
  const size = Math.max(1, Math.floor(batchSize));
  const batches: Array<{ key: string; start: number; end: number }> = [];
  for (let start = 1; start <= pageCount; start += size) {
    const end = Math.min(pageCount, start + size - 1);
    batches.push({ key: `${start}-${end}`, start, end });
  }
  return batches;
};
