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
  metadata: z.record(z.unknown()).optional().default({}),
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
  metadata: z.record(z.unknown()).optional(),
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
