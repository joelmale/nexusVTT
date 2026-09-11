import { z } from 'zod';

const TextSelectionSchema = z.object({
  start: z.number(),
  end: z.number(),
  text: z.string(),
});

export const CreateReferenceSchema = z.object({
  documentId: z.string().uuid(),
  userId: z.string(),
  campaignId: z.string().optional(),
  pageNumber: z.number().int().positive().optional(),
  section: z.string().optional(),
  textSelection: TextSelectionSchema.optional(),
  title: z.string().min(1).max(255),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
  color: z.string().optional(),
  isShared: z.boolean().default(false),
});

export const UpdateReferenceSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  color: z.string().optional(),
  isShared: z.boolean().optional(),
  pageNumber: z.number().int().positive().optional(),
  section: z.string().optional(),
});

export const ListReferencesQuerySchema = z.object({
  documentId: z.string().uuid().optional(),
  userId: z.string().optional(),
  campaignId: z.string().optional(),
  skip: z.string().optional().default('0').transform(Number),
  limit: z.string().optional().default('50').transform(Number),
});

export type CreateReferenceInput = z.infer<typeof CreateReferenceSchema>;
export type UpdateReferenceInput = z.infer<typeof UpdateReferenceSchema>;
export type ListReferencesQuery = z.infer<typeof ListReferencesQuerySchema>;
