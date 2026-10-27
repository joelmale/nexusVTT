import { z } from 'zod';

export const DocumentTypeEnum = z.enum([
  'rulebook',
  'campaign_note',
  'handout',
  'map',
  'character_sheet',
  'homebrew'
]);

export const DocumentFormatEnum = z.enum(['pdf', 'markdown', 'html']);

export const OcrStatusEnum = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
  'not_required'
]);

// Request validation schemas
export const CreateDocumentSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional().default(''),
  type: DocumentTypeEnum,
  format: DocumentFormatEnum,
  author: z.string().optional().default(''),
  uploadedBy: z.string().min(1),
  tags: z.array(z.string()).optional().default([]),
  collections: z.array(z.string()).optional().default([]),
  campaigns: z.array(z.string()).optional().default([]),
  isPublic: z.boolean().optional().default(false),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
  fileSize: z.number().int().positive(),
  fileName: z.string().min(1),
});

export const UpdateDocumentSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  type: DocumentTypeEnum.optional(),
  author: z.string().optional(),
  tags: z.array(z.string()).optional(),
  collections: z.array(z.string()).optional(),
  campaigns: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const ListDocumentsQuerySchema = z.object({
  skip: z.string().optional().default('0').transform(Number),
  limit: z.string().optional().default('50').transform(Number),
  type: DocumentTypeEnum.optional(),
  campaign: z.string().optional(),
  tag: z.string().optional(),
  search: z.string().optional(),
});

export const BulkCreateDocumentSchema = z.object({
  documents: z.array(CreateDocumentSchema),
  batchId: z.string().optional(), // For tracking bulk operations
});

export type CreateDocumentInput = z.infer<typeof CreateDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof UpdateDocumentSchema>;
export type ListDocumentsQuery = z.infer<typeof ListDocumentsQuerySchema>;
export type BulkCreateDocumentInput = z.infer<typeof BulkCreateDocumentSchema>;

// Document-processing queue contract, shared by doc-api (producer) and
// doc-processor (consumer) so the job shape and queue names cannot drift.
export const DEFAULT_DOCUMENT_QUEUE_NAME = 'document-processing';
export const DEFAULT_ASSET_QUEUE_NAME = 'document-assets';

export const PROCESS_DOCUMENT_STAGES = [
  'ingest',
  'render',
  'ocr',
  'layout',
  'extract',
  'index',
  'assets',
] as const;

export type ProcessDocumentStage = (typeof PROCESS_DOCUMENT_STAGES)[number];

export interface ProcessDocumentJob {
  documentId: string;
  stage?: ProcessDocumentStage;
}

/**
 * Retry policy for document-processing jobs. Both producers (doc-api enqueues
 * `ingest`, doc-processor enqueues later stages) use it so a transient failure
 * retries no matter who created the job.
 */
export const DOCUMENT_JOB_DEFAULT_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: { age: 7 * 24 * 3600, count: 1000 },
  removeOnFail: { age: 30 * 24 * 3600 },
};

/**
 * Deterministic id for a document's ingest job, so a second enqueue while one
 * is waiting/active/delayed can be detected. No ':' (BullMQ rejects it).
 */
export const ingestJobId = (documentId: string): string => `ingest-${documentId}`;

export * from './settings';
