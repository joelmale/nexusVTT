export const LOW_TEXT_THRESHOLD = 200;

export interface ProcessingDocumentSnapshot {
  id: string;
  title: string;
  ocrStatus: string;
  searchIndex: string | null;
  pageCount: number;
  metadata: unknown;
}

export interface ProcessingSummary {
  totalDocuments: number;
  processed: number;
  processing: number;
  pending: number;
  failed: number;
  indexed: number;
  withText: number;
  noText: number;
  lowText: number;
  ocrPending: number;
  ocrFailed: number;
  lowTextThreshold: number;
  recentIssues: Array<{
    id: string;
    title: string;
    issue: string;
    textLength: number;
  }>;
}

export interface ProcessingIssue {
  id: string;
  documentId: string;
  title: string;
  type: 'missing_text' | 'low_text' | 'missing_index' | 'ocr_pending' | 'ocr_failed';
  severity: 'error' | 'warning';
  description: string;
  textLength: number;
  ocrStatus: string;
  indexed: boolean;
}

const getTextLength = (metadata: unknown): number => {
  const processing = (metadata as any)?.processing || {};
  return Number(processing.textLength || 0);
};

export const buildProcessingSummary = (documents: ProcessingDocumentSnapshot[]): ProcessingSummary => {
  let withText = 0;
  let noText = 0;
  let lowText = 0;
  let indexed = 0;
  let ocrPending = 0;
  let ocrFailed = 0;

  const recentIssues: ProcessingSummary['recentIssues'] = [];

  for (const doc of documents) {
    const textLength = getTextLength(doc.metadata);

    if (textLength > 0) {
      withText++;
      if (textLength < LOW_TEXT_THRESHOLD) {
        lowText++;
        recentIssues.push({
          id: doc.id,
          title: doc.title,
          issue: 'Low extracted text volume',
          textLength,
        });
      }
    } else {
      noText++;
      recentIssues.push({
        id: doc.id,
        title: doc.title,
        issue: 'No extracted text',
        textLength,
      });
    }

    if (doc.searchIndex) indexed++;
    if (doc.ocrStatus === 'pending') ocrPending++;
    if (doc.ocrStatus === 'failed') ocrFailed++;
  }

  return {
    totalDocuments: documents.length,
    processed: documents.filter(doc => doc.ocrStatus === 'completed').length,
    processing: documents.filter(doc => doc.ocrStatus === 'processing').length,
    pending: documents.filter(doc => doc.ocrStatus === 'pending').length,
    failed: documents.filter(doc => doc.ocrStatus === 'failed').length,
    indexed,
    withText,
    noText,
    lowText,
    ocrPending,
    ocrFailed,
    lowTextThreshold: LOW_TEXT_THRESHOLD,
    recentIssues: recentIssues.slice(0, 10),
  };
};

export const buildProcessingIssues = (documents: ProcessingDocumentSnapshot[]): ProcessingIssue[] => {
  const issues: ProcessingIssue[] = [];

  for (const doc of documents) {
    const textLength = getTextLength(doc.metadata);
    const indexed = !!doc.searchIndex;

    if (textLength === 0) {
      issues.push({
        id: `missing-text-${doc.id}`,
        documentId: doc.id,
        title: doc.title,
        type: 'missing_text',
        severity: 'error',
        description: 'No text was extracted from this document.',
        textLength,
        ocrStatus: doc.ocrStatus,
        indexed,
      });
    } else if (textLength < LOW_TEXT_THRESHOLD) {
      issues.push({
        id: `low-text-${doc.id}`,
        documentId: doc.id,
        title: doc.title,
        type: 'low_text',
        severity: 'warning',
        description: `Low extracted text volume (${textLength} chars).`,
        textLength,
        ocrStatus: doc.ocrStatus,
        indexed,
      });
    }

    if (!indexed) {
      issues.push({
        id: `missing-index-${doc.id}`,
        documentId: doc.id,
        title: doc.title,
        type: 'missing_index',
        severity: 'error',
        description: 'Document is not indexed in search.',
        textLength,
        ocrStatus: doc.ocrStatus,
        indexed,
      });
    }

    if (doc.ocrStatus === 'pending') {
      issues.push({
        id: `ocr-pending-${doc.id}`,
        documentId: doc.id,
        title: doc.title,
        type: 'ocr_pending',
        severity: 'warning',
        description: 'OCR is required but has not completed.',
        textLength,
        ocrStatus: doc.ocrStatus,
        indexed,
      });
    }

    if (doc.ocrStatus === 'failed') {
      issues.push({
        id: `ocr-failed-${doc.id}`,
        documentId: doc.id,
        title: doc.title,
        type: 'ocr_failed',
        severity: 'error',
        description: 'OCR failed during processing.',
        textLength,
        ocrStatus: doc.ocrStatus,
        indexed,
      });
    }
  }

  return issues;
};
