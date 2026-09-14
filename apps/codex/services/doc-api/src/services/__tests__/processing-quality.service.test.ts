import { buildProcessingIssues, buildProcessingSummary } from '../processing-quality.service';

const makeDoc = (overrides: Partial<any>) => ({
  id: 'doc-id',
  title: 'Doc Title',
  ocrStatus: 'completed',
  searchIndex: 'index-id',
  pageCount: 1,
  metadata: {},
  ...overrides,
});

describe('processing-quality.service', () => {
  it('builds summary metrics from processing metadata', () => {
    const docs = [
      makeDoc({
        id: 'doc-1',
        title: 'No Text',
        searchIndex: null,
        metadata: { processing: { textLength: 0 } },
      }),
      makeDoc({
        id: 'doc-2',
        title: 'Low Text',
        ocrStatus: 'pending',
        metadata: { processing: { textLength: 50 } },
      }),
      makeDoc({
        id: 'doc-3',
        title: 'Healthy',
        metadata: { processing: { textLength: 500 } },
      }),
    ];

    const summary = buildProcessingSummary(docs);

    expect(summary.totalDocuments).toBe(3);
    expect(summary.withText).toBe(2);
    expect(summary.noText).toBe(1);
    expect(summary.lowText).toBe(1);
    expect(summary.indexed).toBe(2);
    expect(summary.ocrPending).toBe(1);
    expect(summary.ocrFailed).toBe(0);
  });

  it('builds processing issues for text, indexing, and OCR problems', () => {
    const docs = [
      makeDoc({
        id: 'doc-1',
        title: 'No Text',
        searchIndex: null,
        metadata: { processing: { textLength: 0 } },
      }),
      makeDoc({
        id: 'doc-2',
        title: 'Low Text',
        ocrStatus: 'pending',
        metadata: { processing: { textLength: 50 } },
      }),
      makeDoc({
        id: 'doc-3',
        title: 'Healthy',
        metadata: { processing: { textLength: 500 } },
      }),
    ];

    const issues = buildProcessingIssues(docs);

    const issueTypes = issues.map(issue => issue.type);
    expect(issueTypes).toContain('missing_text');
    expect(issueTypes).toContain('missing_index');
    expect(issueTypes).toContain('low_text');
    expect(issueTypes).toContain('ocr_pending');
    expect(issueTypes).not.toContain('ocr_failed');
  });
});
