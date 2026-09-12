import { z } from 'zod';

// Annotation type enum
export const AnnotationTypeSchema = z.enum(['highlight', 'note', 'drawing']);
export type AnnotationType = z.infer<typeof AnnotationTypeSchema>;

// Position schema
export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
});
export type Position = z.infer<typeof PositionSchema>;

// Document annotation schema
export const DocumentAnnotationSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  referenceId: z.string().uuid().nullable(),
  userId: z.string(),
  campaignId: z.string().nullable(),
  pageNumber: z.number().int().positive(),
  position: PositionSchema,
  type: AnnotationTypeSchema,
  content: z.string(),
  color: z.string().default('#FFFF00'),
  isShared: z.boolean().default(false),
  createdAt: z.date(),
  modifiedAt: z.date(),
});
export type DocumentAnnotation = z.infer<typeof DocumentAnnotationSchema>;

// Create annotation input
export const CreateAnnotationSchema = z.object({
  documentId: z.string().uuid(),
  referenceId: z.string().uuid().optional(),
  userId: z.string(),
  campaignId: z.string().optional(),
  pageNumber: z.number().int().positive(),
  position: PositionSchema,
  type: AnnotationTypeSchema,
  content: z.string().min(0).max(10000),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).default('#FFFF00'),
  isShared: z.boolean().default(false),
});
export type CreateAnnotationInput = z.infer<typeof CreateAnnotationSchema>;

// Update annotation input
export const UpdateAnnotationSchema = z.object({
  content: z.string().min(0).max(10000).optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  position: PositionSchema.optional(),
  isShared: z.boolean().optional(),
});
export type UpdateAnnotationInput = z.infer<typeof UpdateAnnotationSchema>;

// Query parameters for listing annotations
export const ListAnnotationsQuerySchema = z.object({
  documentId: z.string().uuid().optional(),
  userId: z.string().optional(),
  campaignId: z.string().optional(),
  pageNumber: z.number().int().positive().optional(),
  type: AnnotationTypeSchema.optional(),
  isShared: z.boolean().optional(),
  limit: z.number().int().positive().max(100).default(50).optional(),
  offset: z.number().int().nonnegative().default(0).optional(),
});
export type ListAnnotationsQuery = z.infer<typeof ListAnnotationsQuerySchema>;
