import { z } from 'zod';

// Structured data type enum
export const StructuredDataTypeSchema = z.enum(['spell', 'item', 'monster', 'feat', 'class_feature', 'other']);
export type StructuredDataType = z.infer<typeof StructuredDataTypeSchema>;

// Structured data schema
export const StructuredDataSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  type: StructuredDataTypeSchema,
  pageNumber: z.number().int().positive().nullable(),
  section: z.string().nullable(),
  name: z.string(),
  data: z.record(z.unknown()), // JSON object
  searchText: z.string(),
  searchIndex: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type StructuredData = z.infer<typeof StructuredDataSchema>;

// Query parameters for listing structured data
export const ListStructuredDataQuerySchema = z.object({
  documentId: z.string().uuid().optional(),
  type: StructuredDataTypeSchema.optional(),
  name: z.string().optional(),
  search: z.string().optional(),
  limit: z.number().int().positive().max(100).default(50).optional(),
  offset: z.number().int().nonnegative().default(0).optional(),
});
export type ListStructuredDataQuery = z.infer<typeof ListStructuredDataQuerySchema>;

// Quick search query (for spell/item/monster lookup)
export const QuickSearchQuerySchema = z.object({
  term: z.string().min(1),
  type: StructuredDataTypeSchema.optional(),
  campaign: z.string().optional(),
  limit: z.number().int().positive().max(20).default(5).optional(),
});
export type QuickSearchQuery = z.infer<typeof QuickSearchQuerySchema>;
