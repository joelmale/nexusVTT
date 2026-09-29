import {
  buildProcessingIssues,
  buildProcessingSummary,
} from '../processing-quality.service';

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

    const issueTypes = issues.map((issue) => issue.type);
    expect(issueTypes).toContain('missing_text');
    expect(issueTypes).toContain('missing_index');
    expect(issueTypes).toContain('low_text');
    expect(issueTypes).toContain('ocr_pending');
    expect(issueTypes).not.toContain('ocr_failed');
  });

  it('uses ocr textLength when primary textLength is low but OCR succeeded', () => {
    const docs = [
      makeDoc({
        id: '8720e758-4693-4e78-a0be-3f8d31d062a5',
        title: 'OCR Scanned Document',
        searchIndex: '8720e758-4693-4e78-a0be-3f8d31d062a5',
        ocrStatus: 'completed',
        metadata: {
          processing: {
            textLength: 124, // low layout text
            ocr: {
              status: 'completed',
              performed: true,
              textLength: 45000, // full OCR extracted text
            },
          },
        },
      }),
    ];

    const summary = buildProcessingSummary(docs);
    expect(summary.withText).toBe(1);
    expect(summary.lowText).toBe(0);
    expect(summary.noText).toBe(0);

    const issues = buildProcessingIssues(docs);
    expect(issues.length).toBe(0);
  });

  it('counts embedding models and flags documents whose vectors differ from the dominant model', () => {
    const withModel = (id: string, embeddingModel: string) =>
      makeDoc({ id, metadata: { processing: { textLength: 500, chunks: { count: 3, embeddingModel } } } });
    const docs = [
      withModel('doc-1', 'BAAI/bge-small-en-v1.5'),
      withModel('doc-2', 'BAAI/bge-small-en-v1.5'),
      withModel('doc-3', 'hash'),
      makeDoc({ id: 'doc-4', metadata: { processing: { textLength: 500 } } }),
    ];

    expect(buildProcessingSummary(docs).embeddingModels).toEqual({
      'BAAI/bge-small-en-v1.5': 2,
      hash: 1,
    });

    const issues = buildProcessingIssues(docs).filter((issue) => issue.type === 'embedding_model_mixed');
    expect(issues).toHaveLength(1);
    expect(issues[0].documentId).toBe('doc-3');
    expect(issues[0].severity).toBe('warning');
  });
});
