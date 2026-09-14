import { getNextStage, isStageComplete, ProcessingCheckpoints } from '../stage-utils';

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
});
