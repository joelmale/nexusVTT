import { z } from 'zod';
import { DocumentTypeEnum } from './document';

// Admin document list query schema with enhanced filters
export const AdminListDocumentsQuerySchema = z.object({
  status: z.enum(['processing', 'completed', 'failed', 'indexed']).optional(),
  type: DocumentTypeEnum.optional(),
  uploadedBy: z.string().optional(),
  createdAfter: z.string().optional().transform((val) => val ? new Date(val) : undefined),
  createdBefore: z.string().optional().transform((val) => val ? new Date(val) : undefined),
  tags: z.array(z.string()).optional(),
  page: z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('50').transform(Number),
  sortBy: z.enum(['uploadedAt', 'lastModified', 'title', 'fileSize']).optional().default('uploadedAt'),
});

// Admin document update schema
export const AdminUpdateDocumentSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  type: DocumentTypeEnum.optional(),
  tags: z.array(z.string()).optional(),
  campaignId: z.string().optional(),
});

// Admin stats response
export const AdminStatsSchema = z.object({
  totalDocuments: z.number(),
  processingCount: z.number(),
  failedCount: z.number(),
  totalStorageBytes: z.number(),
  documentsByType: z.record(z.number()),
  recentUploads: z.array(z.object({
    id: z.string(),
    title: z.string(),
    createdAt: z.date(),
    status: z.string(),
  })),
  processingQueue: z.object({
    waiting: z.number(),
    active: z.number(),
    completed: z.number(),
    failed: z.number(),
  }),
});

// Admin user management schemas
export const AdminListUsersQuerySchema = z.object({
  skip: z.string().optional().default('0').transform(Number),
  take: z.string().optional().default('50').transform(Number),
  search: z.string().optional(),
  role: z.enum(['admin', 'user']).optional(),
  isActive: z.string().optional().transform(val => val === 'true'),
});

export const AdminCreateUserSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().optional(),
  role: z.enum(['admin', 'user']).optional().default('user'),
  isActive: z.boolean().optional().default(true),
});

export const AdminUpdateUserSchema = z.object({
  email: z.string().email().optional(),
  displayName: z.string().optional(),
  isActive: z.boolean().optional(),
  role: z.enum(['admin', 'user']).optional(),
});

export type AdminListDocumentsQuery = z.infer<typeof AdminListDocumentsQuerySchema>;
export type AdminUpdateDocumentInput = z.infer<typeof AdminUpdateDocumentSchema>;
export type AdminStats = z.infer<typeof AdminStatsSchema>;
export type AdminListUsersQuery = z.infer<typeof AdminListUsersQuerySchema>;
export type AdminCreateUserInput = z.infer<typeof AdminCreateUserSchema>;
export type AdminUpdateUserInput = z.infer<typeof AdminUpdateUserSchema>;