export const STAGES = ['ingest', 'render', 'ocr', 'extract', 'index', 'assets'] as const;

export type Stage = typeof STAGES[number];

export type ProcessingCheckpoints = {
  contentHash?: string;
  stages?: Record<string, { completedAt?: string; durationMs?: number; error?: string }>;
};

export const isStageComplete = (
  checkpoints: ProcessingCheckpoints,
  stage: Stage,
  contentHash?: string | null
) => {
  if (contentHash && checkpoints.contentHash && checkpoints.contentHash !== contentHash) {
    return false;
  }
  return Boolean(checkpoints.stages?.[stage]?.completedAt);
};

export const getNextStage = (checkpoints: ProcessingCheckpoints, skipOcr: boolean) => {
  for (const stage of STAGES) {
    if (stage === 'ocr' && skipOcr) continue;
    if (!checkpoints.stages?.[stage]?.completedAt) {
      return stage;
    }
  }
  return null;
};
