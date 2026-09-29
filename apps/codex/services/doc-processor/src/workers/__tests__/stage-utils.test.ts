import {
  getFollowingStage,
  getNextStage,
  isStageComplete,
  planPageBatches,
  ProcessingCheckpoints,
  resolvePipelineVersion,
} from '../stage-utils';

describe('stage-utils', () => {
  test('isStageComplete returns false when content hash mismatches', () => {
    const checkpoints: ProcessingCheckpoints = {
      contentHash: 'hash-a',
      stages: {
        ingest: { completedAt: '2025-01-01T00:00:00.000Z' },
      },
    };

    expect(isStageComplete(checkpoints, 'ingest', 'hash-b')).toBe(false);
  });

  test('getNextStage returns first incomplete stage', () => {
    const checkpoints: ProcessingCheckpoints = {
      stages: {
        ingest: { completedAt: '2025-01-01T00:00:00.000Z' },
        render: { completedAt: '2025-01-01T00:01:00.000Z' },
      },
    };

    expect(getNextStage(checkpoints, false)).toBe('ocr');
  });

  test('getNextStage skips OCR when requested', () => {
    const checkpoints: ProcessingCheckpoints = {
      stages: {
        ingest: { completedAt: '2025-01-01T00:00:00.000Z' },
        render: { completedAt: '2025-01-01T00:01:00.000Z' },
      },
    };

    expect(getNextStage(checkpoints, true)).toBe('extract');
  });

  test('isStageComplete returns false when stage has error even if completedAt is present', () => {
    const checkpoints: ProcessingCheckpoints = {
      stages: {
        render: { completedAt: '2025-01-01T00:01:00.000Z', error: 'Render failure' },
      },
    };

    expect(isStageComplete(checkpoints, 'render')).toBe(false);
  });

  test('getNextStage returns stage with error for retry', () => {
    const checkpoints: ProcessingCheckpoints = {
      stages: {
        ingest: { completedAt: '2025-01-01T00:00:00.000Z' },
        render: { completedAt: '2025-01-01T00:01:00.000Z', error: 'Render failure' },
        ocr: { completedAt: '2025-01-01T00:02:00.000Z' },
      },
    };

    expect(getNextStage(checkpoints, false)).toBe('render');
  });
});


describe('stage-utils pipeline versions', () => {
  const done = (at = '2026-01-01T00:00:00.000Z') => ({ completedAt: at });

  test('v2 routes ingest -> layout -> extract -> index -> assets', () => {
    expect(getNextStage({ stages: { ingest: done() } }, false, 'v2')).toBe('layout');
    expect(getFollowingStage('ingest', false, 'v2')).toBe('layout');
    expect(getFollowingStage('layout', false, 'v2')).toBe('extract');
    expect(getFollowingStage('index', false, 'v2')).toBe('assets');
    expect(getFollowingStage('assets', false, 'v2')).toBeNull();
  });

  test('v1 routing is unchanged and is the default', () => {
    const checkpoints = { stages: { ingest: done(), render: done() } };
    expect(getNextStage(checkpoints, false)).toBe('ocr');
    expect(getNextStage(checkpoints, false, 'v1')).toBe('ocr');
    expect(getFollowingStage('render', true)).toBe('extract');
    expect(getFollowingStage('ingest', false)).toBe('render');
  });

  test('an incomplete layout stage with finished batches is still the next stage', () => {
    const checkpoints: ProcessingCheckpoints = {
      stages: {
        ingest: done(),
        layout: { batches: { '1-5': { completedAt: '2026-01-01T00:00:00.000Z', pages: 5 } } },
      },
    };
    expect(getNextStage(checkpoints, false, 'v2')).toBe('layout');
  });

  test('resolvePipelineVersion keeps the pinned version, defaults new documents, and keeps legacy documents on v1', () => {
    expect(resolvePipelineVersion({ pipelineVersion: 'v2' }, 'v1')).toBe('v2');
    expect(resolvePipelineVersion({ pipelineVersion: 'v1' }, 'v2')).toBe('v1');
    expect(resolvePipelineVersion({}, 'v2')).toBe('v2');
    expect(resolvePipelineVersion({ checkpoints: { stages: {} } }, 'v2')).toBe('v2');
    expect(resolvePipelineVersion({ checkpoints: { stages: { ingest: done() } } }, 'v2')).toBe('v1');
  });

  test('planPageBatches covers every page once in contiguous ranges', () => {
    expect(planPageBatches(12, 5)).toEqual([
      { key: '1-5', start: 1, end: 5 },
      { key: '6-10', start: 6, end: 10 },
      { key: '11-12', start: 11, end: 12 },
    ]);
    expect(planPageBatches(0, 5)).toEqual([]);
    expect(planPageBatches(3, 0)).toHaveLength(3);
  });
});
